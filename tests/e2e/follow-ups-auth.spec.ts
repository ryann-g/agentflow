import { test, expect } from "./fixtures/auth";

test.describe("Follow-ups (Authenticated)", () => {
  test("should display follow-ups page for authenticated user", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/follow-ups");
    await expect(page).toHaveURL(/\/follow-ups/);
    await expect(page.locator("h1")).toContainText("Follow-ups");
  });

  test("should show empty state when no follow-ups exist", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/follow-ups");
    await expect(page.locator("text=No follow-ups")).toBeVisible();
  });

  test("should display overdue section with overdue lead", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/leads/new");
    await page.fill("#fullName", "Overdue Lead");
    await page.fill("#email", "overdue@test.com");
    await page.fill("#nextActionDate", "2026-01-01");
    await page.fill("#nextAction", "Call overdue");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/follow-ups");
    await expect(page.locator("text=Overdue").first()).toBeVisible();
    await expect(page.locator("text=Overdue Lead")).toBeVisible();
  });

  test("should display upcoming section with upcoming lead", async ({
    authenticatedPage: page,
  }) => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await page.goto("/leads/new");
    await page.fill("#fullName", "Upcoming Lead");
    await page.fill("#email", "upcoming@test.com");
    await page.fill("#nextActionDate", future);
    await page.fill("#nextAction", "Meeting upcoming");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/follow-ups");
    await expect(page.locator("text=Upcoming").first()).toBeVisible();
    await expect(page.locator("text=Upcoming Lead")).toBeVisible();
  });

  test("should show follow-up action description", async ({
    authenticatedPage: page,
  }) => {
    // Upcoming section only lists actions within the next 7 days.
    const future = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await page.goto("/leads/new");
    await page.fill("#fullName", "Action Desc Lead");
    await page.fill("#email", "actiondesc@test.com");
    await page.fill("#nextActionDate", future);
    await page.fill("#nextAction", "Important call");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/follow-ups");
    await expect(page.locator("text=Important call")).toBeVisible();
  });

  test("should navigate to lead detail from follow-up", async ({
    authenticatedPage: page,
  }) => {
    // Upcoming section only lists actions within the next 7 days.
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await page.goto("/leads/new");
    await page.fill("#fullName", "Navigate Lead");
    await page.fill("#email", "navigate@test.com");
    await page.fill("#nextActionDate", future);
    await page.fill("#nextAction", "Navigation test");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/follow-ups");
    await page.locator(`a:has-text("Navigate Lead")`).first().click();
    await expect(page).toHaveURL(/\/leads\/[a-f0-9-]+/);
  });
});
