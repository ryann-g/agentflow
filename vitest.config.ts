import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: [
        // Thin env-var wrappers around the Supabase clients. They need a
        // live Supabase project to exercise, and their failure mode (missing
        // env vars) is asserted in the docs rather than in a unit test.
        "src/lib/supabase/client.ts",
        "src/lib/supabase/server.ts",
        "src/lib/supabase/service.ts",
        "src/app/api/health/route.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 79,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
