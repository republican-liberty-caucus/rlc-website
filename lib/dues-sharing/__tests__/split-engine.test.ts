import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateMembershipSplit, applyPercentageSplit } from '../split-engine';

const NATIONAL_ID = 'national-charter-uuid';
const STATE_ID = 'state-charter-uuid';
const REGION_ID = 'region-charter-uuid';
const COUNTY_ID = 'county-charter-uuid';

describe('calculateMembershipSplit', () => {
  it('gives 100% to National when no state charter exists', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: null,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({
      recipientCharterId: NATIONAL_ID,
      amountCents: 4500,
      isNational: true,
    });
  });

  it('gives National $15 and remainder to state for Individual ($45)', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]).toEqual({
      recipientCharterId: NATIONAL_ID,
      amountCents: 1500,
      isNational: true,
    });
    expect(result.allocations[1]).toEqual({
      recipientCharterId: STATE_ID,
      amountCents: 3000,
      isNational: false,
    });
    expect(result.allocations[0].amountCents + result.allocations[1].amountCents).toBe(4500);
  });

  it('gives National $15 and remainder to state for Student/Military ($30)', () => {
    const result = calculateMembershipSplit({
      totalCents: 3000,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(1500);
  });

  it('gives National $15 and remainder to state for Premium ($75)', () => {
    const result = calculateMembershipSplit({
      totalCents: 7500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(6000);
  });

  it('gives National $15 and remainder to state for Sustaining ($150)', () => {
    const result = calculateMembershipSplit({
      totalCents: 15000,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(13500);
  });

  it('gives National $15 and remainder to state for Roundtable ($1500)', () => {
    const result = calculateMembershipSplit({
      totalCents: 150000,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[1].amountCents).toBe(148500);
  });

  it('gives 100% to National when amount equals national fee', () => {
    const result = calculateMembershipSplit({
      totalCents: 1500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amountCents).toBe(1500);
    expect(result.allocations[0].recipientCharterId).toBe(NATIONAL_ID);
  });

  it('gives 100% to National when amount is less than national fee', () => {
    const result = calculateMembershipSplit({
      totalCents: 500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: null,
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].amountCents).toBe(500);
  });

  it('sends remainder to state when state_managed disbursement', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: { disbursement_model: 'state_managed', is_active: true },
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientCharterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('applies sub-split rules when national_managed', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [
        { recipient_charter_id: STATE_ID, percentage: 60, is_active: true },
        { recipient_charter_id: REGION_ID, percentage: 30, is_active: true },
        { recipient_charter_id: COUNTY_ID, percentage: 10, is_active: true },
      ],
    });

    // National gets $15 = 1500 cents
    expect(result.allocations[0].amountCents).toBe(1500);

    // Remainder = 3000 cents, split 60/30/10
    const subAllocations = result.allocations.slice(1);
    const totalSub = subAllocations.reduce((s, a) => s + a.amountCents, 0);
    expect(totalSub).toBe(3000);

    // 60% of 3000 = 1800
    const stateAlloc = subAllocations.find((a) => a.recipientCharterId === STATE_ID);
    expect(stateAlloc?.amountCents).toBe(1800);

    // 30% of 3000 = 900
    const regionAlloc = subAllocations.find((a) => a.recipientCharterId === REGION_ID);
    expect(regionAlloc?.amountCents).toBe(900);

    // 10% of 3000 = 300
    const countyAlloc = subAllocations.find((a) => a.recipientCharterId === COUNTY_ID);
    expect(countyAlloc?.amountCents).toBe(300);
  });

  it('falls back to state when national_managed but no active rules', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [],
    });

    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientCharterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('ignores inactive rules', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: true },
      splitRules: [
        { recipient_charter_id: STATE_ID, percentage: 100, is_active: true },
        { recipient_charter_id: REGION_ID, percentage: 50, is_active: false },
      ],
    });

    // Only active rule (state=100%) applies
    const subAllocations = result.allocations.slice(1);
    expect(subAllocations).toHaveLength(1);
    expect(subAllocations[0].recipientCharterId).toBe(STATE_ID);
    expect(subAllocations[0].amountCents).toBe(3000);
  });

  it('treats inactive config same as no config', () => {
    const result = calculateMembershipSplit({
      totalCents: 4500,
      nationalCharterId: NATIONAL_ID,
      stateCharterId: STATE_ID,
      splitConfig: { disbursement_model: 'national_managed', is_active: false },
      splitRules: [
        { recipient_charter_id: STATE_ID, percentage: 60, is_active: true },
        { recipient_charter_id: REGION_ID, percentage: 40, is_active: true },
      ],
    });

    // Inactive config → all remainder to state
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[1].recipientCharterId).toBe(STATE_ID);
    expect(result.allocations[1].amountCents).toBe(3000);
  });

  it('total allocations always sum to total payment', () => {
    const tiers = [3000, 4500, 7500, 15000, 35000, 75000, 150000];
    for (const totalCents of tiers) {
      const result = calculateMembershipSplit({
        totalCents,
        nationalCharterId: NATIONAL_ID,
        stateCharterId: STATE_ID,
        splitConfig: { disbursement_model: 'national_managed', is_active: true },
        splitRules: [
          { recipient_charter_id: STATE_ID, percentage: 50, is_active: true },
          { recipient_charter_id: REGION_ID, percentage: 30, is_active: true },
          { recipient_charter_id: COUNTY_ID, percentage: 20, is_active: true },
        ],
      });

      const sum = result.allocations.reduce((s, a) => s + a.amountCents, 0);
      expect(sum).toBe(totalCents);
    }
  });
});

