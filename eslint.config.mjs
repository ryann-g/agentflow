import coreWebVitals from "eslint-config-next/core-web-vitals";

const nextConfig = Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals];

/**
 * Rules introduced by eslint-config-next@16 (React Compiler era).
 *
 * The flagged patterns are legitimate browser-sync effects (storage reads,
 * matchMedia, captcha token state) — refactoring them is tracked as a
 * dedicated post-migration cleanup, NOT part of this behavior-preserving
 * framework upgrade. Warnings keep the signal visible without blocking CI.
 */
const MIGRATION_WARN_RULES = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
};

/**
 * Accepted exceptions to the rules above.
 *
 * CI lints with `--max-warnings 0`, so a warning in these files would block
 * every pull request. The original intent, recorded above, was the opposite:
 * keep the signal visible without blocking CI. These entries are the
 * reconciliation — the rule stays ON everywhere else, so a new warning in
 * any other file still fails the build, and only the five known
 * browser-sync sites are exempted.
 *
 * Every one of these reads browser state that does not exist during
 * server rendering, so it cannot be read during the first render without
 * producing a hydration mismatch:
 *
 *   use-session-storage.ts      sessionStorage read after mount
 *   cookie-consent.tsx          localStorage consent read after mount
 *   consent-aware-analytics.tsx localStorage consent read after mount
 *   maintenance-banner.tsx      matchMedia read after mount
 *   video-modal.tsx             mount transition for the open animation
 *
 * The fix for each is a real refactor — useSyncExternalStore for the
 * storage and matchMedia readers, and a restructure for the modal. That is
 * tracked as a separate piece of work; it is not something to smuggle into
 * a security change.
 */
const ACCEPTED_BROWSER_SYNC_FILES = [
  "src/hooks/use-session-storage.ts",
  "src/components/cookie-consent.tsx",
  "src/components/consent-aware-analytics.tsx",
  "src/components/maintenance-banner.tsx",
  "src/components/video-modal.tsx",
];

const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...nextConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { ...MIGRATION_WARN_RULES },
  },
  {
    // Playwright fixtures use their own hook lifecycle, not React's.
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      ...MIGRATION_WARN_RULES,
    },
  },
  {
    files: ACCEPTED_BROWSER_SYNC_FILES,
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
