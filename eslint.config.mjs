import coreWebVitals from "eslint-config-next/core-web-vitals";

const nextConfig = Array.isArray(coreWebVitals) ? coreWebVitals : [coreWebVitals];

/**
 * Rules introduced by eslint-config-next@16 (React Compiler era).
 * The flagged patterns are legitimate browser-sync effects (storage reads,
 * matchMedia, captcha token state) — refactoring them is tracked as a
 * dedicated post-migration cleanup, NOT part of this behavior-preserving
 * framework upgrade. Warnings keep the signal visible without blocking CI.
 */
const MIGRATION_WARN_RULES = {
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/refs": "warn",
};

export default [
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
];
