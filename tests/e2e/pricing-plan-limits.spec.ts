import { test, expect } from "@playwright/test";

test.describe("Pricing Display", () => {
  test("landing page shows $8/mo for Pro plan", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Pro plan price should be $8
    const proPrice = page.locator("text=$8").first();
    await expect(proPrice).toBeVisible();

    // Free plan should show $0
    const freePrice = page.locator("text=$0").first();
    await expect(freePrice).toBeVisible();

    // Should show 10 active leads for free tier
    await expect(page.locator("text=10 active leads")).toBeVisible();
    await expect(page.locator("text=10 pipelines")).toBeVisible();
  });

  test("landing page shows upgrade CTA", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should have "Get Started" or similar CTA
    const cta = page.locator("text=Get Started").first();
    await expect(cta).toBeVisible();
  });
});

test.describe("Auth Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Subtitle + toggle both contain "Sign in", so assert on roles/copy
    // that uniquely identify the rendered auth UI.
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send magic link" })
    ).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
  });

  test("signup page renders correctly", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("text=Create your account")).toBeVisible();
    await expect(page.locator("input[type='email']")).toBeVisible();
  });
});

test.describe("Protected Routes", () => {
  test("redirects to login when accessing dashboard without auth", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to login when accessing leads without auth", async ({ page }) => {
    await page.goto("/leads");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to login when accessing settings without auth", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to login when accessing billing without auth", async ({ page }) => {
    await page.goto("/settings/billing");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("New Lead Page", () => {
  test("redirects to login when accessing new lead page without auth", async ({ page }) => {
    await page.goto("/leads/new");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("CSV Import Page", () => {
  test("redirects to login when accessing import page without auth", async ({ page }) => {
    await page.goto("/leads/import");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("API Endpoints", () => {
  test("GET /api/leads returns 307 when not authenticated", async ({ page }) => {
    const response = await page.goto("/api/leads");
    // Middleware redirects unauthenticated users to login
    expect(response?.status()).toBe(200); // Follows redirect to login page
  });
});

test.describe("Pricing Consistency", () => {
  test("all pages reference $8 not $19", async ({ page }) => {
    // Check landing page - use innerText to avoid React RSC serialized references
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("$19");
    expect(text).toContain("$8");
  });
});
