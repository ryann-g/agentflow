import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiRateLimit } from "@/lib/rate-limiter";
import {
  retrievePayMongoSubscription,
  PayMongoError,
} from "@/lib/paymongo";

/**
 * GET /api/paymongo/payment-method-url
 *
 * Returns the hosted authentication URL (setup_intent.next_action_url) when
 * the subscription is awaiting customer action — e.g., 3-D Secure on a
 * retry after a failed payment. Null when no action is pending; the UI then
 * falls back to cancel-and-resubscribe guidance.
 */
export async function GET() {
  if (!process.env.PAYMONGO_SECRET_KEY) {
    return NextResponse.json({ error: "PayMongo not configured" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed } = await apiRateLimit(`paymongo:pmurl:${user.id}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("paymongo_subscription_id")
    .eq("id", user.id)
    .single();

  if (!profile?.paymongo_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  try {
    const sub = await retrievePayMongoSubscription(
      profile.paymongo_subscription_id
    );
    const attrs = sub.data.attributes;
    const url = attrs.setup_intent?.next_action_url ?? null;

    return NextResponse.json({
      url,
      status: attrs.status,
    });
  } catch (error) {
    if (error instanceof PayMongoError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    import("@sentry/nextjs").then(({ captureException }) => captureException(error));
    return NextResponse.json(
      { error: "Failed to retrieve payment method status" },
      { status: 500 }
    );
  }
}
