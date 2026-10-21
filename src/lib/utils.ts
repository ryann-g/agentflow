import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStage(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getStageVariant(
  stage: string
): "default" | "primary" | "accent" | "destructive" | "success" | "warning" {
  const variants: Record<string, "default" | "primary" | "accent" | "destructive" | "success" | "warning"> = {
    new_lead: "primary",
    contacted: "accent",
    showing: "warning",
    offer: "default",
    closed_won: "success",
    closed_lost: "destructive",
  };
  return variants[stage] || "default";
}

/**
 * Pipeline depth order. `closed_lost` is terminal-negative: it does not
 * advance the pipeline, so its order stays at 0 for scoring purposes.
 */
const STAGE_ORDER: Record<string, number> = {
  new_lead: 0,
  contacted: 1,
  showing: 2,
  offer: 3,
  closed_won: 4,
  closed_lost: 0,
};

const HOT_STAGE_THRESHOLD = 2; // showing or later
const WARM_STAGE_THRESHOLD = 1; // contacted or later
const HOT_RECENCY_DAYS = 3;
const WARM_RECENCY_DAYS = 7;

interface LeadScoreInput {
  pipeline_stage: string;
  updated_at?: string | null;
}

/**
 * Single source of truth for lead temperature, consumed by both the leads
 * list and the pipeline board so the same lead scores identically everywhere.
 *
 * Hot: deep in the pipeline (showing+) or touched within 3 days.
 * Warm: contacted, or touched within 7 days.
 * Cold: everything else.
 */
export function getLeadScore(lead: LeadScoreInput): "hot" | "warm" | "cold" {
  const stageOrder = STAGE_ORDER[lead.pipeline_stage] ?? 0;
  const daysSinceUpdate = lead.updated_at
    ? Math.floor(
        (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : Number.MAX_SAFE_INTEGER;

  if (stageOrder >= HOT_STAGE_THRESHOLD || daysSinceUpdate <= HOT_RECENCY_DAYS) {
    return "hot";
  }
  if (stageOrder >= WARM_STAGE_THRESHOLD || daysSinceUpdate <= WARM_RECENCY_DAYS) {
    return "warm";
  }
  return "cold";
}
