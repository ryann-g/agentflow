import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];

const PAGE_SIZE = 1000; // Supabase PostgREST default max_rows cap

/**
 * Result of a write that went through a route handler.
 *
 * `status` is carried because the caller needs to distinguish "the plan limit
 * blocked this" (403, upgrade CTA) from "your input was invalid" (400) from
 * "the server broke" (500). The message alone is not enough to pick the right
 * UI.
 */
export interface LeadWriteResult<T> {
  data: T | null;
  error: string | null;
  status: number | null;
}

/**
 * Reads and writes use deliberately different paths.
 *
 * READS go straight to PostgREST. Row-level security already scopes every row
 * to the caller, so there is no authorization decision left to centralise.
 *
 * WRITES go through /api/leads. That route is where the security-relevant
 * logic lives: Zod validation of the payload, rate limiting, the free-tier
 * plan limit, and the `is_active` re-activation guard. Writing straight to
 * PostgREST from the browser skipped every one of those checks — see the
 * Oct 21 2026 audit, finding C2.
 */
async function apiWrite<T>(
  url: string,
  init: RequestInit
): Promise<LeadWriteResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    return { data: null, error: "Network error. Please check your connection.", status: null };
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    return {
      data: null,
      error: payload?.error ?? `Request failed (${response.status})`,
      status: response.status,
    };
  }

  return { data: (payload as T) ?? null, error: null, status: response.status };
}

export async function fetchLeads(): Promise<{ data: Lead[] | null; error: string | null }> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated" };

  // Paginate through all leads — Supabase caps each request at max_rows (default 1000)
  const allLeads: Lead[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) return { data: null, error: error.message };
    if (!data || data.length === 0) break;

    allLeads.push(...data);
    hasMore = data.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return { data: allLeads, error: null };
}

/**
 * Creates a lead through POST /api/leads.
 *
 * `user_id` is deliberately not accepted: the route derives it from the
 * session so a caller cannot create a lead on someone else's behalf.
 */
export async function createLead(
  lead: Omit<LeadInsert, "user_id">
): Promise<LeadWriteResult<Lead>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated", status: null };

  return apiWrite<Lead>("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
}

/**
 * Updates a lead through PUT /api/leads/[id].
 *
 * The route validates the payload with `leadUpdateSchema` and applies the
 * free-tier guard when `is_active` flips back to true.
 */
export async function updateLead(
  id: string,
  updates: LeadUpdate
): Promise<LeadWriteResult<Lead>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated", status: null };

  return apiWrite<Lead>(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

/**
 * Soft-deletes a lead through DELETE /api/leads/[id].
 *
 * Soft delete (is_active = false) rather than a hard delete, so the row stays
 * available for the action history.
 */
export async function deleteLead(
  id: string
): Promise<LeadWriteResult<{ success: boolean }>> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "Not authenticated", status: null };

  return apiWrite<{ success: boolean }>(`/api/leads/${id}`, { method: "DELETE" });
}

/**
 * Bulk operations stay on Postgres RPCs.
 *
 * `bulk_update_leads` and `bulk_delete_leads` are SECURITY DEFINER functions
 * that scope every row with `user_id = auth.uid()`, and the `pipeline_stage`
 * column carries a CHECK constraint. They are therefore already
 * authorization-safe without a route handler — and they run as a single
 * statement instead of N round trips.
 */
export async function bulkDeleteLeads(ids: string[]): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) return { success: true, error: null };

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase.rpc("bulk_delete_leads", { lead_ids: ids });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function bulkUpdateLeads(
  ids: string[],
  updates: Pick<LeadUpdate, "pipeline_stage">
): Promise<{ success: boolean; error: string | null }> {
  if (ids.length === 0) return { success: true, error: null };

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const { error } = await supabase.rpc("bulk_update_leads", {
    lead_ids: ids,
    new_stage: updates.pipeline_stage,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
