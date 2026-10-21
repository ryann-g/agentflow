import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The routes under (dashboard) render the signed-in user's own data, so they
 * must never be prerendered at build time.
 *
 * Without an explicit `dynamic = "force-dynamic"`, Next.js decides each
 * route's rendering mode by watching for `cookies()`. `createClient()`
 * throws before it reaches `cookies()` when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are absent from the build environment --
 * which is exactly the case in the Vercel preview environment, where those
 * two variables are not set. The build then attempted to prerender an
 * authenticated page and failed with:
 *
 *   Error occurred prerendering page "/dashboard".
 *   Error: Supabase environment variables ... are not configured
 *
 * Saying it explicitly means the build never tries, whatever the
 * environment holds.
 */

const LAYOUT_PATH = join(process.cwd(), "src/app/(dashboard)/layout.tsx");

describe("(dashboard) route segment config", () => {
  const layout = readFileSync(LAYOUT_PATH, "utf8");

  it("marks the authenticated route group as dynamic", () => {
    expect(layout).toMatch(/export const dynamic\s*=\s*"force-dynamic"/);
  });

  it("is a Server Component, so it can carry route segment config", () => {
    expect(layout).not.toMatch(/^"use client"/m);
  });

  it("still renders the shared dashboard layout", () => {
    expect(layout).toContain("DashboardLayout");
    expect(layout).toContain("{children}");
  });
});
