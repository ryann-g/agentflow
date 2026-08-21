import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { StickyHeader } from "@/components/layout/sticky-header";
import { HowItWorks } from "@/components/landing/how-it-works";
import { HeroDemo } from "@/components/landing/hero-demo";

// Lazy-load: only needed when Supabase OAuth drops ?code= on root
// Removes ~165KB Supabase client from the landing page bundle
const AuthCallbackRescue = dynamic(
  () =>
    import("@/components/auth-callback-rescue").then(
      (mod) => mod.AuthCallbackRescue
    ),
  { ssr: false }
);
import { Footer } from "@/components/footer";
import { LandingPricing } from "@/components/landing-pricing";
import IntegrationGrid from "@/components/landing/integration-grid";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import {
  Phone,
  Clock,
  ArrowRight,
  Contact,
  GitBranch,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AgentFlow — The CRM for agents who hate CRMs",
  description:
    "Dead-simple contact management and follow-up for solo real estate agents. No bloat. No learning curve. Just who to call today.",
  alternates: {
    canonical: "https://agent-flow.app",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <AuthCallbackRescue />

      <StickyHeader />

      <main id="main-content">

      {/* Hero — visible immediately, no scroll-reveal */}
      <section className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Centered text block */}
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="font-heading text-4xl sm:text-5xl lg:text-[56px] font-bold text-surface-900 leading-[1.1] tracking-tight mb-6">
              The CRM for agents{" "}
              <span className="text-primary">who hate CRMs</span>
            </h1>
            <p className="text-lg sm:text-xl text-surface-500 mb-8 max-w-xl mx-auto leading-relaxed">
              Dead-simple contact management and follow-up for solo real estate
              agents. No bloat. No learning curve. Just who to call today.
            </p>

            {/* Dual CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto rounded-full">
                  Start for free
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/#how-it-works">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto rounded-full">
                  See how it works
                </Button>
              </Link>
            </div>

            {/* Trust signal */}
            <p className="text-sm text-surface-500">
              Free to start. No credit card required.
            </p>
          </div>

          {/* Video demo — centered below text, frosted-glass container */}
          <HeroDemo />
        </div>
      </section>

      {/* Integration Ecosystem Grid */}
      <IntegrationGrid />

      {/* Problem Section */}
      <section className="py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="section-heading mb-4">
              Every CRM you&apos;ve tried is overkill
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="section-subheading mb-12">
              Follow Up Boss at $69/mo. kvCORE at $100/mo. Features for teams of 50 when
              you&apos;re a solo agent doing 12 deals a year.
            </p>
          </ScrollReveal>
          <div className="space-y-6 text-left max-w-2xl mx-auto">
            {[
              {
                num: "01",
                title: "20-minute setup tax",
                desc: "Every time you open the app after a busy week, you face a mountain of missed tasks.",
              },
              {
                num: "02",
                title: "Built for teams",
                desc: "Complex automations, lead routing, ISA management — none of which you need.",
              },
              {
                num: "03",
                title: "Bad mobile experience",
                desc: "You work from your phone between showings. Your CRM should too.",
              },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={180 + i * 70}>
                <div className="flex gap-4 items-start">
                  <span className="text-xs font-mono text-surface-300 mt-1 shrink-0">
                    {item.num}
                  </span>
                  <div>
                    <h3 className="font-heading font-semibold text-surface-900 mb-1">
                      {item.title}
                    </h3>
                    <p className="text-sm text-surface-500 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-24 px-4 sm:px-6 section-alt">
        <div className="max-w-3xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="section-heading mb-4">
              Three things. That&apos;s it.
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="section-subheading mb-12">
              AgentFlow does exactly what you need and nothing else.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                icon: <Contact className="h-5 w-5" />,
                title: "Contacts",
                desc: "Name, phone, email, and source. Everything you need, nothing you don't.",
                preview: (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-surface-100 text-left h-20 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-primary">JD</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-900 truncate">Jane Doe</p>
                        <p className="text-[10px] text-surface-500 truncate">jane@email.com</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">Referral</span>
                      <div className="w-5 h-5 rounded bg-surface-100 flex items-center justify-center">
                        <Contact className="h-3 w-3 text-surface-500" />
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                icon: <GitBranch className="h-5 w-5" />,
                title: "Pipeline",
                desc: "See where every lead stands. Tap to move between stages.",
                preview: (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-surface-100 text-left h-20 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-accent-700">TS</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-900 truncate">Tom Smith</p>
                        <p className="text-[10px] text-surface-500 truncate">Showing scheduled</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-accent-50 text-accent-700 px-1.5 py-0.5 rounded">Showing</span>
                      <div className="flex gap-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-surface-200" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <div className="w-1.5 h-1.5 rounded-full bg-surface-200" />
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                icon: <Clock className="h-5 w-5" />,
                title: "Daily Follow-up",
                desc: "Open the app. See exactly who to call today. Every single morning.",
                preview: (
                  <div className="mt-4 p-3 bg-white rounded-lg border border-surface-100 text-left h-20 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-warning-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-warning-700">MC</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-surface-900 truncate">Mike Chen</p>
                        <p className="text-[10px] text-surface-500 truncate">Follow up today</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-warning-50 text-warning-700 px-1.5 py-0.5 rounded">Overdue</span>
                      <div className="w-5 h-5 rounded bg-primary flex items-center justify-center feature-phone-pulse">
                        <Phone className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                  </div>
                ),
              },
            ].map((item, i) => (
              <ScrollReveal key={i} variant="content" delay={200 + i * 120}>
                <div className="card-elevated text-left flex flex-col feature-card-hover hover:-translate-y-1 transition-all duration-200 cursor-default">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary flex items-center justify-center mb-4 shrink-0">
                    {item.icon}
                  </div>
                  <h3 className="font-heading font-semibold text-surface-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-surface-500 leading-relaxed flex-1">{item.desc}</p>
                  {item.preview}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <HowItWorks />

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-24 px-4 sm:px-6 section-alt">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="section-heading mb-4">
            Simple pricing
          </h2>
          <p className="section-subheading mb-8">
            Less than one lunch per month. Zero guilt.
          </p>
          <LandingPricing />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="section-heading mb-4">
            Stop losing leads to bad tools
          </h2>
          <p className="section-subheading mb-8">
            Join solo agents who actually use their CRM daily.
          </p>
          <Link href="/signup">
            <Button size="lg">
              Start for free
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      </main>

      <Footer />
    </div>
  );
}
