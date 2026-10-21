import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { leadSchema } from "@/lib/validations";
import { apiRateLimit } from "@/lib/rate-limiter";
import { getPlanLimits, resolvePlanType, type PlanType } from "@/lib/constants";

const PAGE_SIZE = 1000; // Supabase PostgREST default max_rows cap

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await apiRateLimit(`leads:get:${user.id}`, 100, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
        },
      }
    );
  }

  // Paginate through all leads — Supabase caps each request at max_rows (default 1000)
  const allLeads: Record<string, unknown>[] = [];
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

    if (error) {
      console.error("Leads GET error:", error.message);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }
    if (!data || data.length === 0) break;

    allLeads.push(...data);
    hasMore = data.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return NextResponse.json(allLeads, {
    headers: {
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await apiRateLimit(`leads:create:${user.id}`, 30, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
        },
      }
    );
  }

  const body = await request.json();

  const result = leadSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // Plan limit enforcement: check active lead count against plan limits
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

  const { count: activeLeadCount } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (activeLeadCount !== null && activeLeadCount >= limits.maxActiveLeads) {
    return NextResponse.json(
      { error: `Free plan limited to ${limits.maxActiveLeads} active leads. Upgrade to Pro for unlimited.` },
      { status: 403 }
    );
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      user_id: user.id,
      full_name: result.data.full_name,
      email: result.data.email || null,
      phone: result.data.phone || null,
      source: result.data.source,
      pipeline_stage: result.data.pipeline_stage,
      next_action: result.data.next_action || null,
      next_action_date: result.data.next_action_date || null,
      notes: result.data.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Leads POST error:", error.message);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }

  return NextResponse.json(data, {
    status: 201,
    headers: {
      "X-RateLimit-Limit": String(rateLimitResult.limit),
      "X-RateLimit-Remaining": String(rateLimitResult.remaining),
      "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
    },
  });
}
