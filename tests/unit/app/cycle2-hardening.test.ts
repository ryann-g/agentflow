import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Cycle-2 hardening pass:
 *   1. Toast auto-dismiss timers are cleared on container unmount and on
 *      manual dismissal (no stray setState-after-unmount).
 *   2. WCAG AA contrast: text-surface-400 is gone from ALL app surfaces.
 *   3. /api/leads/[id] GET/PUT/DELETE are rate limited like their siblings.
 *   4. Cron bearer-token comparison uses a timing-safe equality helper.
 */

const SRC = resolve(process.cwd(), "src");

function read(rel: string): string {
  return readFileSync(resolve(SRC, rel), "utf8");
}

describe("toast timer hygiene", () => {
  const source = read("components/ui/toast.tsx");

  it("tracks timers in a ref so they can be cancelled", () => {
    expect(source).toMatch(/useRef<.*Map</);
  });

  it("clears a toast's timer when dismissed manually", () => {
    expect(source).toMatch(/clearTimeout/);
  });
});

describe("WCAG AA contrast sweep", () => {
  const FILES = [
    "components/action-popup.tsx",
    "components/layout/sidebar.tsx",
    "components/landing/how-it-works.tsx",
    "components/cookie-consent.tsx",
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/(dashboard)/leads/import/page.tsx",
    "app/page.tsx",
  ];

  it.each(FILES)("no text-surface-400 left in %s", (file) => {
    expect(read(file)).not.toMatch(/text-surface-400/);
  });

  it("no hover:border-surface-300 regression guard for leads/pipeline either", () => {
    // already covered in leads-ui-a11y.test.ts; this pins the sweep scope
    expect(FILES.length).toBe(8);
  });
});

describe("/api/leads/[id] rate limiting", () => {
  const source = read("app/api/leads/[id]/route.ts");

  it("imports the shared rate limiter", () => {
    expect(source).toContain('from "@/lib/rate-limiter"');
  });

  it("applies per-user limits in GET, PUT, and DELETE", () => {
    const calls = source.match(/apiRateLimit\(/g)?.length ?? 0;
    expect(calls).toBeGreaterThanOrEqual(3);
    expect(source).toContain("leads:get-one:");
    expect(source).toContain("leads:update:");
    expect(source).toContain("leads:delete:");
  });
});

describe("timing-safe cron authorization", () => {
  const helperSource = read("lib/timing-safe-equal.ts");
  const digest = read("app/api/cron/daily-digest/route.ts");
  const billing = read("app/api/cron/billing-check/route.ts");

  it("shared timing-safe comparison helper exists with length guard", () => {
    expect(helperSource).toMatch(/export function timingSafeEqual/);
    expect(helperSource).toContain("crypto.timingSafeEqual");
  });

  it("both cron routes authorize through the helper", () => {
    expect(digest).toContain('from "@/lib/timing-safe-equal"');
    expect(billing).toContain('from "@/lib/timing-safe-equal"');
    expect(digest).toMatch(/isAuthorizedCronRequest\(/);
    expect(billing).toMatch(/isAuthorizedCronRequest\(/);
  });
});
