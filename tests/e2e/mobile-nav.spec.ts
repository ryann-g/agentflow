import { test, expect } from "./fixtures/auth";

const bottomNav = "nav.fixed.bottom-0";

async function dismissConsentBanner(page: import("@playwright/test").Page) {
  const accept = page.getByRole("button", { name: /accept analytics/i });
  if (await accept.isVisible({ timeout: 2000 }).catch(() => false)) {
    await accept.click();
  }
}

test.describe("Mobile Navigation (Authenticated)", () => {
  test("should display bottom navigation on mobile", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(page.locator(bottomNav)).toBeVisible();
  });

  test("should have all navigation items", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    // June 2026 redesign: Leads replaced Follow-ups in the nav.
    const nav = page.locator(bottomNav);
    await expect(nav.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Leads" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pipeline" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Add Lead" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("should navigate between pages", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await dismissConsentBanner(page);
    await page.locator(bottomNav).getByRole("link", { name: "Pipeline" }).click();
    await expect(page).toHaveURL(/\/pipeline/);
  });

  test("should have proper touch target sizes", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    const navItems = page.locator(`${bottomNav} a`);
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const box = await navItems.nth(i).boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("should show active state for current page", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    const todayLink = page.locator(bottomNav).getByRole("link", { name: "Today" });
    await expect(todayLink).toHaveCSS("color", "rgb(15, 118, 110)");
  });

  test("should have responsive layout", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should work on tablet viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should work on desktop viewport", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
  });
});
