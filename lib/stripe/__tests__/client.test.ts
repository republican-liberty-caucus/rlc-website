import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Stripe before importing the module under test
const mockCheckoutSessionsCreate = vi.fn();
const mockCustomersCreate = vi.fn();
const mockCustomersRetrieve = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock('stripe', () => ({
  default: class MockStripe {
    checkout = { sessions: { create: mockCheckoutSessionsCreate } };
    customers = { create: mockCustomersCreate, retrieve: mockCustomersRetrieve };
    subscriptions = { retrieve: mockSubscriptionsRetrieve };
  },
}));

// Mock Supabase
const mockSupabaseUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const mockSupabaseSingle = vi.fn();
const mockSupabaseSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSupabaseSingle }) });

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSupabaseSelect,
      update: mockSupabaseUpdate,
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Set env vars before importing
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PRICE_INDIVIDUAL = 'price_test_individual';

describe('Stripe client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      client_secret: 'cs_test_123_secret_abc',
    });
    mockCustomersCreate.mockResolvedValue({
      id: 'cus_new_123',
      email: 'test@example.com',
      deleted: false,
    });
  });

  describe('MEMBERSHIP_TIERS', () => {
    it('loads stripePriceId from env for individual tier', async () => {
      const { getTierConfig } = await import('../client');
      const config = getTierConfig('individual');
      expect(config).toBeDefined();
      expect(config!.stripePriceId).toBe('price_test_individual');
    });

    it('returns null stripePriceId when env var not set', async () => {
      const { getTierConfig } = await import('../client');
      // student_military env var not set
      const config = getTierConfig('student_military');
      expect(config).toBeDefined();
      expect(config!.stripePriceId).toBeNull();
    });
  });

  describe('createCheckoutSession', () => {
    it('uses subscription mode with persistent Price ID', async () => {
      mockCustomersRetrieve.mockResolvedValue({
        id: 'cus_existing',
        email: 'test@example.com',
        deleted: false,
      });
      mockSupabaseSingle.mockResolvedValue({
        data: { stripe_customer_id: 'cus_existing' },
        error: null,
      });

      const { createCheckoutSession } = await import('../client');
      await createCheckoutSession({
        tier: 'individual', // has stripePriceId set
        memberEmail: 'test@example.com',
        memberId: 'member-1',
        returnUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          ui_mode: 'embedded',
          mode: 'subscription',
          customer: 'cus_existing',
          line_items: [{ price: 'price_test_individual', quantity: 1 }],
          return_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
          metadata: expect.objectContaining({
            tier: 'individual',
            type: 'membership',
            source: 'rlc-website',
          }),
        })
      );
      // Should NOT have customer_email when using subscription mode
      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.customer_email).toBeUndefined();
    });

    it('falls back to payment mode with price_data when no stripePriceId', async () => {
      const { createCheckoutSession } = await import('../client');
      await createCheckoutSession({
        tier: 'student_military', // no stripePriceId
        memberEmail: 'test@example.com',
        returnUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      });

      expect(mockCheckoutSessionsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          customer_email: 'test@example.com',
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                unit_amount: 3000,
                currency: 'usd',
              }),
              quantity: 1,
            }),
          ],
        })
      );
      // Should NOT have customer field in payment mode
      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.customer).toBeUndefined();
    });

    it('includes source: rlc-website in metadata', async () => {
      const { createCheckoutSession } = await import('../client');
      await createCheckoutSession({
        tier: 'student_military',
        memberEmail: 'test@example.com',
        returnUrl: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.metadata.source).toBe('rlc-website');
    });
  });

  describe('createDonationCheckoutSession', () => {
    it('includes source: rlc-website in donation metadata', async () => {
      const { createDonationCheckoutSession } = await import('../client');
      await createDonationCheckoutSession({
        amount: 5000,
        isRecurring: false,
        donorEmail: 'donor@example.com',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.metadata.source).toBe('rlc-website');
      expect(callArgs.metadata.type).toBe('donation');
    });

    it('uses findOrCreateWebsiteCustomer for recurring donations', async () => {
      mockSupabaseSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const { createDonationCheckoutSession } = await import('../client');
      await createDonationCheckoutSession({
        amount: 2500,
        isRecurring: true,
        donorEmail: 'donor@example.com',
        memberId: 'member-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      // Should create a Stripe Customer (not use customer_email)
      expect(mockCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'donor@example.com',
          metadata: { source: 'rlc-website' },
        })
      );

      const callArgs = mockCheckoutSessionsCreate.mock.calls[0][0];
      expect(callArgs.mode).toBe('subscription');
      expect(callArgs.customer).toBe('cus_new_123');
      expect(callArgs.customer_email).toBeUndefined();
    });
  });
});
