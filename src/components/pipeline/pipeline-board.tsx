"use client";

import { useState, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDismiss } from "@/hooks/use-dismiss";
import {
  Phone,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  Thermometer,
  Snowflake,
} from "lucide-react";
import Link from "next/link";
import { getLeadScore } from "@/lib/utils";
import type { Database } from "@/types";
import { ActionPopup } from "@/components/action-popup";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const STAGES = [
  { key: "new_lead", label: "New Lead", color: "bg-sky-100 text-sky-700" },
  { key: "contacted", label: "Contacted", color: "bg-amber-100 text-amber-700" },
  { key: "showing", label: "Showing", color: "bg-purple-100 text-purple-700" },
  { key: "offer", label: "Offer", color: "bg-orange-100 text-orange-700" },
  { key: "closed_won", label: "Closed Won", color: "bg-green-100 text-green-700" },
  { key: "closed_lost", label: "Closed Lost", color: "bg-red-100 text-red-700" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

interface PipelineBoardProps {
  leads: Lead[];
  updating: string | null;
  onStageChange: (leadId: string, newStage: string) => void;
}

function ScoreIcon({ score }: { score: "hot" | "warm" | "cold" }) {
  if (score === "hot") return <Flame className="h-3.5 w-3.5 text-red-500" />;
  if (score === "warm") return <Thermometer className="h-3.5 w-3.5 text-orange-500" />;
  return <Snowflake className="h-3.5 w-3.5 text-blue-500" />;
}

function LeadCard({
  lead,
  updating,
  onStageChange,
}: {
  lead: Lead;
  updating: string | null;
  onStageChange: (leadId: string, newStage: string) => void;
}) {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [activePopup, setActivePopup] = useState<"email" | "call" | "text" | null>(null);
  const stageMenuRef = useRef<HTMLDivElement>(null);

  useDismiss(stageMenuRef, () => setShowStageMenu(false), showStageMenu);
  const callButtonRef = useRef<HTMLButtonElement>(null);
  const emailButtonRef = useRef<HTMLButtonElement>(null);
  const textButtonRef = useRef<HTMLButtonElement>(null);
  const score = getLeadScore(lead);
  const isOverdue =
    lead.next_action_date && lead.next_action_date < new Date().toISOString().split("T")[0];

  const getAnchorRef = () => {
    if (activePopup === "call") return callButtonRef;
    if (activePopup === "email") return emailButtonRef;
    if (activePopup === "text") return textButtonRef;
    return undefined;
  };

  return (
    <Card
      className={`mb-2 ${updating === lead.id ? "opacity-50" : ""} ${
        isOverdue ? "border-l-2 border-l-red-400" : ""
      }`}
    >
      <div className="p-3">
        {/* Header: Name + Score + Stage Dropdown */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <ScoreIcon score={score} />
            <Link
              href={`/leads/${lead.id}`}
              className="font-medium text-surface-900 hover:text-primary truncate text-sm"
            >
              {lead.full_name}
            </Link>
          </div>
          <div ref={stageMenuRef} className="relative">
            <button
              onClick={() => setShowStageMenu(!showStageMenu)}
              aria-haspopup="menu"
              aria-expanded={showStageMenu}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-surface-100 hover:bg-surface-200 transition-colors"
            >
              {STAGES.find((s) => s.key === lead.pipeline_stage)?.label || lead.pipeline_stage}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showStageMenu && (
              <div className="absolute right-0 top-full mt-1 bg-surface border border-surface-200 rounded-lg shadow-lg z-20 py-1 w-40">
                {STAGES.map((stage) => (
                  <button
                    key={stage.key}
                    onClick={() => {
                      onStageChange(lead.id, stage.key);
                      setShowStageMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-50 transition-colors ${
                      lead.pipeline_stage === stage.key
                        ? "font-medium text-primary"
                        : "text-surface-700"
                    }`}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Next Action */}
        {lead.next_action && (
          <p className="text-xs text-surface-500 mb-2 truncate">{lead.next_action}</p>
        )}

        {/* Date + Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-surface-500">
            <Clock className="h-3 w-3" />
            {lead.next_action_date ? (
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                {new Date(lead.next_action_date).toLocaleDateString()}
              </span>
            ) : (
              <span>No date</span>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="relative flex items-center gap-1">
            {lead.phone && (
              <button
                ref={callButtonRef}
                type="button"
                onClick={() => setActivePopup(activePopup === "call" ? null : "call")}
                className="p-1.5 rounded-lg text-surface-500 hover:text-green-600 hover:bg-green-50 transition-colors"
                title="Call"
              >
                <Phone className="h-3.5 w-3.5" />
              </button>
            )}
            {lead.email && (
              <button
                ref={emailButtonRef}
                type="button"
                onClick={() => setActivePopup(activePopup === "email" ? null : "email")}
                className="p-1.5 rounded-lg text-surface-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Email"
              >
                <Mail className="h-3.5 w-3.5" />
              </button>
            )}
            {lead.phone && (
              <button
                ref={textButtonRef}
                type="button"
                onClick={() => setActivePopup(activePopup === "text" ? null : "text")}
                className="p-1.5 rounded-lg text-surface-500 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                title="Text"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
            )}
            <ActionPopup
              action={activePopup}
              leadName={lead.full_name}
              leadEmail={lead.email}
              leadPhone={lead.phone}
              onClose={() => setActivePopup(null)}
              anchorRef={getAnchorRef()}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function PipelineBoard({
  leads,
  updating,
  onStageChange,
}: PipelineBoardProps) {
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());

  const getLeadsByStage = useCallback(
    (stageKey: StageKey) => leads.filter((l) => l.pipeline_stage === stageKey),
    [leads]
  );

  const toggleStage = (stageKey: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev);
      if (next.has(stageKey)) {
        next.delete(stageKey);
      } else {
        next.add(stageKey);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {STAGES.map((stage) => {
        const stageLeads = getLeadsByStage(stage.key);
        const isCollapsed = collapsedStages.has(stage.key);

        return (
          <div key={stage.key} className="border border-surface-200 rounded-lg overflow-hidden">
            {/* Stage Header */}
            <button
              onClick={() => toggleStage(stage.key)}
              className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 hover:bg-surface-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-surface-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-surface-500" />
                )}
                <h2 className="font-heading text-sm font-semibold text-surface-700">
                  {stage.label}
                </h2>
                <Badge variant="default" className={stage.color}>
                  {stageLeads.length}
                </Badge>
              </div>
            </button>

            {/* Stage Content */}
            {!isCollapsed && (
              <div className="p-3 bg-white">
                {stageLeads.length === 0 ? (
                  <p className="text-xs text-surface-500 text-center py-4">
                    No leads in this stage
                  </p>
                ) : (
                  <div className="space-y-0">
                    {stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        updating={updating}
                        onStageChange={onStageChange}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
