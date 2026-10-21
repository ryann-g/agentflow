import crypto from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// ── Types ──────────────────────────────────────────────────────────────

export class PayMongoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PayMongoError";
  }
}

interface PayMongoConfig {
  amount: number; // smallest currency unit (cents for USD)
  currency: string;
  productName: string;
  productDescription: string;
  interval: "month" | "year";
  intervalCount: number;
}

interface PayMongoApiResponse<T = unknown> {
  data: {
    id: string;
    type: string;
    attributes: T;
  };
}

interface PayMongoListResponse<T = unknown> {
  data: PayMongoApiResponse<T>[];
}

interface CustomerAttributes {
  id: string;
  email: string;
  name: string | null;
  created_at: number;
  updated_at: number;
}

interface PlanAttributes {
  id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: string;
  interval_count: number;
  status: string;
  created_at: number;
  updated_at: number;
}

interface SubscriptionAttributes {
  id: string;
  status: string;
  customer_id: string;
  plan: PlanAttributes;
  latest_invoice: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    payment_intent?: {
      id: string;
      status: string;
      next_action?: {
        redirect?: { url: string };
      };
    };
  } | null;
  next_billing_schedule: string | null;
  /** Present when re-authentication is required (e.g., updating the card). */
  setup_intent?: {
    id: string;
    last_setup_error?: string;
    next_action_url?: string;
    status: string;
  } | null;
  cancelled_at: number | null;
  created_at: number;
  updated_at: number;
}

// ── Configuration ──────────────────────────────────────────────────────

const PAYMONGO_API_BASE = "https://api.paymongo.com/v1";

/**
 * Currency + amounts are env-overridable because Subscriptions are a
 * PHP-first product (all PayMongo examples use PHP); USD card acceptance is
 * a separate account feature. Defaults preserve the $8/$80 USD pricing.
 */
const PLAN_CURRENCY = process.env.PAYMONGO_CURRENCY || "usd";
const MONTHLY_AMOUNT = Number(process.env.PAYMONGO_MONTHLY_AMOUNT) || 800;
const ANNUAL_AMOUNT = Number(process.env.PAYMONGO_ANNUAL_AMOUNT) || 8000;

export const PAYMONGO_PLANS = {
  monthly: {
    amount: MONTHLY_AMOUNT,
    currency: PLAN_CURRENCY,
    productName: "AgentFlow Pro",
    productDescription:
      "Unlimited leads, unlimited pipelines, custom branding, SMS reminders",
    interval: "month" as const,
    intervalCount: 1,
  },
  annual: {
    amount: ANNUAL_AMOUNT,
    currency: PLAN_CURRENCY,
    productName: "AgentFlow Pro (Annual)",
    productDescription:
      "Unlimited leads, unlimited pipelines, custom branding, SMS reminders — 2 months free",
    interval: "year" as const,
    intervalCount: 1,
  },
} as const;

export type PlanInterval = keyof typeof PAYMONGO_PLANS;

// ── Auth Header ────────────────────────────────────────────────────────

function getAuthHeader(): string {
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  if (!secretKey) {
    throw new PayMongoError(
      "PAYMONGO_SECRET_KEY not configured",
      "configuration_error",
      500,
    );
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

// ── API Helpers ────────────────────────────────────────────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function payMongoFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${PAYMONGO_API_BASE}${path}`;
  const idempotencyKey =
    (options.headers as Record<string, string>)?.["Idempotency-Key"] ||
    crypto.randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: getAuthHeader(),
    "Idempotency-Key": idempotencyKey,
    ...((options.headers as Record<string, string>) || {}),
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const errorBody: Record<string, unknown> = await response.json().catch(() => ({}));
        const dataObj = errorBody.data as Record<string, unknown> | undefined;
        const errorAttributes = (dataObj?.attributes as Record<string, unknown>) || undefined;

        // Don't retry client errors (4xx except 429)
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw new PayMongoError(
            (errorAttributes?.message as string) ||
              `PayMongo API error ${response.status}`,
            (errorAttributes?.code as string) || "api_error",
            response.status,
            errorAttributes,
          );
        }

        // Retryable error — retry after delay
        lastError = new PayMongoError(
          `PayMongo API error ${response.status} (attempt ${attempt + 1})`,
          "retryable_error",
          response.status,
          errorBody as Record<string, unknown>,
        );

        if (attempt < MAX_RETRIES) {
          const delay = Math.min(
            BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS,
            10_000,
          );
          await sleep(delay);
          continue;
        }

        // Out of retries. Without this, control falls through to the
        // success return below and the ERROR BODY is handed back to the
        // caller as if it were a valid response — so a subscription cancel
        // would report success while the subscription stayed live, and
        // callers reading `data.id` would get undefined.
        throw lastError;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof PayMongoError && !RETRYABLE_STATUS_CODES.has(error.statusCode)) {
        throw error;
      }

      lastError = error;

      if (attempt < MAX_RETRIES) {
        const delay = Math.min(
          BASE_DELAY_MS * 2 ** attempt + Math.random() * BASE_DELAY_MS,
          10_000,
        );
        await sleep(delay);
        continue;
      }
    }
  }

  throw lastError;
}

