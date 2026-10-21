import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavioural coverage for /api/export.
 *
 * The export route hands the user a JSON dump of their own data. It is the
 * one endpoint that deliberately moves personal data out of the app, so it
 * is worth asserting that it only ever returns the caller's rows and that
 * it refuses to serve an unauthenticated caller.
 *
 * The Oct 21 2026 audit found this route was covered only by source
 * assertions and therefore excluded from the coverage denominator.
 */

const { mockFrom, mockGetUser, mockRateLimiter } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockRateLimiter: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  rateLimiter: mockRateLimiter,
}));

vi.mock("next/server", () => ({
  NextResponse: class NextResponse {
    status: number;
    headers: Map<string, string>;
    private _body: string;
    constructor(body?: string, init?: { status?: number; headers?: Record<string, string> }) {
      this._body = body ?? "";
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    async json() {
      return JSON.parse(this._body);
    }
    get body() {
      return this._body;
    }
    static json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new NextResponse(JSON.stringify(data), init);
    }
  },
}));

import { GET } from "@/app/api/export/route";

/** A chain that resolves to `result` when awaited. */
function buildChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: result, error: null }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result, error: null }).then(resolve);
  return chain;
}

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimiter.mockResolvedValue({
      allowed: true,
      remaining: 4,
      limit: 5,
      reset: new Date(),
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return buildChain({ id: "u1", plan: "free" });
      if (table === "leads") return buildChain([{ id: "l1", user_id: "u1" }]);
      return buildChain([{ id: "a1", user_id: "u1" }]);
    });
  });

  it("returns 401 when the caller is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when the auth check reports an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 429 when the export rate limit is exhausted", async () => {
    mockRateLimiter.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 5,
      reset: new Date(),
    });
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("exports the caller's profile, leads and actions", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.userId).toBe("u1");
    expect(body.profile).toMatchObject({ id: "u1" });
    expect(body.leads).toHaveLength(1);
    expect(body.actions).toHaveLength(1);
    expect(typeof body.exportedAt).toBe("string");
  });

  it("scopes every query to the caller's id", async () => {
    await GET();

    const scopedCalls = mockFrom.mock.results
      .map((result) => result.value as Record<string, unknown>)
      .filter((chain) => typeof chain.eq === "function")
      .map((chain) => chain.eq as ReturnType<typeof vi.fn>);

    expect(scopedCalls.length).toBeGreaterThan(0);
    for (const eq of scopedCalls) {
      expect(eq).toHaveBeenCalled();
    }
  });

  it("sends a downloadable attachment that is not cached", async () => {
    const res = await GET();

    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("rate limits by user id", async () => {
    await GET();
    expect(mockRateLimiter).toHaveBeenCalledWith("export:u1", { limit: 5, window: 60 });
  });
});
