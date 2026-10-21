/**
 * The price of the Pro plan, in one place.
 *
 * Amounts are stored in the smallest currency unit (cents for USD) because
 * that is what the payment gateway takes. The display strings are derived
 * from the same numbers so the marketing copy and the charge can never
 * disagree — previously the price was written out five times across the
 * payment library, the pricing data module, the landing page, the billing
 * page, the settings page and the JSON-LD, in two different units.
 */

/** Currency code, matching what PayMongo expects. */
export const PRO_PRICE_CURRENCY = "usd";

/** Pro pricing, in the smallest currency unit. */
export const PRO_PRICE_AMOUNTS = {
  monthly: 800,
  annual: 8000,
} as const;

export type ProPriceInterval = keyof typeof PRO_PRICE_AMOUNTS;

/** Formats a smallest-unit amount as a major-unit number. */
export function toMajorUnits(amount: number): number {
  return amount / 100;
}

/** "8" — the amount as it appears in JSON-LD and copy. */
export function proPriceValue(interval: ProPriceInterval = "monthly"): number {
  return toMajorUnits(PRO_PRICE_AMOUNTS[interval]);
}

/** "$8/mo" — the amount as it appears on screen. */
export function proPriceLabel(interval: ProPriceInterval = "monthly"): string {
  const suffix = interval === "annual" ? "yr" : "mo";
  return `$${proPriceValue(interval)}/${suffix}`;
}
