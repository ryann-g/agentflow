import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(import.meta.dirname, "..", "..", "..", "src");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf-8");
}

describe("Server Component conversion", () => {
  describe("server data fetching functions", () => {
    test("useDashboard exports getDashboardData function", () => {
      const src = read("hooks/useDashboard.ts");
      expect(src).toMatch(/export async function getDashboardData/);
      expect(src).toMatch(/createClient/);
      expect(src).toMatch(/Promise\.all/);
    });

    test("useLeadsServer exports getLeadsForServer function", () => {
      const src = read("hooks/useLeadsServer.ts");
      expect(src).toMatch(/export async function getLeadsForServer/);
      expect(src).toMatch(/createClient/);
    });
  });

  describe("page files are Server Components (no 'use client' directive)", () => {
    test("dashboard/page.tsx has no 'use client'", () => {
      const src = read("app/(dashboard)/dashboard/page.tsx");
      expect(src).not.toMatch(/"use client"/);
      expect(src).toMatch(/async function DashboardPage/);
    });

    test("pipeline/page.tsx has no 'use client'", () => {
      const src = read("app/(dashboard)/pipeline/page.tsx");
      expect(src).not.toMatch(/"use client"/);
      expect(src).toMatch(/async function PipelinePage/);
    });

    test("leads/page.tsx has no 'use client'", () => {
      const src = read("app/(dashboard)/leads/page.tsx");
      expect(src).not.toMatch(/"use client"/);
      expect(src).toMatch(/async function LeadsPage/);
    });

    test("follow-ups/page.tsx has no 'use client'", () => {
      const src = read("app/(dashboard)/follow-ups/page.tsx");
      expect(src).not.toMatch(/"use client"/);
      expect(src).toMatch(/async function FollowUpsPage/);
    });
  });

  describe("client components have 'use client' directive", () => {
    test("pipeline/pipeline-client.tsx has 'use client'", () => {
      const src = read("app/(dashboard)/pipeline/pipeline-client.tsx");
      expect(src).toMatch(/^"use client"/);
      expect(src).toMatch(/export function PipelineClient/);
    });

    test("leads/leads-client.tsx has 'use client'", () => {
      const src = read("app/(dashboard)/leads/leads-client.tsx");
      expect(src).toMatch(/^"use client"/);
      expect(src).toMatch(/export function LeadsClient/);
    });

    test("follow-ups/follow-ups-client.tsx has 'use client'", () => {
      const src = read("app/(dashboard)/follow-ups/follow-ups-client.tsx");
      expect(src).toMatch(/^"use client"/);
      expect(src).toMatch(/export function FollowUpsClient/);
    });

    test("settings/billing/page.tsx has 'use client'", () => {
      const src = read("app/(dashboard)/settings/billing/page.tsx");
      expect(src).toMatch(/^"use client"/);
    });

    test("settings/page.tsx has 'use client'", () => {
      const src = read("app/(dashboard)/settings/page.tsx");
      expect(src).toMatch(/^"use client"/);
    });
  });

  describe("leads/[id] proof of concept (prior session)", () => {
    test("leads/[id]/page.tsx is a Server Component", () => {
      const src = read("app/(dashboard)/leads/[id]/page.tsx");
      expect(src).not.toMatch(/"use client"/);
      expect(src).toMatch(/async function LeadDetailPage/);
    });

    test("leads/[id]/lead-detail-client.tsx is a Client Component", () => {
      const src = read("app/(dashboard)/leads/[id]/lead-detail-client.tsx");
      expect(src).toMatch(/^"use client"/);
      expect(src).toMatch(/DeleteLeadButton/);
    });

    test("useLead.ts exports getLead function", () => {
      const src = read("hooks/useLead.ts");
      expect(src).toMatch(/export async function getLead/);
    });
  });

  describe("auth pages still have 'use client' (unchanged)", () => {
    test("login page is still a Client Component", () => {
      const src = read("app/(auth)/login/page.tsx");
      expect(src).toMatch(/^"use client"/);
    });

    test("signup page is still a Client Component", () => {
      const src = read("app/(auth)/signup/page.tsx");
      expect(src).toMatch(/^"use client"/);
    });
  });
});
