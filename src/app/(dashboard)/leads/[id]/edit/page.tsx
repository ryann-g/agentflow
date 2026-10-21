"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { showToast } from "@/components/ui/toast";
import { updateLead } from "@/hooks/useLeads";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import type { Database } from "@/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "csv_import", label: "CSV Import" },
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "open_house", label: "Open House" },
  { value: "zillow", label: "Zillow" },
  { value: "other", label: "Other" },
] as const;

const PIPELINE_STAGES = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "showing", label: "Showing" },
  { value: "offer", label: "Offer" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
] as const;

type LeadSource = (typeof SOURCES)[number]["value"];
type LeadStage = (typeof PIPELINE_STAGES)[number]["value"];

export default function EditLeadPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("manual");
  const [pipelineStage, setPipelineStage] = useState("new_lead");
  const [nextAction, setNextAction] = useState("");
  const [nextActionDate, setNextActionDate] = useState("");
  const [notes, setNotes] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function fetchLead() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", params.id)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setLead(data);
      setFullName(data.full_name);
      setEmail(data.email || "");
      setPhone(data.phone || "");
      setSource(data.source);
      setPipelineStage(data.pipeline_stage);
      setNextAction(data.next_action || "");
      setNextActionDate(data.next_action_date || "");
      setNotes(data.notes || "");
      setLoading(false);
    }

    fetchLead();
  }, [supabase, params.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Not authenticated");
      setSaving(false);
      return;
    }

    // Writes go through PUT /api/leads/[id] so the route's Zod validation,
    // rate limit and ownership scoping apply.
    const { error: updateError } = await updateLead(params.id as string, {
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      source: source as LeadSource,
      pipeline_stage: pipelineStage as LeadStage,
      next_action: nextAction || null,
      next_action_date: nextActionDate || null,
      notes: notes || null,
    });

    if (updateError) {
      setError(updateError);
      setSaving(false);
      return;
    }

    showToast("Lead updated successfully!", "success");
    router.push(`/leads/${params.id}`);
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <p className="text-surface-500">Lead not found.</p>
        <Link href="/leads" className="text-primary hover:underline mt-2 inline-block">
          Back to leads
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/leads/${lead.id}`}
          className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {lead.full_name}
        </Link>
        <h1 className="font-heading text-2xl font-bold text-surface-900">Edit Lead</h1>
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
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div>
              <label htmlFor="pipelineStage" className="block text-sm font-medium text-surface-700 mb-1">
                Pipeline stage
              </label>
              <select
                id="pipelineStage"
                value={pipelineStage}
                onChange={(e) => setPipelineStage(e.target.value)}
                className="input-field"
              >
                {PIPELINE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
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
            <Link href={`/leads/${lead.id}`} className="flex-1">
              <Button type="button" variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={saving} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              Save changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
