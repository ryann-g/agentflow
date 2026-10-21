export const PLAN_LIMITS = {
  free: {
    maxActiveLeads: 10,
    maxPipelines: 10,
  },
  pro: {
    maxActiveLeads: Infinity,
    maxPipelines: Infinity,
  },
  team: {
    maxActiveLeads: Infinity,
    maxPipelines: Infinity,
  },
} as const;

export type PlanType = keyof typeof PLAN_LIMITS;

/**
 * Resolves a stored plan value to a plan we know about.
 *
 * Anything unrecognised resolves to "free" — the most restrictive tier — so
 * an unexpected value in `profiles.plan` can never grant extra capacity.
 *
 * The cast in the old code (`profile.plan as PlanType`) told TypeScript the
 * value was always valid while telling it nothing at runtime. A plan row
 * holding a stale or mistyped value made `PLAN_LIMITS[plan]` undefined, and
 * the next `limits.maxActiveLeads` threw a TypeError — a 500 on lead
 * creation rather than a sensible limit.
 */
export function resolvePlanType(plan: string | null | undefined): PlanType {
  return plan === "pro" || plan === "team" ? plan : "free";
}

/** The limits that apply to a stored plan value. */
export function getPlanLimits(plan: string | null | undefined) {
  return PLAN_LIMITS[resolvePlanType(plan)];
}
