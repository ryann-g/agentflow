"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { proPriceLabel } from "@/lib/pricing";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, AlertTriangle } from "lucide-react";

function BillingContent() {
  const searchParams = useSearchParams();
  const upgraded = searchParams.get("upgraded") === "true";
  const cancelled = searchParams.get("cancelled") === "true";
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionInterval, setSubscriptionInterval] = useState<string>("monthly");
  const [accessEndsAt, setAccessEndsAt] = useState<string | null>(null);
  const [pmAuthUrl, setPmAuthUrl] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan, subscription_status, subscription_interval, grace_period_ends_at")
          .eq("id", user.id)
          .single();
        if (profile) {
          setPlan(profile.plan as "free" | "pro");
          setSubscriptionStatus(profile.subscription_status);
          setSubscriptionInterval(
            profile.subscription_interval === "annual" ? "annual" : "monthly"
          );
          setAccessEndsAt(profile.grace_period_ends_at ?? null);

          // Failed-payment recovery: surface hosted re-auth link when pending.
          if (profile.plan === "pro" && profile.subscription_status === "past_due") {
            fetch("/api/paymongo/payment-method-url")
              .then((r) => (r.ok ? r.json() : { url: null }))
              .then((d) => setPmAuthUrl(d.url ?? null))
              .catch(() => setPmAuthUrl(null));
          }
        }
      }
      setLoadingProfile(false);
    }
    fetchProfile();
  }, [supabase]);

  useEffect(() => {
    if (upgraded) {
      setSuccess("Your account has been upgraded to Pro! You now have unlimited leads and pipelines.");
    }
    if (cancelled) {
      setSuccess("Your subscription has been cancelled. You'll remain on Pro until the end of your billing period.");
    }
  }, [upgraded, cancelled]);

  async function handleUpgrade(interval: "monthly" | "annual" = "monthly") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.subscriptionId) {
        // Already active (card vaulted), no redirect needed
        setSuccess("Your Pro subscription is now active!");
      }
    } catch {
      setError("Failed to start checkout. Please try again.");
    }
    setLoading(false);
  }

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel your Pro subscription?")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch("/api/paymongo/cancel", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        // PayMongo cancels immediately; the app grants paid-through access via
        // grace_period_ends_at (billing-check cron downgrades after it).
        setSubscriptionStatus("cancelled");
        if (data.accessEndsAt) setAccessEndsAt(data.accessEndsAt);
        setSuccess(
          data.accessEndsAt
            ? `Subscription cancelled. You keep Pro until ${new Date(data.accessEndsAt).toLocaleDateString()}.`
            : "Your subscription has been cancelled."
        );
      } else {
        setError(data.error || "Failed to cancel subscription. Please try again.");
      }
    } catch {
      setError("Failed to cancel subscription. Please try again.");
    }
    setCancelling(false);
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-surface-900">Billing</h1>
        <p className="text-surface-500 text-sm mt-1">Manage your subscription</p>
      </div>

      {plan === "pro" && subscriptionStatus === "cancelled" && accessEndsAt && (
        <div className="mb-6 p-4 rounded-lg bg-accent-50 border border-accent-100 flex items-start gap-3">
          <CreditCard className="h-5 w-5 text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-surface-700 font-medium">
              Subscription ends {new Date(accessEndsAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-surface-500 mt-1">
              You keep Pro features until then. Resubscribe any time before or after.
            </p>
          </div>
        </div>
      )}

      {!loadingProfile && (
        <button
          type="button"
          onClick={() => {
            setLoadingProfile(true);
            window.location.reload();
          }}
          className="mb-4 text-xs text-surface-500 hover:text-surface-700 underline"
        >
          Completed a payment? Refresh status
        </button>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg bg-success-50 border border-success-100 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-500 shrink-0" />
          <p className="text-sm text-success-700">{success}</p>
        </div>
      )}

      {subscriptionStatus === "past_due" && (
        <div className="mb-6 p-4 rounded-lg bg-warning-50 border border-warning-100 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning-500 shrink-0" />
          <div>
            <p className="text-sm text-warning-700 font-medium">Payment past due</p>
            <p className="text-xs text-warning-600 mt-1">
              Your payment failed. PayMongo will retry up to 3 times — act now to keep Pro.
            </p>
            {pmAuthUrl ? (
              <a
                href={pmAuthUrl}
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-primary hover:underline"
              >
                Update card / re-authenticate
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <p className="text-xs text-surface-500 mt-2">
                No re-authentication is currently pending. If retries are exhausted,
                cancel and resubscribe to vault a new card.
              </p>
            )}
          </div>
        </div>
      )}

      {loadingProfile ? (
        <div className="space-y-4">
          <div className="skeleton h-64 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
            </CardHeader>
            <div className="flex items-center justify-between mb-4">
              <span className="text-surface-700 font-medium">
                {plan === "pro" ? "Pro" : "Free"} Plan
              </span>
              <Badge variant={plan === "pro" ? "primary" : "default"}>
                {plan === "pro" ? proPriceLabel("monthly") : "$0/mo"}
              </Badge>
            </div>
            {plan === "free" && (
              <div className="p-4 bg-primary-50 rounded-lg">
                <h3 className="font-heading font-semibold text-surface-900 mb-2">
                  Upgrade to Pro
                </h3>
                <ul className="space-y-1 mb-4">
                  {[
                    "Unlimited leads",
                    "Unlimited pipelines",
                    "Custom branding",
                    "SMS reminders",
                    "Priority support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-surface-600">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Interval selector */}
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpgrade("monthly")}
                      disabled={loading}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        subscriptionInterval === "month"
                          ? "border-primary bg-primary-50 text-primary"
                          : "border-surface-200 hover:border-surface-300"
                      }`}
                    >
                      <div className="text-sm font-medium">Monthly</div>
                      <div className="text-lg font-bold">{proPriceLabel("monthly")}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpgrade("annual")}
                      disabled={loading}
                      className={`p-3 rounded-lg border text-center transition-colors ${
                        subscriptionInterval === "annual"
                          ? "border-primary bg-primary-50 text-primary"
                          : "border-surface-200 hover:border-surface-300"
                      }`}
                    >
                      <div className="text-sm font-medium">Annual</div>
                      <div className="text-lg font-bold">{proPriceLabel("annual")}</div>
                      <div className="text-xs text-success-600">2 months free</div>
                    </button>
                  </div>
                </div>

                <Button onClick={() => handleUpgrade("monthly")} loading={loading} className="w-full">
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Upgrade to Pro — {proPriceLabel("monthly")}
                </Button>
                {error && (
                  <p className="text-sm text-destructive mt-2 text-center">{error}</p>
                )}
              </div>
            )}
            {plan === "pro" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-surface-500">Billing interval</span>
                  <span className="text-surface-700 capitalize">{subscriptionInterval}</span>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive-50"
                  onClick={handleCancel}
                  loading={cancelling}
                >
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Cancel Subscription
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Plan Comparison</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left py-2 text-surface-500 font-medium">Feature</th>
                    <th className="text-center py-2 text-surface-500 font-medium">Free</th>
                    <th className="text-center py-2 text-surface-500 font-medium">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: "Active leads", free: "10", pro: "Unlimited" },
                    { feature: "Pipelines", free: "10", pro: "Unlimited" },
                    { feature: "Daily email digest", free: "✓", pro: "✓" },
                    { feature: "Custom branding", free: "—", pro: "✓" },
                    { feature: "SMS reminders", free: "—", pro: "✓" },
                    { feature: "Priority support", free: "—", pro: "✓" },
                  ].map((row) => (
                    <tr key={row.feature} className="border-b border-surface-100">
                      <td className="py-2 text-surface-700">{row.feature}</td>
                      <td className="py-2 text-center text-surface-500">{row.free}</td>
                      <td className="py-2 text-center text-surface-700 font-medium">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="p-4 md:p-8"><div className="skeleton h-8 w-48 mb-6" /><div className="skeleton h-64 w-full" /></div>}>
      <BillingContent />
    </Suspense>
  );
}
