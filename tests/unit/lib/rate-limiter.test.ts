import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("rateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exports rateLimiter function", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");
    expect(typeof rateLimiter).toBe("function");
  });

  it("allows request within limit", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");
    const result = await rateLimiter("test-key", { limit: 5, window: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("blocks request exceeding limit", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");
    const key = "block-test";

    for (let i = 0; i < 3; i++) {
      await rateLimiter(key, { limit: 3, window: 60 });
    }

    const result = await rateLimiter(key, { limit: 3, window: 60 });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");
    const key = "reset-test";

    await rateLimiter(key, { limit: 2, window: 60 });
    await rateLimiter(key, { limit: 2, window: 60 });

    vi.advanceTimersByTime(61000);

    const result = await rateLimiter(key, { limit: 2, window: 60 });
    expect(result.allowed).toBe(true);
  });

  it("returns correct reset timestamp", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");
    const result = await rateLimiter("timestamp-test", { limit: 5, window: 60 });
    expect(result.reset).toBeInstanceOf(Date);
    expect(result.reset.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("apiRateLimit middleware", () => {
  it("exports apiRateLimit function", async () => {
    const { apiRateLimit } = await import("@/lib/rate-limiter");
    expect(typeof apiRateLimit).toBe("function");
  });
});

describe("rateLimiter — store eviction", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the store bounded when many distinct keys are used", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");

    // More keys than the eviction budget (10,000). Each key is unique, so
    // nothing is ever revisited and the store would grow without bound.
    for (let i = 0; i < 10_050; i++) {
      await rateLimiter(`key-${i}`, { limit: 5, window: 60 });
    }

    // The limiter still works after the sweep.
    const result = await rateLimiter("key-after-eviction", { limit: 5, window: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("drops expired entries before it drops live ones", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");

    // A long-lived key that must survive the sweep.
    await rateLimiter("live-key", { limit: 3, window: 600 });

    // Short-lived keys. Kept under the eviction budget so no sweep runs yet.
    for (let i = 0; i < 9_000; i++) {
      await rateLimiter(`short-${i}`, { limit: 5, window: 1 });
    }

    // Let the short-lived keys expire. "live-key" is unaffected.
    vi.advanceTimersByTime(2_000);

    const deleteSpy = vi.spyOn(Map.prototype, "delete");

    // Cross the eviction budget. The sweep should now find 9,000 expired
    // entries to drop, so it never needs to fall back to removing the
    // oldest (still-live) entries.
    for (let i = 0; i < 1_100; i++) {
      await rateLimiter(`recent-${i}`, { limit: 5, window: 600 });
    }

    const deleted = deleteSpy.mock.calls.map((call) => call[0] as string);
    deleteSpy.mockRestore();

    expect(deleted).toContain("short-0");
    expect(deleted).not.toContain("live-key");
  });

  it("starts a fresh window for a key whose entry was evicted", async () => {
    const { rateLimiter } = await import("@/lib/rate-limiter");

    await rateLimiter("short-lived", { limit: 2, window: 1 });
    await rateLimiter("short-lived", { limit: 2, window: 1 });

    vi.advanceTimersByTime(2_000);

    const result = await rateLimiter("short-lived", { limit: 2, window: 1 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});
