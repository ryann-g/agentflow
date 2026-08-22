import type { ChangelogEntry } from "@/lib/changelog";

/**
 * Hand-curated changelog entries, newest first.
 *
 * Edit this file to add a new release. The /changelog page
 * auto-renders, sorts, and groups whatever is here.
 *
 * Fields:
 *   id          — URL-safe slug, used as React key
 *   date        — ISO date (YYYY-MM-DD)
 *   version     — optional semver shown as a small badge
 *   title       — short, user-facing title
 *   summary     — 1-2 sentences in plain English
 *   items       — bullet points describing what changed
 *   pinned      — when true, renders at the top (one entry at a time)
 *   cta         — optional { label, href } for a call-to-action link
 *   publishedAt — optional ISO datetime; entry is hidden until then
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "security-speed-billing-foundations",
    date: "2026-08-22",
    version: "0.28.0",
    title: "Faster dashboard, safer accounts, smarter billing states",
    summary:
      "Our biggest reliability release yet: the whole app moved to the latest web framework, account security got a major upgrade, and the billing page now tells you exactly what is happening with your subscription.",
    items: [
      "Pipeline quick actions now really call, text, or email your leads — one tap from any card",
      "Clearer billing status: see exactly when cancelled access ends, with self-service recovery if a payment fails",
      "Major security hardening across accounts, imports, and payment webhooks",
      "Faster dashboard — less duplicate loading behind the scenes",
      "Password reset fully working end to end",
      "Upgraded core framework for speed and future features",
    ],
  },
  {
    id: "paymongo-checkout",
    date: "2026-06-30",
    version: "0.27.0",
    title: "Upgraded payment system for smoother checkout",
    summary:
      "We switched payment providers to give you a faster, more reliable checkout experience. Upgrading to Pro now takes seconds instead of minutes, and billing just works.",
    items: [
      "Faster checkout — upgrading to Pro is now instant with PayMongo",
      "More payment options — supports GCash, Maya, GrabPay, and major Philippine banks",
      "Better reliability — fewer failed payments and clearer error messages",
      "Improved documentation — easier for our team to keep things running smoothly",
      "Codebase cleanup — removed old payment code, reorganized docs into folders",
    ],
  },
  {
    id: "performance-server-rendering",
    date: "2026-06-21",
    version: "0.26.0",
    title: "Faster dashboard pages + codebase cleanup",
    summary:
      "Dashboard, leads, pipeline, follow-ups, and settings pages now load significantly faster. We moved data loading to the server so you see your content instantly — no more waiting for spinners. We also cleaned up the codebase and removed sensitive scripts from the public repository.",
    items: [
      "Dashboard page loads 44% faster — content appears instantly, no loading spinner",
      "All dashboard pages now fetch data on the server instead of your browser (faster on mobile and slow connections)",
      "Cleaned up unused code and duplicate files across the codebase",
      "Removed debug scripts from the public repository (security improvement)",
      "Added tests to verify the new fast-loading pages work correctly",
    ],
  },
  {
    id: "security-audit-gdpr",
    date: "2026-06-19",
    version: "0.25.0",
    title: "Download your data + cookie consent + security upgrades",
    summary:
      "You can now download a copy of all your leads, contacts, and activity history from Settings. We also added a cookie consent banner and shipped six security improvements under the hood.",
    items: [
      "Download My Data — export your entire account as a JSON file from Settings",
      "Cookie consent banner — analytics only load after you click Accept",
      "Six security fixes across the codebase (authentication, data access, error reporting)",
      "Server-side CSV import for faster, more reliable lead imports",
    ],
    pinned: true,
  },
  {
    id: "csv-import-unlimited",
    date: "2026-06-19",
    title: "Unlimited CSV imports + larger file support",
    summary:
      "Import as many leads as you need in a single CSV file. We removed the old row limit and increased the file size so you can bring your entire database over in one go.",
    items: [
      "Removed the 1,000-row limit — import as many leads as your CSV contains",
      "File size limit increased from 5MB to 50MB (supports 20,000+ leads per file)",
      "Fixed a bug where imports could silently fail if your account information couldn't be loaded",
      "Clearer error messages when something goes wrong during import",
      "Bulk actions (stage change, delete) now complete faster — no more waiting",
    ],
  },
  {
    id: "auth-redesign-oauth",
    date: "2026-06-18",
    title: "Auth pages redesigned + Google & Slack sign-in",
    summary:
      "Cleaner, faster sign-in. Login and signup are now single-column with no distractions. You can now sign in with Google or Slack — just click a button.",
    items: [
      "Login and signup pages redesigned: clean single-column layout, centered on all screens",
      "Sign in with Google — one-click OAuth, no password needed",
      "Sign in with Slack — one-click OAuth for teams",
      "Shared OAuth component across login and signup (consistent buttons, loading states, error handling)",
      "Social sign-in buttons auto-detect which providers are enabled — greyed out with a friendly message if not configured",
      "Orange CTA buttons (consistent with the rest of the site)",
      "Better error messages: raw JSON errors replaced with readable text",
      "Improved accessibility: proper aria-labels, focus rings, autocomplete attributes, keyboard navigation",
      "Faster page loads: streamlined auth pages with less JavaScript",
    ],
  },
  {
    id: "hero-demo-video",
    date: "2026-06-17",
    version: "0.24.0",
    title: "Live hero demo video + security hardening + landing page audit",
    summary:
      "The landing page hero now shows a real, clickable product demo instead of a static mockup. We also completed a full frontend audit, fixed 20+ design and accessibility issues, and shipped two security fixes.",
    items: [
      "Hero: replaced static SVG mockup with a live 25-second pipeline demo video (autoplay, loop, muted)",
      "Hero: click-to-fullscreen video modal with smooth scale/opacity transition",
      "Demo video shows real workflow: email composer, call screen, and text messaging",
      "Action popups restyled to match site design (white bg, teal accents, orange CTAs)",
      "Hero content now visible immediately — no scroll-reveal delay on first load",
      "Integration grid: removed fabricated claims (Zillow, Realtor.com, MLS), replaced with real capabilities",
      "Scroll-reveal overuse reduced (14 → 8 animated elements)",
      "Feature mock cards unified: consistent layout, equal heights, matching dimensions",
      "Added JSON-LD structured data and canonical URL for SEO",
      "Pricing toggle now has role='switch' and aria-checked for accessibility",
      "Footer 'All rights reserved' removed",
      "Contrast fixes: surface-400 → surface-500 across integration grid and HowItWorks",
      "Added <main> landmark, prefers-reduced-motion on scroll-behavior, flattened card-elevated shadow",
      "Security: auth callback redirect validated via URL origin check (open redirect fix)",
      "Security: middleware now fails closed when Supabase env vars are missing",
      "Security: escapeHtml applied to user names in daily digest email body",
    ],
  },
  {
    id: "landing-scroll-reveal",
    date: "2026-06-13",
    version: "0.23.0",
    title: "Landing page scroll-reveal animations + design fixes",
    summary:
      "The landing page now feels alive — sections fade in and slide up as you scroll, with a three-family animation system that respects your motion preferences. We also cleaned up the design with a numbered problem list, a realistic dashboard mockup, and removed the fake social proof.",
    items: [
      "Scroll-reveal animations: hero, content, and conversion sections each animate independently as you scroll into view",
      "Three-family animation system: opacity fade + transform, chained with IntersectionObserver",
      "Removed fake social proof (avatar stack, '47+ agents' claim) — replaced with a trust signal",
      "Problem section redesigned as a numbered list (01/02/03) instead of three identical columns",
      "Dashboard mockup reworked with realistic data (real phone numbers, varied names, overdue items)",
      "Easing: ease-out-quart for even visual distribution",
      "Respects prefers-reduced-motion — animations disabled for users who need it",
    ],
  },
  {
    id: "pipeline-redesign",
    date: "2026-06-12",
    version: "0.22.0",
    title: "Pipeline redesign + security hardening + CSV import fixes",
    summary:
      "The pipeline is now mobile-friendly with collapsible accordion sections and one-tap action buttons. We also completed a full security audit, fixed the CSV importer to handle real-world CRM exports, and streamlined the sidebar.",
    items: [
      "Pipeline: replaced drag-and-drop with accordion sections + stage dropdown (one-tap moves)",
      "Pipeline: added quick action buttons (call, email, text) on every lead card",
      "Pipeline: lead scoring indicators (hot/warm/cold) and overdue highlighting",
      "Pipeline: collapsible stages — tap header to expand/collapse",
      "CSV import: now reads First Name + Last Name columns from CRM exports",
      "CSV import: auto-detects columns and skips the mapping step when confident",
      "CSV import: 5MB file size limit, 1000 row limit, formula injection sanitization",
      "CSV import: replaced naive parser with papaparse (handles quotes, commas, semicolons)",
      "Sidebar: replaced Follow-ups with Leads (better search, sort, filter, bulk actions)",
      "Sidebar: Settings removed from nav (accessible via profile link at bottom)",
      "Security: Stripe webhook handlers fixed (was using anon key, now uses service role)",
      "Security: edit lead page now filters by user_id (was IDOR-vulnerable)",
      "Security: removed unsafe-eval from CSP in production, fixed COOP/CORP headers",
      "Security: auth callback no longer logs full URL (PII leak fixed)",
    ],
  },
  {
    id: "landing-page-polish",
    date: "2026-06-10",
    version: "0.21.0",
    title: "Landing page polish and design consistency",
    summary:
      "The landing page gets a real integration showcase, a unified teal color system, and better visual hierarchy with subtle shadows. Small cleanup across the codebase for consistency.",
    items: [
      "Replaced StatsBar with built-in tools grid (Phone & SMS, Email, Google Calendar, CSV Import, Map Location, Daily Digest)",
      "Unified button color: all CTAs now use teal instead of orange",
      "Card border-radius standardized to 10px across all components",
      "Added subtle shadows back to cards for better visual depth",
      "Removed em-dashes from body copy for a more natural tone",
      "Cleaned up dead CSS (unused CTA variables, unused button variant)",
      "Scaled up integration grid cards for better readability",
    ],
  },
  {
    id: "login-signup-redesign",
    date: "2026-06-08",
    version: "0.20.0",
    title: "Login & signup page redesign",
    summary:
      "A cleaner, more focused sign-in experience. The left panel is now a calm brand statement with centered typography, and the right panel is streamlined with better heading consistency.",
    items: [
      "Left panel redesigned with clean light background and centered content",
      "New brand headline: 'The only thing on your screen should be who to call today.'",
      "Supporting line and three feature lines for quick value communication",
      "Trust badge removed from login right panel for a cleaner form",
      "Headings ('Welcome back' / 'Create your account') centered on both pages",
      "Font sizes bumped on left panel for better readability",
      "Right panel heading sizes aligned between login and signup",
    ],
  },
  {
    id: "shipping-status-bar",
    date: "2026-06-07",
    version: "0.19.0",
    title: "Shipping Status Bar + feature flags",
    summary:
      "A new amber banner on every dashboard page tells you what we're actively building, with a one-click link to the full changelog. Behind the scenes we also shipped a feature flag system for safer rollouts.",
    items: [
      "Amber banner with a pulse dot on every dashboard page",
      "Dismiss with the X button or press Escape — reappears on a new session",
      "Honors your 'prefers-reduced-motion' setting (no pulsing)",
      "3 feature flags ready to use: CSV Import, Pipeline view, Bulk Actions",
    ],
  },
  {
    id: "design-token-cleanup",
    date: "2026-06-07",
    title: "Design token cleanup",
    summary:
      "We replaced the last 9 raw Tailwind color references (red-500, green-50, etc.) with semantic design tokens. Same look, much easier to evolve.",
    items: [
      "Toast notifications now use semantic success / destructive / accent colors",
      "LIVE STATS badge, completed-action checkmarks, and error states aligned",
      "Sets us up for a future dark mode with zero code changes",
    ],
  },
  {
    id: "turnstile-mobile-fix",
    date: "2026-06-06",
    title: "Cloudflare Turnstile — mobile fix",
    summary:
      "The captcha widget now loads reliably on mobile, with a clear error message and retry button if your connection is slow or the script is blocked.",
    items: [
      "10-second timeout fallback with a 'Retry' button",
      "Responsive width (280px) so it fits on 320px screens",
      "Visible error state when the script fails to load",
      "Forgot-password form is now also gated behind the captcha",
    ],
  },
  {
    id: "auth-stack-unblocked",
    date: "2026-06-06",
    title: "Auth stack unblocked",
    summary:
      "Magic-link sign-in and Google OAuth now work reliably across localhost, Vercel preview deploys, and the production domain.",
    items: [
      "OAuth callback URL uses your current origin (no more stale env var)",
      "Sign-in errors from the URL (?error=...) now display in a friendly banner",
      "Supabase redirect URLs allowlisted for *.vercel.app + localhost + agent-flow.app",
    ],
  },
  {
    id: "codebase-docs",
    date: "2026-06-06",
    title: "Codebase documentation",
    summary:
      "A complete docs/ suite covering architecture, auth, database, API, environment variables, security, deployment, and onboarding. New contributors can go from zero to first deploy in under an hour.",
    items: [
      "12 markdown files, ~4,000 lines, 11 architecture diagrams",
      "docs/ONBOARDING.md walks a new dev from clone to live deploy",
      "docs/SECURITY.md captures CSP, headers, captcha, and secret rotation",
    ],
  },
  {
    id: "vercel-env-recovery",
    date: "2026-06-06",
    title: "Vercel env recovery + defensive guard",
    summary:
      "We caught and fixed a Production regression where 4 environment variables had been silently wiped to empty strings. A new defensive guard makes the UI fail loud next time instead of breaking silently.",
    items: [
      "All NEXT_PUBLIC_* and SUPABASE_SERVICE_ROLE_KEY restored and re-encrypted at rest",
      "Turnstile widget now shows 'Captcha is misconfigured' if the site key is missing",
      "Defensive .gitignore entries prevent secrets leaking from 'vercel env pull'",
    ],
  },
  {
    id: "pricing-update",
    date: "2026-06-09",
    title: "Pricing: Pro is now $8/month",
    summary:
      "Pro tier updated from $5 to $8/month ($80/year, save 17%). The original $5 was a launch-intro price. With production-grade security (Cloudflare Turnstile), a redesigned UI, and priority support, AgentFlow delivers the same features as $69-100/mo competitors at a fraction of the cost.",
    items: [
      "Annual plan now $80/year (save 2 months vs monthly billing)",
      "Still 88% cheaper than Follow Up Boss ($69/mo) and kvCORE ($100/mo)",
      "Launch-intro pricing has ended — reflects the true cost of the product",
      "Existing Pro subscribers keep their current rate until next billing cycle",
    ],
  },
  {
    id: "ui-redesign",
    date: "2026-06-03",
    title: "UI/UX redesign",
    summary:
      "Full marketing and auth redesign with a flat-design system, orange CTAs everywhere, and WCAG AA contrast on every text element.",
    items: [
      "Landing page rebuilt with a product mockup, animated stats, and pricing toggle",
      "Signup page is now two-column with social proof on the left",
      "Color tokens consolidated: primary (teal), CTA (orange), accent (sky), success, warning, destructive",
    ],
  },
  {
    id: "turnstile-integration",
    date: "2026-06-04",
    title: "Cloudflare Turnstile — bot protection",
    summary:
      "Added Cloudflare Turnstile to sign-in and sign-up to stop automated abuse. Free, privacy-friendly, no image puzzles — just a checkbox that disappears for trusted users.",
    items: [
      "Magic link, password sign-in, and signup all gated",
      "Google OAuth remains CAPTCHA-free (Supabase doesn't support it there yet)",
      "Widget runs in Invisible mode for most users — they never see a challenge",
    ],
  },
  {
    id: "csv-import",
    date: "2026-05-30",
    title: "CSV lead import",
    summary:
      "Drag-and-drop CSV import for leads with auto-detected columns and batch insert. Bring your existing list in under a minute.",
    items: [
      "First-row preview before you commit",
      "Validation errors highlighted per row",
      "Up to 1,000 leads per import",
    ],
  },
  {
    id: "drag-drop-pipeline",
    date: "2026-05-30",
    title: "Drag-and-drop pipeline (replaced)",
    summary:
      "The original drag-and-drop pipeline. Replaced in v0.22.0 with accordion sections + action buttons for better mobile support.",
    items: [
      "4-stage pipeline: New → Contacted → Qualified → Won",
      "Touch-friendly on mobile (long-press to start a drag)",
      "Stage order is re-orderable from Settings",
    ],
  },
];
