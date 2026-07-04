import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Pin,
  Tag,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  sortChangelog,
  getPublishedEntries,
  groupByMonth,
  type ChangelogEntry,
} from "@/lib/changelog";
import { CHANGELOG } from "@/data/changelog";

export const metadata: Metadata = {
  title: "Changelog — AgentFlow",
  alternates: {
    canonical: "https://agent-flow.app/changelog",
  },
  description:
    "Every release, improvement, and bug fix shipped to AgentFlow. Updated whenever we deploy.",
};

// Always fresh — the changelog is hand-curated and re-rendered on every deploy.
export const dynamic = "force-static";

export default function ChangelogPage() {
  // Filter out future-scheduled entries, then sort pinned-first.
  const published = getPublishedEntries(CHANGELOG, new Date());
  const sorted = sortChangelog(published);

  // Pinned entries render at the top in their own section
  const pinned = sorted.filter((e) => e.pinned);
  const unpinned = sorted.filter((e) => !e.pinned);
  const months = groupByMonth(unpinned);

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
          Changelog
        </h1>
        <p className="text-sm text-surface-500 mb-10">
          Every release, improvement, and bug fix. Updated whenever we ship.
        </p>

        {pinned.length > 0 && (
          <section
            aria-label="Pinned announcement"
            className="mb-12 rounded-lg border border-warning-200 bg-warning-50 p-6"
          >
            {pinned.map((entry) => (
              <ChangelogCard key={entry.id} entry={entry} pinned />
            ))}
          </section>
        )}

        {months.length === 0 && pinned.length === 0 ? (
          <p className="text-surface-500">No releases yet, check back soon.</p>
        ) : (
          <div className="space-y-12">
            {months.map((group) => (
              <section key={group.month} aria-labelledby={`month-${group.month}`}>
                <h2
                  id={`month-${group.month}`}
                  className="font-heading text-lg font-semibold text-surface-900 mb-4"
                >
                  {group.month}
                </h2>
                <div className="space-y-8">
                  {group.entries.map((entry) => (
                    <ChangelogCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Archive link */}
        <div className="mt-16 pt-8 border-t border-surface-100">
          <Link
            href="https://github.com/dream-creator/agentflow/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-700 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View full release history on GitHub
          </Link>
        </div>
      </main>
    </div>
  );
}

function ChangelogCard({
  entry,
  pinned = false,
}: {
  entry: ChangelogEntry;
  pinned?: boolean;
}) {
  return (
    <article
      id={entry.id}
      className={pinned ? "" : "rounded-lg border border-surface-200 p-6"}
    >
      {/* Header: title + meta */}
      <header className="mb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="font-heading text-xl font-semibold text-surface-900">
            {entry.title}
          </h3>
          {pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-200 text-warning-800 px-2.5 py-0.5 text-xs font-medium">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-surface-500 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
          </span>
          {entry.version && (
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-100 px-2 py-0.5 font-mono text-surface-700">
              <Tag className="h-3 w-3" />v{entry.version}
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <p className="text-surface-600 leading-relaxed mb-3">{entry.summary}</p>
      {entry.items.length > 0 && (
        <ul className="space-y-1.5 text-sm text-surface-600">
          {entry.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span
                className="inline-block w-1 h-1 rounded-full bg-surface-400 mt-2 shrink-0"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Optional CTA */}
      {entry.cta && (
        <div className="mt-4">
          <Link
            href={entry.cta.href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-700 transition-colors"
          >
            {entry.cta.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </article>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
