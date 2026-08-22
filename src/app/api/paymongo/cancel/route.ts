import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiRateLimit } from "@/lib/rate-limiter";
import {
  cancelPayMongoSubscription,
  retrievePayMongoSubscription,
  PayMongoError,
} from "@/lib/paymongo";

export async function POST() {
  if (!process.env.PAYMONGO_SECRET_KEY) {
    return NextResponse.json(
      { error: "PayMongo not configured" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResult = await apiRateLimit(
    `paymongo:cancel:${user.id}`,
    10,
    60,
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
        },
      },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("paymongo_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.paymongo_subscription_id) {
    return NextResponse.json(
      { error: "No active subscription" },
      { status: 400 },
    );
  }

  const subscriptionId = profile.paymongo_subscription_id;

  try {
    // PayMongo cancels IMMEDIATELY (no Stripe-style period-end flag), so
    // customers would lose Pro they already paid for. Capture the paid-
    // through date BEFORE cancelling and park it in the shared grace column;
    // the billing-check cron downgrades once that date passes.
    let accessEndsAt: string | null = null;
    try {
      const sub = await retrievePayMongoSubscription(subscriptionId);
      const schedule = sub.data.attributes.next_billing_schedule;
      if (typeof schedule === "string" && schedule.length >= 10) {
        accessEndsAt = `${schedule.slice(0, 10)}T23:59:59Z`;
      }
    } catch {
      // Non-fatal: without a schedule the webhook downgrades immediately.
    }

    await cancelPayMongoSubscription(subscriptionId);

    await supabase
      .from("profiles")
      .update({
        subscription_status: "cancelled",
        ...(accessEndsAt ? { grace_period_ends_at: accessEndsAt } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json(
      { success: true, accessEndsAt },
      {
        headers: {
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
          "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
        },
      },
    );
  } catch (error) {
    if (error instanceof PayMongoError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    import("@sentry/nextjs").then(({ captureException }) =>
      captureException(error),
    );
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 },
    );
  }
}
