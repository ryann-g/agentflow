import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for /api/cron/billing-check.
 *
 * This route was at 0% coverage and was the single biggest contributor to
 * the repository's coverage gate failing on main (69% against an 80%
 * threshold — see the Oct 21 2026 audit, finding L7).
 *
 * The route downgrades subscriptions whose paid-through grace period has
 * expired, so it is worth asserting that it is gated by CRON_SECRET and
 * that it reports what it changed.
 */

const { mockHandleGracePeriodExpired } = vi.hoisted(() => ({
  mockHandleGracePeriodExpired: vi.fn(),
}));

vi.mock("@/lib/paymongo", () => ({
  handleGracePeriodExpired: mockHandleGracePeriodExpired,
}));

vi.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    private _headers: Map<string, string>;
    constructor(url: string, init?: RequestInit) {
      this.url = url;
      this._headers = new Map();
      const h = (init?.headers ?? {}) as Record<string, string>;
      for (const [k, v] of Object.entries(h)) this._headers.set(k, v);
    }
    get headers() {
      return { get: (name: string) => this._headers.get(name) || null };
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
    })),
  },
}));

import { GET } from "@/app/api/cron/billing-check/route";
import { NextRequest } from "next/server";

function authorizedRequest() {
  return new NextRequest("http://localhost:3000/api/cron/billing-check", {
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("/api/cron/billing-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
  });

  it("returns 401 when the authorization header is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/cron/billing-check");
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(mockHandleGracePeriodExpired).not.toHaveBeenCalled();
  });

  it("returns 401 when the authorization header is wrong", async () => {
    const request = new NextRequest("http://localhost:3000/api/cron/billing-check", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(mockHandleGracePeriodExpired).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(authorizedRequest());
    expect(response.status).toBe(401);
  });

  it("reports how many subscriptions were downgraded", async () => {
    mockHandleGracePeriodExpired.mockResolvedValue(3);
    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.downgraded).toBe(3);
    expect(typeof body.timestamp).toBe("string");
  });

  it("reports zero when nothing was downgraded", async () => {
    mockHandleGracePeriodExpired.mockResolvedValue(0);
    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(body.downgraded).toBe(0);
  });

  it("returns 500 when the downgrade pass throws", async () => {
    mockHandleGracePeriodExpired.mockRejectedValue(new Error("db down"));
    const response = await GET(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    // The internal error must not be echoed to the caller.
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("db down");
  });
});
