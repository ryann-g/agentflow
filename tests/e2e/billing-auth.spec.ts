import { test, expect } from "./fixtures/auth";
import { createClient } from "@supabase/supabase-js";

/**
 * Billing page states (authenticated). Fixture users are free-tier by
 * default; Pro/past_due/cancelled states are staged via service-role
 * profile patches and cleaned up automatically when the fixture releases.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function patchProfile(userId: string, patch: Record<string, unknown>) {
  const { error } = await admin()
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

test.describe("Billing (Authenticated)", () => {
  test("renders Free plan with upgrade options", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/settings/billing");
    await expect(page.getByText("Free Plan")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upgrade to Pro" })).toBeVisible();
    await expect(page.getByText("Monthly")).toBeVisible();
    await expect(page.getByText("$80/yr")).toBeVisible(); // unique to annual card
    await expect(page.getByText("$80/yr")).toBeVisible();
    await expect(page.getByText("2 months free")).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();
    await expect(page.getByText("Active leads")).toBeVisible(); // comparison table
  });

  test("renders Pro plan with cancel option", async ({
    authenticatedPage: page,
    authFixture,
  }) => {
    await patchProfile(authFixture.userId, {
      plan: "pro",
      subscription_status: "active",
      paymongo_subscription_id: "subs_test_fake",
      subscription_interval: "monthly",
    });
    await page.goto("/settings/billing");
    await expect(page.getByText("Pro Plan").first()).toBeVisible(); // sidebar also matches
    await expect(page.getByRole("button", { name: "Cancel Subscription" })).toBeVisible();
  });

  test("shows past-due banner with recovery guidance", async ({
    authenticatedPage: page,
    authFixture,
  }) => {
    await patchProfile(authFixture.userId, {
      plan: "pro",
      subscription_status: "past_due",
      paymongo_subscription_id: "subs_test_pastdue",
    });
    await page.goto("/settings/billing");
    await expect(page.getByText("Payment past due")).toBeVisible();
    // PAYMONGO keys are not configured on this deployment yet, so the
    // re-auth URL lookup degrades to the guided fallback copy.
    await expect(
      page.getByText(/cancel and resubscribe to vault a new card/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows paid-through banner for cancelled-but-graced Pro", async ({
    authenticatedPage: page,
    authFixture,
  }) => {
    const ends = new Date(Date.now() + 5 * 86_400_000).toISOString();
    await patchProfile(authFixture.userId, {
      plan: "pro",
      subscription_status: "cancelled",
      grace_period_ends_at: ends,
      paymongo_subscription_id: "subs_test_grace",
    });
    await page.goto("/settings/billing");
    await expect(page.getByText(/Subscription ends/i)).toBeVisible();
    await expect(page.getByText("You keep Pro features until then", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel Subscription" })).toBeVisible();
  });
});
