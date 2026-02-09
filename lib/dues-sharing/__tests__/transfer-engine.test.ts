import { describe, it, expect, vi, beforeEach } from 'vitest';

// ----------------------------------------------------------------
// Mocks — must be declared before the module under test is imported
// ----------------------------------------------------------------

vi.mock('@/lib/stripe/client', () => ({
  createTransfer: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { executeTransfer, executeTransfersForContribution } from '../transfer-engine';
import { createTransfer } from '@/lib/stripe/client';
import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

// ----------------------------------------------------------------
// Mock Supabase chain builder
// ----------------------------------------------------------------

type ChainResult = { data?: unknown; error?: unknown };

/**
 * Builds a mock Supabase query-builder chain.
 *
 * Every chainable method (select, eq, is, in, single, etc.) returns the same
 * object so `.from('x').update({}).eq('a','b').select(...)` works.
 *
 * `terminalResult` is what the *last* awaited call resolves to.
 */
function mockChain(terminalResult: ChainResult = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    'select',
    'eq',
    'is',
    'in',
    'single',
    'limit',
    'order',
    'update',
    'insert',
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  // Make the chain thenable so `await supabase.from(...).update(...).eq(...)` resolves
  (chain as Record<string, unknown>)['then'] = (resolve: (v: ChainResult) => void) =>
    resolve(terminalResult);
  return chain;
}

/**
 * Build a mock Supabase client where `.from(table)` returns the provided chain.
 * Accepts a map of table -> chain so different tables can have different behaviour.
 */
function mockSupabase(chains: Record<string, ReturnType<typeof mockChain>>) {
  return {
    from: vi.fn((table: string) => chains[table] ?? mockChain()),
  };
}

// ----------------------------------------------------------------
// Typed references to the mocked functions
// ----------------------------------------------------------------

const mockedCreateTransfer = createTransfer as ReturnType<typeof vi.fn>;
const mockedCreateServerClient = createServerClient as ReturnType<typeof vi.fn>;
const mockedLogger = logger as {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe('executeTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: calls Stripe with idempotency key and marks entry as transferred', async () => {
    const transferId = 'tr_test123';
    mockedCreateTransfer.mockResolvedValue({ id: transferId });

    // The function calls createServerClient(), then chains .from().update().eq()
    // Two Supabase calls happen inside executeTransfer on the happy path:
    //   1. (stripe fail branch — not reached here)
    //   2. update status='transferred'
    const ledgerChain = mockChain({ data: null, error: null });
    const supabase = mockSupabase({ rlc_split_ledger_entries: ledgerChain });
    mockedCreateServerClient.mockReturnValue(supabase);

    await executeTransfer({
      ledgerEntryId: 'entry-1',
      amountCents: 5000,
      destinationAccountId: 'acct_abc',
      transferGroup: 'tg-1',
    });

    // Stripe called with correct params including idempotency key
    expect(mockedCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 5000,
        destinationAccountId: 'acct_abc',
        transferGroup: 'tg-1',
        idempotencyKey: 'ledger-entry-1',
      })
    );

    // DB updated to 'transferred' with the stripe transfer ID
    expect(ledgerChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'transferred',
        stripe_transfer_id: transferId,
      })
    );
    expect(ledgerChain.eq).toHaveBeenCalledWith('id', 'entry-1');

    // Logged the successful transfer
    expect(mockedLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Transferred $50.00')
    );
  });

  it('skips when amountCents is 0 — no Stripe call', async () => {
    await executeTransfer({
      ledgerEntryId: 'entry-zero',
      amountCents: 0,
      destinationAccountId: 'acct_abc',
    });

    expect(mockedCreateTransfer).not.toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping zero/negative')
    );
  });

  it('marks entry as failed and throws when Stripe fails', async () => {
    const stripeError = new Error('Stripe outage');
    mockedCreateTransfer.mockRejectedValue(stripeError);

    const ledgerChain = mockChain({ data: null, error: null });
    const supabase = mockSupabase({ rlc_split_ledger_entries: ledgerChain });
    mockedCreateServerClient.mockReturnValue(supabase);

    await expect(
      executeTransfer({
        ledgerEntryId: 'entry-fail',
        amountCents: 1000,
        destinationAccountId: 'acct_abc',
      })
    ).rejects.toThrow('Stripe outage');

    // Entry marked as 'failed'
    expect(ledgerChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    );
    expect(ledgerChain.eq).toHaveBeenCalledWith('id', 'entry-fail');
  });

  it('logs RECONCILIATION NEEDED and throws when Stripe succeeds but DB update fails', async () => {
    const transferId = 'tr_test_recon';
    mockedCreateTransfer.mockResolvedValue({ id: transferId });

    const dbError = { message: 'DB connection lost', code: '500' };

    // The chain for the success-path update must resolve with an error
    const ledgerChain = mockChain({ data: null, error: dbError });
    const supabase = mockSupabase({ rlc_split_ledger_entries: ledgerChain });
    mockedCreateServerClient.mockReturnValue(supabase);

    await expect(
      executeTransfer({
        ledgerEntryId: 'entry-recon',
        amountCents: 2000,
        destinationAccountId: 'acct_abc',
      })
    ).rejects.toEqual(dbError);

    // Logged with transfer ID for reconciliation
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('RECONCILIATION NEEDED'),
      dbError
    );
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(transferId),
      dbError
    );

    // Must NOT have marked entry as 'failed' — the only update call should be
    // the 'transferred' attempt (which failed at the DB level, not Stripe level)
    const updateCalls = ledgerChain.update.mock.calls as Array<[Record<string, unknown>]>;
    const failedCalls = updateCalls.filter((call) => call[0]?.status === 'failed');
    expect(failedCalls).toHaveLength(0);
  });
});

