import { z } from "zod";

/**
 * Maximum stored length of each free-text lead field.
 *
 * These live here, next to the schema that enforces them, so the CSV import
 * route can truncate to exactly the same bounds the API routes accept. The
 * database has no length constraint on these columns, so a value that slips
 * past the schema would be stored unbounded — and would then be rejected the
 * next time the lead is edited through /api/leads/[id].
 */
export const LEAD_FIELD_MAX_LENGTHS = {
  full_name: 100,
  email: 255,
  phone: 20,
  notes: 1000,
} as const;

export const leadSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(LEAD_FIELD_MAX_LENGTHS.full_name),
  email: z.string().email("Invalid email").max(LEAD_FIELD_MAX_LENGTHS.email).optional().nullable(),
  phone: z.string().max(LEAD_FIELD_MAX_LENGTHS.phone).optional().nullable(),
  source: z.enum(["manual", "csv_import", "website", "referral", "open_house", "zillow", "other"]).default("manual"),
  pipeline_stage: z.enum(["new_lead", "contacted", "showing", "offer", "closed_won", "closed_lost"]).default("new_lead"),
  notes: z.string().max(LEAD_FIELD_MAX_LENGTHS.notes).optional().nullable(),
  next_action: z.string().max(200).optional().nullable(),
  next_action_date: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export const leadUpdateSchema = leadSchema.partial();

/**
 * The `actions` table records a lead's follow-up history.
 *
 * Note: nothing writes to the table today — the follow-up flow marks work
 * complete on the lead itself (`leads.next_action`). The table is read by
 * the lead detail page and by the data export, so it is always empty.
 * Wiring a write path (or dropping the column family) is a product call,
 * not a cleanup one.
 */
export const actionSchema = z.object({
  lead_id: z.string().uuid("Invalid lead ID"),
  action_type: z.enum(["call", "text", "email", "meeting", "showing", "note"]),
  description: z.string().max(500).optional().nullable(),
  due_date: z.string().min(1, "Due date is required"),
  completed: z.boolean().default(false),
});

export const checkoutBodySchema = z.object({
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

/**
 * A single row of a pre-parsed CSV import.
 *
 * The fields are nullable because the client sends null for a column the user
 * did not map. The types are still enforced: a row where `email` is a number
 * or an object is rejected by the schema rather than crashing the route with
 * a TypeError on `.trim()`.
 *
 * Length and format limits are applied separately by the import route, which
 * reports them per row ("Row 4: name exceeds 100 characters — skipped") so
 * the user knows which rows were dropped.
 */
export const importLeadRowSchema = z.object({
  full_name: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  source: z.string().nullish(),
});

export const importLeadsSchema = z.array(importLeadRowSchema).max(10_000);

export type ImportLeadRow = z.infer<typeof importLeadRowSchema>;
