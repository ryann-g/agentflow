import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("feature-flags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Strip all feature-flag and maintenance-related env vars
    for (const key of Object.keys(process.env)) {
      if (
        key.startsWith("NEXT_PUBLIC_FEATURE_") ||
        key === "NEXT_PUBLIC_MAINTENANCE_BANNER"
      ) {
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isFeatureEnabled", () => {
    it("returns the code default (true) when no env override is set", async () => {
      const { isFeatureEnabled } = await import("@/lib/feature-flags");
      expect(isFeatureEnabled("csv_import")).toBe(true);
    });

    it("returns the code default (false) when a flag is explicitly off in code", async () => {
      process.env.NEXT_PUBLIC_FEATURE_CSV_IMPORT = "false";
      const { isFeatureEnabled } = await import("@/lib/feature-flags");
      expect(isFeatureEnabled("csv_import")).toBe(false);
    });

    it("treats any non-'false' env value as the code default (fail-open)", async () => {
      process.env.NEXT_PUBLIC_FEATURE_CSV_IMPORT = "1";
      const { isFeatureEnabled } = await import("@/lib/feature-flags");
      expect(isFeatureEnabled("csv_import")).toBe(true);
    });

    it("only the literal string 'false' kills a feature", async () => {
      process.env.NEXT_PUBLIC_FEATURE_CSV_IMPORT = "FALSE";
      const { isFeatureEnabled } = await import("@/lib/feature-flags");
      // All of the above should NOT kill the flag (fail-open for safety)
      expect(isFeatureEnabled("csv_import")).toBe(true);
    });
  });

  describe("isMaintenanceBannerVisible", () => {
    it("returns false by default when env var is not set", async () => {
      const { isMaintenanceBannerVisible } = await import("@/lib/feature-flags");
      expect(isMaintenanceBannerVisible()).toBe(false);
    });

    it("returns true when NEXT_PUBLIC_MAINTENANCE_BANNER is 'true'", async () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_BANNER = "true";
      const { isMaintenanceBannerVisible } = await import("@/lib/feature-flags");
      expect(isMaintenanceBannerVisible()).toBe(true);
    });

    it("returns false when NEXT_PUBLIC_MAINTENANCE_BANNER is 'false'", async () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_BANNER = "false";
      const { isMaintenanceBannerVisible } = await import("@/lib/feature-flags");
      expect(isMaintenanceBannerVisible()).toBe(false);
    });

    it("returns false for any value other than the literal 'true'", async () => {
      process.env.NEXT_PUBLIC_MAINTENANCE_BANNER = "TRUE";
      const { isMaintenanceBannerVisible } = await import("@/lib/feature-flags");
      expect(isMaintenanceBannerVisible()).toBe(false);
    });
  });

  describe("FEATURE_FLAGS metadata", () => {
    it("exposes a human-readable label for each flag", async () => {
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags");
      expect(FEATURE_FLAGS.csv_import.label).toBeTruthy();
    });

    it("registers no flag that nothing consumes", async () => {
      // A flag that gates nothing is dead configuration that reads like a
      // live switch. `pipeline` and `bulk_actions` were removed for exactly
      // this reason (Oct 21 2026 audit).
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags");
      expect(Object.keys(FEATURE_FLAGS)).toEqual(["csv_import"]);
    });

    it("every flag has a default boolean", async () => {
      const { FEATURE_FLAGS } = await import("@/lib/feature-flags");
      for (const [, value] of Object.entries(FEATURE_FLAGS)) {
        expect(typeof value.default).toBe("boolean");
      }
    });
  });
});
