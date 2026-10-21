import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Behavioural coverage for /api/leads/import.
 *
 * This is the most security-sensitive route in the app: it accepts
 * user-supplied lead data, sanitizes it against spreadsheet formula
 * injection, enforces the free-tier cap, and writes to the database. The
 * Oct 21 2026 audit found it had only source-assertion tests, so it was
 * excluded from the coverage denominator — which is how a request-size guard
 * that sat AFTER the body was read, and an unvalidated JSON channel, could
 * both survive.
 *
 * These tests exercise the route behaviourally.
 */

const { mockFrom, mockGetUser, mockApiRateLimit } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockGetUser: vi.fn(),
  mockApiRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ from: mockFrom, auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimit: mockApiRateLimit,
}));

vi.mock("next/server", () => ({
  NextRequest: class NextRequest {
    url: string;
    private _body: FormData | string;
    private _headers: Record<string, string>;
    constructor(url: string, init?: RequestInit & { body?: unknown }) {
      this.url = url;
      this._body = (init?.body as FormData) ?? "";
      this._headers = {};
      const h = (init?.headers ?? {}) as Record<string, string>;
      for (const [k, v] of Object.entries(h)) this._headers[k.toLowerCase()] = v;
    }
    async formData() {
      return this._body as FormData;
    }
    get headers() {
      return { get: (name: string) => this._headers[name.toLowerCase()] ?? null };
    }
  },
  NextResponse: {
    json: vi.fn((data: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: () => Promise.resolve(data),
    })),
  },
}));

import { NextRequest } from "next/server";

/** A query chain that resolves to a count when awaited. */
function buildLeadsChain(count = 0) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: null, count, error: null }).then(resolve);
  return chain;
}

function buildProfileChain(profile: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: profile, error: null }));
  return chain;
}

function jsonRequest(leads: unknown, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.append("leads", typeof leads === "string" ? leads : JSON.stringify(leads));
  return new NextRequest("http://localhost:3000/api/leads/import", {
    method: "POST",
    body: form,
    headers,
  });
}

async function importRoute() {
  return await import("@/app/api/leads/import/route");
}

