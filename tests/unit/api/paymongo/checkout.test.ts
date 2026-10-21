import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────

const { mockFrom, mockGetUser, mockGetOrCreateCustomer, mockCreateSubscription } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetOrCreateCustomer: vi.fn(),
  mockCreateSubscription: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimit: vi.fn(() => Promise.resolve({ allowed: true, remaining: 9, limit: 10, reset: new Date() })),
}));

vi.mock("@/lib/paymongo", () => ({
  getOrCreatePayMongoCustomer: mockGetOrCreateCustomer,
  createPayMongoSubscription: mockCreateSubscription,
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

vi.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    method: string;
    private _body: string;
    private _headers: Record<string, string>;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this.method = init?.method || "GET";
      this._body = (init?.body as string) || "{}";
      this._headers = (init?.headers as Record<string, string>) || {};
    }
    async json() { return JSON.parse(this._body); }
    get headers() {
      return { get: (name: string) => this._headers[name] || null };
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
    })),
  },
}));

// ── Tests ──────────────────────────────────────────────────────

describe("/api/paymongo/checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PAYMONGO_SECRET_KEY = "sk_test_fake";
  });

  it("returns 500 when PAYMONGO_SECRET_KEY is not set", async () => {
    delete process.env.PAYMONGO_SECRET_KEY;
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toMatch(/unauthorized/i);
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

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("defaults to monthly interval when body is empty", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const profileChain = buildSupabaseChain({
      data: { email: "a@b.com", full_name: "Test" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);
    mockGetOrCreateCustomer.mockResolvedValue("cus_123");
    mockCreateSubscription.mockResolvedValue({
      subscriptionId: "sub_123",
      checkoutUrl: "https://checkout.paymongo.com/ok",
    });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockCreateSubscription).toHaveBeenCalledWith("cus_123", "u1", "monthly");
  });

  it("returns checkout URL on success", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const profileChain = buildSupabaseChain({
      data: { email: "a@b.com", full_name: "Test" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);
    mockGetOrCreateCustomer.mockResolvedValue("cus_123");
    mockCreateSubscription.mockResolvedValue({
      subscriptionId: "sub_456",
      checkoutUrl: "https://checkout.paymongo.com/abc",
    });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toContain("checkout.paymongo.com");
  });

  it("returns url: null when card is already vaulted", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const profileChain = buildSupabaseChain({
      data: { email: "a@b.com", full_name: "Test" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);
    mockGetOrCreateCustomer.mockResolvedValue("cus_123");
    mockCreateSubscription.mockResolvedValue({
      subscriptionId: "sub_789",
      checkoutUrl: null,
    });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.url).toBeNull();
    expect(body.subscriptionId).toBe("sub_789");
  });

  it("returns 400 for invalid interval", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "weekly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns error from PayMongoError when API call fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } } });
    const profileChain = buildSupabaseChain({
      data: { email: "a@b.com", full_name: "Test" },
      error: null,
    });
    mockFrom.mockReturnValue(profileChain);

    const MockedPayMongoError = vi.mocked(
      (await import("@/lib/paymongo")).PayMongoError,
    );
    mockGetOrCreateCustomer.mockRejectedValue(
      new MockedPayMongoError("API limit reached", "rate_limit", 429),
    );

    const { POST } = await import("@/app/api/paymongo/checkout/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "Content-Type": "application/json" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });
});

// ── Helpers ────────────────────────────────────────────────────

function buildSupabaseChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}
