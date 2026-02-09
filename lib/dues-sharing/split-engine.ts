import { NATIONAL_FLAT_FEE_CENTS, getNationalCharterId } from './constants';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { Charter, DisbursementModel, SplitSourceType } from '@/types';

// ─── Pure types ──────────────────────────────────────────────────────────────

export interface SplitAllocation {
  recipientCharterId: string;
  amountCents: number;
  isNational: boolean;
}

export interface SplitResult {
  allocations: SplitAllocation[];
  totalCents: number;
  splitRuleSnapshot: Record<string, unknown>;
}

export interface SplitRuleRow {
  recipient_charter_id: string;
  percentage: number;
  is_active: boolean;
}

export interface SplitConfigRow {
  disbursement_model: DisbursementModel;
  is_active: boolean;
}

// ─── Pure functions ──────────────────────────────────────────────────────────

/**
 * Calculate the split allocations for a membership payment.
 * National always gets a flat $15. Remainder goes to the state charter
 * (or sub-split per config). If no state charter exists, National keeps 100%.
 *
 * All amounts are in cents to avoid floating-point issues.
 */
export function calculateMembershipSplit(params: {
  totalCents: number;
  nationalCharterId: string;
  stateCharterId: string | null;
  splitConfig: SplitConfigRow | null;
  splitRules: SplitRuleRow[];
}): SplitResult {
  const { totalCents, nationalCharterId, stateCharterId, splitConfig, splitRules } = params;

  // No state charter → National keeps 100%
  if (!stateCharterId) {
    return {
      allocations: [{ recipientCharterId: nationalCharterId, amountCents: totalCents, isNational: true }],
      totalCents,
      splitRuleSnapshot: { reason: 'no_state_charter' },
    };
  }

  const nationalShare = Math.min(NATIONAL_FLAT_FEE_CENTS, totalCents);
  const remainder = totalCents - nationalShare;

  // If the payment is <= national fee, National gets it all
  if (remainder <= 0) {
    return {
      allocations: [{ recipientCharterId: nationalCharterId, amountCents: totalCents, isNational: true }],
      totalCents,
      splitRuleSnapshot: { reason: 'amount_lte_national_fee' },
    };
  }

  const allocations: SplitAllocation[] = [
    { recipientCharterId: nationalCharterId, amountCents: nationalShare, isNational: true },
  ];

  // No active config or state_managed → entire remainder to state
  if (!splitConfig?.is_active || splitConfig.disbursement_model === 'state_managed') {
    allocations.push({ recipientCharterId: stateCharterId, amountCents: remainder, isNational: false });
    return {
      allocations,
      totalCents,
      splitRuleSnapshot: {
        model: splitConfig?.disbursement_model || 'none',
        national_cents: nationalShare,
        state_remainder_cents: remainder,
      },
    };
  }

  // national_managed with sub-split rules
  const activeRules = splitRules.filter((r) => r.is_active);
  if (activeRules.length === 0) {
    // No rules configured yet → all remainder to state
    allocations.push({ recipientCharterId: stateCharterId, amountCents: remainder, isNational: false });
    return {
      allocations,
      totalCents,
      splitRuleSnapshot: { model: 'national_managed', reason: 'no_active_rules' },
    };
  }

  // Apply sub-split percentages with rounding
  const subAllocations = applyPercentageSplit(remainder, activeRules);
  allocations.push(...subAllocations);

  return {
    allocations,
    totalCents,
    splitRuleSnapshot: {
      model: 'national_managed',
      national_cents: nationalShare,
      rules: activeRules.map((r) => ({
        recipient: r.recipient_charter_id,
        percentage: r.percentage,
      })),
    },
  };
}

/**
 * Apply percentage-based sub-splits to a remainder amount.
 * Uses largest-remainder rounding to ensure pennies sum exactly.
 */
export function applyPercentageSplit(
  totalCents: number,
  rules: SplitRuleRow[]
): SplitAllocation[] {
  // Calculate raw (fractional) amounts
  const raw = rules.map((r) => ({
    recipientCharterId: r.recipient_charter_id,
    rawCents: (totalCents * r.percentage) / 100,
    isNational: false,
  }));

  // Floor each amount
  const floored = raw.map((r) => ({
    ...r,
    amountCents: Math.floor(r.rawCents),
    fractional: r.rawCents - Math.floor(r.rawCents),
  }));

  // Distribute leftover pennies via largest-remainder method
  const totalFloored = floored.reduce((sum, r) => sum + r.amountCents, 0);
  let leftover = totalCents - totalFloored;

  // Sort by fractional part descending — ties go to first recipient
  const sorted = [...floored].sort((a, b) => b.fractional - a.fractional);
  for (const entry of sorted) {
    if (leftover <= 0) break;
    entry.amountCents += 1;
    leftover -= 1;
  }

  return sorted.map(({ recipientCharterId, amountCents, isNational }) => ({
    recipientCharterId,
    amountCents,
    isNational,
  }));
}

// ─── Database functions ──────────────────────────────────────────────────────

/**
 * Walk the charter hierarchy upward from a given charter to find its state-level ancestor.
 * Returns null if no state charter exists in the hierarchy.
 */