describe("/api/leads/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      limit: 5,
      reset: new Date(),
    });
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockFrom.mockImplementation((table: string) =>
      table === "profiles"
        ? buildProfileChain({ plan: "pro" })
        : buildLeadsChain(0)
    );
  });

  it("rejects an unauthenticated caller", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann" }]));
    expect(res.status).toBe(401);
  });

  it("rejects a caller over the rate limit", async () => {
    mockApiRateLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      limit: 5,
      reset: new Date(),
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann" }]));
    expect(res.status).toBe(429);
  });

  it("rejects an oversized request before reading the body", async () => {
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest([{ full_name: "Ann" }], { "content-length": "99999999" })
    );
    expect(res.status).toBe(413);
    // The body must never be parsed for an oversized request.
    expect(mockApiRateLimit).toHaveBeenCalled();
  });

  it("rejects malformed JSON in the pre-parsed channel", async () => {
    const { POST } = await importRoute();

    const res = await POST(jsonRequest("{not json"));
    expect(res.status).toBe(400);
  });

  it("rejects rows whose field types are wrong", async () => {
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann", email: 12345 }]));
    expect(res.status).toBe(400);
  });

  it("imports valid rows and sanitizes formula injection", async () => {
    const insertedBatches: unknown[][] = [];
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return buildProfileChain({ plan: "pro" });
      const chain = buildLeadsChain(0);
      chain.insert = vi.fn((batch: unknown[]) => {
        insertedBatches.push(batch);
        return Promise.resolve({ data: null, error: null });
      });
      return chain;
    });

    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest([
        { full_name: "Ann Lee", email: "ann@example.com", phone: "555-0100" },
        { full_name: "=CMD('calc')" },
      ])
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(2);

    const rows = insertedBatches.flat() as Array<Record<string, unknown>>;
    const formulaRow = rows.find((r) => String(r.full_name).includes("CMD"));
    // The dangerous leading "=" is neutralised with a quote prefix.
    expect(formulaRow?.full_name).toBe("'=CMD('calc')");
    expect(formulaRow?.user_id).toBe("u1");
  });

  it("skips rows with an empty name and reports them", async () => {
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "   " }]));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(0);
    expect(body.errors.join(" ")).toContain("empty name");
  });

  it("skips rows whose name is too long", async () => {
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "x".repeat(101) }]));
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.errors.join(" ")).toContain("exceeds 100 characters");
  });

  it("truncates an over-long email and reports it", async () => {
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest([{ full_name: "Ann", email: "a".repeat(300) }])
    );
    const body = await res.json();

    expect(body.imported).toBe(1);
    expect(body.errors.join(" ")).toContain("email exceeds 255 characters");
  });

  it("truncates an over-long phone and reports it", async () => {
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest([{ full_name: "Ann", phone: "9".repeat(40) }])
    );
    const body = await res.json();

    expect(body.imported).toBe(1);
    expect(body.errors.join(" ")).toContain("phone exceeds 20 characters");
  });

  it("returns 500 when the plan cannot be read", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        const chain: Record<string, unknown> = {};
        chain.select = vi.fn(() => chain);
        chain.eq = vi.fn(() => chain);
        chain.single = vi.fn(() =>
          Promise.resolve({ data: null, error: { message: "nope" } })
        );
        return chain;
      }
      return buildLeadsChain(0);
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann" }]));
    expect(res.status).toBe(500);
  });

  it("returns 403 when the free plan has no slots left", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "profiles"
        ? buildProfileChain({ plan: "free" })
        : buildLeadsChain(10)
    );
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann" }]));
    expect(res.status).toBe(403);
  });

  it("truncates the import to the remaining free-tier slots", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "profiles"
        ? buildProfileChain({ plan: "free" })
        : buildLeadsChain(8)
    );
    const { POST } = await importRoute();

    const res = await POST(
      jsonRequest([{ full_name: "A" }, { full_name: "B" }, { full_name: "C" }])
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.imported).toBe(2);
    expect(body.errors.join(" ")).toContain("free plan limit reached");
  });

  it("reports a failed batch insert without losing the rest", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") return buildProfileChain({ plan: "pro" });
      const chain = buildLeadsChain(0);
      chain.insert = vi.fn(() =>
        Promise.resolve({ data: null, error: { message: "insert failed" } })
      );
      return chain;
    });
    const { POST } = await importRoute();

    const res = await POST(jsonRequest([{ full_name: "Ann" }]));
    const body = await res.json();

    expect(body.imported).toBe(0);
    expect(body.errors.join(" ")).toContain("insert failed");
  });

  describe("raw CSV upload path", () => {
    function fileRequest(content: string, filename = "leads.csv") {
      const form = new FormData();
      form.append("file", new File([content], filename, { type: "text/csv" }));
      return new NextRequest("http://localhost:3000/api/leads/import", {
        method: "POST",
        body: form,
      });
    }

    it("rejects a request with neither a file nor leads", async () => {
      const form = new FormData();
      const { POST } = await importRoute();

      const res = await POST(
        new NextRequest("http://localhost:3000/api/leads/import", {
          method: "POST",
          body: form,
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects a file field that is a plain string", async () => {
      const form = new FormData();
      form.append("file", "name\nAnn");
      const { POST } = await importRoute();

      const res = await POST(
        new NextRequest("http://localhost:3000/api/leads/import", {
          method: "POST",
          body: form,
        })
      );
      expect(res.status).toBe(400);
    });

    it("rejects binary content masquerading as CSV", async () => {
      const { POST } = await importRoute();

      const res = await POST(fileRequest("name\0email\nAnn"));
      expect(res.status).toBe(400);
    });

    it("rejects an empty CSV", async () => {
      const { POST } = await importRoute();

      const res = await POST(fileRequest("name,email\n"));
      expect(res.status).toBe(400);
    });

    it("imports rows from a raw CSV file", async () => {
      const { POST } = await importRoute();

      const res = await POST(fileRequest("name,email\nAnn Lee,ann@example.com"));
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.imported).toBe(1);
    });
  });
});
