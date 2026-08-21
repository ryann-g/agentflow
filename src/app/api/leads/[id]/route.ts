import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { leadUpdateSchema } from "@/lib/validations";
import { apiRateLimit } from "@/lib/rate-limiter";
import { PLAN_LIMITS, type PlanType } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await apiRateLimit(`leads:get-one:${user.id}`, 100, 60)).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    console.error("Lead GET error:", error.message);
    return NextResponse.json({ error: "Failed to fetch lead" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await apiRateLimit(`leads:update:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();

  const result = leadUpdateSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation failed", details: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  // SEC-004: prevent free-tier plan-limit bypass via is_active reactivation.
  // Without this, a free user could soft-delete leads to free up slots,
  // create new ones via POST (which enforces the limit), then re-activate
  // the deleted ones via PUT (which previously had no limit check) to
  // exceed the free-tier active-lead cap. We only gate the false→true
  // transition; other field updates and true→false (soft-delete) are
  // always allowed.
  if (result.data.is_active === true) {
    // Fetch current row to detect an actual false→true transition. If the
    // lead is already active, re-setting is_active:true is a no-op and
    // doesn't consume a new slot.
    const { data: current } = await supabase
      .from("leads")
      .select("is_active")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (current && current.is_active === false) {
      // Load plan and current active-lead count (server-side — mirrors the
      // POST handler's enforcement; checkPlanLimit() uses the browser
      // client so it cannot be used here).
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .single();

      const plan: PlanType = (profile?.plan as PlanType) || "free";
      const limits = PLAN_LIMITS[plan];

      const { count: activeLeadCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (
        activeLeadCount !== null &&
        activeLeadCount >= limits.maxActiveLeads
      ) {
        return NextResponse.json(
          {
            error: `Free plan limited to ${limits.maxActiveLeads} active leads. Upgrade to Pro for unlimited.`,
          },
          { status: 403 }
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("leads")
    .update({
      ...result.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("Lead PUT error:", error.message);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await apiRateLimit(`leads:delete:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Lead DELETE error:", error.message);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
