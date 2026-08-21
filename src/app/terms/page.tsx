import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — AgentFlow",
  description:
    "AgentFlow terms of service. The ground rules for using our CRM platform.",
  alternates: {
    canonical: "https://agent-flow.app/terms",
  },
};

const SECTIONS = [
  { id: "service", num: "1", title: "Service Description and Disclaimer" },
  { id: "account", num: "2", title: "Account Requirements" },
  { id: "billing", num: "3", title: "Subscription and Billing" },
  { id: "acceptable-use", num: "4", title: "Acceptable Use" },
  { id: "ip-data", num: "5", title: "IP and Data Ownership" },
  { id: "warranties", num: "6", title: "Disclaimer of Warranties" },
  { id: "liability", num: "7", title: "Limitation of Liability" },
  { id: "termination", num: "8", title: "Termination" },
  { id: "governing-law", num: "9", title: "Governing Law" },
  { id: "contact", num: "10", title: "Contact" },
] as const;

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-surface-600 hover:text-surface-900 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Home className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-heading text-base font-semibold text-surface-900">
              AgentFlow
            </span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-10 lg:py-14">
        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-12">
          {/* Sidebar TOC (sticky on desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <div className="flex items-center gap-2 mb-5">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-heading text-sm font-semibold text-surface-900">
                  Contents
                </span>
              </div>
              <nav aria-label="Table of contents">
                <ul className="space-y-1">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="group flex items-baseline gap-2 py-1 text-sm text-surface-500 hover:text-primary transition-colors"
                      >
                        <span className="font-mono text-xs text-surface-500 group-hover:text-primary tabular-nums w-4 shrink-0">
                          {s.num}.
                        </span>
                        <span className="leading-snug">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main>
            {/* Page header */}
            <header className="mb-10">
              <h1 className="font-heading text-3xl sm:text-4xl font-bold text-surface-900 tracking-tight mb-2">
                Terms of Service
              </h1>
              <p className="text-sm text-surface-500">
                Effective Date: June 6, 2026
              </p>
            </header>

            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 border border-surface-200 rounded-card">
              <summary className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-surface-700 cursor-pointer select-none">
                <FileText className="h-4 w-4 text-primary" />
                Table of Contents
              </summary>
              <nav aria-label="Table of contents" className="px-4 pb-3">
                <ul className="space-y-1">
                  {SECTIONS.map((s) => (
                    <li key={s.id}>
                      <a
                        href={`#${s.id}`}
                        className="flex items-baseline gap-2 py-1 text-sm text-surface-500 hover:text-primary transition-colors"
                      >
                        <span className="font-mono text-xs text-surface-500 tabular-nums w-4 shrink-0">
                          {s.num}.
                        </span>
                        <span>{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>

            {/* Introduction */}
            <div className="prose prose-surface max-w-none mb-10">
              <p>
                These Terms of Service (&quot;Terms&quot;) govern your access to and
                use of AgentFlow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;),
                a CRM platform for solo real estate agents. By creating an
                account, you agree to be bound by these Terms.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-10">
              {SECTIONS.map((s) => (
                <section key={s.id} id={s.id} className="scroll-mt-24">
                  <h2 className="font-heading text-xl font-semibold text-surface-900 mb-4 flex items-baseline gap-2.5">
                    <span className="font-mono text-sm text-primary tabular-nums">
                      {s.num}.
                    </span>
                    {s.title}
                  </h2>
                  <div className="prose prose-surface max-w-none">
                    {s.id === "service" && (
                      <>
                        <p>
                          AgentFlow is a productivity tool designed to help solo
                          real estate agents manage leads, track pipelines, and
                          schedule follow-ups.
                        </p>
                        <p>We do not provide real estate, legal, or financial advice.</p>
                        <p>
                          You are solely responsible for the business decisions
                          you make while using our service.
                        </p>
                      </>
                    )}

                    {s.id === "account" && (
                      <>
                        <p>To use AgentFlow, you must:</p>
                        <ul>
                          <li>Be a real person who is at least 18 years of age.</li>
                          <li>Provide accurate and current account information.</li>
                          <li>Keep your login credentials secure and confidential.</li>
                          <li>
                            Accept responsibility for all activity that occurs
                            under your account.
                          </li>
                        </ul>
                      </>
                    )}

                    {s.id === "billing" && (
                      <>
                        <p>
                          AgentFlow is offered as a subscription-based service. We
                          provide a Free tier with limited features and a Pro tier
                          with extended capabilities.
                        </p>
                        <p>
                          Paid subscriptions are billed monthly in advance and may
                          be cancelled at any time from your account settings.
                        </p>
                        <p>
                          Refunds are not prorated; cancellation takes effect at
                          the end of the current billing period.
                        </p>
                      </>
                    )}

                    {s.id === "acceptable-use" && (
                      <>
                        <p>You agree not to use AgentFlow to:</p>
                        <ul>
                          <li>
                            Violate any applicable law, including real estate, fair
                            housing, anti-spam (such as CAN-SPAM and TCPA), or
                            consumer protection regulations.
                          </li>
                          <li>Send unsolicited communications or spam.</li>
                          <li>Harass, threaten, defame, or defraud any person or entity.</li>
                          <li>
                            Attempt to hack, reverse-engineer, disrupt, or otherwise
                            interfere with the security or operation of the service.
                          </li>
                          <li>Engage in any activity that is illegal or harmful.</li>
                        </ul>
                      </>
                    )}

                    {s.id === "ip-data" && (
                      <>
                        <p>
                          You retain full ownership of all contacts, notes,
                          pipeline data, and other content you upload or create in
                          AgentFlow. You may export your data at any time.
                        </p>
                        <p>
                          <strong>Our Platform:</strong> We retain all rights,
                          title, and interest in and to the AgentFlow software,
                          design, trademarks, logos, and underlying technology. You
                          may not copy, resell, or create derivative works of the
                          platform.
                        </p>
                      </>
                    )}

                    {s.id === "warranties" && (
                      <>
                        <p>
                          The service is provided on an &quot;as is&quot; and
                          &quot;as available&quot; basis.
                        </p>
                        <p>
                          To the fullest extent permitted by applicable law, we
                          disclaim all warranties, express or implied, including
                          the implied warranties of merchantability, fitness for a
                          particular purpose, and non-infringement. We do not
                          warrant that the service will be uninterrupted,
                          error-free, or secure.
                        </p>
                      </>
                    )}

                    {s.id === "liability" && (
                      <>
                        <p>
                          To the maximum extent permitted by law, AgentFlow and its
                          affiliates, officers, employees, agents, and partners
                          will not be liable for any indirect, incidental, special,
                          consequential, or punitive damages.
                        </p>
                        <p>
                          This includes, without limitation, damages for lost
                          commissions, lost profits, lost data, business
                          interruption, or any other commercial loss arising out of
                          or related to your use of (or inability to use) the
                          service.
                        </p>
                      </>
                    )}

                    {s.id === "termination" && (
                      <>
                        <p>
                          You may delete your account and terminate these Terms at
                          any time from your account settings.
                        </p>
                        <p>
                          We may suspend or terminate your account at any time, with
                          or without notice, if we reasonably believe you have
                          breached these Terms, failed to pay applicable fees, or
                          remained inactive for twelve (12) months or more.
                        </p>
                      </>
                    )}

                    {s.id === "governing-law" && (
                      <>
                        <p>
                          These Terms are governed by and construed in accordance
                          with the laws of the{" "}
                          <strong>State of California, United States of America</strong>,
                          without regard to its conflict of laws principles.
                        </p>
                        <p>
                          You agree to submit to the exclusive jurisdiction of the
                          state and federal courts located in California for the
                          resolution of any dispute arising out of or relating to
                          these Terms or your use of the Service.
                        </p>
                      </>
                    )}

                    {s.id === "contact" && (
                      <>
                        <p>
                          If you have any questions about these Terms, please
                          contact us:
                        </p>
                        <p>
                          <strong>Email:</strong>{" "}
                          <a href="mailto:support@agent-flow.app">
                            support@agent-flow.app
                          </a>
                        </p>
                        <p>
                          <strong>Website:</strong>{" "}
                          <a
                            href="https://agent-flow.app"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            agent-flow.app
                          </a>
                        </p>
                      </>
                    )}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
