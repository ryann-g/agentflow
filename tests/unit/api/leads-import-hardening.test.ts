import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  importLeadRowSchema,
  importLeadsSchema,
  LEAD_FIELD_MAX_LENGTHS,
  leadSchema,
} from "@/lib/validations";

/**
 * Regression guard for the Oct 21 2026 audit findings H1, H2, H3 and L8.
 *
 * H1 — the route read the request body with `request.formData()` (which
 *      buffers the whole payload in memory) and only checked the size
 *      afterwards, so the check could not prevent the allocation.
 * H2 — the pre-parsed `leads` channel was `JSON.parse`d with no schema, so a
 *      row with a non-string email reached `.trim()` and threw an unhandled
 *      TypeError (HTTP 500).
 * H3 — `formData.get("file")` was cast to `File` without a runtime check, so
 *      a plain string field passed the size check and crashed on `.text()`.
 * L8  — truncation sliced to 101/256/21 while the schema allows 100/255/20.
 */

const IMPORT_ROUTE_PATH = join(
  process.cwd(),
  "src/app/api/leads/import/route.ts"
);
const importRouteSource = readFileSync(IMPORT_ROUTE_PATH, "utf8");

describe("importLeadsSchema rejects malformed rows instead of crashing", () => {
  it("accepts a well-formed row", () => {
    const result = importLeadRowSchema.safeParse({
      full_name: "John Smith",
      email: "john@example.com",
      phone: "555-0123",
      source: "csv_import",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null fields for unmapped columns", () => {
    const result = importLeadRowSchema.safeParse({
      full_name: "John Smith",
      email: null,
      phone: null,
      source: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-string email instead of letting .trim() throw", () => {
    const result = importLeadRowSchema.safeParse({
      full_name: "John Smith",
      email: 12345,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string full_name", () => {
    const result = importLeadRowSchema.safeParse({
      full_name: { first: "John" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a null row", () => {
    expect(importLeadsSchema.safeParse([null]).success).toBe(false);
  });

  it("rejects more rows than the import cap allows", () => {
    const rows = Array.from({ length: 10_001 }, () => ({ full_name: "x" }));
    expect(importLeadsSchema.safeParse(rows).success).toBe(false);
  });

  it("accepts exactly the import cap", () => {
    const rows = Array.from({ length: 10_000 }, () => ({ full_name: "x" }));
    expect(importLeadsSchema.safeParse(rows).success).toBe(true);
  });
});

describe("lead field length limits have a single source of truth", () => {
  it("exposes the same bounds the lead schema enforces", () => {
    expect(leadSchema.safeParse({ full_name: "x".repeat(100) }).success).toBe(true);
    expect(leadSchema.safeParse({ full_name: "x".repeat(101) }).success).toBe(false);
    expect(
      leadSchema.safeParse({ full_name: "x", email: "a@b.co" }).success
    ).toBe(true);
  });

  it("keeps the constants aligned with the schema", () => {
    expect(LEAD_FIELD_MAX_LENGTHS.full_name).toBe(100);
    expect(LEAD_FIELD_MAX_LENGTHS.email).toBe(255);
    expect(LEAD_FIELD_MAX_LENGTHS.phone).toBe(20);
  });
});

describe("/api/leads/import request hardening", () => {
  it("checks Content-Length before reading the body", () => {
    // Match the statements, not the explanatory comment, which mentions
    // request.formData() by name.
    const lengthGuard = importRouteSource.indexOf("const contentLength =");
    const bodyRead = importRouteSource.indexOf("await request.formData()");

    expect(lengthGuard).toBeGreaterThan(-1);
    expect(bodyRead).toBeGreaterThan(-1);
    expect(lengthGuard).toBeLessThan(bodyRead);
  });

  it("rejects an oversized body with 413", () => {
    expect(importRouteSource).toContain("MAX_REQUEST_SIZE");
    expect(importRouteSource).toContain("{ status: 413 }");
  });

  it("caps the pre-parsed JSON channel separately from the multipart body", () => {
    expect(importRouteSource).toContain("MAX_LEADS_JSON_BYTES");
    const jsonCheck = importRouteSource.indexOf("MAX_LEADS_JSON_BYTES");
    const jsonParse = importRouteSource.indexOf("JSON.parse(leadsJson)");
    expect(jsonCheck).toBeLessThan(jsonParse);
  });

  it("validates the pre-parsed channel with a schema", () => {
    expect(importRouteSource).toContain('from "@/lib/validations"');
    expect(importRouteSource).toContain("importLeadsSchema.safeParse");
  });

  it("type-checks the uploaded file instead of casting it", () => {
    expect(importRouteSource).toContain("instanceof File");
    expect(importRouteSource).not.toContain('as File | null');
  });

  it("truncates to the shared length constants, not hardcoded offsets", () => {
    expect(importRouteSource).toContain(
      "sanitizeCsvValue(name).slice(0, LEAD_FIELD_MAX_LENGTHS.full_name)"
    );
    expect(importRouteSource).not.toMatch(/slice\(0, 10[01]\)/);
    expect(importRouteSource).not.toMatch(/slice\(0, 25[56]\)/);
    expect(importRouteSource).not.toMatch(/slice\(0, 2[01]\)/);
  });

  it("caps rows on the raw-CSV path too, not only the JSON path", () => {
    expect(importRouteSource).toContain("MAX_IMPORT_ROWS");
    const csvBranch = importRouteSource.slice(
      importRouteSource.indexOf("Fallback: accept raw CSV file"),
      importRouteSource.indexOf("Validate each row")
    );
    expect(csvBranch).toContain("MAX_IMPORT_ROWS");
  });
});
