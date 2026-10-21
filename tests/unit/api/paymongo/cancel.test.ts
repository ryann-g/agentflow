import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────

const { mockFrom, mockGetUser, mockCancelSubscription } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockCancelSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 9, limit: 10, reset: new Date() })),
}));

vi.mock("@/lib/paymongo", () => ({
  cancelPayMongoSubscription: mockCancelSubscription,
  PayMongoError: class PayMongoError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.name = "PayMongoError";
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

// ── Helpers ────────────────────────────────────────────────────

function buildSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  return chain;
}

// ── Tests ──────────────────────────────────────────────────────

describe("/api/paymongo/cancel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PAYMONGO_SECRET_KEY = "sk_test_fake";
  });

  it("returns 500 when PAYMONGO_SECRET_KEY is not set", async () => {
    delete process.env.PAYMONGO_SECRET_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 when user has no subscription", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const profileChain = buildSupabaseChain({
      data: { paymongo_subscription_id: null },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { apiRateLimit } = await import("@/lib/rate-limiter");
    vi.mocked(apiRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 10,
      reset: new Date("2026-01-01T00:00:00Z"),
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    expect(res.status).toBe(429);
  });

  it("cancels subscription and returns success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const profileChain = buildSupabaseChain({
      data: { paymongo_subscription_id: "sub_123" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);
    mockCancelSubscription.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockCancelSubscription).toHaveBeenCalledWith("sub_123");
  });

  it("returns PayMongoError status when cancellation fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const profileChain = buildSupabaseChain({
      data: { paymongo_subscription_id: "sub_123" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const MockedPayMongoError = vi.mocked(
      (await import("@/lib/paymongo")).PayMongoError,
    );
    mockCancelSubscription.mockRejectedValue(
      new MockedPayMongoError("Subscription already cancelled", "not_found", 404),
    );

    const { POST } = await import("@/app/api/paymongo/cancel/route");
    const res = await POST();
    expect(res.status).toBe(404);
  });
});
