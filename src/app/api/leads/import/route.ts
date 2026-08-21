import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { apiRateLimit } from "@/lib/rate-limiter";
import { PLAN_LIMITS, type PlanType } from "@/lib/constants";
import Papa from "papaparse";
import {
  sanitizeCsvValue,
  isBinaryContent,
} from "@/lib/csv-sanitize";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
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

  // --- Accept pre-parsed leads from client (after column mapping) ---
  const formData = await request.formData();
  const leadsJson = formData.get("leads") as string | null;

  let leads: Array<{
    full_name: string;
    email: string | null;
    phone: string | null;
    source: string;
  }>;

  if (leadsJson) {
    // Client already parsed CSV and mapped columns — validate server-side
    try {
      leads = JSON.parse(leadsJson);
    } catch {
      return NextResponse.json({ error: "Invalid leads data" }, { status: 400 });
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "No leads to import" },
        { status: 400 }
      );
    }

    if (leads.length > 10000) {
      return NextResponse.json(
        { error: "Maximum 10,000 rows per import" },
        { status: 400 }
      );
    }
  } else {
    // Fallback: accept raw CSV file (for future API usage)
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file or leads data provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const text = await file.text();

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
      if (name.length > 100) {
        errors.push(`Row ${index + 1}: name exceeds 100 characters — skipped`);
        return null;
      }
      const email = lead.email ? lead.email.trim() : "";
      const phone = lead.phone ? lead.phone.trim() : "";

      if (email.length > 255) {
        errors.push(`Row ${index + 1}: email exceeds 255 characters — truncated`);
      }
      if (phone.length > 20) {
        errors.push(`Row ${index + 1}: phone exceeds 20 characters — truncated`);
      }
      return {
        user_id: user.id,
        full_name: sanitizeCsvValue(name).slice(0, 101),
        email: email ? sanitizeCsvValue(email).slice(0, 256) : null,
        phone: phone ? sanitizeCsvValue(phone).slice(0, 21) : null,
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

  const plan: PlanType = (profile.plan as PlanType) || "free";
  const limits = PLAN_LIMITS[plan];

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