// ── Customer Management ────────────────────────────────────────────────

export async function getOrCreatePayMongoCustomer(
  userId: string,
  email: string,
  fullName?: string,
): Promise<string> {
  const supabase = createServiceClient();

  // Check if customer already exists on profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("paymongo_customer_id")
    .eq("id", userId)
    .single();

  if (profile?.paymongo_customer_id) {
    return profile.paymongo_customer_id;
  }

  // Create new PayMongo customer
  const result = await payMongoFetch<PayMongoApiResponse<CustomerAttributes>>(
    "/customers",
    {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            email,
            name: fullName || undefined,
          },
        },
      }),
    },
  );

  const customerId = result.data.id;

  // Store on profile
  await supabase
    .from("profiles")
    .update({ paymongo_customer_id: customerId })
    .eq("id", userId);

  return customerId;
}

// ── Plan Management ────────────────────────────────────────────────────

// Cache for plan IDs (created once, reused per interval)
const _planCache: Record<string, string> = {};

/**
 * Plan endpoints differ across PayMongo doc generations: the current guide
 * posts to /v1/subscriptions/plans while older integrations used /v1/plans.
 * Try the documented path first, fall back to the legacy one.
 */
const PLAN_LIST_PATHS = ["/subscriptions/plans?limit=100", "/plans?limit=100"];
const PLAN_CREATE_PATHS = ["/subscriptions/plans", "/plans"];

async function getOrCreatePlan(interval: PlanInterval): Promise<string> {
  if (_planCache[interval]) return _planCache[interval];

  const config = PAYMONGO_PLANS[interval];

  let lastListError: unknown = null;
  for (const path of PLAN_LIST_PATHS) {
    try {
      const existing = await payMongoFetch<PayMongoListResponse<PlanAttributes>>(path);
      const found = existing.data.find(
        (p) =>
          p.data.attributes.name === config.productName &&
          p.data.attributes.amount === config.amount &&
          p.data.attributes.currency === config.currency &&
          p.data.attributes.interval === config.interval,
      );
      if (found) {
        _planCache[interval] = found.data.id;
        return _planCache[interval];
      }
      break; // listing worked; nothing matched -> go create
    } catch (err) {
      lastListError = err; // 404-style -> try legacy path
    }
  }

  const body = JSON.stringify({
    data: {
      attributes: {
        name: config.productName,
        description: config.productDescription,
        amount: config.amount,
        currency: config.currency,
        interval: config.interval,
        interval_count: config.intervalCount,
      },
    },
  });

  let lastCreateError: unknown = lastListError;
  for (const path of PLAN_CREATE_PATHS) {
    try {
      const result = await payMongoFetch<PayMongoApiResponse<PlanAttributes>>(path, {
        method: "POST",
        body,
      });
      _planCache[interval] = result.data.id;
      return _planCache[interval];
    } catch (err) {
      lastCreateError = err;
    }
  }

  throw lastCreateError instanceof PayMongoError
    ? lastCreateError
    : new PayMongoError(
        "Could not create or find PayMongo plan",
        "plan_error",
        500,
      );
}

// ── Subscription Management ────────────────────────────────────────────

