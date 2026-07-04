import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — AgentFlow",
  description:
    "AgentFlow terms of service. The ground rules for using our CRM platform.",
  alternates: {
    canonical: "https://agent-flow.app/terms",
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-surface-100">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-3xl font-bold text-surface-900 mb-2">
          Terms of Service
        </h1>
        <p className="text-sm text-surface-500 mb-8">
          Effective Date: June 6, 2026
        </p>

        <div className="prose prose-surface max-w-none">
          <p className="text-surface-600 leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of
            AgentFlow (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a CRM
            platform for solo real estate agents. By creating an account, you agree
            to be bound by these Terms.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            1. Service Description and Disclaimer
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            AgentFlow is a productivity tool designed to help solo real estate
            agents manage leads, track pipelines, and schedule follow-ups.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            We do not provide real estate, legal, or financial advice.
          </p>
          <p className="text-surface-600 leading-relaxed">
            You are solely responsible for the business decisions you make while
            using our service.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            2. Account Requirements
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            To use AgentFlow, you must:
          </p>
          <ul className="list-disc list-inside text-surface-600 space-y-1.5 mb-3 ml-4">
            <li>Be a real person who is at least 18 years of age.</li>
            <li>Provide accurate and current account information.</li>
            <li>
              Keep your login credentials secure and confidential.
            </li>
            <li>
              Accept responsibility for all activity that occurs under your
              account.
            </li>
          </ul>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            3. Subscription and Billing
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            AgentFlow is offered as a subscription-based service. We provide a
            Free tier with limited features and a Pro tier with extended
            capabilities.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            Paid subscriptions are billed monthly in advance and may be
            cancelled at any time from your account settings.
          </p>
          <p className="text-surface-600 leading-relaxed">
            Refunds are not prorated; cancellation takes effect at the end of
            the current billing period.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            4. Acceptable Use
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            You agree not to use AgentFlow to:
          </p>
          <ul className="list-disc list-inside text-surface-600 space-y-1.5 mb-3 ml-4">
            <li>
              Violate any applicable law, including real estate, fair housing,
              anti-spam (such as CAN-SPAM and TCPA), or consumer protection
              regulations.
            </li>
            <li>Send unsolicited communications or spam.</li>
            <li>Harass, threaten, defame, or defraud any person or entity.</li>
            <li>
              Attempt to hack, reverse-engineer, disrupt, or otherwise interfere
              with the security or operation of the service.
            </li>
            <li>Engage in any activity that is illegal or harmful.</li>
          </ul>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            5. IP and Data Ownership
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            You retain full ownership of all contacts, notes, pipeline data,
            and other content you upload or create in AgentFlow. You may export
            your data at any time.
          </p>
          <p className="text-surface-600 leading-relaxed">
            <strong className="text-surface-800">Our Platform:</strong> We
            retain all rights, title, and interest in and to the AgentFlow
            software, design, trademarks, logos, and underlying technology. You
            may not copy, resell, or create derivative works of the platform.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            6. Disclaimer of Warranties
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          </p>
          <p className="text-surface-600 leading-relaxed">
            To the fullest extent permitted by applicable law, we disclaim all
            warranties, express or implied, including the implied warranties of
            merchantability, fitness for a particular purpose, and
            non-infringement. We do not warrant that the service will be
            uninterrupted, error-free, or secure.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            7. Limitation of Liability
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            To the maximum extent permitted by law, AgentFlow and its
            affiliates, officers, employees, agents, and partners will not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages.
          </p>
          <p className="text-surface-600 leading-relaxed">
            This includes, without limitation, damages for lost commissions,
            lost profits, lost data, business interruption, or any other
            commercial loss arising out of or related to your use of (or
            inability to use) the service.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            8. Termination
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            You may delete your account and terminate these Terms at any time
            from your account settings.
          </p>
          <p className="text-surface-600 leading-relaxed">
            We may suspend or terminate your account at any time, with or
            without notice, if we reasonably believe you have breached these
            Terms, failed to pay applicable fees, or remained inactive for
            twelve (12) months or more.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            9. Governing Law
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            These Terms are governed by and construed in accordance with the
            laws of the <strong className="text-surface-800">State of California, United States of America</strong>,
            without regard to its conflict of laws principles.
          </p>
          <p className="text-surface-600 leading-relaxed">
            You agree to submit to the exclusive jurisdiction of the state and
            federal courts located in California for the resolution of any
            dispute arising out of or relating to these Terms or your use of
            the Service.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            10. Contact
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            If you have any questions about these Terms, please contact us:
          </p>
          <p className="text-surface-600 leading-relaxed">
            <strong className="text-surface-800">Email:</strong>{" "}
            <a
              href="mailto:support@agent-flow.app"
              className="text-primary hover:underline"
            >
              support@agent-flow.app
            </a>
          </p>
          <p className="text-surface-600 leading-relaxed">
            <strong className="text-surface-800">Website:</strong>{" "}
            <a
              href="https://agent-flow.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              agent-flow.app
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
