import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Home, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentFlow",
  description:
    "AgentFlow privacy policy. Learn how we collect, use, and protect your data.",
  alternates: {
    canonical: "https://agent-flow.app/privacy",
  },
};

const SECTIONS = [
  { id: "collect", num: "1", title: "Information We Collect" },
  { id: "use", num: "2", title: "Use of Information" },
  { id: "sharing", num: "3", title: "Information Sharing and Disclosure" },
  { id: "security", num: "4", title: "Data Security" },
  { id: "retention", num: "5", title: "Data Retention and User Rights" },
  { id: "cookies", num: "6", title: "Cookies and Tracking" },
  { id: "turnstile", num: "7", title: "Third-Party Security Services (Cloudflare Turnstile)" },
  { id: "transfers", num: "8", title: "International Data Transfers" },
  { id: "age", num: "9", title: "Age Restrictions" },
  { id: "contact", num: "10", title: "Contact Information" },
] as const;

export default function PrivacyPage() {
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
                <Shield className="h-4 w-4 text-primary" />
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
                Privacy Policy
              </h1>
              <p className="text-sm text-surface-500">
                Effective Date: June 6, 2026
              </p>
            </header>

            {/* Mobile TOC */}
            <details className="lg:hidden mb-8 border border-surface-200 rounded-card">
              <summary className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-surface-700 cursor-pointer select-none">
                <Shield className="h-4 w-4 text-primary" />
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
                This Privacy Policy explains how AgentFlow (&quot;we,&quot;
                &quot;us,&quot; or &quot;our&quot;) collects, uses, discloses, and
                safeguards your information when you use our CRM platform. By
                creating an account, you consent to the practices described in
                this policy.
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
                    {s.id === "collect" && (
                      <>
                        <p>
                          <strong>Account Information:</strong> Name, email
                          address, and brokerage name collected upon registration.
                        </p>
                        <p>
                          <strong>Client Data:</strong> Lead information (names,
                          phone numbers, emails, notes, pipeline stages) entered
                          into the CRM. You retain full ownership of this data.
                        </p>
                        <p>
                          <strong>Payment Information:</strong> Processed via
                          Stripe. We do not store full credit card numbers; we
                          retain only the last four digits and basic billing
                          details.
                        </p>
                        <p>
                          <strong>Usage Data:</strong> Automatically collected
                          metrics, including IP address, browser type, and session
                          duration.
                        </p>
                        <p>
                          <strong>Third-Party Integrations:</strong> Read-only
                          access requested during Google Contacts synchronization.
                          We do not store persistent access tokens post-session.
                        </p>
                      </>
                    )}

                    {s.id === "use" && (
                      <>
                        <p>
                          We use collected information solely to provide and
                          improve AgentFlow services, specifically to:
                        </p>
                        <ul>
                          <li>Operate and maintain the platform.</li>
                          <li>Process subscription payments.</li>
                          <li>
                            Transmit automated follow-up digests and SMS reminders.
                          </li>
                          <li>Provide customer support.</li>
                          <li>
                            Monitor platform security and resolve technical issues.
                          </li>
                        </ul>
                        <p>
                          Note: We do not send promotional communications without
                          explicit consent.
                        </p>
                      </>
                    )}

                    {s.id === "sharing" && (
                      <>
                        <p>
                          We do not sell, rent, or trade your personal or client
                          data. We disclose information only under the following
                          circumstances:
                        </p>
                        <ul>
                          <li>
                            <strong>Service Providers:</strong> Shared with
                            trusted partners to facilitate our service delivery
                            (Stripe for payments, Resend for email, Supabase for
                            database hosting, and Cloudflare for security).
                          </li>
                          <li>
                            <strong>Legal Obligations:</strong> Disclosed if
                            required by subpoena, court order, or similar legal
                            mandate.
                          </li>
                          <li>
                            <strong>Business Transfers:</strong> Transferred in
                            connection with a merger, acquisition, or sale of
                            assets.
                          </li>
                        </ul>
                      </>
                    )}

                    {s.id === "security" && (
                      <p>
                        We implement industry-standard encryption for data in
                        transit and at rest. Authentication requires email magic
                        links or Google single sign-on (SSO). However, no
                        electronic transmission or storage system is entirely
                        secure; we cannot guarantee absolute data security against
                        unauthorized access.
                      </p>
                    )}

                    {s.id === "retention" && (
                      <>
                        <p>
                          <strong>Retention:</strong> Data is retained while your
                          account remains active.
                        </p>
                        <p>
                          <strong>Deletion:</strong> Upon account cancellation,
                          personal data is erased or irreversibly anonymized within
                          30 days.
                        </p>
                        <p>
                          <strong>User Rights:</strong> You may access, correct, or
                          request deletion of your data at any time. You may also
                          export your client data in CSV format directly via the
                          application.
                        </p>
                      </>
                    )}

                    {s.id === "cookies" && (
                      <>
                        <p>
                          We utilize only strictly necessary cookies to maintain
                          session state and basic interface preferences. We do not
                          use advertising cookies, tracking pixels, or behavioral
                          profiling.
                        </p>
                        <p>
                          <strong>Security Cookies:</strong> Cloudflare sets a{" "}
                          <code>__cf_bm</code> cookie on authentication pages to
                          distinguish between human and automated traffic. It
                          expires after 30 minutes of inactivity, contains no
                          personally identifiable information, and is mandatory for
                          form security.
                        </p>
                      </>
                    )}

                    {s.id === "turnstile" && (
                      <>
                        <p>
                          Our authentication pages utilize Cloudflare Turnstile to
                          prevent automated abuse (e.g., bot traffic, credential
                          stuffing).
                        </p>
                        <p>
                          <strong>Data Processed:</strong> Cloudflare automatically
                          receives your IP address, browser/OS metadata, basic
                          configuration settings, and a request timestamp.
                          Behavior signals are processed only if a challenge
                          renders and are not used for user fingerprinting.
                        </p>
                        <p>
                          <strong>Data Handling:</strong> Cloudflare issues a
                          temporary pass/fail token. AgentFlow does not access or
                          store raw signals. Cloudflare processes this data under
                          its own privacy policy (
                          <a
                            href="https://www.cloudflare.com/privacypolicy/"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            cloudflare.com/privacypolicy
                          </a>
                          ).
                        </p>
                        <p>
                          <strong>Opt-Out:</strong> Users opting out of Turnstile
                          evaluation must contact{" "}
                          <a href="mailto:privacy@agent-flow.app">
                            privacy@agent-flow.app
                          </a>{" "}
                          to establish alternative authentication.
                        </p>
                      </>
                    )}

                    {s.id === "transfers" && (
                      <p>
                        AgentFlow operates in the United States. Information
                        collected is processed and stored on U.S. servers.
                      </p>
                    )}

                    {s.id === "age" && (
                      <p>
                        AgentFlow is intended exclusively for adult professionals.
                        Users must be at least 18 years of age.
                      </p>
                    )}

                    {s.id === "contact" && (
                      <>
                        <p>
                          For privacy-related inquiries or to exercise data rights,
                          contact us at:
                        </p>
                        <p>
                          <strong>Email:</strong>{" "}
                          <a href="mailto:privacy@agent-flow.app">
                            privacy@agent-flow.app
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
