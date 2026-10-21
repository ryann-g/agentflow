"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { Trash2 } from "lucide-react";
import { deleteLead } from "@/hooks/useLeads";

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    // Soft delete goes through DELETE /api/leads/[id] so the route's
    // ownership scoping and rate limit apply.
    const { error } = await deleteLead(leadId);

    if (error) {
      showToast("Failed to delete lead. Please try again.", "error");
      return;
    }

    showToast("Lead deleted successfully!", "success");
    router.push("/leads");
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete}>
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
