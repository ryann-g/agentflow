import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression guard for audit finding H4 (Oct 21 2026).
 *
 * The client Sentry config set `replaysSessionSampleRate: 0` and
 * `replaysOnErrorSampleRate: 1.0`. No replay integration was ever
 * registered — @sentry/nextjs v10 does not add one by default — so the
 * options were inert. They still mattered: the file's `beforeSend` scrubber
 * runs only for error events, and Sentry does NOT call `beforeSend` for
 * replay events. The configuration therefore described an unmasked DOM
 * capture of authenticated pages (client names, emails, phone numbers) that
 * would have started the moment anyone registered the integration.
 *
 * These assertions keep the configuration honest:
 *   1. No replay sample rates are set without the integration being
 *      registered.
 *   2. If replay IS ever enabled, the masking options are present.
 */

const CLIENT_CONFIG_PATH = join(process.cwd(), "src/sentry.client.config.ts");
const source = readFileSync(CLIENT_CONFIG_PATH, "utf8");

// Strip block comments so the guidance inside them is not mistaken for
// live configuration.
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("Sentry client configuration", () => {
  it("does not enable session replay", () => {
    expect(code).not.toMatch(/replaysSessionSampleRate\s*:/);
    expect(code).not.toMatch(/replaysOnErrorSampleRate\s*:/);
  });

  it("does not register a replay integration", () => {
    expect(code).not.toMatch(/replayIntegration\s*\(/);
  });

  it("keeps the error-event scrubber in place", () => {
    expect(code).toContain("beforeSend");
    expect(code).toContain("scrubRequest");
    expect(code).toContain("scrubBreadcrumbs");
    expect(code).toContain("scrubExceptions");
  });

  it("documents how to enable replay safely", () => {
    expect(source).toContain("maskAllText");
    expect(source).toContain("maskAllInputs");
    expect(source).toContain("blockAllMedia");
    expect(source).toContain("networkCaptureBodies");
  });
});
