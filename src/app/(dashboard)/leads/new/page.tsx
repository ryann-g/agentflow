"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { showToast } from "@/components/ui/toast";
import { checkPlanLimit } from "@/lib/plan-limit";
import { createLead } from "@/hooks/useLeads";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "csv_import", label: "CSV Import" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "open_house", label: "Open House" },
  { value: "zillow", label: "Zillow" },
  { value: "other", label: "Other" },
] as const;

type LeadSource = (typeof SOURCES)[number]["value"];

export default function NewLeadPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }

    // Check plan limit before inserting
    const limit = await checkPlanLimit();
    if (limit.error) {
      setError(limit.error);
      setLoading(false);
      return;
    }

    if (!limit.allowed) {
      showToast(
        `Plan limit reached. You have ${limit.currentCount} active leads (${limit.plan} plan). Upgrade to Pro for unlimited.`,
        "error",
        { label: "Upgrade to Pro", href: "/settings/billing" }
      );
      setLoading(false);
      return;
    }

    // Writes go through POST /api/leads so the route's Zod validation, rate
    // limit and free-tier plan limit apply. checkPlanLimit() above is only a
    // fast UX pre-check — the server is the authority.
    const { error: insertError, status } = await createLead({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      source: source as LeadSource,
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
      notes: notes || null,
    });

    if (insertError) {
      if (status === 403) {
        // The server enforced the free-tier cap. Offer the upgrade path.
        showToast(insertError, "error", {
          label: "Upgrade to Pro",
          href: "/settings/billing",
        });
      } else {
        setError(insertError);
      }
      setLoading(false);
      return;
    }

    showToast("Lead created successfully!", "success");
    router.push("/leads");
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>
        <h1 className="font-heading text-2xl font-bold text-surface-900">Add New Lead</h1>
        <p className="text-surface-500 text-sm mt-1">
          Takes about 30 seconds
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-surface-700 mb-1">
              Full name <span className="text-destructive">*</span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dan Smith"
              required
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-surface-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dan@example.com"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-surface-700 mb-1">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="555-0123"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="source" className="block text-sm font-medium text-surface-700 mb-1">
              Source
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="input-field"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="nextAction" className="block text-sm font-medium text-surface-700 mb-1">
                Next action
              </label>
              <input
                id="nextAction"
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Follow up about listing"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="nextActionDate" className="block text-sm font-medium text-surface-700 mb-1">
                Due date
              </label>
              <input
                id="nextActionDate"
                type="date"
                value={nextActionDate}
                onChange={(e) => setNextActionDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-surface-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this lead..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive-50 text-destructive text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Link href="/leads" className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Add Lead
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
