import { describe, it, expect } from "vitest";
import { isPayMongoCheckoutUrl } from "@/lib/checkout-url";

/**
 * The checkout URL is produced by the server and handed to the browser to
 * navigate to. Without a host check, a tampered or misconfigured response
 * turns into an open redirect: the user leaves the app for an arbitrary
 * host, on a page that looks like a payment form.
 */

describe("isPayMongoCheckoutUrl", () => {
  it("accepts a PayMongo checkout URL", () => {
    expect(
      isPayMongoCheckoutUrl("https://checkout.paymongo.com/abc123")
    ).toBe(true);
  });

  it("accepts a subdomain of a PayMongo host", () => {
    expect(
      isPayMongoCheckoutUrl("https://www.paymongo.com/session/xyz")
    ).toBe(true);
  });

  it("rejects a look-alike host that merely contains paymongo", () => {
    expect(
      isPayMongoCheckoutUrl("https://paymongo.com.evil.test/checkout")
    ).toBe(false);
    expect(
      isPayMongoCheckoutUrl("https://evil.test/?x=checkout.paymongo.com")
    ).toBe(false);
  });

  it("rejects a non-PayMongo host", () => {
    expect(isPayMongoCheckoutUrl("https://evil.test/pay")).toBe(false);
    expect(isPayMongoCheckoutUrl("https://agent-flow.app/")).toBe(false);
  });

  it("rejects a non-HTTPS URL", () => {
    expect(isPayMongoCheckoutUrl("http://checkout.paymongo.com/abc")).toBe(false);
    expect(
      isPayMongoCheckoutUrl("javascript:alert(1)")
    ).toBe(false);
  });

  it("rejects a value that is not a URL at all", () => {
    expect(isPayMongoCheckoutUrl("not a url")).toBe(false);
    expect(isPayMongoCheckoutUrl("")).toBe(false);
    expect(isPayMongoCheckoutUrl(null)).toBe(false);
    expect(isPayMongoCheckoutUrl(undefined)).toBe(false);
    expect(isPayMongoCheckoutUrl(42)).toBe(false);
    expect(isPayMongoCheckoutUrl({})).toBe(false);
  });
});
