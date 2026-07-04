import type { MetadataRoute } from "next";

const BASE_URL = "https://agent-flow.app";

/**
 * Sitemap for AgentFlow public-facing pages.
 * Auth-gated dashboard routes are excluded (covered by robots.txt Disallow).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
