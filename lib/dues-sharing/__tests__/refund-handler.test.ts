/**
 * Tests for the charge.refunded handler (handleChargeRefunded) in the Stripe webhook route.
 *
 * handleChargeRefunded is a private function inside app/api/webhooks/stripe/route.ts.
 * We test it through the exported POST handler by crafting Stripe charge.refunded events
 * and mocking the infrastructure (Stripe signature verification, Supabase, Stripe transfers).
 */
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() runs BEFORE vi.mock() factories, which
// themselves are hoisted above all imports. This ensures mockReverseTransfer
// exists when the '@/lib/stripe/client' factory references it.
// ---------------------------------------------------------------------------

const { mockReverseTransfer, mockStripeEventRef } = vi.hoisted(() => {
  return {
    mockReverseTransfer: vi.fn(),
    mockStripeEventRef: { current: null as Record<string, unknown> | null },
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'stripe-signature' ? 'test_sig_valid' : null),
  }),
}));

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));

vi.mock('@/lib/highlevel/client', () => ({ syncMemberToHighLevel: vi.fn() }));
vi.mock('@/lib/highlevel/notifications', () => ({ triggerWelcomeSequence: vi.fn() }));
vi.mock('@/lib/dues-sharing/split-engine', () => ({ processDuesSplit: vi.fn() }));

