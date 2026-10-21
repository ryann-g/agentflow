import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for audit finding C2 (Oct 21 2026).
 *
 * The app used to write leads straight to PostgREST from the browser, which
 * bypassed every check living in the /api/leads route handlers: Zod
 * validation, rate limiting, the free-tier plan limit, and the `is_active`
 * re-activation guard. The routes were reachable only from tests, so the
 * guards never ran in production.
 *
 * These assertions are source-level on purpose: the vitest config runs in the
 * `node` environment with no DOM, so behaviour-level rendering is not
 * available. What we are protecting is the *shape* of the write path — which
 * transport a write travels over — and that is a static property.
 */

const SRC = join(process.cwd(), "src");

function read(relativePath: string): string {
  return readFileSync(join(SRC, relativePath), "utf8");
}

describe("lead writes go through the /api/leads route handlers", () => {
  const hooks = read("hooks/useLeads.ts");

  describe("src/hooks/useLeads.ts", () => {
    it("posts new leads to /api/leads instead of inserting via PostgREST", () => {
      const createLead = hooks.slice(
        hooks.indexOf("export async function createLead"),
        hooks.indexOf("export async function updateLead")
      );

      expect(createLead).toContain('apiWrite<Lead>("/api/leads"');
      expect(createLead).toContain('method: "POST"');
      expect(createLead).not.toMatch(/\.from\(["']leads["']\)\s*\.insert/);
    });

    it("puts lead updates through /api/leads/[id] instead of updating via PostgREST", () => {
      const updateLead = hooks.slice(
        hooks.indexOf("export async function updateLead"),
        hooks.indexOf("export async function deleteLead")
      );

      expect(updateLead).toContain("apiWrite<Lead>(`/api/leads/${id}`");
      expect(updateLead).toContain('method: "PUT"');
      expect(updateLead).not.toMatch(/\.from\(["']leads["']\)\s*\.update/);
    });

    it("puts lead soft-deletes through /api/leads/[id] instead of updating via PostgREST", () => {
      const deleteLead = hooks.slice(
        hooks.indexOf("export async function deleteLead"),
        hooks.indexOf("export async function bulkDeleteLeads")
      );

      expect(deleteLead).toContain("apiWrite<{ success: boolean }>(`/api/leads/${id}`");
      expect(deleteLead).toContain('method: "DELETE"');
      expect(deleteLead).not.toMatch(/\.from\(["']leads["']\)/);
    });

    it("never lets a caller set user_id on a new lead", () => {
      const createLead = hooks.slice(
        hooks.indexOf("export async function createLead"),
        hooks.indexOf("export async function updateLead")
      );

      // The route derives user_id from the session.
      expect(createLead).toContain('Omit<LeadInsert, "user_id">');
      expect(createLead).not.toMatch(/user_id:/);
    });

    it("keeps reads on PostgREST, where row-level security does the scoping", () => {
      const fetchLeads = hooks.slice(
        hooks.indexOf("export async function fetchLeads"),
        hooks.indexOf("export async function createLead")
      );

      expect(fetchLeads).toContain('.from("leads")');
      expect(fetchLeads).toContain('.eq("user_id", user.id)');
    });

    it("keeps bulk operations on the ownership-checked Postgres RPCs", () => {
      const bulk = hooks.slice(hooks.indexOf("export async function bulkDeleteLeads"));

      expect(bulk).toContain('supabase.rpc("bulk_delete_leads"');
      expect(bulk).toContain('supabase.rpc("bulk_update_leads"');
    });
  });

  describe("call sites", () => {
    it("the new-lead page creates through the createLead hook", () => {
      const page = read("app/(dashboard)/leads/new/page.tsx");

      expect(page).toContain('from "@/hooks/useLeads"');
      expect(page).toContain("createLead(");
      expect(page).not.toMatch(/\.from\(["']leads["']\)\s*\.insert/);
    });

    it("the edit page saves through the updateLead hook", () => {
      const page = read("app/(dashboard)/leads/[id]/edit/page.tsx");

      expect(page).toContain('from "@/hooks/useLeads"');
      expect(page).toContain("updateLead(");
      expect(page).not.toMatch(/\.from\(["']leads["']\)\s*\.update/);
    });

    it("the lead detail delete button soft-deletes through the deleteLead hook", () => {
      const client = read("app/(dashboard)/leads/[id]/lead-detail-client.tsx");

      expect(client).toContain('from "@/hooks/useLeads"');
      expect(client).toContain("deleteLead(");
      expect(client).not.toMatch(/\.from\(["']leads["']\)/);
    });
  });
});
