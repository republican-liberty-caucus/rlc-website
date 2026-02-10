import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MembershipTier, MembershipStatus, Contact } from '@/types';

/**
 * Tests for the Stripe webhook handler logic.
 *
 * Since the webhook handler is a Next.js route (exports POST), we extract
 * and test the key behavioral logic via the route's internal functions.
 * We mock Stripe, Supabase, and HighLevel to isolate webhook behavior.
 */

// ── Mocks ──────────────────────────────────────────────────────────

const mockStripeConstructEvent = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: { constructEvent: mockStripeConstructEvent },
      customers: { retrieve: mockCustomersRetrieve },
      subscriptions: { retrieve: mockSubscriptionsRetrieve },
    })),
  };
});

// Chainable Supabase mock
function createMockSupabase(responses: Record<string, { data: unknown; error: unknown }[]>) {
  const callCounts: Record<string, number> = {};

  function getResponse(table: string): { data: unknown; error: unknown } {
    const idx = callCounts[table] ?? 0;
    callCounts[table] = idx + 1;
    const tableResponses = responses[table] || [{ data: null, error: null }];
    return tableResponses[idx] ?? tableResponses[tableResponses.length - 1];
  }

  function makeChain(table: string) {
    const response = () => getResponse(table);
    const chain: Record<string, unknown> = {};

    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockImplementation(() => {
      const res = getResponse(`${table}:insert`);
      return { select: vi.fn().mockReturnValue({ single: vi.fn().mockReturnValue(res) }), ...res };
    });
    chain.update = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.is = vi.fn().mockReturnValue(chain);
    chain.not = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockImplementation(response);
    chain.limit = vi.fn().mockImplementation(response);

    return chain;
  }

  return { from: vi.fn().mockImplementation((table: string) => makeChain(table)) };
}

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/lib/stripe/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stripe/client')>('@/lib/stripe/client');
  return {
    ...actual,
    getStripe: vi.fn(() => ({
      webhooks: { constructEvent: mockStripeConstructEvent },
      customers: { retrieve: mockCustomersRetrieve },
      subscriptions: { retrieve: mockSubscriptionsRetrieve },
    })),
  };
});

vi.mock('@/lib/highlevel/client', () => ({
  syncMemberToHighLevel: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/highlevel/notifications', () => ({
  triggerWelcomeSequence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/dues-sharing/split-engine', () => ({
  processDuesSplit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('test-signature'),
  }),
}));

// ── Helpers ────────────────────────────────────────────────────────

