/**
 * In-memory rate limiter using a Map store.
 *
 * LIMITATION: This is an in-memory store, which means it resets on every
 * cold start in Vercel serverless (each request may hit a fresh instance).
 * It provides basic protection against accidental rapid-fire requests within
 * a single warm instance, but NOT against distributed or persistent attacks.
 *
 * For production-grade rate limiting, consider upgrading to a shared
 * store (e.g., Redis via Upstash, Vercel KV, or Supabase pg_audit).
 */

interface RateLimitConfig {
  limit: number;
  window: number; // seconds
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: Date;
  limit: number;
}

const store = new Map<string, { count: number; resetTime: number }>();

/**
 * Upper bound on how many keys we keep alive.
 *
 * Without it the Map only ever grows: a key is reset when it is touched
 * again, so keys that are never revisited — every rate-limit key includes a
 * user id, so a busy deployment accumulates one per visitor — stay in memory
 * for the lifetime of the instance.
 */
const MAX_TRACKED_KEYS = 10_000;

/**
 * Drops expired entries, then the oldest ones if the budget is still
 * exceeded. Map iteration is insertion-ordered, so the first keys are the
 * oldest.
 */
function evictIfNeeded(now: number): void {
  if (store.size <= MAX_TRACKED_KEYS) return;

  for (const [key, entry] of store) {
    if (now > entry.resetTime) store.delete(key);
  }

  while (store.size > MAX_TRACKED_KEYS) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    store.delete(oldest.value);
  }
}

export async function rateLimiter(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.window * 1000;
  const resetTime = now + windowMs;

  evictIfNeeded(now);

  const existing = store.get(key);

  if (!existing || now > existing.resetTime) {
    store.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: config.limit - 1,
      reset: new Date(resetTime),
      limit: config.limit,
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      reset: new Date(existing.resetTime),
      limit: config.limit,
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: config.limit - existing.count,
    reset: new Date(existing.resetTime),
    limit: config.limit,
  };
}

export function apiRateLimit(key: string, limit = 100, window = 60) {
  return rateLimiter(key, { limit, window });
}
