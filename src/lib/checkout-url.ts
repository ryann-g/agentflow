/**
 * Client-safe helpers for the URLs the app navigates to.
 *
 * This module deliberately imports nothing server-side, so it is safe to use
 * from a client component. The payment gateway helpers live in
 * `src/lib/paymongo.ts`, which imports `node:crypto` and the Supabase
 * service-role client — neither of which belongs in a browser bundle.
 */

const PAYMONGO_CHECKOUT_HOSTS = [
  "checkout.paymongo.com",
  "www.paymongo.com",
  "paymongo.com",
];

/**
 * True when the URL is an HTTPS PayMongo checkout page.
 *
 * The checkout URL is produced by the server and handed to the browser to
 * navigate to. Without this check, a tampered or misconfigured response
 * turns into an open redirect: the user leaves the app for an arbitrary
 * host, on a page that looks like a payment form.
 */
export function isPayMongoCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  return PAYMONGO_CHECKOUT_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
}
