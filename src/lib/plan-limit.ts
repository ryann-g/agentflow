import { createClient } from "@/lib/supabase/client";
import { getPlanLimits, resolvePlanType, type PlanType } from "@/lib/constants";

interface PlanLimitResult {
  allowed: boolean;
  plan: PlanType;
  currentCount: number;
  maxAllowed: number;
  error?: string;
}

export async function checkPlanLimit(): Promise<PlanLimitResult> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { allowed: false, plan: "free", currentCount: 0, maxAllowed: 0, error: "Not authenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { allowed: false, plan: "free", currentCount: 0, maxAllowed: 0, error: "Could not verify your plan. Please refresh and try again." };
  }

  const plan: PlanType = resolvePlanType(profile.plan);
  const limits = getPlanLimits(plan);

  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const currentCount = count ?? 0;

  return {
    allowed: currentCount < limits.maxActiveLeads,
    plan,
    currentCount,
    maxAllowed: limits.maxActiveLeads,
  };
}
