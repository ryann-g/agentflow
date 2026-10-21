import { Resend } from "resend";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  }
  return _resend;
}

export const EMAIL_CONFIG = {
  from: "AgentFlow <hello@agent-flow.app>",
  appName: "AgentFlow",
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

interface LeadForDigest {
  full_name: string;
  next_action: string | null;
  next_action_date: string | null;
}

export async function sendDailyDigest(
  to: string,
  userName: string,
  leads: LeadForDigest[]
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const resend = getResendClient();

  const leadList = leads
    .map(
      (l) =>
        `<li><strong>${escapeHtml(l.full_name)}</strong>${l.next_action ? `: ${escapeHtml(l.next_action)}` : ""}${l.next_action_date ? ` (due ${new Date(l.next_action_date).toLocaleDateString()})` : ""}</li>`
    )
    .join("");

  const html = `
    <h2>Good morning, ${escapeHtml(userName)}!</h2>
    <p>You have ${leads.length} lead${leads.length === 1 ? "" : "s"} to follow up with today:</p>
    <ul>${leadList}</ul>
    <p>
      <a href="${EMAIL_CONFIG.appUrl}/follow-ups" style="display:inline-block;background-color:#0F766E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">
        View Follow-ups
      </a>
    </p>
    <p style="color:#64748B;font-size:12px;margin-top:24px;">
      — ${EMAIL_CONFIG.appName}: The CRM for agents who hate CRMs
    </p>
  `;

  try {
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject: `${leads.length} follow-up${leads.length === 1 ? "" : "s"} due today`,
      html,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function sendWelcomeEmail(
  to: string,
  userName: string
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const resend = getResendClient();

  const html = `
    <h2>Welcome to ${EMAIL_CONFIG.appName}, ${escapeHtml(userName)}!</h2>
    <p>You're all set to start managing your leads like a pro.</p>
    <p>Here's what you can do:</p>
    <ul>
      <li>Add your first lead</li>
      <li>Set up your pipeline stages</li>
      <li>Schedule follow-ups</li>
    </ul>
    <p>
      <a href="${EMAIL_CONFIG.appUrl}/dashboard" style="display:inline-block;background-color:#0F766E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;">
        Go to Dashboard
      </a>
    </p>
    <p style="color:#64748B;font-size:12px;margin-top:24px;">
      — ${EMAIL_CONFIG.appName}: The CRM for agents who hate CRMs
    </p>
  `;

  try {
    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to,
      subject: `Welcome to ${EMAIL_CONFIG.appName}!`,
      html,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

