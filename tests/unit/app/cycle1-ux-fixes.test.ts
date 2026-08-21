import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Source-assertion tests for the Cycle-1 UX fixes:
 *   1. Login password view offers a way back to magic-link sign-in
 *   2. Signup surfaces real Supabase error messages (not a blanket
 *      "Something went wrong")
 *   3. Pipeline page redirects unauthenticated visitors like its siblings
 *   4. Billing cancel no longer flips the plan badge to Free while the
 *      success message says the user keeps Pro until period end
 *   5. CSV import drop zone actually accepts drag-and-drop
 */

const SRC = resolve(process.cwd(), "src");

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

describe("login password view navigation", () => {
  const source = read("app/(auth)/login/page.tsx");

  it("offers an explicit switch back to magic-link from the password view", () => {
    expect(source).toContain('setActiveView("magic-link")');
    expect(source).toContain("Use magic link instead");
  });
});

describe("signup error surfacing", () => {
  const source = read("app/(auth)/signup/page.tsx");

  it("uses a humanizer that maps known Supabase OTP errors", () => {
    expect(source).toMatch(/function humanizeSignupError/);
    expect(source).toMatch(/rate limit/i);
  });

  it("falls back to the real error message before the generic one", () => {
    expect(source).toMatch(/error\.message/);
  });

  it("no longer shows only the blanket generic message", () => {
    expect(source).not.toContain(
      'setErrorMessage("Something went wrong. Please try again.");'
    );
  });
});

describe("pipeline page auth redirect", () => {
  const source = read("app/(dashboard)/pipeline/page.tsx");

  it("redirects unauthenticated visitors to /login like leads/follow-ups", () => {
    expect(source).toMatch(/redirect\("\/login"\)/);
    expect(source).not.toMatch(/return null;/);
  });
});

describe("billing cancel state consistency", () => {
  const source = read("app/(dashboard)/settings/billing/page.tsx");

  it("keeps the Pro badge after requesting cancellation (webhook owns downgrade)", () => {
    expect(source).not.toMatch(/setPlan\("free"\)/);
  });

  it("still records the cancelled subscription status for display", () => {
    expect(source).toMatch(/setSubscriptionStatus\("cancelled"\)/);
  });
});

describe("CSV import drag-and-drop", () => {
  const source = read("app/(dashboard)/leads/import/page.tsx");

  it("wires onDrop/onDragOver handlers to the upload zone", () => {
    expect(source).toMatch(/onDrop=\{handleDrop\}/);
    expect(source).toMatch(/onDragOver=\{handleDragOver\}/);
    expect(source).toMatch(/onDragLeave=\{handleDragLeave\}/);
  });

  it("routes dropped files through the same processing path as file input", () => {
    expect(source).toMatch(/function processFile\(file: File\)/);
    expect(source).toMatch(/processFile\(selectedFile\)/);
    expect(source).toMatch(/processFile\(file\)/);
  });

  it("accepts .csv files dropped via dataTransfer", () => {
    expect(source).toMatch(/dataTransfer\.files/);
  });
});
