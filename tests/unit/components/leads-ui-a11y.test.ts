import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Source-assertion tests for the leads/pipeline UI quick-win pass:
 *
 * 1. Lead selection checkboxes expose real semantics to screen readers
 *    (role="checkbox" + aria-checked + accessible name) — previously bare
 *    buttons invisible to assistive tech.
 * 2. Custom dropdowns (leads sort menu, pipeline stage menu) close on
 *    outside click / touch / Escape via the shared useDismiss hook —
 *    previously they stayed open until re-clicked.
 * 3. Meta text uses surface-500 (#64748B, 4.76:1 AA) instead of
 *    surface-400 (#94A3B8, ~2.5:1 fail) per the project's own WCAG rule.
 */

const LEADS_CLIENT = resolve(
  process.cwd(),
  "src/app/(dashboard)/leads/leads-client.tsx"
);
const PIPELINE_BOARD = resolve(
  process.cwd(),
  "src/components/pipeline/pipeline-board.tsx"
);
const USE_DISMISS = resolve(process.cwd(), "src/hooks/use-dismiss.ts");

const leadsSource = readFileSync(LEADS_CLIENT, "utf8");
const boardSource = readFileSync(PIPELINE_BOARD, "utf8");

describe("lead selection checkboxes (a11y)", () => {
  it("exposes checkbox semantics", () => {
    expect(leadsSource).toContain('role="checkbox"');
    expect(leadsSource).toContain("aria-checked={");
  });

  it("gives each checkbox an accessible name tied to its lead", () => {
    expect(leadsSource).toContain("aria-label={`Select ${lead.full_name}`}");
  });

  it("hides the decorative checkmark svg from screen readers", () => {
    expect(leadsSource).toMatch(/aria-hidden="true">\s*<path strokeLinecap/);
  });
});

describe("dropdown dismissal (outside click / Escape)", () => {
  const hookSource = readFileSync(USE_DISMISS, "utf8");

  it("shared useDismiss hook exists", () => {
    expect(hookSource).toMatch(/export function useDismiss/);
  });

  it("hook listens for pointer and Escape and cleans up", () => {
    expect(hookSource).toContain('"mousedown"');
    expect(hookSource).toContain('"touchstart"');
    expect(hookSource).toContain('"keydown"');
    expect(hookSource).toContain('"Escape"');
    expect(hookSource.match(/removeEventListener/g)?.length).toBe(3);
  });

  it("hook no-ops while inactive (no listeners for closed menus)", () => {
    expect(hookSource).toMatch(/if \(!active\) return;/);
  });

  it("leads sort menu uses useDismiss", () => {
    expect(leadsSource).toContain("useDismiss");
    expect(leadsSource).toContain("setShowSortMenu(false)");
  });

  it("pipeline stage menu uses useDismiss", () => {
    expect(boardSource).toContain("useDismiss");
    expect(boardSource).toContain("setShowStageMenu(false)");
  });
});

describe("contrast tokens (WCAG AA)", () => {
  it("no surface-400 meta text remains in leads-client or pipeline-board", () => {
    expect(leadsSource).not.toMatch(/text-surface-400/);
    expect(boardSource).not.toMatch(/text-surface-400/);
  });
});
