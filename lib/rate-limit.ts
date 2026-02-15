import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter for Vercel serverless functions.
 * Each instance persists within a warm function invocation window.
 * For production-grade distributed rate limiting, upgrade to @upstash/ratelimit.
 */
class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }

  /** Periodically prune expired entries to prevent memory leaks */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

// Shared limiters for different endpoint categories
// Checkout/donate: 10 requests per minute per IP (creating Stripe sessions is expensive)
const paymentLimiter = new RateLimiter(10, 60_000);

// General public endpoints: 30 requests per minute per IP
const publicLimiter = new RateLimiter(30, 60_000);

// Prune every 5 minutes to prevent memory buildup
setInterval(() => {
  paymentLimiter.prune();
  publicLimiter.prune();
}, 300_000).unref();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/**
 * Apply rate limiting to a request. Returns a 429 response if rate limit exceeded,
 * or null if the request is allowed to proceed.
 */
export function applyRateLimit(
  request: Request,
  type: 'payment' | 'public' = 'public'
): NextResponse | null {
  const ip = getClientIp(request);
  const limiter = type === 'payment' ? paymentLimiter : publicLimiter;
  const { allowed, remaining } = limiter.check(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // Return null to indicate the request is allowed
  // Callers can optionally set X-RateLimit-Remaining on their responses
  void remaining;
  return null;
}
