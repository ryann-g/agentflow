import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ──────────────────────────────────────────────────────

const { mockFrom, mockVerifyWebhook } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockVerifyWebhook: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/paymongo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/paymongo")>();
  return {
    ...original,
    verifyWebhookSignature: mockVerifyWebhook,
    handleSubscriptionActivated: vi.fn(),
    handleSubscriptionUpdated: vi.fn(),
    handleSubscriptionUnpaid: vi.fn(),
    handlePaymentFailed: vi.fn(),
    handlePaymentPaid: vi.fn(),
  };
});

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
    async text() {
      return this._body;
    }
    get headers() {
      return {
        get: (name: string) => this._headers[name.toLowerCase()] || null,
      };
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
    })),
  },
}));

// ── Helpers ────────────────────────────────────────────────────

function buildInsertResult(result: { data: unknown; error: unknown }) {
  return {
    insert: vi.fn(() => result),
  };
}

function buildSelectResult(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(result));
  return chain;
}

function buildUpdateResult(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  // Supabase update returns a thenable promise-like chain, but we don't await it.
  // We just need the chain to be callable so the route can fire it.
  return chain;
}

// ── Tests ──────────────────────────────────────────────────────

describe("/api/paymongo/webhook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.PAYMONGO_WEBHOOK_SECRET = "whsec_test";
  });

  it("returns 500 if PAYMONGO_WEBHOOK_SECRET is not set", async () => {
    delete process.env.PAYMONGO_WEBHOOK_SECRET;
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: "{}",
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns 400 if no paymongo-signature header", async () => {
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: '{"event":"test"}',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if signature verification fails", async () => {
    mockVerifyWebhook.mockReturnValue(false);
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: '{"event":"test"}',
      headers: { "paymongo-signature": "invalid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if body is invalid JSON", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: "not-json",
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("deduplicates already-processed events", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const selectChain = buildSelectResult({
      data: { status: "processed" },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(selectChain);

    const payload = JSON.stringify({
      id: "evt_dup",
      attributes: {
        type: "subscription.activated",
        data: { id: "sub_123", type: "subscription", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
  });

  it("re-processes failed events on retry", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    });
    const selectChain = buildSelectResult({
      data: { status: "failed" },
      error: null,
    });
    const updateChain = buildUpdateResult({ data: null, error: null });

    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_retry",
      attributes: {
        type: "subscription.activated",
        data: { id: "sub_retry", type: "subscription", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 for subscription.activated event", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_001",
      attributes: {
        type: "subscription.activated",
        data: { id: "sub_activated", type: "subscription", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 for subscription.cancelled event", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_002",
      attributes: {
        type: "subscription.cancelled",
        data: { id: "sub_cancelled", type: "subscription", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 for invoice.payment_failed event", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_003",
      attributes: {
        type: "invoice.payment_failed",
        data: { id: "inv_failed", type: "invoice", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 for invoice.paid event", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_004",
      attributes: {
        type: "invoice.paid",
        data: { id: "inv_paid", type: "invoice", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 200 for unhandled event types (no-op)", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_005",
      attributes: {
        type: "some.unknown.event",
        data: { id: "x", type: "unknown", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("records failed status when handler throws", async () => {
    mockVerifyWebhook.mockReturnValue(true);
    const { handleSubscriptionActivated } = await import("@/lib/paymongo");
    vi.mocked(handleSubscriptionActivated).mockRejectedValueOnce(
      new Error("profile not found"),
    );

    const insertResult = buildInsertResult({ data: null, error: null });
    const updateChain = buildUpdateResult({ data: null, error: null });
    mockFrom
      .mockReturnValueOnce(insertResult)
      .mockReturnValueOnce(updateChain);

    const payload = JSON.stringify({
      id: "evt_err",
      attributes: {
        type: "subscription.activated",
        data: { id: "sub_err", type: "subscription", attributes: {} },
      },
    });

    const { POST } = await import("@/app/api/paymongo/webhook/route");
    const req = new NextRequest("http://localhost:3000/api/paymongo/webhook", {
      method: "POST",
      body: payload,
      headers: { "paymongo-signature": "valid_sig" } as unknown as HeadersInit,
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
