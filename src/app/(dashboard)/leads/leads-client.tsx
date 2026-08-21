"use client";

import { useState, useMemo, useRef } from "react";
import { bulkDeleteLeads, bulkUpdateLeads } from "@/hooks/useLeads";
import { useDismiss } from "@/hooks/use-dismiss";
import { showToast } from "@/components/ui/toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Phone,
  Mail,
  MessageSquare,
  Search,
  Upload,
  ArrowUpDown,
  LayoutGrid,
  List,
  Trash2,
  ChevronDown,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react";
import Link from "next/link";
import { formatStage, getStageVariant } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/feature-flags";
import type { Database } from "@/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const STAGES = [
  { key: "new_lead", label: "New Lead", order: 0 },
  { key: "contacted", label: "Contacted", order: 1 },
  { key: "showing", label: "Showing", order: 2 },
  { key: "offer", label: "Offer", order: 3 },
  { key: "closed_won", label: "Closed Won", order: 4 },
  { key: "closed_lost", label: "Closed Lost", order: 5 },
] as const;

type SortKey = "name" | "date_added" | "stage" | "last_activity";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "date_added", label: "Date Added" },
  { key: "stage", label: "Pipeline Stage" },
  { key: "last_activity", label: "Last Activity" },
];

function getLeadScore(lead: Lead): "hot" | "warm" | "cold" {
  const stageOrder = STAGES.find((s) => s.key === lead.pipeline_stage)?.order ?? 0;
  const daysSinceUpdate = lead.updated_at
    ? Math.floor(
        (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : 999;

  if (stageOrder >= 2 || daysSinceUpdate <= 3) return "hot";
  if (stageOrder >= 1 || daysSinceUpdate <= 7) return "warm";
  return "cold";
}

function getScoreIcon(score: "hot" | "warm" | "cold") {
  switch (score) {
    case "hot":
      return <Flame className="h-3.5 w-3.5" />;
    case "warm":
      return <Thermometer className="h-3.5 w-3.5" />;
    case "cold":
      return <Snowflake className="h-3.5 w-3.5" />;
  }
}

function getScoreColor(score: "hot" | "warm" | "cold") {
  switch (score) {
    case "hot":
      return "text-destructive bg-destructive-50";
    case "warm":
      return "text-warning-600 bg-warning-50";
    case "cold":
      return "text-accent bg-accent-50";
  }
}

function getStageProgress(stage: string): number {
  const order = STAGES.find((s) => s.key === stage)?.order ?? 0;
  return ((order + 1) / STAGES.length) * 100;
}

function getStageBarColor(stage: string): string {
  const variant = getStageVariant(stage);
  const colors = {
    primary: "bg-primary",
    accent: "bg-accent",
    warning: "bg-warning-500",
    destructive: "bg-destructive",
    success: "bg-success",
    default: "bg-surface-400",
  };
  return colors[variant] || colors.default;
}

export function LeadsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("last_activity");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useDismiss(sortMenuRef, () => setShowSortMenu(false), showSortMenu);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (filter !== "all") {
      result = result.filter((l) => l.pipeline_stage === filter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.full_name.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.full_name.localeCompare(b.full_name);
        case "date_added":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "stage":
          return (
            (STAGES.find((s) => s.key === a.pipeline_stage)?.order ?? 0) -
            (STAGES.find((s) => s.key === b.pipeline_stage)?.order ?? 0)
          );
        case "last_activity":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [leads, filter, search, sort]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    for (const stage of STAGES) {
      counts[stage.key] = leads.filter((l) => l.pipeline_stage === stage.key).length;
    }
    return counts;
  }, [leads]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filteredLeads.length > 0 && filteredLeads.every((l) => selected.has(l.id));

  function selectAll() {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredLeads.map((l) => l.id)));
    }
  }

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!window.confirm(`Delete ${ids.length} lead${ids.length > 1 ? "s" : ""}? This cannot be undone.`)) {
      return;
    }
    setBulkDeleting(true);
    try {
      const { success, error } = await bulkDeleteLeads(ids);
      if (success) {
        setLeads((prev) => prev.filter((l) => !selected.has(l.id)));
        setSelected(new Set());
        showToast(`Deleted ${ids.length} lead${ids.length > 1 ? "s" : ""}`, "success");
      } else {
        showToast(`Failed to delete leads: ${error}`, "error");
      }
    } catch {
      showToast("An unexpected error occurred while deleting leads", "error");
    } finally {
      setBulkDeleting(false);
    }
  }

  async function bulkChangeStage(stage: string) {
    const ids = Array.from(selected);
    try {
      const { success, error } = await bulkUpdateLeads(ids, { pipeline_stage: stage });
      if (success) {
        setLeads((prev) =>
          prev.map((l) => (selected.has(l.id) ? { ...l, pipeline_stage: stage } : l))
        );
        setSelected(new Set());
        showToast(`Updated ${ids.length} leads to ${stage.replace("_", " ")}`, "success");
      } else {
        showToast(`Failed to update leads: ${error}`, "error");
      }
    } catch {
      showToast("An unexpected error occurred while updating leads", "error");
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-surface-900">
            Leads
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {leads.length} total leads
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex gap-2">
          {isFeatureEnabled("csv_import") && (
            <Link href="/leads/import">
              <Button variant="secondary" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
            </Link>
          )}
          <Link href="/leads/new">
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-1" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "bg-surface-100 text-surface-600 hover:bg-surface-200"
          }`}
        >
          All ({stageCounts.all})
        </button>
        {STAGES.map((stage) => (
          <button
            key={stage.key}
            onClick={() => setFilter(stage.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              filter === stage.key
                ? "bg-primary text-white"
                : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            {stage.label} ({stageCounts[stage.key] || 0})
          </button>
        ))}
      </div>

      {/* Search, Sort, View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div ref={sortMenuRef} className="relative">
          <button
            onClick={() => setShowSortMenu(!showSortMenu)}
            aria-haspopup="menu"
            aria-expanded={showSortMenu}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-200 bg-surface text-sm text-surface-700 hover:bg-surface-50 transition-colors w-full sm:w-auto"
          >
            <ArrowUpDown className="h-4 w-4" />
            {SORT_OPTIONS.find((o) => o.key === sort)?.label}
            <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
          </button>
          {showSortMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-surface-200 rounded-lg shadow-lg z-10 py-1 w-44">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSort(option.key);
                    setShowSortMenu(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-50 transition-colors ${
                    sort === option.key ? "text-primary font-medium" : "text-surface-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex border border-surface-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition-colors ${
              viewMode === "list"
                ? "bg-primary text-white"
                : "bg-surface text-surface-500 hover:bg-surface-50"
            }`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-white"
                : "bg-surface text-surface-500 hover:bg-surface-50"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
          <span className="text-sm font-medium text-primary-700">
            {selected.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <select
              onChange={(e) => {
                if (e.target.value) bulkChangeStage(e.target.value);
                e.target.value = "";
              }}
              className="text-sm border border-primary-200 rounded-lg px-2 py-1 bg-white text-surface-700"
              defaultValue=""
            >
              <option value="" disabled>
                Move to stage...
              </option>
              {STAGES.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
            <Button variant="destructive" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {bulkDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Select All */}
      {filteredLeads.length > 0 && (
        <button
          onClick={selectAll}
          className="text-xs text-surface-500 hover:text-surface-700 font-medium"
        >
          {allVisibleSelected ? "Deselect all" : "Select all"}
        </button>
      )}

      {/* Leads */}
      {filteredLeads.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6 text-surface-500" />}
          title={search ? "No leads found" : "No leads yet"}
          description={
            search
              ? "Try a different search term."
              : "Add your first lead to start tracking your pipeline."
          }
          action={
            !search ? (
              <Link href="/leads/new">
                <Button>Add your first lead</Button>
              </Link>
            ) : undefined
          }
        />
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filteredLeads.map((lead) => {
            const score = getLeadScore(lead);
            return (
              <Card
                key={lead.id}
                className={`p-3 transition-all ${
                  selected.has(lead.id)
                    ? "border-primary ring-1 ring-primary-200"
                    : "hover:border-surface-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected.has(lead.id)}
                    aria-label={`Select ${lead.full_name}`}
                    onClick={() => toggleSelect(lead.id)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      selected.has(lead.id)
                        ? "bg-primary border-primary text-white"
                        : "border-surface-300 hover:border-primary"
                    }`}
                  >
                    {selected.has(lead.id) && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {lead.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium text-sm text-surface-900 hover:text-primary truncate"
                      >
                        {lead.full_name}
                      </Link>
                      <Badge variant={getStageVariant(lead.pipeline_stage)}>
                        {formatStage(lead.pipeline_stage)}
                      </Badge>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getScoreColor(score)}`}>
                        {getScoreIcon(score)}
                        {score}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-surface-500">
                      {lead.email && <span className="truncate max-w-[160px]">{lead.email}</span>}
                      {lead.phone && <span>{lead.phone}</span>}
                      <span className="text-surface-500">{lead.source.replace("_", " ")}</span>
                    </div>
                    {/* Pipeline Progress */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden max-w-[120px]">
                        <div
                          className={`h-full rounded-full ${getStageBarColor(lead.pipeline_stage)} transition-all`}
                          style={{ width: `${getStageProgress(lead.pipeline_stage)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-surface-500">
                        {Math.round(getStageProgress(lead.pipeline_stage))}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        aria-label="Call"
                        className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        aria-label="Send email"
                        className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {lead.phone && (
                      <a
                        href={`sms:${lead.phone}`}
                        aria-label="Send text message"
                        className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const score = getLeadScore(lead);
            return (
              <Card
                key={lead.id}
                className={`p-4 transition-all ${
                  selected.has(lead.id)
                    ? "border-primary ring-1 ring-primary-200"
                    : "hover:border-surface-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.has(lead.id)}
                      aria-label={`Select ${lead.full_name}`}
                      onClick={() => toggleSelect(lead.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected.has(lead.id)
                          ? "bg-primary border-primary text-white"
                          : "border-surface-300 hover:border-primary"
                      }`}
                    >
                      {selected.has(lead.id) && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <Badge variant={getStageVariant(lead.pipeline_stage)}>
                      {formatStage(lead.pipeline_stage)}
                    </Badge>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${getScoreColor(score)}`}>
                    {getScoreIcon(score)}
                  </span>
                </div>

                <Link href={`/leads/${lead.id}`} className="block mb-2">
                  <h3 className="font-medium text-surface-900 hover:text-primary truncate">
                    {lead.full_name}
                  </h3>
                </Link>

                <div className="space-y-1 mb-3">
                  {lead.email && (
                    <p className="text-xs text-surface-500 truncate">{lead.email}</p>
                  )}
                  {lead.phone && (
                    <p className="text-xs text-surface-500">{lead.phone}</p>
                  )}
                </div>

                {/* Pipeline Progress */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getStageBarColor(lead.pipeline_stage)} transition-all`}
                      style={{ width: `${getStageProgress(lead.pipeline_stage)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-surface-500">
                    {Math.round(getStageProgress(lead.pipeline_stage))}%
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-surface-500">
                    {lead.source.replace("_", " ")}
                  </span>
                  <div className="flex items-center gap-1">
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        aria-label="Call"
                        className="p-1.5 rounded hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {lead.email && (
                      <a
                        href={`mailto:${lead.email}`}
                        aria-label="Email"
                        className="p-1.5 rounded hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
