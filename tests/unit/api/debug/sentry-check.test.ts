import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Coverage for /api/debug/sentry-check.
 *
 * This route was at 0% coverage and was a contributor to the coverage gate
 * failing on main (Oct 21 2026 audit, finding L7).
 *
 * The route is an operator tool that emits one message and one exception to
 * Sentry so an operator can confirm events actually reach the dashboard. It
 * is gated by CRON_SECRET, so the important assertions are that it is gated
 * at all, and that it does not leak internals to an unauthenticated caller.
 */

const { mockCaptureMessage, mockCaptureException, mockFlush } = vi.hoisted(() => ({
  mockCaptureMessage: vi.fn(() => "message-id"),
  mockCaptureException: vi.fn(() => "error-id"),
  mockFlush: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@sentry/nextjs", () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
  flush: mockFlush,
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

import { POST } from "@/app/api/debug/sentry-check/route";
import { NextRequest } from "next/server";

function authorizedRequest() {
  return new NextRequest("http://localhost:3000/api/debug/sentry-check", {
    method: "POST",
    headers: { authorization: "Bearer test-cron-secret" },
  });
}

describe("/api/debug/sentry-check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mockFlush.mockResolvedValue(true);
  });

  it("returns 401 without authorization", async () => {
    const request = new NextRequest("http://localhost:3000/api/debug/sentry-check", {
      method: "POST",
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong secret", async () => {
    const request = new NextRequest("http://localhost:3000/api/debug/sentry-check", {
      method: "POST",
      headers: { authorization: "Bearer wrong" },
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await POST(authorizedRequest());
    expect(response.status).toBe(401);
  });

  it("emits a message and an exception and reports both ids", async () => {
    const response = await POST(authorizedRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(body.messageId).toBe("message-id");
    expect(body.errorId).toBe("error-id");
    expect(body.ok).toBe(true);
  });

  it("reports a failed transport when Sentry does not confirm", async () => {
    mockFlush.mockResolvedValue(false);
    const response = await POST(authorizedRequest());
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.hint).toContain("Transport did not confirm");
  });
});
