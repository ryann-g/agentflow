import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit } from "@/lib/rate-limiter";
import { getPlanLimits, resolvePlanType, type PlanType } from "@/lib/constants";
import {
  importLeadsSchema,
  LEAD_FIELD_MAX_LENGTHS,
  type ImportLeadRow,
} from "@/lib/validations";
import Papa from "papaparse";
import {
  sanitizeCsvValue,
  isBinaryContent,
} from "@/lib/csv-sanitize";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_REQUEST_SIZE = 12 * 1024 * 1024; // 12MB — multipart framing overhead
const MAX_LEADS_JSON_BYTES = 8 * 1024 * 1024; // 8MB for the pre-parsed channel
const MAX_IMPORT_ROWS = 10_000;
const BATCH_SIZE = 1000;

/**
 * POST /api/leads/import
 *
 * Server-side CSV import — all validation and insertion happens here so the
 * client can never bypass server-side plan-limit or schema checks.
 *
 * Body: FormData with a "file" field (CSV) and optional "leads" field
 * (JSON array of pre-parsed leads — used when the client has already parsed
 * the CSV and mapped columns).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await apiRateLimit(`leads:import:${user.id}`, 5, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before importing again." },
      { status: 429 }
    );
  }

  // Reject an oversized body BEFORE reading it. `request.formData()` buffers
  // the entire payload in memory, so a size check placed after the read
  // cannot prevent the allocation it is meant to prevent.
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return NextResponse.json(
      {
        error: `Import is too large. Maximum request size is ${Math.floor(
          MAX_REQUEST_SIZE / 1024 / 1024
        )}MB.`,
      },
      { status: 413 }
    );
  }

  // --- Accept pre-parsed leads from client (after column mapping) ---
  const formData = await request.formData();
  const leadsJson = formData.get("leads") as string | null;

  let leads: ImportLeadRow[];

  if (leadsJson) {
    // The pre-parsed channel has its own size cap: the multipart framing
    // limit above does not bound a single large field.
    if (leadsJson.length > MAX_LEADS_JSON_BYTES) {
      return NextResponse.json(
        {
          error: `Import is too large. Maximum size is ${Math.floor(
            MAX_LEADS_JSON_BYTES / 1024 / 1024
          )}MB.`,
        },
        { status: 413 }
      );
    }

    // Client already parsed CSV and mapped columns — validate server-side.
    let parsed: unknown;
    try {
      parsed = JSON.parse(leadsJson);
    } catch {
      return NextResponse.json({ error: "Invalid leads data" }, { status: 400 });
    }

    const result = importLeadsSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid leads data", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    leads = result.data;
  } else {
    // Fallback: accept raw CSV file (for future API usage)
    const fileEntry = formData.get("file");

    if (!fileEntry) {
      return NextResponse.json({ error: "No file or leads data provided" }, { status: 400 });
    }

    // `formData.get()` returns string | File. A client that sends a plain
    // string in the "file" field would otherwise pass the size check
    // (`undefined > MAX_FILE_SIZE` is false) and crash on `.text()`.
    if (!(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: "File must be uploaded as a file, not a text field" },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        },
        { status: 413 }
      );
    }

    const text = await fileEntry.text();

    // Binary content detection
    if (isBinaryContent(text)) {
      return NextResponse.json(
        { error: "File appears to be binary, not a CSV. Please upload a valid CSV file." },
        { status: 400 }
      );
    }

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: `CSV parsing error: ${parsed.errors[0].message}` },
        { status: 400 }
      );
    }

    if (parsed.data.length === 0) {
      return NextResponse.json(
        { error: "CSV file is empty or has no data rows" },
        { status: 400 }
      );
    }

    if (parsed.data.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT_ROWS.toLocaleString()} rows per import` },
        { status: 400 }
      );
    }

    leads = parsed.data.map((row) => ({
      full_name: sanitizeCsvValue(Object.values(row)[0] || ""),
      email: null,
      phone: null,
      source: "csv_import",
    }));
  }

  // --- Validate each row ---
  // Sanitization happens HERE on the server (not only in the browser) so a
  // direct POST with crafted JSON cannot store spreadsheet-formula payloads.
  const errors: string[] = [];
  const validLeads = leads
    .map((lead, index) => {
      const name = (lead.full_name || "").trim();
      if (!name) {
        errors.push(`Row ${index + 1}: empty name — skipped`);
        return null;
      }
      if (name.length > LEAD_FIELD_MAX_LENGTHS.full_name) {
        errors.push(
          `Row ${index + 1}: name exceeds ${LEAD_FIELD_MAX_LENGTHS.full_name} characters — skipped`
        );
        return null;
      }
      const email = lead.email ? lead.email.trim() : "";
      const phone = lead.phone ? lead.phone.trim() : "";

      if (email.length > LEAD_FIELD_MAX_LENGTHS.email) {
        errors.push(
          `Row ${index + 1}: email exceeds ${LEAD_FIELD_MAX_LENGTHS.email} characters — truncated`
        );
      }
      if (phone.length > LEAD_FIELD_MAX_LENGTHS.phone) {
        errors.push(
          `Row ${index + 1}: phone exceeds ${LEAD_FIELD_MAX_LENGTHS.phone} characters — truncated`
        );
      }
      // Sanitize first, then cap to the same bounds leadSchema enforces. The
      // sanitizer can prepend a quote, so capping afterwards is what keeps
      // the stored value inside the schema's limit.
      return {
        user_id: user.id,
        full_name: sanitizeCsvValue(name).slice(0, LEAD_FIELD_MAX_LENGTHS.full_name),
        email: email
          ? sanitizeCsvValue(email).slice(0, LEAD_FIELD_MAX_LENGTHS.email)
          : null,
        phone: phone
          ? sanitizeCsvValue(phone).slice(0, LEAD_FIELD_MAX_LENGTHS.phone)
          : null,
        source: "csv_import",
        pipeline_stage: "new_lead",
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (validLeads.length === 0) {
    return NextResponse.json({
      imported: 0,
      errors: errors.length > 0 ? errors : ["No valid rows to import"],
    });
  }

  // --- Plan limit enforcement ---
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Could not verify your subscription plan. Please try again." },
      { status: 500 }
    );
  }

  const plan: PlanType = resolvePlanType(profile.plan);
  const limits = getPlanLimits(plan);

  if (limits.maxActiveLeads !== Infinity) {
    const { count: activeLeadCount } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    const remaining = limits.maxActiveLeads - (activeLeadCount ?? 0);
    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Free plan limited to ${limits.maxActiveLeads} active leads. Upgrade to Pro for unlimited.` },
        { status: 403 }
      );
    }

    // Truncate to remaining slots if needed
    if (validLeads.length > remaining) {
      const truncated = validLeads.splice(remaining);
      for (let i = 0; i < truncated.length; i++) {
        errors.push(`Skipped: free plan limit reached`);
      }
    }
  }

  // --- Batch insert ---
  let imported = 0;
  for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
    const batch = validLeads.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("leads").insert(batch);

    if (error) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
    } else {
      imported += batch.length;
    }
  }

  return NextResponse.json({
    imported,
    errors,
  });
}
