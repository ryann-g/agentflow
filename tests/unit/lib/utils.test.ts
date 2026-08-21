import { describe, it, expect } from "vitest";
import { cn, formatStage, getStageVariant } from "@/lib/utils";

describe("cn()", () => {
  it("returns a single class name unchanged", () => {
    expect(cn("px-4")).toBe("px-4");
  });

  it("merges multiple class names", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null inputs", () => {
    expect(cn(undefined, null, "text-sm")).toBe("text-sm");
  });

  it("handles falsy values", () => {
    expect(cn(false, 0, "", "text-sm")).toBe("text-sm");
  });

  it("resolves Tailwind conflicts — later wins", () => {
    expect(cn("px-4", "px-8")).toBe("px-8");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("p-4", "p-2")).toBe("p-2");
  });

  it("handles conditional classes via clsx", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe(
      "base active"
    );
  });

  it("handles arrays of classes", () => {
    expect(cn(["px-4", "py-2"], "text-sm")).toBe("px-4 py-2 text-sm");
  });

  it("handles object syntax via clsx", () => {
    expect(cn({ "px-4": true, "px-8": false })).toBe("px-4");
  });

  it("deduplicates non-conflicting classes", () => {
    const result = cn("text-sm", "font-bold", "text-red-500");
    expect(result).toContain("text-sm");
    expect(result).toContain("font-bold");
    expect(result).toContain("text-red-500");
  });

  it("handles empty strings gracefully", () => {
    expect(cn("", "", "text-sm")).toBe("text-sm");
  });

  it("resolves conflicting flex direction classes", () => {
    const result = cn("flex items-center", "flex-col justify-center");
    expect(result).toContain("flex-col");
    expect(result).toContain("items-center");
    expect(result).toContain("justify-center");
  });
});

describe("formatStage()", () => {
  it("formats new_lead to New Lead", () => {
    expect(formatStage("new_lead")).toBe("New Lead");
  });

  it("formats contacted to Contacted", () => {
    expect(formatStage("contacted")).toBe("Contacted");
  });

  it("formats closed_won to Closed Won", () => {
    expect(formatStage("closed_won")).toBe("Closed Won");
  });

  it("formats closed_lost to Closed Lost", () => {
    expect(formatStage("closed_lost")).toBe("Closed Lost");
  });

  it("formats single word stages", () => {
    expect(formatStage("showing")).toBe("Showing");
    expect(formatStage("offer")).toBe("Offer");
  });

  it("capitalizes first letter of each word", () => {
    expect(formatStage("hello_world")).toBe("Hello World");
  });
});

describe("getStageVariant()", () => {
  it("returns primary for new_lead", () => {
    expect(getStageVariant("new_lead")).toBe("primary");
  });

  it("returns accent for contacted", () => {
    expect(getStageVariant("contacted")).toBe("accent");
  });

  it("returns warning for showing", () => {
    expect(getStageVariant("showing")).toBe("warning");
  });

  it("returns default for offer", () => {
    expect(getStageVariant("offer")).toBe("default");
  });

  it("returns success for closed_won", () => {
    expect(getStageVariant("closed_won")).toBe("success");
  });

  it("returns destructive for closed_lost", () => {
    expect(getStageVariant("closed_lost")).toBe("destructive");
  });

  it("returns default for unknown stage", () => {
    expect(getStageVariant("unknown_stage")).toBe("default");
  });
});

// ── getLeadScore (shared leads/pipeline scoring) ──────────────

import { getLeadScore } from "@/lib/utils";

describe("getLeadScore", () => {
  const makeLead = (stage: string, updatedDaysAgo: number) => ({
    pipeline_stage: stage,
    updated_at: new Date(Date.now() - updatedDaysAgo * 86_400_000).toISOString(),
  });

  it("scores showing-or-later stages as hot regardless of recency", () => {
    expect(getLeadScore(makeLead("showing", 90))).toBe("hot");
    expect(getLeadScore(makeLead("offer", 400))).toBe("hot");
    expect(getLeadScore(makeLead("closed_won", 400))).toBe("hot");
  });

  it("scores recently-updated new leads as hot", () => {
    expect(getLeadScore(makeLead("new_lead", 1))).toBe("hot");
  });

  it("scores contacted stage or week-fresh leads as warm", () => {
    expect(getLeadScore(makeLead("contacted", 30))).toBe("warm");
    expect(getLeadScore(makeLead("new_lead", 5))).toBe("warm");
  });

  it("scores stale cold-pipeline leads as cold", () => {
    expect(getLeadScore(makeLead("new_lead", 30))).toBe("cold");
  });

  it("treats closed_lost as non-advanced (score driven by recency)", () => {
    expect(getLeadScore(makeLead("closed_lost", 400))).toBe("cold");
    expect(getLeadScore(makeLead("closed_lost", 2))).toBe("hot");
  });
});
