import { describe, it, expect } from "vitest";
import Papa from "papaparse";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  sanitizeCsvValue,
  isBinaryContent,
} from "@/lib/csv-sanitize";

/**
 * Regression context (Aug 2026 audit): formula-injection sanitization lived
 * ONLY in the client import page. The server route /api/leads/import accepts
 * a pre-parsed `leads` JSON array and never sanitized it, so a direct POST
 * could store =CMD()/+SUM() payloads that later flow into data exports.
 *
 * These tests pin:
 *   1. The shared sanitizer's behavior (single source of truth in src/lib)
 *   2. That the SERVER route applies it to every string field on both the
 *      JSON and raw-CSV paths
 */

const IMPORT_ROUTE_PATH = resolve(
  process.cwd(),
  "src/app/api/leads/import/route.ts"
);
const importRouteSource = readFileSync(IMPORT_ROUTE_PATH, "utf8");

describe("sanitizeCsvValue (shared lib)", () => {
  it("passes through normal text", () => {
    expect(sanitizeCsvValue("John Smith")).toBe("John Smith");
    expect(sanitizeCsvValue("555-0123 ext.12")).toBe("555-0123 ext.12");
  });

  it("prefixes formula injection characters with a single quote", () => {
    expect(sanitizeCsvValue('=CMD("calc")')).toBe("'=CMD(\"calc\")");
    expect(sanitizeCsvValue("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(sanitizeCsvValue("-1+1")).toBe("'-1+1");
    expect(sanitizeCsvValue("@SUM(1)")).toBe("'@SUM(1)");
  });

  it("handles tab and carriage return prefixes", () => {
    expect(sanitizeCsvValue("\tformula")).toBe("'\tformula");
    expect(sanitizeCsvValue("\rformula")).toBe("'\rformula");
  });

  it("passes through empty strings", () => {
    expect(sanitizeCsvValue("")).toBe("");
  });
});

describe("isBinaryContent (shared lib)", () => {
  it("accepts normal CSV text", () => {
    expect(isBinaryContent("name,email\nJohn,john@test.com")).toBe(false);
  });

  it("rejects content with null bytes", () => {
    expect(isBinaryContent("name\0email")).toBe(true);
  });
});

describe("/api/leads/import server-side sanitization", () => {
  it("imports the shared sanitizer", () => {
    expect(importRouteSource).toContain('from "@/lib/csv-sanitize"');
  });

  it("sanitizes name, email, and phone on the client-JSON path", () => {
    // The row-mapping block must run every stored string through the
    // sanitizer before validation/truncation.
    const jsonPathBlock = importRouteSource.slice(
      importRouteSource.indexOf("Validate each row"),
      importRouteSource.indexOf("Plan limit enforcement")
    );
    expect(jsonPathBlock).toContain("sanitizeCsvValue(name)");
    expect(jsonPathBlock).toContain("sanitizeCsvValue(email)");
    expect(jsonPathBlock).toContain("sanitizeCsvValue(phone)");
  });

  it("sanitizes fields on the raw-CSV fallback path too", () => {
    const csvFallbackBlock = importRouteSource.slice(
      importRouteSource.indexOf("Fallback: accept raw CSV file"),
      importRouteSource.indexOf("Validate each row")
    );
    expect(csvFallbackBlock).toContain("sanitizeCsvValue");
  });
});

  describe("papaparse parsing", () => {
    it("parses simple CSV", () => {
      const csv = "name,email,phone\nJohn,john@test.com,555-0123\nJane,jane@test.com,555-0456";
      const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
      expect(result.errors).toHaveLength(0);
      expect(result.data).toHaveLength(2);
      expect((result.data[0] as Record<string, string>).name).toBe("John");
    });

    it("handles quoted fields with commas", () => {
      const csv = 'name,email\n"Smith, Jr.",john@test.com';
      const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
      expect(result.errors).toHaveLength(0);
      expect((result.data[0] as Record<string, string>).name).toBe("Smith, Jr.");
    });

    it("handles empty lines", () => {
      const csv = "name,email\nJohn,john@test.com\n\nJane,jane@test.com\n";
      const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
      expect(result.data).toHaveLength(2);
    });

    it("handles semicolon delimiter", () => {
      const csv = "name;email\nJohn;john@test.com";
      const result = Papa.parse(csv, { header: true, skipEmptyLines: true, delimiter: ";" });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as Record<string, string>).name).toBe("John");
    });

    it("detects First Name + Last Name columns", () => {
      const csv = "First Name,Last Name,Email,Phone\nShelby,Terrell,elijah57@example.net,555-0123";
      const result = Papa.parse(csv, { header: true, skipEmptyLines: true });
      const originalHeaders = Object.keys(result.data[0] as Record<string, string>);
      const headers = originalHeaders.map((h) => h.trim().toLowerCase());

      const nameIdx = headers.findIndex((h) =>
        ["name", "full_name", "fullname", "contact", "lead", "first name", "first_name", "firstname"].includes(h)
      );
      const lastNameIdx = headers.findIndex((h) =>
        ["last name", "last_name", "lastname", "surname"].includes(h)
      );
      const emailIdx = headers.findIndex((h) =>
        ["email", "email_address", "emailaddress", "e-mail"].includes(h)
      );

      expect(headers[nameIdx]).toBe("first name");
      expect(headers[lastNameIdx]).toBe("last name");
      expect(headers[emailIdx]).toBe("email");

      const row = result.data[0] as Record<string, string>;
      const firstName = row[originalHeaders[nameIdx]];
      const lastName = row[originalHeaders[lastNameIdx]];
      expect(`${firstName} ${lastName}`).toBe("Shelby Terrell");
    });
  });
