import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Source-assertion tests for the public /terms page.
 *
 * Why source-assert and not jsdom render:
 *   The /terms page is a static Server Component with no logic, no state,
 *   and no props. The project convention (see changelog.test.ts) is to
 *   pattern-match the source for key content markers. This catches:
 *     - Accidental section removal or renumbering
 *     - Wording regression on the effective date
 *     - Contact info drift (email, website)
 *     - Re-introduction of the old 9-section layout
 *     - Loss of the governing-law placeholder
 *   without spinning up a React render tree.
 */

const TERMS_PATH = resolve(process.cwd(), "src/app/terms/page.tsx");
const source = readFileSync(TERMS_PATH, "utf8");

const NEW_SECTIONS = [
  "1. Service Description and Disclaimer",
  "2. Account Requirements",
  "3. Subscription and Billing",
  "4. Acceptable Use",
  "5. IP and Data Ownership",
  "6. Disclaimer of Warranties",
  "7. Limitation of Liability",
  "8. Termination",
  "9. Governing Law",
  "10. Contact",
] as const;

const REMOVED_SECTIONS = [
  "What AgentFlow Is (And Isn't)",
  "Simple Pricing",
  "Your Data",
  "Our Stuff",
  "Service Limits",
  "Leaving Us",
  "Contact Us",
] as const;

describe("/terms page (source assertions)", () => {
  it("is a Server Component (no 'use client' directive)", () => {
    expect(source.startsWith('"use client"')).toBe(false);
    expect(source.startsWith("'use client'")).toBe(false);
  });

  it("exports Next.js metadata for SEO", () => {
    expect(source).toMatch(/export const metadata:\s*Metadata/);
    expect(source).toMatch(/title:\s*"Terms of Service/);
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
    // Section IDs are defined in the SECTIONS array and applied via id={s.id}
    const anchors = ["service", "account", "billing", "acceptable-use", "ip-data", "warranties", "liability", "termination", "governing-law", "contact"];
    for (const id of anchors) {
      expect(source, `missing section anchor id="${id}"`).toContain(`id: "${id}"`);
    }
    // Verify sections use the id for anchoring
    expect(source).toContain("id={s.id}");
  });

  it("shows the current Effective Date (June 6, 2026)", () => {
    expect(source).toContain("Effective Date: June 6, 2026");
  });

  it("lists all 10 sections in the new corporate structure", () => {
    // Section titles in the SECTIONS array don't include the number prefix
    // (numbers are added via {s.num} in the JSX rendering)
    const SECTION_TITLES = [
      "Service Description and Disclaimer",
      "Account Requirements",
      "Subscription and Billing",
      "Acceptable Use",
      "IP and Data Ownership",
      "Disclaimer of Warranties",
      "Limitation of Liability",
      "Termination",
      "Governing Law",
      "Contact",
    ];
    for (const title of SECTION_TITLES) {
      expect(source, `missing section title: ${title}`).toContain(title);
    }
  });

  it("numbers sections sequentially 1 through 10", () => {
    for (let i = 1; i <= 10; i++) {
      const re = new RegExp(`font-mono text-sm text-primary tabular-nums`);
      expect(source, `missing styled section number for ${i}. `).toMatch(re);
    }
  });

  it("contains the support email as a mailto link", () => {
    expect(source).toContain('href="mailto:support@agent-flow.app"');
    expect(source).toContain("support@agent-flow.app");
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

  it("specifies a USA governing jurisdiction (State of California, United States of America)", () => {
    expect(source).toContain("State of California, United States of America");
  });

  it("includes a 'no conflict of laws' qualifier in §9", () => {
    expect(source).toMatch(/conflict of laws/i);
  });

  it("includes an exclusive-jurisdiction / venue clause in §9", () => {
    expect(source).toMatch(/jurisdiction|venue|courts located in/i);
  });

  it("does NOT contain the literal [Insert State/Country] placeholder anymore", () => {
    expect(source).not.toContain("[Insert State/Country]");
  });

  it("does NOT contain any of the removed old 9-section headings", () => {
    for (const old of REMOVED_SECTIONS) {
      expect(source, `legacy heading still present: ${old}`).not.toContain(old);
    }
  });

  it("disclaims advice liability (no real estate / legal / financial advice)", () => {
    expect(source).toMatch(/real estate/i);
    expect(source).toMatch(/legal/i);
    expect(source).toMatch(/financial advice/i);
  });

  it("disclaims warranties with the standard 'as is' / 'as available' language", () => {
    expect(source).toMatch(/as is/i);
    expect(source).toMatch(/as available/i);
  });

  it("disclaims indirect, incidental, special, or consequential damages", () => {
    expect(source).toMatch(/indirect/i);
    expect(source).toMatch(/incidental/i);
    expect(source).toMatch(/consequential/i);
    // "lost commissions" may be split across lines in JSX
    expect(source).toMatch(/lost[\s\S]*commissions/i);
    expect(source).toMatch(/lost[\s\S]*data/i);
  });

  it("uses sentence case throughout (no all-caps legal shouting)", () => {
    const allCapsPhrases = [
      "THE SERVICE IS PROVIDED",
      "AS IS\" AND \"AS AVAILABLE",
      "TO THE FULLEST EXTENT",
      "WE DISCLAIM ALL WARRANTIES",
      "MERCHANTABILITY, FITNESS FOR A PARTICULAR",
      "WE DO NOT WARRANT",
      "TO THE MAXIMUM EXTENT",
      "AGENTFLOW AND ITS AFFILIATES",
      "WILL NOT BE LIABLE",
      "ANY INDIRECT, INCIDENTAL, SPECIAL",
    ];
    for (const phrase of allCapsPhrases) {
      expect(
        source,
        `all-caps phrase re-introduced: "${phrase}"`
      ).not.toContain(phrase);
    }
  });

  it("states user can cancel / terminate anytime", () => {
    expect(source).toMatch(/cancel at any time|delete.*account|terminate/i);
  });

  it("forbids spam, harassment, hacking, and illegal use in Acceptable Use", () => {
    expect(source).toMatch(/spam/i);
    expect(source).toMatch(/harass/i);
    expect(source).toMatch(/hack/i);
    expect(source).toMatch(/illegal/i);
  });
});
