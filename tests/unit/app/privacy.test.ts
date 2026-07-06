import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Source-assertion tests for the public /privacy page.
 *
 * Mirrors the pattern used in terms.test.ts — pattern-matches the source
 * for key content markers without spinning up a React render tree.
 */

const PRIVACY_PATH = resolve(process.cwd(), "src/app/privacy/page.tsx");
const source = readFileSync(PRIVACY_PATH, "utf8");

const SECTIONS = [
  "1. Information We Collect",
  "2. Use of Information",
  "3. Information Sharing and Disclosure",
  "4. Data Security",
  "5. Data Retention and User Rights",
  "6. Cookies and Tracking",
  "7. Third-Party Security Services (Cloudflare Turnstile)",
  "8. International Data Transfers",
  "9. Age Restrictions",
  "10. Contact Information",
] as const;

describe("/privacy page (source assertions)", () => {
  it("is a Server Component (no 'use client' directive)", () => {
    expect(source.startsWith('"use client"')).toBe(false);
    expect(source.startsWith("'use client'")).toBe(false);
  });

  it("exports Next.js metadata for SEO", () => {
    expect(source).toMatch(/export const metadata:\s*Metadata/);
    expect(source).toMatch(/title:\s*"Privacy Policy/);
  });

  it("has a branded nav with AgentFlow logo and wordmark", () => {
    expect(source).toContain("AgentFlow");
    expect(source).toContain("bg-primary flex items-center justify-center");
  });

  it("uses a two-column layout on desktop (lg:grid)", () => {
    expect(source).toContain("lg:grid lg:grid-cols-[200px_1fr] lg:gap-12");
  });

  it("has a sticky sidebar table of contents", () => {
    expect(source).toContain('aria-label="Table of contents"');
    expect(source).toContain("sticky top-24");
    expect(source).toContain("Contents");
  });

  it("has a collapsible mobile TOC (details/summary)", () => {
    expect(source).toContain("<details");
    expect(source).toContain("lg:hidden");
    expect(source).toContain("Table of Contents");
  });

  it("each section has an id anchor for deep linking", () => {
    const anchors = ["collect", "use", "sharing", "security", "retention", "cookies", "turnstile", "transfers", "age", "contact"];
    for (const id of anchors) {
      expect(source, `missing section anchor id="${id}"`).toContain(`id: "${id}"`);
    }
    expect(source).toContain("id={s.id}");
  });

  it("shows the current Effective Date (June 6, 2026)", () => {
    expect(source).toContain("Effective Date: June 6, 2026");
  });

  it("lists all 10 sections", () => {
    // Section titles in the SECTIONS array don't include the number prefix
    const SECTION_TITLES = [
      "Information We Collect",
      "Use of Information",
      "Information Sharing and Disclosure",
      "Data Security",
      "Data Retention and User Rights",
      "Cookies and Tracking",
      "Third-Party Security Services (Cloudflare Turnstile)",
      "International Data Transfers",
      "Age Restrictions",
      "Contact Information",
    ];
    for (const title of SECTION_TITLES) {
      expect(source, `missing section title: ${title}`).toContain(title);
    }
  });

  it("contains the privacy email as a mailto link", () => {
    expect(source).toContain('href="mailto:privacy@agent-flow.app"');
    expect(source).toContain("privacy@agent-flow.app");
  });

  it("contains the website as an external link with safe rel", () => {
    expect(source).toContain('href="https://agent-flow.app"');
    expect(source).toMatch(
      /href="https:\/\/agent-flow\.app"[^>]*target="_blank"/
    );
    expect(source).toMatch(
      /href="https:\/\/agent-flow\.app"[^>]*rel="noopener noreferrer"/
    );
  });

  it("mentions Cloudflare Turnstile in §7", () => {
    expect(source).toMatch(/Cloudflare Turnstile/i);
    expect(source).toContain("cloudflare.com/privacypolicy");
  });

  it("mentions Stripe for payment processing", () => {
    expect(source).toMatch(/Stripe/i);
  });

  it("mentions Supabase for database hosting", () => {
    expect(source).toMatch(/Supabase/i);
  });

  it("states data is deleted within 30 days of account cancellation", () => {
    expect(source).toMatch(/30 days/i);
  });

  it("does NOT contain the old section headings", () => {
    const oldHeadings = [
      "What We Collect",
      "How We Use Your Data",
      "Who We Share Data With",
      "Keeping Your Data Safe",
      "Get In Touch",
    ];
    for (const old of oldHeadings) {
      expect(source, `legacy heading still present: ${old}`).not.toContain(old);
    }
  });

  it("states users must be at least 18 years of age", () => {
    expect(source).toMatch(/18 years/i);
  });

  it("mentions the __cf_bm security cookie", () => {
    expect(source).toContain("__cf_bm");
  });
});
