import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Mail, Globe, MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us — AgentFlow",
  description: "Get in touch with the AgentFlow team. We're here to help.",
  alternates: {
    canonical: "https://agent-flow.app/contact",
  },
};

export default function ContactPage() {
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
          Contact Us
        </h1>
        <p className="text-surface-500 text-lg mb-10 max-w-xl">
          Have a question, need help, or want to report an issue? We&apos;re always here for
          you.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Email Card */}
          <a
            href="mailto:support@agent-flow.app"
            className="group block p-6 rounded-card border border-surface-200 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Mail className="h-6 w-6" />
            </div>
            <h2 className="font-heading font-semibold text-surface-900 mb-1">
              Email Us
            </h2>
            <p className="text-sm text-surface-500 mb-3">
              For general questions, support, or feedback.
            </p>
            <p className="text-sm font-medium text-primary group-hover:underline">
              support@agent-flow.app
            </p>
          </a>

          {/* Website Card */}
          <a
            href="https://agent-flow.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-6 rounded-card border border-surface-200 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-primary-50 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
              <Globe className="h-6 w-6" />
            </div>
            <h2 className="font-heading font-semibold text-surface-900 mb-1">
              Visit Our Website
            </h2>
            <p className="text-sm text-surface-500 mb-3">
              Learn more about AgentFlow and our features.
            </p>
            <p className="text-sm font-medium text-primary group-hover:underline">
              agent-flow.app
            </p>
          </a>
        </div>

        {/* Privacy Contact */}
        <div className="mt-8 p-6 rounded-card bg-surface-50 border border-surface-100">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-surface-100 text-surface-600 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-surface-900 mb-1">
                Privacy Concerns
              </h3>
              <p className="text-sm text-surface-500 mb-2">
                For privacy-related inquiries or to exercise your data rights, contact us
                directly.
              </p>
              <a
                href="mailto:privacy@agent-flow.app"
                className="text-sm font-medium text-primary hover:underline"
              >
                privacy@agent-flow.app
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
