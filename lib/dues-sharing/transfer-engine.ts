import { createTransfer } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type Stripe from 'stripe';

/**
 * Execute a Stripe transfer for a single ledger entry and update the entry.
 * Separates Stripe call from DB update to avoid losing transfer IDs on DB failure.
 */
export async function executeTransfer(params: {
  ledgerEntryId: string;
  amountCents: number;
  destinationAccountId: string;
  transferGroup?: string;
}): Promise<void> {
  const { ledgerEntryId, amountCents, destinationAccountId, transferGroup } = params;

  if (amountCents <= 0) {
    logger.warn(`executeTransfer: Skipping zero/negative amount for entry ${ledgerEntryId}`);
    return;
  }

  const supabase = createServerClient();

  // Step 1: Attempt Stripe transfer
  let transfer: Stripe.Transfer;
  try {
    transfer = await createTransfer({
      amount: amountCents,
      destinationAccountId,
      transferGroup,
      description: `Dues split - entry ${ledgerEntryId}`,
      idempotencyKey: `ledger-${ledgerEntryId}`,
    });
  } catch (stripeError) {
    // Stripe transfer failed — safe to mark as failed
    await supabase
      .from('rlc_split_ledger_entries')
      .update({ status: 'failed' } as never)
      .eq('id', ledgerEntryId);
    throw stripeError;
  }

  // Step 2: Stripe succeeded — try DB update
  const { error: updateError } = await supabase
    .from('rlc_split_ledger_entries')
    .update({
      status: 'transferred',
      stripe_transfer_id: transfer.id,
      transferred_at: new Date().toISOString(),
    } as never)
    .eq('id', ledgerEntryId);

  if (updateError) {
    // CRITICAL: Money was sent but DB update failed. Log transfer ID for reconciliation.
    logger.error(
      `RECONCILIATION NEEDED: Transfer ${transfer.id} succeeded for entry ${ledgerEntryId} but DB update failed:`,
      updateError
    );
    throw updateError;
  }

  logger.info(
    `executeTransfer: Transferred $${(amountCents / 100).toFixed(2)} to ${destinationAccountId} (entry ${ledgerEntryId}, transfer ${transfer.id})`
  );
}

/**
 * After a split is calculated and ledger entries are created,
 * attempt immediate transfers for charters with active Stripe accounts.
 * Uses atomic claim pattern to prevent duplicate transfers from concurrent calls.
 */
export async function executeTransfersForContribution(contributionId: string): Promise<void> {
  const supabase = createServerClient();

  // Atomic claim: UPDATE status to 'processing' WHERE status='pending', then SELECT
  const { data: entries, error } = await supabase
    .from('rlc_split_ledger_entries')
    .update({ status: 'processing' } as never)
    .eq('contribution_id', contributionId)
    .eq('status', 'pending')
    .select('id, amount, recipient_charter_id, stripe_transfer_group_id');

  if (error || !entries || entries.length === 0) return;

  // Get Stripe accounts for all recipient charters
  const charterIds = [...new Set((entries as { recipient_charter_id: string }[]).map((e) => e.recipient_charter_id))];

  const { data: stripeAccounts } = await supabase
    .from('rlc_charter_stripe_accounts')
    .select('charter_id, stripe_account_id')
    .in('charter_id', charterIds)
    .eq('status', 'active');

  const accountMap = new Map<string, string>();
  if (stripeAccounts) {
    for (const acct of stripeAccounts) {
      const row = acct as { charter_id: string; stripe_account_id: string };
      accountMap.set(row.charter_id, row.stripe_account_id);
    }
  }

  for (const entry of entries) {
    const row = entry as {
      id: string;
      amount: number;
      recipient_charter_id: string;
      stripe_transfer_group_id: string | null;
    };

    const stripeAccountId = accountMap.get(row.recipient_charter_id);
    if (!stripeAccountId) {
      // Charter not onboarded yet — revert to pending so drain can pick it up later
      await supabase
        .from('rlc_split_ledger_entries')
        .update({ status: 'pending' } as never)
        .eq('id', row.id);
      continue;
    }

    try {
      await executeTransfer({
        ledgerEntryId: row.id,
        amountCents: Math.round(Number(row.amount) * 100),
        destinationAccountId: stripeAccountId,
        transferGroup: row.stripe_transfer_group_id || undefined,
      });
    } catch (transferError) {
      logger.error(`Transfer failed for ledger entry ${row.id} (non-fatal):`, transferError);
      // executeTransfer already marks entry as 'failed' on Stripe error
    }
  }
}
