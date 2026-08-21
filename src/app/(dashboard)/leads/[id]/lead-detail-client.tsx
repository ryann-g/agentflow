"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { Trash2 } from "lucide-react";
import type { Database } from "@/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this lead?")) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("leads")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", leadId)
      .eq("user_id", user.id);

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