vi.mock('@/lib/stripe/client', () => ({
  getStripe: vi.fn(() => ({
    webhooks: {
      constructEvent: vi.fn(() => mockStripeEventRef.current),
    },
  })),
  reverseTransfer: mockReverseTransfer,
  MEMBERSHIP_TIERS: [],
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the route handler AFTER all mocks are set up
// ---------------------------------------------------------------------------
import { POST } from '@/app/api/webhooks/stripe/route';
import { createServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Supabase mock infrastructure
// ---------------------------------------------------------------------------

interface SupabaseMockConfig {
  /** rlc_contributions lookup result */
  contribution?: { data: Record<string, unknown> | null; error: Record<string, unknown> | null };
  /** rlc_split_ledger_entries (original entries, reversal_of_id IS NULL) */
  ledgerEntries?: { data: Record<string, unknown>[] | null; error: Record<string, unknown> | null };
  /** rlc_split_ledger_entries (existing reversals, reversal_of_id IS NOT NULL) */
  existingReversals?: { data: Record<string, unknown>[] | null; error: Record<string, unknown> | null };
  /** rlc_webhook_events insert result (idempotency) */
  webhookIdempotency?: { error: Record<string, unknown> | null };
}

/** Tracks all insert/update calls made to the mock Supabase client */
interface SupabaseMockTracker {
  insertCalls: Array<{ table: string; data: unknown }>;
  updateCalls: Array<{ table: string; data: unknown; filters: Record<string, unknown> }>;
}

/**
 * Creates a mock Supabase client that tracks calls and returns configured data.
 *
 * The mock correctly handles the chaining pattern used throughout the codebase:
 *   .from('table').select('cols').eq('col', val).is('col', null).single()
 *
 * It distinguishes between:
 * - rlc_contributions lookups (via .single())
 * - rlc_split_ledger_entries original entries (via .is('reversal_of_id', null))
 * - rlc_split_ledger_entries existing reversals (via .not('reversal_of_id', 'is', null))
 * - Insert and update mutations (tracked in the tracker object)
 */
function createMockSupabase(config: SupabaseMockConfig) {
  const tracker: SupabaseMockTracker = {
    insertCalls: [],
    updateCalls: [],
  };

  // Per-query state — reset on each .from() call
  let currentTable = '';
  let isUpdateCall = false;
  let currentFilters: Record<string, unknown> = {};
  let isNullFilter = false;
  let notNullFilter = false;

  function resetQueryState() {
    isNullFilter = false;
    notNullFilter = false;
    isUpdateCall = false;
    currentFilters = {};
  }

  // Build a single shared chainable object. Every method returns `chain`
  // so the real code can call `.from().select().eq().is().single()` etc.
  // Terminal resolution happens via .single() or implicit await (thenable).
  const chain: Record<string, unknown> = {};

  chain.select = vi.fn(() => chain);

  chain.eq = vi.fn((col: string, val: unknown) => {
    currentFilters[col] = val;
    return chain;
  });

  chain.is = vi.fn((_col: string, _val: unknown) => {
    isNullFilter = true;
    return chain;
  });

  chain.not = vi.fn((_col: string, _op: string, _val: unknown) => {
    notNullFilter = true;
    return chain;
  });

  chain.limit = vi.fn(() => chain);

  chain.single = vi.fn(() => {
    if (currentTable === 'rlc_contributions') {
      const result = config.contribution ?? { data: null, error: { code: 'PGRST116' } };
      resetQueryState();
      return result;
    }
    // For webhook_events or any other .single() call, return empty success
    resetQueryState();
    return { data: null, error: null };
  });

  chain.insert = vi.fn((data: unknown) => {
    tracker.insertCalls.push({ table: currentTable, data });
    if (currentTable === 'rlc_webhook_events') {
      // The webhook idempotency insert is destructured as { error }
      // and doesn't chain further in the real code. Return a thenable
      // that resolves with the configured error.
      const result = { data: null, error: config.webhookIdempotency?.error ?? null };
      const webhookChain: Record<string, unknown> = { ...chain };
      webhookChain.then = (
        resolve: (val: unknown) => unknown,
        reject?: (err: unknown) => unknown
      ) => Promise.resolve(result).then(resolve, reject);
      // Also support direct .error access for sync destructuring
      (webhookChain as Record<string, unknown>).error = result.error;
      return webhookChain;
    }
    return chain;
  });

  chain.update = vi.fn((data: unknown) => {
    tracker.updateCalls.push({ table: currentTable, data, filters: { ...currentFilters } });
    isUpdateCall = true;
    return chain;
  });

  // Make the chain thenable so `const { data, error } = await supabase.from(...).select(...).eq(...)...`
  // resolves correctly for non-.single() queries.
  chain.then = (
    resolve: (val: unknown) => unknown,
    reject?: (err: unknown) => unknown
  ) => {
    let result: { data: unknown; error: unknown };

    if (currentTable === 'rlc_split_ledger_entries') {
      if (isUpdateCall) {
        isUpdateCall = false;
        result = { data: null, error: null };
      } else if (isNullFilter) {
        result = config.ledgerEntries ?? { data: [], error: null };
      } else if (notNullFilter) {
        result = config.existingReversals ?? { data: [], error: null };
      } else {
        result = { data: [], error: null };
      }
    } else if (currentTable === 'rlc_contributions' && isUpdateCall) {
      isUpdateCall = false;
      result = { data: null, error: null };
    } else if (currentTable === 'rlc_webhook_events') {
      result = { data: null, error: config.webhookIdempotency?.error ?? null };
    } else {
      result = { data: null, error: null };
    }

    resetQueryState();
    return Promise.resolve(result).then(resolve, reject);
  };

  const supabase = {
    from: vi.fn((table: string) => {
      currentTable = table;
      resetQueryState();
      return chain;
    }),
  };

  return { supabase, tracker };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set the mock Stripe event that constructEvent will return */
function setMockStripeEvent(event: Record<string, unknown>) {
  mockStripeEventRef.current = event;
}

/** Build a Stripe charge.refunded event */
function buildChargeRefundedEvent(overrides: {
  paymentIntent?: string | null;
  amountRefunded?: number;
  amountTotal?: number;
}) {
  return {
    id: `evt_test_${Date.now()}`,
    type: 'charge.refunded',
    data: {
      object: {
        id: 'ch_test_123',
        payment_intent: overrides.paymentIntent ?? 'pi_test_abc',
        amount: overrides.amountTotal ?? 4500,
        amount_refunded: overrides.amountRefunded ?? 4500,
      },
    },
  };
}

/** Create a mock Request with body text */
function buildRequest(body = '{}') {
  return new Request('https://localhost/api/webhooks/stripe', {
    method: 'POST',
    body,
    headers: { 'stripe-signature': 'test_sig_valid' },
  });
}

// ---------------------------------------------------------------------------
// Shared test IDs
// ---------------------------------------------------------------------------

const CONTRIBUTION_ID = 'contrib-uuid-001';
const NATIONAL_ENTRY_ID = 'entry-national-001';
const STATE_ENTRY_ID = 'entry-state-001';
const NATIONAL_CHARTER_ID = 'charter-national-001';
const STATE_CHARTER_ID = 'charter-state-001';
const NATIONAL_TRANSFER_ID = 'tr_national_001';
const STATE_TRANSFER_ID = 'tr_state_001';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleChargeRefunded (via POST handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReverseTransfer.mockResolvedValue({ id: 'trr_test' });

    // Set env var so the handler does not bail
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  // =========================================================================
  // 1. Full refund: both transferred entries get reversed
  // =========================================================================
  it('reverses all transferred entries and marks contribution refunded on full refund', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'transferred',
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
          {
            id: STATE_ENTRY_ID,
            amount: 30,
            status: 'transferred',
            stripe_transfer_id: STATE_TRANSFER_ID,
            recipient_charter_id: STATE_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 4500, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // Both Stripe transfers should be reversed
    expect(mockReverseTransfer).toHaveBeenCalledTimes(2);
    expect(mockReverseTransfer).toHaveBeenCalledWith(NATIONAL_TRANSFER_ID);
    expect(mockReverseTransfer).toHaveBeenCalledWith(STATE_TRANSFER_ID);

    // Should insert 2 reversal ledger entries
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerInserts).toHaveLength(2);

    // Both reversals should have negative amounts
    for (const insert of ledgerInserts) {
      const data = insert.data as Record<string, unknown>;
      expect(Number(data.amount)).toBeLessThan(0);
      expect(data.status).toBe('reversed');
      expect(data.contribution_id).toBe(CONTRIBUTION_ID);
    }

    // Should update original entries to 'reversed'
    const entryUpdates = tracker.updateCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(entryUpdates.length).toBeGreaterThanOrEqual(2);
    for (const update of entryUpdates) {
      const data = update.data as Record<string, unknown>;
      expect(data.status).toBe('reversed');
    }

    // Should update contribution to 'refunded'
    const contribUpdates = tracker.updateCalls.filter(
      (c) => c.table === 'rlc_contributions'
    );
    expect(contribUpdates).toHaveLength(1);
    expect((contribUpdates[0].data as Record<string, unknown>).payment_status).toBe('refunded');
  });

  // =========================================================================
  // 2. Full refund with mixed statuses (transferred + pending)
  // =========================================================================
  it('handles mixed entry statuses: reverses transferred via Stripe, reverses pending directly', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'transferred',
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
          {
            id: STATE_ENTRY_ID,
            amount: 30,
            status: 'pending',
            stripe_transfer_id: null,
            recipient_charter_id: STATE_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 4500, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // Only the transferred entry should trigger a Stripe reversal
    expect(mockReverseTransfer).toHaveBeenCalledTimes(1);
    expect(mockReverseTransfer).toHaveBeenCalledWith(NATIONAL_TRANSFER_ID);

    // Both entries should get reversal ledger rows inserted
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerInserts).toHaveLength(2);

    // Verify national reversal has negative amount of -15
    const nationalReversal = ledgerInserts.find(
      (c) => (c.data as Record<string, unknown>).reversal_of_id === NATIONAL_ENTRY_ID
    );
    expect(nationalReversal).toBeDefined();
    expect(Number((nationalReversal!.data as Record<string, unknown>).amount)).toBe(-15);

    // Verify state reversal has negative amount of -30
    const stateReversal = ledgerInserts.find(
      (c) => (c.data as Record<string, unknown>).reversal_of_id === STATE_ENTRY_ID
    );
    expect(stateReversal).toBeDefined();
    expect(Number((stateReversal!.data as Record<string, unknown>).amount)).toBe(-30);
  });

  // =========================================================================
  // 3. Partial refund: proportional math correct (50% refund)
  // =========================================================================
  it('applies proportional reversal amounts on partial refund', async () => {
    // $45 total, $22.50 refunded (50%)
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'transferred',
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
          {
            id: STATE_ENTRY_ID,
            amount: 30,
            status: 'transferred',
            stripe_transfer_id: STATE_TRANSFER_ID,
            recipient_charter_id: STATE_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
      existingReversals: {
        data: [], // No prior partial refunds
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 2250, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // Both transfers should be reversed via Stripe
    expect(mockReverseTransfer).toHaveBeenCalledTimes(2);

    // Check proportional amounts: 50% refund
    // National: 15 * (2250/4500) = 15 * 0.5 = 7.50 -> -7.5
    // State: 30 * (2250/4500) = 30 * 0.5 = 15 -> -15
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerInserts).toHaveLength(2);

    const nationalReversal = ledgerInserts.find(
      (c) => (c.data as Record<string, unknown>).reversal_of_id === NATIONAL_ENTRY_ID
    );
    // Math.round(1500 * 0.5) / 100 = 750/100 = 7.5
    expect(Number((nationalReversal!.data as Record<string, unknown>).amount)).toBeCloseTo(-7.5, 2);

    const stateReversal = ledgerInserts.find(
      (c) => (c.data as Record<string, unknown>).reversal_of_id === STATE_ENTRY_ID
    );
    // Math.round(3000 * 0.5) / 100 = 1500/100 = 15
    expect(Number((stateReversal!.data as Record<string, unknown>).amount)).toBeCloseTo(-15, 2);

    // Partial refund snapshot should include reason
    const snapshot = (nationalReversal!.data as Record<string, unknown>).split_rule_snapshot as Record<string, unknown>;
    expect(snapshot.reason).toBe('partial_refund');
  });

  // =========================================================================
  // 4. Partial refund: contribution stays 'completed'
  // =========================================================================
  it('keeps contribution status as completed on partial refund', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'transferred',
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
      existingReversals: {
        data: [],
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    // Partial refund: only 1000 of 4500 cents
    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 1000, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // Contribution should be updated to 'completed' (not 'refunded')
    const contribUpdates = tracker.updateCalls.filter(
      (c) => c.table === 'rlc_contributions'
    );
    expect(contribUpdates).toHaveLength(1);
    expect((contribUpdates[0].data as Record<string, unknown>).payment_status).toBe('completed');
  });

  // =========================================================================
  // 5. Double charge.refunded: second call finds entries already reversed
  // =========================================================================
  it('skips already-reversed entries on duplicate charge.refunded event', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'reversed', // Already reversed from first event
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
          {
            id: STATE_ENTRY_ID,
            amount: 30,
            status: 'reversed', // Already reversed from first event
            stripe_transfer_id: STATE_TRANSFER_ID,
            recipient_charter_id: STATE_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 4500, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // No Stripe transfer reversals should be attempted
    expect(mockReverseTransfer).not.toHaveBeenCalled();

    // No new reversal ledger entries should be inserted
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerInserts).toHaveLength(0);
  });

  // =========================================================================
  // 6. reverseTransfer failure: entry marked 'failed', others still processed
  // =========================================================================
  it('marks entry as failed when reverseTransfer throws, continues processing others', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [
          {
            id: NATIONAL_ENTRY_ID,
            amount: 15,
            status: 'transferred',
            stripe_transfer_id: NATIONAL_TRANSFER_ID,
            recipient_charter_id: NATIONAL_CHARTER_ID,
            source_type: 'membership',
          },
          {
            id: STATE_ENTRY_ID,
            amount: 30,
            status: 'transferred',
            stripe_transfer_id: STATE_TRANSFER_ID,
            recipient_charter_id: STATE_CHARTER_ID,
            source_type: 'membership',
          },
        ],
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    // First call (national) fails, second call (state) succeeds
    mockReverseTransfer
      .mockRejectedValueOnce(new Error('Stripe transfer reversal failed: insufficient funds'))
      .mockResolvedValueOnce({ id: 'trr_state_001' });

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 4500, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // Both transfers should be attempted
    expect(mockReverseTransfer).toHaveBeenCalledTimes(2);

    // The failed entry should be marked as 'failed'
    const failedUpdates = tracker.updateCalls.filter(
      (c) =>
        c.table === 'rlc_split_ledger_entries' &&
        (c.data as Record<string, unknown>).status === 'failed'
    );
    expect(failedUpdates.length).toBeGreaterThanOrEqual(1);

    // The successful entry should still get a reversal ledger row
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    // Only the successful entry gets a reversal insert (the failed one does not)
    expect(ledgerInserts).toHaveLength(1);
    expect(
      (ledgerInserts[0].data as Record<string, unknown>).reversal_of_id
    ).toBe(STATE_ENTRY_ID);
  });

  // =========================================================================
  // 7. No payment_intent on charge: early return, no DB calls
  // =========================================================================
  it('returns 200 with no DB calls when charge has no payment_intent', async () => {
    const { supabase, tracker } = createMockSupabase({});

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ paymentIntent: null, amountRefunded: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // No Stripe calls
    expect(mockReverseTransfer).not.toHaveBeenCalled();

    // No contribution inserts
    const contributionCalls = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_contributions'
    );
    expect(contributionCalls).toHaveLength(0);

    // No ledger inserts
    const ledgerCalls = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerCalls).toHaveLength(0);
  });

  // =========================================================================
  // 8. No ledger entries: contribution found but no entries, early return
  // =========================================================================
  it('returns 200 with no reversals when contribution has no ledger entries', async () => {
    const { supabase, tracker } = createMockSupabase({
      contribution: {
        data: { id: CONTRIBUTION_ID, amount: 45, contribution_type: 'membership' },
        error: null,
      },
      ledgerEntries: {
        data: [], // No ledger entries exist
        error: null,
      },
    });

    (createServerClient as Mock).mockReturnValue(supabase);

    setMockStripeEvent(
      buildChargeRefundedEvent({ amountRefunded: 4500, amountTotal: 4500 })
    );

    const response = await POST(buildRequest());
    expect(response.status).toBe(200);

    // No transfers should be reversed
    expect(mockReverseTransfer).not.toHaveBeenCalled();

    // No reversal entries should be created
    const ledgerInserts = tracker.insertCalls.filter(
      (c) => c.table === 'rlc_split_ledger_entries'
    );
    expect(ledgerInserts).toHaveLength(0);

    // No contribution status update should happen
    const contribUpdates = tracker.updateCalls.filter(
      (c) => c.table === 'rlc_contributions'
    );
    expect(contribUpdates).toHaveLength(0);
  });
});
