import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentFlow",
  description: "AgentFlow privacy policy. Learn how we collect, use, and protect your data.",
  alternates: {
    canonical: "https://agent-flow.app/privacy",
  },
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-sm text-surface-500 mb-8">
          Effective Date: June 6, 2026
        </p>

        <div className="prose prose-surface max-w-none">
          <p className="text-surface-600 leading-relaxed">
            This Privacy Policy explains how AgentFlow (&quot;we,&quot; &quot;us,&quot; or
            &quot;our&quot;) collects, uses, discloses, and safeguards your information when
            you use our CRM platform. By creating an account, you consent to the practices
            described in this policy.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            1. Information We Collect
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Account Information:</strong> Name, email
            address, and brokerage name collected upon registration.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Client Data:</strong> Lead information
            (names, phone numbers, emails, notes, pipeline stages) entered into the CRM. You
            retain full ownership of this data.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Payment Information:</strong> Processed
            via Stripe. We do not store full credit card numbers; we retain only the last
            four digits and basic billing details.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Usage Data:</strong> Automatically
            collected metrics, including IP address, browser type, and session duration.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Third-Party Integrations:</strong>{" "}
            Read-only access requested during Google Contacts synchronization. We do not
            store persistent access tokens post-session.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            2. Use of Information
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            We use collected information solely to provide and improve AgentFlow services,
            specifically to:
          </p>
          <ul className="list-disc list-inside text-surface-600 space-y-1.5 mb-3 ml-4">
            <li>Operate and maintain the platform.</li>
            <li>Process subscription payments.</li>
            <li>Transmit automated follow-up digests and SMS reminders.</li>
            <li>Provide customer support.</li>
            <li>Monitor platform security and resolve technical issues.</li>
          </ul>
          <p className="text-surface-600 leading-relaxed">
            Note: We do not send promotional communications without explicit consent.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            3. Information Sharing and Disclosure
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            We do not sell, rent, or trade your personal or client data. We disclose
            information only under the following circumstances:
          </p>
          <ul className="list-disc list-inside text-surface-600 space-y-1.5 mb-3 ml-4">
            <li>
              <strong className="text-surface-800">Service Providers:</strong> Shared with
              trusted partners to facilitate our service delivery (Stripe for payments,
              Resend for email, Supabase for database hosting, and Cloudflare for security).
            </li>
            <li>
              <strong className="text-surface-800">Legal Obligations:</strong> Disclosed if
              required by subpoena, court order, or similar legal mandate.
            </li>
            <li>
              <strong className="text-surface-800">Business Transfers:</strong> Transferred
              in connection with a merger, acquisition, or sale of assets.
            </li>
          </ul>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            4. Data Security
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            We implement industry-standard encryption for data in transit and at rest.
            Authentication requires email magic links or Google single sign-on (SSO).
            However, no electronic transmission or storage system is entirely secure; we
            cannot guarantee absolute data security against unauthorized access.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            5. Data Retention and User Rights
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Retention:</strong> Data is retained while
            your account remains active.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Deletion:</strong> Upon account
            cancellation, personal data is erased or irreversibly anonymized within 30 days.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">User Rights:</strong> You may access,
            correct, or request deletion of your data at any time. You may also export your
            client data in CSV format directly via the application.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            6. Cookies and Tracking
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            We utilize only strictly necessary cookies to maintain session state and basic
            interface preferences. We do not use advertising cookies, tracking pixels, or
            behavioral profiling.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Security Cookies:</strong> Cloudflare sets
            a{" "}
            <code className="bg-surface-100 px-1 rounded text-[13px]">__cf_bm</code> cookie
            on authentication pages to distinguish between human and automated traffic. It
            expires after 30 minutes of inactivity, contains no personally identifiable
            information, and is mandatory for form security.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            7. Third-Party Security Services (Cloudflare Turnstile)
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            Our authentication pages utilize Cloudflare Turnstile to prevent automated abuse
            (e.g., bot traffic, credential stuffing).
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Data Processed:</strong> Cloudflare
            automatically receives your IP address, browser/OS metadata, basic configuration
            settings, and a request timestamp. Behavior signals are processed only if a
            challenge renders and are not used for user fingerprinting.
          </p>
          <p className="text-surface-600 leading-relaxed mb-3">
            <strong className="text-surface-800">Data Handling:</strong> Cloudflare issues
            a temporary pass/fail token. AgentFlow does not access or store raw signals.
            Cloudflare processes this data under its own privacy policy (
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              cloudflare.com/privacypolicy
            </a>
            ).
          </p>
          <p className="text-surface-600 leading-relaxed">
            <strong className="text-surface-800">Opt-Out:</strong> Users opting out of
            Turnstile evaluation must contact{" "}
            <a
              href="mailto:privacy@agent-flow.app"
              className="text-primary hover:underline"
            >
              privacy@agent-flow.app
            </a>{" "}
            to establish alternative authentication.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            8. International Data Transfers
          </h2>
          <p className="text-surface-600 leading-relaxed">
            AgentFlow operates in the United States. Information collected is processed and
            stored on U.S. servers.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            9. Age Restrictions
          </h2>
          <p className="text-surface-600 leading-relaxed">
            AgentFlow is intended exclusively for adult professionals. Users must be at
            least 18 years of age.
          </p>

          <h2 className="font-heading text-xl font-semibold text-surface-900 mt-10 mb-3">
            10. Contact Information
          </h2>
          <p className="text-surface-600 leading-relaxed mb-3">
            For privacy-related inquiries or to exercise data rights, contact us at:
          </p>
          <p className="text-surface-600 leading-relaxed">
            <strong className="text-surface-800">Email:</strong>{" "}
            <a
              href="mailto:privacy@agent-flow.app"
              className="text-primary hover:underline"
            >
              privacy@agent-flow.app
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