export async function createPayMongoSubscription(
  customerId: string,
  userId: string,
  interval: PlanInterval = "monthly",
): Promise<{ subscriptionId: string; checkoutUrl: string | null }> {
  const supabase = createServiceClient();
  const planId = await getOrCreatePlan(interval);

  const result = await payMongoFetch<
    PayMongoApiResponse<SubscriptionAttributes>
  >("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          customer_id: customerId,
          plan_id: planId,
        },
      },
    }),
  });

  const subscription = result.data;
  const subscriptionId = subscription.id;
  const status = subscription.attributes.status;

  // Store subscription ID + interval on profile
  await supabase
    .from("profiles")
    .update({
      paymongo_subscription_id: subscriptionId,
      subscription_interval: interval,
    })
    .eq("id", userId);

  // If status is incomplete, the first invoice needs payment
  // PayMongo returns a payment_intent with next_action_url for redirect
  let checkoutUrl: string | null = null;
  if (
    status === "incomplete" &&
    subscription.attributes.latest_invoice?.payment_intent
  ) {
    const piId = subscription.attributes.latest_invoice.payment_intent.id;
    const piResult = await payMongoFetch<
      PayMongoApiResponse<{ next_action?: { redirect?: { url: string } } }>
    >(`/payment_intents/${piId}`);
    checkoutUrl =
      piResult.data.attributes.next_action?.redirect?.url || null;
  }

  // If already active (e.g., card vaulted from previous subscription), activate immediately
  if (status === "active") {
    await supabase
      .from("profiles")
      .update({
        plan: "pro",
        subscription_status: "active",
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

  return { subscriptionId, checkoutUrl };
}

// ── Cancel Subscription ────────────────────────────────────────────────

export async function cancelPayMongoSubscription(
  subscriptionId: string,
): Promise<void> {
  await payMongoFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
  });
}

// ── Webhook Handlers ───────────────────────────────────────────────────

