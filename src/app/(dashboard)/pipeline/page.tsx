import { getLeadsForServer } from "@/hooks/useLeadsServer";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { PipelineBoard } from "@/components/pipeline/pipeline-board";
import { PipelineClient } from "./pipeline-client";

export default async function PipelinePage() {
  const { data: leads, error } = await getLeadsForServer();

  if (error === "Not authenticated") {
    redirect("/login");
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-surface-900">
            Pipeline
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {leads?.length ?? 0} active leads
          </p>
        </div>
        <Link href="/leads/new">
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-1" />
            Add Lead
          </Button>
        </Link>
      </div>

      {!leads || leads.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="h-6 w-6 text-surface-500" />}
          title="No leads yet"
          description="Add your first lead to start building your pipeline."
          action={
            <Link href="/leads/new">
              <Button>Add your first lead</Button>
            </Link>
          }
        />
      ) : (
        <PipelineClient initialLeads={leads} />
      )}
    </div>
  );
}
