import { notFound } from "next/navigation";
import Link from "next/link";
import { getLead } from "@/hooks/useLead";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Phone, Mail, MessageSquare, Edit, Clock, CheckCircle } from "lucide-react";
import { formatStage, getStageVariant } from "@/lib/utils";
import { DeleteLeadButton } from "./lead-detail-client";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lead, actions, error } = await getLead(id);

  if (error || !lead) {
    notFound();
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
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-surface-900">
              {lead.full_name}
            </h1>
            <Badge variant={getStageVariant(lead.pipeline_stage)} className="mt-2">
              {formatStage(lead.pipeline_stage)}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Link href={`/leads/${lead.id}/edit`}>
              <Button variant="ghost" size="sm">
                <Edit className="h-4 w-4" />
              </Button>
            </Link>
            <DeleteLeadButton leadId={lead.id} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {lead.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500">Phone</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-900">{lead.phone}</span>
                  <a
                    href={`tel:${lead.phone}`}
                    aria-label="Call"
                    className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-touch min-h-touch flex items-center justify-center"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                  <a
                    href={`sms:${lead.phone}`}
                    aria-label="Send text message"
                    className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-touch min-h-touch flex items-center justify-center"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
            {lead.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-500">Email</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-surface-900">{lead.email}</span>
                  <a
                    href={`mailto:${lead.email}`}
                    aria-label="Send email"
                    className="p-2 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-primary transition-colors min-w-touch min-h-touch flex items-center justify-center"
                  >
                    <Mail className="h-4 w-4" />
                  </a>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-surface-500">Source</span>
              <span className="text-sm text-surface-900 capitalize">
                {lead.source.replace("_", " ")}
              </span>
            </div>
          </div>
        </Card>

        {/* Next Action */}
        <Card>
          <CardHeader>
            <CardTitle>Next Action</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {lead.next_action ? (
              <>
                <p className="text-sm text-surface-900">{lead.next_action}</p>
                {lead.next_action_date && (
                  <p className="text-xs text-surface-500">
                    Due: {new Date(lead.next_action_date).toLocaleDateString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-surface-500">No next action set</p>
            )}
          </div>
        </Card>

        {/* Notes */}
        {lead.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <p className="text-sm text-surface-700 whitespace-pre-wrap">{lead.notes}</p>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-3 gap-2">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="btn-primary flex flex-col items-center gap-1 py-3"
              >
                <Phone className="h-5 w-5" />
                <span className="text-xs">Call</span>
              </a>
            )}
            {lead.phone && (
              <a
                href={`sms:${lead.phone}`}
                className="btn-secondary flex flex-col items-center gap-1 py-3"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs">Text</span>
              </a>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="btn-secondary flex flex-col items-center gap-1 py-3"
              >
                <Mail className="h-5 w-5" />
                <span className="text-xs">Email</span>
              </a>
            )}
          </div>
        </Card>

        {/* Action History */}
        <Card>
          <CardHeader>
            <CardTitle>Action History</CardTitle>
          </CardHeader>
          {actions.length === 0 ? (
            <p className="text-sm text-surface-500">No actions recorded yet</p>
          ) : (
            <div className="space-y-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-surface-50"
                >
                  <div className="mt-0.5">
                    {action.completed ? (
                      <CheckCircle className="h-4 w-4 text-success-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-surface-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={action.completed ? "success" : "default"}>
                        {action.action_type}
                      </Badge>
                      <span className="text-xs text-surface-500">
                        {new Date(action.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {action.description && (
                      <p className="text-sm text-surface-700">{action.description}</p>
                    )}
                    {action.due_date && (
                      <p className="text-xs text-surface-500 mt-1">
                        Due: {new Date(action.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