export async function handleSubscriptionActivated(
  subscriptionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("paymongo_subscription_id", subscriptionId)
    .single();

  if (profile) {
    await supabase
      .from("profiles")
      .update({
        plan: "pro",
        subscription_status: "active",
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }
}

export async function handlePaymentFailed(
  subscriptionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, subscription_status")
    .eq("paymongo_subscription_id", subscriptionId)
    .single();

  if (profile) {
    // Don't overwrite if already past_due (idempotent)
    if (profile.subscription_status === "past_due") return;

    // Set 3-day grace period
    const gracePeriodEnds = new Date();
    gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 3);

    await supabase
      .from("profiles")
      .update({
        subscription_status: "past_due",
        grace_period_ends_at: gracePeriodEnds.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }
}

export async function handlePaymentPaid(
  subscriptionId: string,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, subscription_status")
    .eq("paymongo_subscription_id", subscriptionId)
    .single();

  if (profile && profile.subscription_status === "past_due") {
    // Payment succeeded — clear grace period, restore active status
    await supabase
      .from("profiles")
      .update({
        subscription_status: "active",
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }
}

// ── Subscription lifecycle (official event catalog) ───────────────────

/** Extract the subscription id from an event's embedded resource. Invoice
 * events carry it in attributes.resource_id; subscription events in id. */
export function extractSubscriptionRef(
  resourceType: string,
  resourceId: string,
  attributes: Record<string, unknown>
): string | null {
  if (resourceType === "subscription") return resourceId;
  if (resourceType === "invoice") {
    const ref = attributes.resource_id;
    return typeof ref === "string" && ref.startsWith("subs_") ? ref : null;
  }
  return null;
}

/** Payment retries exhausted — PayMongo stops collecting. Downgrade now. */
export async function handleSubscriptionUnpaid(
  subscriptionId: string,
): Promise<void> {
  await downgradeProfileBySubscription(subscriptionId, "unpaid");
}

/** Cancellation surfaced via subscription.updated (status=cancelled).
 * PayMongo cancels immediately, but customers prepaid through
 * next_billing_schedule — grant access until that date via the shared
 * grace-period column; the billing-check cron performs the downgrade. */
export async function handleSubscriptionUpdated(
  subscriptionId: string,
  attrs: Record<string, unknown>,
): Promise<void> {
  const supabase = createServiceClient();
  const status = attrs.status;

  if (status === "cancelled") {
    const schedule =
      typeof attrs.next_billing_schedule === "string"
        ? attrs.next_billing_schedule
        : null;
    const graceEnds = schedule ? `${schedule}T23:59:59Z` : null;
    const nowIso = new Date().toISOString();

    if (graceEnds && graceEnds > nowIso) {
      await supabase
        .from("profiles")
        .update({
          subscription_status: "cancelled",
          grace_period_ends_at: graceEnds,
          updated_at: nowIso,
        })
        .eq("paymongo_subscription_id", subscriptionId);
      return; // plan stays pro until cron downgrades
    }
    await downgradeProfileBySubscription(subscriptionId, "cancelled");
    return;
  }

  if (status === "past_due") {
    await handlePaymentFailed(subscriptionId);
    return;
  }
  if (status === "active") {
    await handleSubscriptionActivated(subscriptionId);
  }
}

async function downgradeProfileBySubscription(
  subscriptionId: string,
  statusLabel: string,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("profiles")
    .update({
      plan: "free",
      paymongo_subscription_id: null,
      subscription_status: statusLabel === "unpaid" ? "unpaid" : "cancelled",
      grace_period_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("paymongo_subscription_id", subscriptionId);
}

// ── Grace Period Expiry (for cron) ─────────────────────────────────────

export async function handleGracePeriodExpired(): Promise<number> {
  const supabase = createServiceClient();

  // Find all profiles past their grace period
  // Covers both failed-payment grace AND cancelled-with-paid-through-date.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id")
    .not("grace_period_ends_at", "is", null)
    .lt("grace_period_ends_at", new Date().toISOString());

  if (!profiles || profiles.length === 0) return 0;

  // Downgrade each to Free
  for (const profile of profiles) {
    await supabase
      .from("profiles")
      .update({
        plan: "free",
        paymongo_subscription_id: null,
        subscription_status: "cancelled",
        grace_period_ends_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
  }

  return profiles.length;
}

export async function retrievePayMongoSubscription(
  subscriptionId: string,
): Promise<PayMongoApiResponse<SubscriptionAttributes>> {
  return payMongoFetch<PayMongoApiResponse<SubscriptionAttributes>>(
    `/subscriptions/${subscriptionId}`,
  );
}

// ── Webhook Signature Verification ─────────────────────────────────────
//
// Spec (docs.paymongo.com → Webhook Setup & Management):
//   Header format:  t=<unix-ts>,te=<test-mode-hex>,li=<live-mode-hex>
//                   (the mode not in use is sent empty, e.g. `li=`)
//   Signed payload: `${t}.${rawBody}` — timestamp, period, raw JSON body
//   Digest:         HMAC-SHA256 keyed with the endpoint's signing secret
//
// The raw body must be verified byte-for-byte BEFORE any JSON parsing,
// which the webhook route guarantees by calling request.text() first.

/** Replay window: deliveries older than this are rejected. */
const WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS = 300;

interface PayMongoSignatureHeader {
  timestamp: number;
  testSignature: string | null;
  liveSignature: string | null;
}

/**
 * Parses the compound Paymongo-Signature header into its parts.
 * Returns null for malformed headers (missing/non-numeric timestamp).
 */
function parseWebhookSignatureHeader(
  header: string
): PayMongoSignatureHeader | null {
  if (!header) return null;

  const parts = new Map<string, string>();
  for (const piece of header.split(",")) {
    const separatorIndex = piece.indexOf("=");
    if (separatorIndex <= 0) return null;
    const key = piece.slice(0, separatorIndex).trim();
    const value = piece.slice(separatorIndex + 1).trim();
    parts.set(key, value);
  }

  const rawTimestamp = parts.get("t");
  if (!rawTimestamp) return null;

  const timestamp = Number.parseInt(rawTimestamp, 10);
  if (!Number.isFinite(timestamp)) return null;

  return {
    timestamp,
    testSignature: parts.get("te") || null,
    liveSignature: parts.get("li") || null,
  };
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export interface WebhookVerificationOptions {
  /** Replay window in seconds. Defaults to WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS. */
  toleranceSeconds?: number;
  /** Current unix time in seconds — injectable for deterministic tests. */
  nowSeconds?: number;
}

/**
 * Verifies a PayMongo webhook delivery against the compound signature spec.
 *
 * Accepts the delivery when EITHER provided mode signature (te or li) matches
 * the HMAC of `<timestamp>.<body>` — callers don't need to know which mode
 * their signing secret belongs to.
 *
 * Throws PayMongoError(configuration_error) only when the env secret is
 * missing; all signature mismatches are plain `false`.
 */
export function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
  options: WebhookVerificationOptions = {}
): boolean {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new PayMongoError(
      "PAYMONGO_WEBHOOK_SECRET not configured",
      "configuration_error",
      500,
    );
  }

  const parsed = parseWebhookSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const tolerance =
    options.toleranceSeconds ?? WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS;
  const nowSeconds =
    options.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) return false;

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${parsed.timestamp}.${body}`)
    .digest("hex");

  const candidates = [parsed.testSignature, parsed.liveSignature].filter(
    (sig): sig is string => sig !== null && sig !== ""
  );
  if (candidates.length === 0) return false;

  return candidates.some((candidate) =>
    timingSafeHexEqual(candidate.toLowerCase(), expected)
  );
}