export async function resolveStateCharter(charterId: string): Promise<string | null> {
  const supabase = createServerClient();

  // Fetch the charter and walk up
  let currentId: string | null = charterId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      logger.error(`Circular charter hierarchy detected at ${currentId}`);
      return null;
    }
    visited.add(currentId);

    const { data, error } = await supabase
      .from('rlc_charters')
      .select('id, charter_level, parent_charter_id')
      .eq('id', currentId)
      .single();

    if (error || !data) return null;

    const charter = data as Pick<Charter, 'id' | 'charter_level' | 'parent_charter_id'>;

    if (charter.charter_level === 'state') {
      return charter.id;
    }

    // If we hit national, there's no state charter in this path
    if (charter.charter_level === 'national') {
      return null;
    }

    currentId = charter.parent_charter_id;
  }

  return null;
}

/**
 * Process the dues split for a completed membership contribution.
 * Creates ledger entries for each recipient. Does NOT execute transfers
 * (that's the transfer engine's job in Phase 3).
 */
export async function processDuesSplit(contributionId: string): Promise<void> {
  const supabase = createServerClient();
  const nationalCharterId = getNationalCharterId();

  // Fetch the contribution
  interface ContributionRow {
    id: string;
    amount: number;
    currency: string;
    contribution_type: string;
    member_id: string | null;
    charter_id: string | null;
  }
  const { data: rawContribution, error: contribError } = await supabase
    .from('rlc_contributions')
    .select('id, amount, currency, contribution_type, member_id, charter_id')
    .eq('id', contributionId)
    .single();

  const contribution = rawContribution as ContributionRow | null;

  if (contribError || !contribution) {
    logger.error(`processDuesSplit: Contribution ${contributionId} not found`, contribError);
    return;
  }

  // Only split membership payments
  if (contribution.contribution_type !== 'membership') {
    return;
  }

  const totalCents = Math.round(Number(contribution.amount) * 100);
  if (totalCents <= 0) return;

  // Idempotency: check if ledger entries already exist
  const { data: existingEntries } = await supabase
    .from('rlc_split_ledger_entries')
    .select('id')
    .eq('contribution_id', contributionId)
    .limit(1);

  if (existingEntries && existingEntries.length > 0) {
    logger.info(`processDuesSplit: Ledger entries already exist for ${contributionId}, skipping`);
    return;
  }

  // Resolve member's state charter
  const memberCharterId = contribution.charter_id as string | null;
  let stateCharterId: string | null = null;

  if (memberCharterId) {
    stateCharterId = await resolveStateCharter(memberCharterId);
  }

  // Look up split config for the state charter
  let splitConfig: SplitConfigRow | null = null;
  let splitRules: SplitRuleRow[] = [];

  if (stateCharterId) {
    const { data: configData } = await supabase
      .from('rlc_charter_split_configs')
      .select('id, disbursement_model, is_active')
      .eq('charter_id', stateCharterId)
      .single();

    if (configData) {
      splitConfig = configData as SplitConfigRow;

      // Only fetch rules if national_managed
      if (splitConfig.is_active && splitConfig.disbursement_model === 'national_managed') {
        const configId = (configData as { id: string }).id;
        const { data: rules } = await supabase
          .from('rlc_charter_split_rules')
          .select('recipient_charter_id, percentage, is_active')
          .eq('config_id', configId)
          .order('sort_order', { ascending: true });

        splitRules = (rules || []) as SplitRuleRow[];
      }
    }
  }

  // Calculate the split
  const result = calculateMembershipSplit({
    totalCents,
    nationalCharterId,
    stateCharterId,
    splitConfig,
    splitRules,
  });

  // Generate a transfer group ID for correlating all entries from this payment
  const transferGroupId = `split_${contributionId}`;

  // Write ledger entries
  const sourceType: SplitSourceType = 'membership';
  const entries = result.allocations
    .filter((a) => a.amountCents > 0)
    .map((a) => ({
      contribution_id: contributionId,
      source_type: sourceType,
      recipient_charter_id: a.recipientCharterId,
      amount: a.amountCents / 100,
      currency: (contribution.currency as string) || 'USD',
      // National entries are "transferred" (money stays in platform account)
      status: a.isNational ? 'transferred' : 'pending',
      stripe_transfer_group_id: transferGroupId,
      transferred_at: a.isNational ? new Date().toISOString() : null,
      split_rule_snapshot: result.splitRuleSnapshot,
    }));

  if (entries.length === 0) return;

  const { error: insertError } = await supabase
    .from('rlc_split_ledger_entries')
    .insert(entries as never);

  if (insertError) {
    logger.error(`processDuesSplit: Failed to insert ledger entries for ${contributionId}:`, insertError);
    throw insertError;
  }

  logger.info(
    `processDuesSplit: Created ${entries.length} ledger entries for contribution ${contributionId} ` +
    `(total: $${(totalCents / 100).toFixed(2)})`
  );

  // Attempt immediate transfers for charters with active Stripe accounts
  try {
    const { executeTransfersForContribution } = await import('./transfer-engine');
    await executeTransfersForContribution(contributionId);
  } catch (transferError) {
    logger.error(`processDuesSplit: Transfer execution failed for ${contributionId} (non-fatal):`, transferError);
  }
}