describe('executeTransfersForContribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: build a mock Supabase client wired for executeTransfersForContribution.
   *
   * The function makes two distinct `.from()` calls:
   *   1. `rlc_split_ledger_entries` — update+eq+eq+select (atomic claim)
   *   2. `rlc_charter_stripe_accounts` — select+in+eq
   *
   * Per-entry operations also hit `rlc_split_ledger_entries` (revert or executeTransfer).
   */
  function buildContributionSupabase(params: {
    claimedEntries: unknown[] | null;
    claimError?: unknown;
    stripeAccounts: unknown[] | null;
  }) {
    // Track call count for rlc_split_ledger_entries to distinguish atomic claim
    // from per-entry operations
    let ledgerFromCallCount = 0;

    // Chain for the atomic claim (first .from('rlc_split_ledger_entries') call)
    const claimChain = mockChain({
      data: params.claimedEntries,
      error: params.claimError ?? null,
    });

    // Chain for per-entry revert operations
    const revertChain = mockChain({ data: null, error: null });

    // Chain for stripe accounts lookup
    const stripeAccountChain = mockChain({
      data: params.stripeAccounts,
      error: null,
    });

    // Chain for executeTransfer's internal Supabase calls (update after Stripe)
    const transferUpdateChain = mockChain({ data: null, error: null });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'rlc_charter_stripe_accounts') {
          return stripeAccountChain;
        }
        if (table === 'rlc_split_ledger_entries') {
          ledgerFromCallCount++;
          // Call 1 = atomic claim
          if (ledgerFromCallCount === 1) return claimChain;
          // Subsequent calls are per-entry operations (revert or transfer update)
          // We alternate between revert and transfer chains, but since they resolve
          // identically for success, a single chain works. For reverts specifically,
          // we return the revert chain.
          return revertChain;
        }
        return mockChain();
      }),
    };

    return { supabase, claimChain, revertChain, stripeAccountChain, transferUpdateChain };
  }

  it('atomically claims entries and processes charters with active Stripe accounts', async () => {
    const entries = [
      { id: 'e1', amount: 30, recipient_charter_id: 'charter-a', stripe_transfer_group_id: 'tg-1' },
      { id: 'e2', amount: 45, recipient_charter_id: 'charter-b', stripe_transfer_group_id: 'tg-1' },
    ];

    const stripeAccounts = [
      { charter_id: 'charter-a', stripe_account_id: 'acct_aaa' },
      { charter_id: 'charter-b', stripe_account_id: 'acct_bbb' },
    ];

    const { supabase, claimChain } = buildContributionSupabase({
      claimedEntries: entries,
      stripeAccounts,
    });

    mockedCreateServerClient.mockReturnValue(supabase);
    mockedCreateTransfer.mockResolvedValue({ id: 'tr_test123' });

    await executeTransfersForContribution('contrib-1');

    // Atomic claim: update to 'processing' where status='pending'
    expect(claimChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' })
    );
    expect(claimChain.eq).toHaveBeenCalledWith('contribution_id', 'contrib-1');
    expect(claimChain.eq).toHaveBeenCalledWith('status', 'pending');

    // Both entries triggered Stripe transfers
    expect(mockedCreateTransfer).toHaveBeenCalledTimes(2);
    expect(mockedCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 3000, // 30 * 100
        destinationAccountId: 'acct_aaa',
        idempotencyKey: 'ledger-e1',
      })
    );
    expect(mockedCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 4500, // 45 * 100
        destinationAccountId: 'acct_bbb',
        idempotencyKey: 'ledger-e2',
      })
    );
  });

  it('continues processing remaining entries when one fails', async () => {
    const entries = [
      { id: 'e1', amount: 30, recipient_charter_id: 'charter-a', stripe_transfer_group_id: null },
      { id: 'e2', amount: 45, recipient_charter_id: 'charter-b', stripe_transfer_group_id: null },
    ];

    const stripeAccounts = [
      { charter_id: 'charter-a', stripe_account_id: 'acct_aaa' },
      { charter_id: 'charter-b', stripe_account_id: 'acct_bbb' },
    ];

    const { supabase } = buildContributionSupabase({
      claimedEntries: entries,
      stripeAccounts,
    });

    mockedCreateServerClient.mockReturnValue(supabase);

    // First transfer fails, second succeeds
    mockedCreateTransfer
      .mockRejectedValueOnce(new Error('Stripe rate limit'))
      .mockResolvedValueOnce({ id: 'tr_ok' });

    // Should NOT throw — failures are caught per-entry
    await executeTransfersForContribution('contrib-2');

    // Both entries attempted
    expect(mockedCreateTransfer).toHaveBeenCalledTimes(2);

    // Error logged for the failed entry (non-fatal)
    expect(mockedLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Transfer failed for ledger entry e1'),
      expect.any(Error)
    );
  });

  it('no-ops when no pending entries are found', async () => {
    const { supabase } = buildContributionSupabase({
      claimedEntries: null,
      stripeAccounts: null,
    });

    mockedCreateServerClient.mockReturnValue(supabase);

    await executeTransfersForContribution('contrib-empty');

    // No Stripe calls
    expect(mockedCreateTransfer).not.toHaveBeenCalled();
  });

  it('reverts entry to pending when charter has no active Stripe account', async () => {
    const entries = [
      { id: 'e-no-stripe', amount: 50, recipient_charter_id: 'charter-no-acct', stripe_transfer_group_id: null },
    ];

    const { supabase, revertChain } = buildContributionSupabase({
      claimedEntries: entries,
      stripeAccounts: [], // no Stripe accounts at all
    });

    mockedCreateServerClient.mockReturnValue(supabase);

    await executeTransfersForContribution('contrib-3');

    // Entry reverted to 'pending'
    expect(revertChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    );
    expect(revertChain.eq).toHaveBeenCalledWith('id', 'e-no-stripe');

    // No Stripe transfer attempted
    expect(mockedCreateTransfer).not.toHaveBeenCalled();
  });
});