describe('applyPercentageSplit', () => {
  it('splits evenly with no rounding issues', () => {
    const result = applyPercentageSplit(1000, [
      { recipient_charter_id: 'a', percentage: 50, is_active: true },
      { recipient_charter_id: 'b', percentage: 50, is_active: true },
    ]);

    expect(result).toHaveLength(2);
    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(1000);
    expect(result.find((r) => r.recipientCharterId === 'a')?.amountCents).toBe(500);
    expect(result.find((r) => r.recipientCharterId === 'b')?.amountCents).toBe(500);
  });

  it('handles rounding with largest-remainder method', () => {
    // 3333 cents split 33.33 / 33.33 / 33.34
    // Raw: 1110.89 / 1110.89 / 1111.22
    // Floor: 1110 / 1110 / 1111 = 3331
    // Leftover: 2 pennies → distributed to highest fractional
    const result = applyPercentageSplit(3333, [
      { recipient_charter_id: 'a', percentage: 33.33, is_active: true },
      { recipient_charter_id: 'b', percentage: 33.33, is_active: true },
      { recipient_charter_id: 'c', percentage: 33.34, is_active: true },
    ]);

    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(3333);
  });

  it('handles single recipient at 100%', () => {
    const result = applyPercentageSplit(4500, [
      { recipient_charter_id: 'a', percentage: 100, is_active: true },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(4500);
  });

  it('handles very uneven splits', () => {
    const result = applyPercentageSplit(10000, [
      { recipient_charter_id: 'a', percentage: 99.99, is_active: true },
      { recipient_charter_id: 'b', percentage: 0.01, is_active: true },
    ]);

    const total = result.reduce((s, a) => s + a.amountCents, 0);
    expect(total).toBe(10000);
  });
});

// ─── processDuesSplit integration tests ──────────────────────────────────────

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('../constants', () => ({
  NATIONAL_FLAT_FEE_CENTS: 1500,
  getNationalCharterId: () => 'national-uuid',
}));

vi.mock('../transfer-engine', () => ({
  executeTransfersForContribution: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/**
 * Build a chainable Supabase mock.
 *
 * `tableHandlers` maps table names to the result that the terminal method
 * (.single(), .limit(), the end of a select chain, or .insert()) should return.
 *
 * Each handler is `{ data, error? }`.  The builder tracks which table was
 * addressed by `.from()` and returns the corresponding result at the terminal.
 */
interface TableResponse {
  data: unknown;
  error?: { code?: string; message?: string } | null;
}

type TableHandlerFn = (callIndex: number) => TableResponse;
type TableHandler = TableResponse | TableHandlerFn;

function createMockSupabase(tableHandlers: Record<string, TableHandler | TableHandler[]>) {
  // Track how many times each table has been accessed (for ordered multi-call scenarios)
  const callCounts: Record<string, number> = {};

  function resolveHandler(table: string): TableResponse {
    const handler = tableHandlers[table];
    if (!handler) {
      return { data: null, error: null };
    }

    const idx = callCounts[table] ?? 0;
    callCounts[table] = idx + 1;

    if (Array.isArray(handler)) {
      const entry = handler[idx] ?? handler[handler.length - 1];
      if (typeof entry === 'function') return entry(idx);
      return entry;
    }

    if (typeof handler === 'function') return handler(idx);
    return handler;
  }

  function makeChain(table: string) {
    const chain: Record<string, unknown> = {};
    const terminal = () => resolveHandler(table);

    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockImplementation(() => terminal());
    chain.order = vi.fn().mockImplementation(() => terminal());
    chain.single = vi.fn().mockImplementation(() => terminal());
    chain.insert = vi.fn().mockImplementation(() => resolveHandler(`${table}:insert`));

    return chain;
  }

  return {
    from: vi.fn().mockImplementation((table: string) => makeChain(table)),
  };
}

describe('processDuesSplit', () => {
  let mockExecuteTransfers: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the dynamic import mock
    const transferEngine = await import('../transfer-engine');
    mockExecuteTransfers = transferEngine.executeTransfersForContribution as ReturnType<typeof vi.fn>;
    mockExecuteTransfers.mockResolvedValue(undefined);
  });

  async function importAndRun(contributionId: string) {
    // Re-import to pick up fresh mocks each time
    const { processDuesSplit } = await import('../split-engine');
    return processDuesSplit(contributionId);
  }

  it('creates 2 ledger entries for membership with state charter (happy path)', async () => {
    const mockSb = createMockSupabase({
      // 1) Fetch contribution
      rlc_contributions: {
        data: {
          id: 'contrib-1',
          amount: 45,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: 'county-charter-uuid',
        },
      },
      // 2) Idempotency check (no existing entries), then insert
      rlc_split_ledger_entries: [
        { data: [], error: null },
      ],
      'rlc_split_ledger_entries:insert': { data: null, error: null },
      // 3) resolveStateCharter walks hierarchy: county → state
      rlc_charters: [
        { data: { id: 'county-charter-uuid', charter_level: 'county', parent_charter_id: 'state-charter-uuid' } },
        { data: { id: 'state-charter-uuid', charter_level: 'state', parent_charter_id: 'national-uuid' } },
      ],
      // 4) Split config lookup (none configured → default split)
      rlc_charter_split_configs: { data: null, error: { code: 'PGRST116', message: 'not found' } },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-1');

    // Verify insert was called on ledger entries
    const insertCalls = mockSb.from.mock.calls.filter(
      (call) => call[0] === 'rlc_split_ledger_entries'
    );
    // Should have been called at least twice: once for idempotency check, once for chain leading to insert
    expect(insertCalls.length).toBeGreaterThanOrEqual(2);

    // Find the chain that had .insert() called on it (the second call to rlc_split_ledger_entries)
    const lastLedgerChain = mockSb.from.mock.results.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, idx: number) =>
        mockSb.from.mock.calls[idx][0] === 'rlc_split_ledger_entries' && result.value.insert.mock.calls.length > 0
    );
    expect(lastLedgerChain).toBeDefined();

    const insertedEntries = lastLedgerChain!.value.insert.mock.calls[0][0];
    expect(insertedEntries).toHaveLength(2);

    // National entry: $15, status='transferred'
    const nationalEntry = insertedEntries.find(
      (e: { recipient_charter_id: string }) => e.recipient_charter_id === 'national-uuid'
    );
    expect(nationalEntry.amount).toBe(15);
    expect(nationalEntry.status).toBe('transferred');

    // State entry: $30, status='pending'
    const stateEntry = insertedEntries.find(
      (e: { recipient_charter_id: string }) => e.recipient_charter_id === 'state-charter-uuid'
    );
    expect(stateEntry.amount).toBe(30);
    expect(stateEntry.status).toBe('pending');

    // Transfer engine should have been invoked
    expect(mockExecuteTransfers).toHaveBeenCalledWith('contrib-1');
  });

  it('skips processing when ledger entries already exist (idempotency)', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-2',
          amount: 45,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: 'some-charter',
        },
      },
      // Idempotency check returns existing entry
      rlc_split_ledger_entries: { data: [{ id: 'existing-entry' }], error: null },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-2');

    // No insert should have been called — the function returned early
    const allCalls = mockSb.from.mock.calls;
    const ledgerInsertChains = allCalls
      .map((_: unknown, idx: number) => mockSb.from.mock.results[idx].value)
      .filter((chain: { insert: ReturnType<typeof vi.fn> }) => chain.insert.mock.calls.length > 0);
    expect(ledgerInsertChains).toHaveLength(0);

    // Transfer engine should NOT have been called
    expect(mockExecuteTransfers).not.toHaveBeenCalled();
  });

  it('returns early for non-membership contributions', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-3',
          amount: 100,
          currency: 'USD',
          contribution_type: 'donation',
          member_id: 'member-1',
          charter_id: 'some-charter',
        },
      },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-3');

    // Should not reach idempotency check or insert
    const ledgerCalls = mockSb.from.mock.calls.filter(
      (call) => call[0] === 'rlc_split_ledger_entries'
    );
    expect(ledgerCalls).toHaveLength(0);
    expect(mockExecuteTransfers).not.toHaveBeenCalled();
  });

  it('returns early when amount is zero', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-4',
          amount: 0,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: 'some-charter',
        },
      },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-4');

    const ledgerCalls = mockSb.from.mock.calls.filter(
      (call) => call[0] === 'rlc_split_ledger_entries'
    );
    expect(ledgerCalls).toHaveLength(0);
    expect(mockExecuteTransfers).not.toHaveBeenCalled();
  });

  it('allocates 100% to National when member has no charter_id', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-5',
          amount: 45,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: null,
        },
      },
      rlc_split_ledger_entries: [
        { data: [], error: null },
      ],
      'rlc_split_ledger_entries:insert': { data: null, error: null },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-5');

    // Find the insert call
    const insertChain = mockSb.from.mock.results.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, idx: number) =>
        mockSb.from.mock.calls[idx][0] === 'rlc_split_ledger_entries' && result.value.insert.mock.calls.length > 0
    );
    expect(insertChain).toBeDefined();

    const insertedEntries = insertChain!.value.insert.mock.calls[0][0];

    // Only one entry — all to National
    expect(insertedEntries).toHaveLength(1);
    expect(insertedEntries[0].recipient_charter_id).toBe('national-uuid');
    expect(insertedEntries[0].amount).toBe(45);
    expect(insertedEntries[0].status).toBe('transferred');
  });

  it('still creates ledger entries when transfer engine throws (non-fatal)', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-6',
          amount: 45,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: null,
        },
      },
      rlc_split_ledger_entries: [
        { data: [], error: null },
      ],
      'rlc_split_ledger_entries:insert': { data: null, error: null },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    // Make the transfer engine throw
    mockExecuteTransfers.mockRejectedValue(new Error('Stripe unavailable'));

    // Should NOT throw — the error is caught internally
    await expect(importAndRun('contrib-6')).resolves.toBeUndefined();

    // Ledger insert should still have happened before the transfer attempt
    const insertChain = mockSb.from.mock.results.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, idx: number) =>
        mockSb.from.mock.calls[idx][0] === 'rlc_split_ledger_entries' && result.value.insert.mock.calls.length > 0
    );
    expect(insertChain).toBeDefined();
    expect(insertChain!.value.insert.mock.calls[0][0]).toHaveLength(1);
  });

  it('returns early when amount is NaN (totalCents <= 0 after Math.round)', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-7',
          amount: NaN,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: 'some-charter',
        },
      },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-7');

    // NaN * 100 = NaN, Math.round(NaN) = NaN, NaN <= 0 is false... but let's verify behavior
    // Actually: NaN <= 0 evaluates to false in JS, so it would NOT early return on the <= 0 check.
    // However, the function would proceed and calculateMembershipSplit would get NaN totalCents.
    // Let's check: with no charter_id it allocates NaN cents to national, then filters amountCents > 0
    // which NaN > 0 is false, so entries would be empty, and entries.length === 0 → early return.
    // Either way, no insert should happen.
    const ledgerInsertChains = mockSb.from.mock.calls
      .map((_: unknown, idx: number) => mockSb.from.mock.results[idx].value)
      .filter((chain: { insert: ReturnType<typeof vi.fn> }) => chain.insert.mock.calls.length > 0);
    expect(ledgerInsertChains).toHaveLength(0);
    expect(mockExecuteTransfers).not.toHaveBeenCalled();
  });

  it('sets status=transferred for national entries and status=pending for non-national', async () => {
    const mockSb = createMockSupabase({
      rlc_contributions: {
        data: {
          id: 'contrib-8',
          amount: 45,
          currency: 'USD',
          contribution_type: 'membership',
          member_id: 'member-1',
          charter_id: 'state-charter-uuid',
        },
      },
      rlc_split_ledger_entries: [
        { data: [], error: null },
      ],
      'rlc_split_ledger_entries:insert': { data: null, error: null },
      // charter_id is already state-level
      rlc_charters: [
        { data: { id: 'state-charter-uuid', charter_level: 'state', parent_charter_id: 'national-uuid' } },
      ],
      rlc_charter_split_configs: { data: null, error: { code: 'PGRST116', message: 'not found' } },
    });

    const { createServerClient } = await import('@/lib/supabase/server');
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

    await importAndRun('contrib-8');

    const insertChain = mockSb.from.mock.results.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result: any, idx: number) =>
        mockSb.from.mock.calls[idx][0] === 'rlc_split_ledger_entries' && result.value.insert.mock.calls.length > 0
    );
    expect(insertChain).toBeDefined();

    const entries = insertChain!.value.insert.mock.calls[0][0];
    expect(entries).toHaveLength(2);

    // National entry
    const nationalEntry = entries.find(
      (e: { recipient_charter_id: string }) => e.recipient_charter_id === 'national-uuid'
    );
    expect(nationalEntry).toBeDefined();
    expect(nationalEntry.status).toBe('transferred');
    expect(nationalEntry.transferred_at).toBeTruthy();
    expect(nationalEntry.amount).toBe(15);

    // State entry
    const stateEntry = entries.find(
      (e: { recipient_charter_id: string }) => e.recipient_charter_id === 'state-charter-uuid'
    );
    expect(stateEntry).toBeDefined();
    expect(stateEntry.status).toBe('pending');
    expect(stateEntry.transferred_at).toBeNull();
    expect(stateEntry.amount).toBe(30);

    // Both entries should have the same transfer group
    expect(nationalEntry.stripe_transfer_group_id).toBe(stateEntry.stripe_transfer_group_id);
    expect(nationalEntry.stripe_transfer_group_id).toBe('split_contrib-8');
  });
});
