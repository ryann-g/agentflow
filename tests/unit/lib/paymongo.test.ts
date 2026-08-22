import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import type { PayMongoError as PayMongoErrorType } from "@/lib/paymongo";

// ── PayMongoError ──────────────────────────────────────────────

describe("PayMongoError", () => {
  it("is instance of Error", async () => {
    const { PayMongoError } = await import("@/lib/paymongo");
    const err = new PayMongoError("msg", "code", 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PayMongoError);
  });

  it("stores message, code, statusCode, and details", async () => {
    const { PayMongoError } = await import("@/lib/paymongo");
    const details = { field: "email" };
    const err = new PayMongoError("bad request", "bad_request", 422, details);
    expect(err.message).toBe("bad request");
    expect(err.code).toBe("bad_request");
    expect(err.statusCode).toBe(422);
    expect(err.details).toBe(details);
  });

  it("name is PayMongoError", async () => {
    const { PayMongoError } = await import("@/lib/paymongo");
    const err = new PayMongoError("x", "y", 500);
    expect(err.name).toBe("PayMongoError");
  });

  it("details is optional", async () => {
    const { PayMongoError } = await import("@/lib/paymongo");
    const err = new PayMongoError("msg", "code", 400);
    expect(err.details).toBeUndefined();
  });
});

// ── PAYMONGO_PLANS ─────────────────────────────────────────────

describe("PAYMONGO_PLANS", () => {
  it("has monthly and annual plans with correct amounts", async () => {
    const { PAYMONGO_PLANS } = await import("@/lib/paymongo");
    expect(PAYMONGO_PLANS.monthly.amount).toBe(800);
    expect(PAYMONGO_PLANS.monthly.currency).toBe("usd");
    expect(PAYMONGO_PLANS.monthly.interval).toBe("month");
    expect(PAYMONGO_PLANS.monthly.intervalCount).toBe(1);

    expect(PAYMONGO_PLANS.annual.amount).toBe(8000);
    expect(PAYMONGO_PLANS.annual.currency).toBe("usd");
    expect(PAYMONGO_PLANS.annual.interval).toBe("year");
    expect(PAYMONGO_PLANS.annual.intervalCount).toBe(1);
  });

  it("annual is 10x monthly", async () => {
    const { PAYMONGO_PLANS } = await import("@/lib/paymongo");
    expect(PAYMONGO_PLANS.annual.amount).toBe(PAYMONGO_PLANS.monthly.amount * 10);
  });

  it("both use USD currency", async () => {
    const { PAYMONGO_PLANS } = await import("@/lib/paymongo");
    expect(PAYMONGO_PLANS.monthly.currency).toBe("usd");
    expect(PAYMONGO_PLANS.annual.currency).toBe("usd");
  });
});

// ── verifyWebhookSignature ─────────────────────────────────────
//
// Spec (docs.paymongo.com → Webhook Setup & Management):
//   Header format:  t=<unix-ts>,te=<test-mode-hex>,li=<live-mode-hex>
//   Signed payload: `${t}.${rawBody}`  (timestamp, period, raw JSON body)
//   Digest:         HMAC-SHA256 with the endpoint's signing secret
//   Mode selection: compare `te` for test events, `li` for live events.
//
// The previous implementation hashed only the body and compared it to the
// entire header string — every legitimate delivery failed verification on
// length mismatch inside timingSafeEqual.

/** Helper: build a spec-compliant Paymongo-Signature header value. */
function buildSignatureHeader(
  payload: string,
  secret: string,
  timestampSeconds: number,
  mode: "te" | "li"
): string {
  const sig = createHmac("sha256", secret)
    .update(`${timestampSeconds}.${payload}`)
    .digest("hex");
  const other = mode === "te" ? "li" : "te";
  // PayMongo sends an empty value for the mode not in use.
  return `t=${timestampSeconds},${mode}=${sig},${other}=`;
}

