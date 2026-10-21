import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PRO_PRICE_AMOUNTS,
  PRO_PRICE_CURRENCY,
  proPriceLabel,
  proPriceValue,
  toMajorUnits,
} from "@/lib/pricing";

/**
 * The Pro price used to be written out in five places across two different
 * units — 800 cents in the payment library, 8 dollars in the pricing data
 * module, "$8/mo" as a literal string in three UI surfaces, and "8" as a
 * JSON-LD string. A unit mistake was one edit away from charging the wrong
 * amount (Oct 21 2026 audit, finding M8).
 *
 * These tests pin the canonical values and check that no surface reintroduces
 * a hardcoded price.
 */

const SRC = join(process.cwd(), "src");

function read(relativePath: string): string {
  return readFileSync(join(SRC, relativePath), "utf8");
}

describe("canonical Pro price", () => {
  it("stores amounts in the smallest currency unit", () => {
    expect(PRO_PRICE_AMOUNTS.monthly).toBe(800);
    expect(PRO_PRICE_AMOUNTS.annual).toBe(8000);
    expect(PRO_PRICE_CURRENCY).toBe("usd");
  });

  it("derives the major-unit value from the minor-unit amount", () => {
    expect(toMajorUnits(800)).toBe(8);
    expect(toMajorUnits(8000)).toBe(80);
    expect(proPriceValue("monthly")).toBe(8);
    expect(proPriceValue("annual")).toBe(80);
  });

  it("derives the display labels from the same numbers", () => {
    expect(proPriceLabel("monthly")).toBe("$8/mo");
    expect(proPriceLabel("annual")).toBe("$80/yr");
  });

  it("keeps the label in step with the amount", () => {
    // A change to the amount must change the label, with no second edit.
    const amount = PRO_PRICE_AMOUNTS.monthly;
    expect(proPriceLabel("monthly")).toBe(`$${amount / 100}/mo`);
  });
});

describe("price surfaces derive from the canonical source", () => {
  const surfaces = [
    "app/layout.tsx",
    "app/(dashboard)/settings/billing/page.tsx",
    "app/(dashboard)/settings/page.tsx",
    "lib/pricing-data.ts",
    "lib/paymongo.ts",
  ];

  it.each(surfaces)("%s has no hardcoded price literal", (surface) => {
    const source = read(surface);
    // "$8/mo", "$80/yr" and a bare `price: "8"` are the shapes that drifted.
    expect(source).not.toMatch(/\$8\/mo/);
    expect(source).not.toMatch(/\$80\/yr/);
    expect(source).not.toMatch(/monthlyPrice:\s*8\b/);
    expect(source).not.toMatch(/annualPrice:\s*80\b/);
    expect(source).not.toMatch(/price:\s*"8"/);
  });

  it("the payment library reads the canonical amounts", () => {
    const source = read("lib/paymongo.ts");
    expect(source).toContain("PRO_PRICE_AMOUNTS.monthly");
    expect(source).toContain("PRO_PRICE_AMOUNTS.annual");
    expect(source).toContain("PRO_PRICE_CURRENCY");
  });

  it("the pricing data module reads the canonical values", () => {
    const source = read("lib/pricing-data.ts");
    expect(source).toContain('from "@/lib/pricing"');
    expect(source).toContain("proPriceValue(");
  });

  it("the UI surfaces read the canonical label", () => {
    for (const surface of [
      "app/(dashboard)/settings/billing/page.tsx",
      "app/(dashboard)/settings/page.tsx",
    ]) {
      const source = read(surface);
      expect(source).toContain('from "@/lib/pricing"');
      expect(source).toContain("proPriceLabel(");
    }
  });
});
