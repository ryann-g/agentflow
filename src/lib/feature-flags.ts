/**
 * Simple feature flag system.
 *
 * Rules:
 * - Every flag has a default in code (`true` = enabled by default).
 * - Environment variable `NEXT_PUBLIC_FEATURE_<KEY>=false` kills a feature.
 * - The literal string `"false"` is the ONLY kill value — everything else
 *   (including `"FALSE"`, `"0"`, `"no"`, missing var) falls through to the
 *   code default. This is "fail-open" by design: a misconfigured env var
 *   never accidentally turns off a feature for a user.
 *
 * Usage:
 *   if (isFeatureEnabled("csv_import")) { ... }
 *   if (isMaintenanceBannerVisible()) { <MaintenanceBanner /> }
 *
 * To add a new flag:
 *   1. Add an entry to FEATURE_FLAGS with a `label` and `default`.
 *   2. Call isFeatureEnabled("your_flag") in any client or server code.
 *   3. To turn it off: set NEXT_PUBLIC_FEATURE_YOUR_FLAG=false in Vercel.
 */

interface FeatureFlag {
  /** Human-readable label for internal docs. Not shown to users. */
  label: string;
  /** Code default. `true` = enabled unless explicitly killed. */
  default: boolean;
}

/**
 * Every flag here must be consumed by a code path.
 *
 * `pipeline` and `bulk_actions` were registered for months but never
 * consulted by anything — a flag that gates nothing is dead configuration
 * that reads like a live switch. Add the flag AND the `isFeatureEnabled`
 * call in the same change.
 */
export const FEATURE_FLAGS = {
  csv_import: { label: "CSV Lead Import", default: true },
} as const satisfies Record<string, FeatureFlag>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const FALSE = "false" as const;

function envKeyFor(flag: FeatureFlagKey): string {
  return `NEXT_PUBLIC_FEATURE_${flag.toUpperCase()}`;
}

/**
 * Returns true if the feature is currently enabled.
 *
 * Reads the env var at call time (NOT module load) so Vercel env-var changes
 * take effect on the next deploy without a code change.
 *
 * Safe to call from server and client code.
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  const envValue = process.env[envKeyFor(flag)];
  if (envValue === FALSE) return false;
  return FEATURE_FLAGS[flag].default;
}

/**
 * Returns true when the maintenance banner should be displayed.
 *
 * Defaults to false. Set NEXT_PUBLIC_MAINTENANCE_BANNER=true in Vercel
 * to show the banner to authenticated users on dashboard pages.
 *
 * Only the literal string "true" turns the banner on (fail-closed for UX).
 */
export function isMaintenanceBannerVisible(): boolean {
  return process.env.NEXT_PUBLIC_MAINTENANCE_BANNER === "true";
}
