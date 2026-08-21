import crypto from "crypto";

/**
 * Constant-time string comparison with a length pre-check.
 *
 * The length check does leak whether lengths differ — a universally
 * accepted tradeoff (Stripe's own SDKs do the same) because byte-position
 * leakage is what timing attacks actually exploit.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) return false;

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Fail-closed cron authorization: compares the Authorization header against
 * `Bearer ${CRON_SECRET}` without leaking content through early exits.
 * When CRON_SECRET is unset every request is rejected.
 */
export function isAuthorizedCronRequest(authHeader: string | null): boolean {
  if (!process.env.CRON_SECRET) return false;
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return timingSafeEqual(authHeader ?? "", expected);
}
