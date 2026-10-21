import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for /api/paymongo/payment-method-url.
 *
 * This route was at 0% coverage and was a contributor to the coverage gate
 * failing on main (Oct 21 2026 audit, finding L7).
 *
 * The route returns the hosted-authentication URL a customer needs to
 * complete a 3-D Secure challenge or a card update. It is worth asserting
 * that it authenticates BEFORE the configuration check, so an anonymous
 * caller cannot use the response to learn whether billing is configured.
 */

const { mockFrom, mockGetUser, mockRetrieveSubscription } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockRetrieveSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 9, limit: 10, reset: new Date() })),
}));

vi.mock("@/lib/paymongo", () => ({
  retrievePayMongoSubscription: mockRetrieveSubscription,
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

function buildSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe("/api/paymongo/payment-method-url", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PAYMONGO_SECRET_KEY = "sk_test_fake";
  });

  it("returns 401 when the caller is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("checks authentication before the billing configuration check", async () => {
    // An anonymous caller must not learn whether PayMongo is configured.
    delete process.env.PAYMONGO_SECRET_KEY;
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 503 to an authenticated caller when PayMongo is not configured", async () => {
    delete process.env.PAYMONGO_SECRET_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    expect(res.status).toBe(503);
  });

  it("returns 400 when the user has no subscription", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(buildSupabaseChain({ data: null, error: null }));

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    expect(res.status).toBe(400);
  });

  it("returns the setup intent URL when customer action is pending", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(
      buildSupabaseChain({ data: { paymongo_subscription_id: "sub_1" }, error: null })
    );
    mockRetrieveSubscription.mockResolvedValue({
      data: {
        attributes: {
          status: "pending",
          setup_intent: { next_action_url: "https://checkout.paymongo.com/auth/abc" },
        },
      },
    });

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://checkout.paymongo.com/auth/abc");
    expect(body.status).toBe("pending");
  });

  it("returns a null URL when no customer action is pending", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(
      buildSupabaseChain({ data: { paymongo_subscription_id: "sub_1" }, error: null })
    );
    mockRetrieveSubscription.mockResolvedValue({
      data: { attributes: { status: "active", setup_intent: null } },
    });

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBeNull();
  });

  it("surfaces a PayMongo error with its status code", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(
      buildSupabaseChain({ data: { paymongo_subscription_id: "sub_1" }, error: null })
    );
    const { PayMongoError } = await import("@/lib/paymongo");
    mockRetrieveSubscription.mockRejectedValue(
      new PayMongoError("Subscription not found", "not_found", 404)
    );

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 500 when the request fails unexpectedly", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockReturnValue(
      buildSupabaseChain({ data: { paymongo_subscription_id: "sub_1" }, error: null })
    );
    mockRetrieveSubscription.mockRejectedValue(new Error("network down"));

    const { GET } = await import("@/app/api/paymongo/payment-method-url/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to retrieve payment method status");
  });
});