function makeMember(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'member-1',
    clerk_user_id: null,
    email: 'test@example.com',
    first_name: 'John',
    last_name: 'Doe',
    phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: 'US',
    membership_tier: 'individual' as MembershipTier,
    membership_status: 'current' as MembershipStatus,
    membership_start_date: '2025-06-01T00:00:00Z',
    membership_expiry_date: '2026-06-01T00:00:00Z',
    membership_join_date: '2025-06-01T00:00:00Z',
    primary_charter_id: 'charter-1',
    highlevel_contact_id: null,
    civicrm_contact_id: null,
    stripe_customer_id: 'cus_website_123',
    email_opt_in: true,
    sms_opt_in: false,
    do_not_phone: false,
    household_id: null,
    household_role: null,
    primary_contact_id: null,
    metadata: {},
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeStripeEvent(type: string, data: unknown) {
  return { id: `evt_test_${Date.now()}`, type, data: { object: data } };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Stripe webhook handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  describe('source guard: handleCheckoutComplete', () => {
    it('skips checkout events without metadata.type (external/HighLevel)', async () => {
      const session = {
        id: 'cs_hl_123',
        customer: 'cus_highlevel',
        customer_email: 'hl@example.com',
        payment_intent: 'pi_hl_123',
        amount_total: 4500,
        currency: 'usd',
        mode: 'payment',
        metadata: {}, // No type — HighLevel event
      };

      const event = makeStripeEvent('checkout.session.completed', session);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        // Idempotency table
        rlc_webhook_events: [{ data: null, error: null }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Should NOT have tried to look up member (skipped early)
      const memberLookupCalls = mockSb.from.mock.calls.filter(
        (call: string[]) => call[0] === 'rlc_members'
      );
      expect(memberLookupCalls).toHaveLength(0);
    });

    it('processes checkout events with metadata.type=membership', async () => {
      const member = makeMember();
      const session = {
        id: 'cs_web_123',
        customer: 'cus_website_123',
        customer_email: 'test@example.com',
        payment_intent: 'pi_web_123',
        subscription: null,
        amount_total: 4500,
        currency: 'usd',
        mode: 'subscription',
        metadata: {
          type: 'membership',
          tier: 'individual',
          source: 'rlc-website',
          member_id: 'member-1',
        },
      };

      const event = makeStripeEvent('checkout.session.completed', session);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
        rlc_members: [
          { data: member, error: null }, // lookup by member_id
        ],
        rlc_contributions: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } }, // idempotency check
        ],
        'rlc_contributions:insert': [{ data: { id: 'contrib-1' }, error: null }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Should have looked up member
      const memberLookupCalls = mockSb.from.mock.calls.filter(
        (call: string[]) => call[0] === 'rlc_members'
      );
      expect(memberLookupCalls.length).toBeGreaterThan(0);
    });
  });

  describe('handleInvoicePaid', () => {
    it('skips invoice with billing_reason=subscription_create', async () => {
      const invoice = {
        id: 'in_first_123',
        customer: 'cus_website_123',
        payment_intent: 'pi_first_123',
        amount_paid: 4500,
        currency: 'usd',
        billing_reason: 'subscription_create', // First invoice — skip
      };

      const event = makeStripeEvent('invoice.payment_succeeded', invoice);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Should NOT have looked up member (skipped before customer lookup)
      const memberLookupCalls = mockSb.from.mock.calls.filter(
        (call: string[]) => call[0] === 'rlc_members'
      );
      expect(memberLookupCalls).toHaveLength(0);
    });

    it('skips gracefully for unknown customer (likely HighLevel)', async () => {
      const invoice = {
        id: 'in_hl_123',
        customer: 'cus_highlevel_999',
        payment_intent: 'pi_hl_123',
        amount_paid: 4500,
        currency: 'usd',
        billing_reason: 'subscription_cycle', // Renewal, not create
      };

      const event = makeStripeEvent('invoice.payment_succeeded', invoice);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
        rlc_members: [{ data: null, error: { code: 'PGRST116', message: 'not found' } }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      // Should return 200 (graceful skip), not 500 (throw)
      expect(res.status).toBe(200);
    });

    it('extends renewal expiry from existing expiry date, not now', async () => {
      // Member's expiry is 2026-06-01 — renewing early (in Feb 2026)
      // New expiry should be 2027-06-01, not 2027-02-XX
      const member = makeMember({
        membership_expiry_date: '2026-06-01T00:00:00Z',
      });

      const invoice = {
        id: 'in_renewal_123',
        customer: 'cus_website_123',
        payment_intent: 'pi_renewal_123',
        amount_paid: 4500,
        currency: 'usd',
        billing_reason: 'subscription_cycle',
      };

      const event = makeStripeEvent('invoice.payment_succeeded', invoice);
      mockStripeConstructEvent.mockReturnValue(event);

      let capturedUpdate: Record<string, unknown> | null = null;
      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
        rlc_members: [{ data: member, error: null }],
        rlc_contributions: [
          { data: null, error: { code: 'PGRST116', message: 'not found' } }, // idempotency
        ],
        'rlc_contributions:insert': [{ data: { id: 'contrib-renewal' }, error: null }],
      });

      // Intercept the update call to capture the dates
      const origFrom = mockSb.from;
      mockSb.from = vi.fn().mockImplementation((table: string) => {
        const chain = origFrom(table);
        if (table === 'rlc_members') {
          const origUpdate = chain.update;
          chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
            capturedUpdate = payload;
            return origUpdate(payload);
          });
        }
        return chain;
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      // Verify the expiry date was extended from existing expiry, not from now
      expect(capturedUpdate).not.toBeNull();
      // TS can't trace assignment through mock callback, so it narrows to null/never
      const update = capturedUpdate as unknown as Record<string, unknown>;
      const newExpiry = new Date(update.membership_expiry_date as string);
      // Should be approximately 2027-06-01 (existing 2026-06-01 + 1 year)
      expect(newExpiry.getUTCFullYear()).toBe(2027);
      expect(newExpiry.getUTCMonth()).toBe(5); // June = month 5 (0-indexed)

      const newStart = new Date(update.membership_start_date as string);
      // Start should be the existing expiry (2026-06-01), not today
      expect(newStart.getUTCFullYear()).toBe(2026);
      expect(newStart.getUTCMonth()).toBe(5);
    });
  });

  describe('handleSubscriptionCancelled', () => {
    it('skips gracefully for unknown customer', async () => {
      const subscription = {
        id: 'sub_hl_123',
        customer: 'cus_highlevel_unknown',
        status: 'canceled',
      };

      const event = makeStripeEvent('customer.subscription.deleted', subscription);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
        rlc_members: [{ data: null, error: { code: 'PGRST116', message: 'not found' } }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe('handleSubscriptionChange', () => {
    it('skips gracefully for unknown customer', async () => {
      const subscription = {
        id: 'sub_hl_456',
        customer: 'cus_highlevel_other',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
      };

      const event = makeStripeEvent('customer.subscription.updated', subscription);
      mockStripeConstructEvent.mockReturnValue(event);

      const mockSb = createMockSupabase({
        rlc_webhook_events: [{ data: null, error: null }],
        rlc_members: [{ data: null, error: { code: 'PGRST116', message: 'not found' } }],
      });

      const { createServerClient } = await import('@/lib/supabase/server');
      (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSb);

      const { POST } = await import('@/app/api/webhooks/stripe/route');
      const req = new Request('https://example.com/api/webhooks/stripe', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'stripe-signature': 'test-signature' },
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });
});
