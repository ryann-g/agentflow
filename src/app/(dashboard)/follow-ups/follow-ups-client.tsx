"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { updateLead } from "@/hooks/useLeads";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CalendarClock,
  Flame,
} from "lucide-react";
import { formatStage, getStageVariant } from "@/lib/utils";
import type { Database } from "@/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function FollowUpsClient({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  const { overdue, today, upcoming } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split("T")[0];

    const withDates = leads.filter((l) => l.next_action_date);
    return {
      overdue: withDates
        .filter((l) => l.next_action_date! < todayStr)
        .sort((a, b) => (a.next_action_date || "").localeCompare(b.next_action_date || "")),
      today: withDates.filter((l) => l.next_action_date === todayStr),
      upcoming: withDates
        .filter((l) => l.next_action_date! > todayStr && l.next_action_date! <= nextWeekStr)
        .sort((a, b) => (a.next_action_date || "").localeCompare(b.next_action_date || "")),
    };
  }, [leads]);

  const totalFollowUps = overdue.length + today.length + upcoming.length;

  async function markComplete(leadId: string) {
    setCompletedIds((prev) => new Set(prev).add(leadId));

    setTimeout(() => {
      updateLead(leadId, {
        next_action: null,
        next_action_date: null,
      });

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setCompletedIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      setStreak((s) => s + 1);
    }, 600);
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-surface-900">
          Follow-ups
        </h1>
        <p className="text-surface-500 text-sm mt-1">
          {totalFollowUps} leads need attention
          {streak > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-warning-600 font-medium">
              <Flame className="h-3.5 w-3.5" />
              {streak} completed
            </span>
          )}
        </p>
      </div>

      {totalFollowUps === 0 && completedIds.size === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-6 w-6 text-success" />}
          title="All caught up!"
          description="No follow-ups due. Add leads with next actions to see them here."
        />
      ) : (
        <div className="space-y-8">
          {/* Overdue */}
          {overdue.length > 0 && (
            <Section
              title="Overdue"
              count={overdue.length}
              variant="destructive"
              icon={<AlertTriangle className="h-4 w-4" />}
              pulse
            >
              {overdue.map((lead) => (
                <FollowUpCard
                  key={lead.id}
                  lead={lead}
                  onComplete={() => markComplete(lead.id)}
                  completing={completedIds.has(lead.id)}
                  urgency="overdue"
                />
              ))}
            </Section>
          )}

          {/* Today */}
          {today.length > 0 && (
            <Section
              title="Today"
              count={today.length}
              variant="warning"
              icon={<Clock className="h-4 w-4" />}
            >
              {today.map((lead) => (
                <FollowUpCard
                  key={lead.id}
                  lead={lead}
                  onComplete={() => markComplete(lead.id)}
                  completing={completedIds.has(lead.id)}
                  urgency="today"
                />
              ))}
            </Section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <Section
              title="Upcoming"
              count={upcoming.length}
              variant="default"
              icon={<CalendarClock className="h-4 w-4" />}
            >
              {upcoming.map((lead) => (
                <FollowUpCard
                  key={lead.id}
                  lead={lead}
                  onComplete={() => markComplete(lead.id)}
                  completing={completedIds.has(lead.id)}
                  urgency="upcoming"
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  variant,
  icon,
  pulse = false,
  children,
}: {
  title: string;
  count: number;
  variant: "destructive" | "warning" | "default";
  icon: React.ReactNode;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  const colors = {
    destructive: "text-destructive",
    warning: "text-warning-600",
    default: "text-surface-500",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className={`flex items-center gap-1.5 ${colors[variant]}`}>
          {icon}
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide">
            {title}
          </h2>
        </div>
        <Badge
          variant={
            variant === "destructive"
              ? "destructive"
              : variant === "warning"
              ? "warning"
              : "default"
          }
        >
          {count}
        </Badge>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FollowUpCard({
  lead,
  onComplete,
  completing,
  urgency,
}: {
  lead: Lead;
  onComplete: () => void;
  completing: boolean;
  urgency: "overdue" | "today" | "upcoming";
}) {
  const borderColors = {
    overdue: "border-destructive-200 bg-destructive-50/30",
    today: "border-warning-200 bg-warning-50/30",
    upcoming: "",
  };

  const avatarColors = {
    overdue: "bg-destructive-100 text-destructive",
    today: "bg-warning-100 text-warning-700",
    upcoming: "bg-primary-100 text-primary",
  };

  const dueLabel = useMemo(() => {
    if (!lead.next_action_date) return "No date";
    const d = new Date(lead.next_action_date);
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.floor((target.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  }, [lead.next_action_date]);

  return (
    <Card
      className={`p-3 transition-all duration-300 ${
        completing ? "opacity-0 scale-95 -translate-x-4" : ""
      } ${borderColors[urgency]}`}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${avatarColors[urgency]}`}
        >
          <span className="text-sm font-semibold">
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
          </div>
          {lead.next_action && (
            <p className="text-xs text-surface-500 truncate mb-1">{lead.next_action}</p>
          )}
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                urgency === "overdue"
                  ? "bg-destructive-100 text-destructive"
                  : urgency === "today"
                  ? "bg-warning-100 text-warning-700"
                  : "bg-surface-100 text-surface-500"
              }`}
            >
              {dueLabel}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onComplete}
            disabled={completing}
            className="p-2 rounded-lg hover:bg-success-50 text-surface-500 hover:text-success transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center disabled:opacity-50"
            title="Mark complete"
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
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
}
