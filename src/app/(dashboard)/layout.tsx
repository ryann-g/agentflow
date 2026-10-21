import { DashboardLayout } from "@/components/layout/dashboard-layout";

/**
 * Every route in this group renders the signed-in user's own data, so none
 * of them may be prerendered at build time.
 *
 * Without this, the build decides each route's rendering mode by watching
 * for `cookies()`. `createClient()` throws before it reaches `cookies()` when
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are absent from
 * the build environment — as they are in the Vercel preview environment —
 * so the build attempted to prerender an authenticated page and failed with
 * "Supabase environment variables are not configured".
 *
 * Saying it explicitly means the build never tries, whatever the
 * environment holds.
 */
export const dynamic = "force-dynamic";

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