describe("verifyWebhookSignature", () => {
  const SECRET = "test_webhook_secret";
  const NOW = 1_800_000_000; // fixed unix seconds for determinism

  beforeEach(() => {
    process.env.PAYMONGO_WEBHOOK_SECRET = SECRET;
  });

  it("accepts a valid test-mode (te) signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"data":{"attributes":{"type":"subscription.activated"}}}';
    const header = buildSignatureHeader(payload, SECRET, NOW, "te");

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      true
    );
  });

  it("accepts a valid live-mode (li) signature", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"livemode":true}';
    const header = buildSignatureHeader(payload, SECRET, NOW, "li");

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      true
    );
  });

  it("signs the timestamp and body together (<t>.<body>), not the body alone", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"event":"invoice.paid"}';
    // A bare-body HMAC (the old broken scheme) must NOT verify.
    const bodyOnlySig = createHmac("sha256", SECRET)
      .update(payload)
      .digest("hex");
    const header = `t=${NOW},te=${bodyOnlySig},li=`;

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      false
    );
  });

  it("rejects a tampered body", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"amount":800}';
    const header = buildSignatureHeader(payload, SECRET, NOW, "te");

    expect(
      verifyWebhookSignature('{"amount":999999}', header, { nowSeconds: NOW })
    ).toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"event":"test"}';
    const header = buildSignatureHeader(payload, "attacker_secret", NOW, "te");

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      false
    );
  });

  it("rejects a timestamp older than the replay window", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"event":"test"}';
    const staleTs = NOW - 301; // default tolerance is 300s
    const header = buildSignatureHeader(payload, SECRET, staleTs, "te");

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      false
    );
  });

  it("accepts a timestamp within the replay window", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"event":"test"}';
    const freshTs = NOW - 299;
    const header = buildSignatureHeader(payload, SECRET, freshTs, "te");

    expect(verifyWebhookSignature(payload, header, { nowSeconds: NOW })).toBe(
      true
    );
  });

  it("honours a custom tolerance window", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const payload = '{"event":"test"}';
    const oldTs = NOW - 1000;
    const header = buildSignatureHeader(payload, SECRET, oldTs, "te");

    expect(
      verifyWebhookSignature(payload, header, {
        nowSeconds: NOW,
        toleranceSeconds: 3600,
      })
    ).toBe(true);
  });

  it("rejects a malformed header (missing t part)", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    expect(
      verifyWebhookSignature("{}", "te=deadbeef,li=", { nowSeconds: NOW })
    ).toBe(false);
  });

  it("rejects a non-numeric timestamp", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    expect(
      verifyWebhookSignature("{}", "t=not-a-number,te=deadbeef,li=", {
        nowSeconds: NOW,
      })
    ).toBe(false);
  });

  it("rejects an empty header string", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    expect(verifyWebhookSignature("{}", "", { nowSeconds: NOW })).toBe(false);
  });

  it("rejects a header where both signatures are empty", async () => {
    const { verifyWebhookSignature } = await import("@/lib/paymongo");
    const header = `t=${NOW},te=,li=`;
    expect(verifyWebhookSignature("{}", header, { nowSeconds: NOW })).toBe(
      false
    );
  });

  it("throws PayMongoError when PAYMONGO_WEBHOOK_SECRET is not set", async () => {
    delete process.env.PAYMONGO_WEBHOOK_SECRET;
    const { verifyWebhookSignature, PayMongoError } = await import(
      "@/lib/paymongo"
    );
    expect(() =>
      verifyWebhookSignature("body", "t=1,te=sig,li=")
    ).toThrow(PayMongoError);
  });

  it("throws with configuration_error code when secret missing", async () => {
    delete process.env.PAYMONGO_WEBHOOK_SECRET;
    const { verifyWebhookSignature, PayMongoError } = await import(
      "@/lib/paymongo"
    );
    try {
      verifyWebhookSignature("body", "t=1,te=sig,li=");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PayMongoError);
      expect((e as PayMongoErrorType).code).toBe("configuration_error");
    }
  });
});

// ── Subscription lifecycle routing (official event catalog) ──────────

const updateCalls: Array<Record<string, unknown>> = [];
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: "profile_1", subscription_status: "past_due" },
            error: null,
          }),
        }),
      }),
      update: (payload: Record<string, unknown>) => {
        updateCalls.push(payload);
        return {
          eq: () => Promise.resolve({ data: null, error: null }),
          not: () => Promise.resolve({ data: [], error: null }),
        };
      },
    }),
  }),
}));

describe("extractSubscriptionRef", () => {
  it("returns the id for subscription resources", async () => {
    const { extractSubscriptionRef } = await import("@/lib/paymongo");
    expect(extractSubscriptionRef("subscription", "subs_abc", {})).toBe("subs_abc");
  });

  it("resolves invoice events through attributes.resource_id", async () => {
    const { extractSubscriptionRef } = await import("@/lib/paymongo");
    expect(
      extractSubscriptionRef("invoice", "inv_xyz", { resource_id: "subs_def" })
    ).toBe("subs_def");
  });

  it("ignores invoices whose resource_id is not a subscription", async () => {
    const { extractSubscriptionRef } = await import("@/lib/paymongo");
    expect(
      extractSubscriptionRef("invoice", "inv_xyz", { resource_id: "inv_other" })
    ).toBeNull();
    expect(extractSubscriptionRef("payment", "pay_1", {})).toBeNull();
  });
});

describe("handleSubscriptionUpdated", () => {
  beforeEach(() => updateCalls.length = 0);

  it("cancelled + future schedule keeps Pro and sets paid-through grace", async () => {
    const { handleSubscriptionUpdated } = await import("@/lib/paymongo");
    const future = new Date(Date.now() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    await handleSubscriptionUpdated("subs_cancelled", {
      status: "cancelled",
      next_billing_schedule: future,
    });
    const last = updateCalls[updateCalls.length - 1];
    expect(last.subscription_status).toBe("cancelled");
    expect(last.grace_period_ends_at).toContain(future);
    expect(last.plan).toBeUndefined(); // downgrade deferred to cron
  });

  it("cancelled without remaining access downgrades immediately", async () => {
    const { handleSubscriptionUpdated } = await import("@/lib/paymongo");
    await handleSubscriptionUpdated("subs_gone", { status: "cancelled" });
    const last = updateCalls[updateCalls.length - 1];
    expect(last.plan).toBe("free");
    expect(last.grace_period_ends_at).toBeNull();
  });

  it("active status re-grants Pro", async () => {
    const { handleSubscriptionUpdated } = await import("@/lib/paymongo");
    await handleSubscriptionUpdated("subs_reactivated", { status: "active" });
    const last = updateCalls[updateCalls.length - 1];
    expect(last.plan).toBe("pro");
    expect(last.subscription_status).toBe("active");
  });
});

describe("handleSubscriptionUnpaid", () => {
  it("downgrades immediately (retries exhausted)", async () => {
    updateCalls.length = 0;
    const { handleSubscriptionUnpaid } = await import("@/lib/paymongo");
    await handleSubscriptionUnpaid("subs_unpaid");
    const last = updateCalls[updateCalls.length - 1];
    expect(last.plan).toBe("free");
    expect(last.subscription_status).toBe("unpaid");
  });
});
