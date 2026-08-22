"use client";

import { useEffect, useState } from "react";
import { fetchLeads } from "@/hooks/useLeads";

/**
 * Shared overdue-lead count for the dashboard chrome.
 *
 * Sidebar and BottomNav previously each ran the full paginated leads fetch
 * on mount — tripling data transfer on every dashboard view alongside the
 * page's own server-side fetch. A single module-level cache with in-flight
 * dedup and a short TTL serves every consumer from one request.
 */

const TTL_MS = 60_000;

let cachedCount: number | null = null;
let cachedAt = 0;
let inflight: Promise<number> | null = null;

async function loadOverdueCount(): Promise<number> {
  const now = Date.now();
  if (cachedCount !== null && now - cachedAt < TTL_MS) return cachedCount;
  if (inflight) return inflight;

  inflight = fetchLeads().then(({ data }) => {
    const today = new Date().toISOString().split("T")[0];
    const count =
      data?.filter((l) => l.next_action_date && l.next_action_date < today)
        .length ?? 0;
    cachedCount = count;
    cachedAt = Date.now();
    inflight = null;
    return count;
  });

  return inflight;
}

export function useOverdueCount(): number {
  const [count, setCount] = useState(cachedCount ?? 0);

  useEffect(() => {
    let cancelled = false;
    loadOverdueCount().then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
