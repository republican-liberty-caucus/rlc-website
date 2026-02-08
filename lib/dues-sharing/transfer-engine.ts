import { createTransfer } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

/**
 * Execute a Stripe transfer for a single ledger entry and update the entry.
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

  try {
    const transfer = await createTransfer({
      amount: amountCents,
      destinationAccountId,
      transferGroup,
      description: `Dues split - entry ${ledgerEntryId}`,
    });

    // Update ledger entry
    const { error: updateError } = await supabase
      .from('rlc_split_ledger_entries')
      .update({
        status: 'transferred',
        stripe_transfer_id: transfer.id,
        transferred_at: new Date().toISOString(),
      } as never)
      .eq('id', ledgerEntryId);

    if (updateError) {
      logger.error(`executeTransfer: Failed to update ledger entry ${ledgerEntryId}:`, updateError);
      throw updateError;
    }

    logger.info(`executeTransfer: Transferred $${(amountCents / 100).toFixed(2)} to ${destinationAccountId} (entry ${ledgerEntryId})`);
  } catch (error) {
    // Mark entry as failed
    await supabase
      .from('rlc_split_ledger_entries')
      .update({ status: 'failed' } as never)
      .eq('id', ledgerEntryId);

    throw error;
  }
}

/**
 * After a split is calculated and ledger entries are created,
 * attempt immediate transfers for chapters with active Stripe accounts.
 */
export async function executeTransfersForContribution(contributionId: string): Promise<void> {
  const supabase = createServerClient();

  // Get pending (non-National) ledger entries
  const { data: entries, error } = await supabase
    .from('rlc_split_ledger_entries')
    .select('id, amount, recipient_chapter_id, stripe_transfer_group_id')
    .eq('contribution_id', contributionId)
    .eq('status', 'pending');

  if (error || !entries || entries.length === 0) return;

  // Get Stripe accounts for all recipient chapters
  const chapterIds = [...new Set((entries as { recipient_chapter_id: string }[]).map((e) => e.recipient_chapter_id))];

  const { data: stripeAccounts } = await supabase
    .from('rlc_chapter_stripe_accounts')
    .select('chapter_id, stripe_account_id')
    .in('chapter_id', chapterIds)
    .eq('status', 'active');

  if (!stripeAccounts || stripeAccounts.length === 0) return;

  const accountMap = new Map<string, string>();
  for (const acct of stripeAccounts) {
    const row = acct as { chapter_id: string; stripe_account_id: string };
    accountMap.set(row.chapter_id, row.stripe_account_id);
  }

  for (const entry of entries) {
    const row = entry as {
      id: string;
      amount: number;
      recipient_chapter_id: string;
      stripe_transfer_group_id: string | null;
    };

    const stripeAccountId = accountMap.get(row.recipient_chapter_id);
    if (!stripeAccountId) continue; // Chapter not onboarded yet — stays pending

    try {
      await executeTransfer({
        ledgerEntryId: row.id,
        amountCents: Math.round(Number(row.amount) * 100),
        destinationAccountId: stripeAccountId,
        transferGroup: row.stripe_transfer_group_id || undefined,
      });
    } catch (transferError) {
      logger.error(`Transfer failed for ledger entry ${row.id} (non-fatal):`, transferError);
    }
  }
}
