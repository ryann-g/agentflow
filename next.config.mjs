const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-inline' is still required: Next.js emits inline bootstrap
      // scripts for hydration, and removing it means threading a per-request
      // nonce through the proxy. That is the correct long-term shape, but
      // it is not a change to make without also verifying every page still
      // hydrates.
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://browser.sentry-cdn.com https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      // Every image the app renders is same-origin (public/icons). The
      // previous `https:` wildcard allowed an image from any host.
      "img-src 'self' data: blob:",
      "font-src 'self' https://challenges.cloudflare.com",
      "connect-src 'self' https://api.paymongo.com https://fsxdduvwshirrheenmag.supabase.co https://o4509104489611264.ingest.us.sentry.io https://vitals.vercel-insights.com https://challenges.cloudflare.com",
      // The app renders no iframes. The PayMongo checkout is a top-level
      // redirect (window.location.href), not a framed page.
      "frame-src 'self' https://challenges.cloudflare.com",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: isDev ? "unsafe-none" : "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: isDev ? "cross-origin" : "same-origin" },
];

const nextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    {
      source: "/_next/static/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
};

let config = nextConfig;

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  const { withSentryConfig } = await import("@sentry/nextjs");
  config = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  });
}

export default config;
