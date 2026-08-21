import { test, expect } from "./fixtures/auth";

test.describe("Pipeline (Authenticated)", () => {
  async function seedLead(page: import("@playwright/test").Page, name: string, email: string) {
    await page.goto("/leads/new");
    await page.fill("#fullName", name);
    await page.fill("#email", email);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });
  }
  test("should display pipeline page for authenticated user", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/pipeline");
    await expect(page).toHaveURL(/\/pipeline/);
    await expect(page.locator("h1")).toContainText("Pipeline");
  });

  test("should render all 6 pipeline stage sections", async ({
    authenticatedPage: page,
  }) => {
    await seedLead(page, "Stage Seed Lead", "stageseed@test.com");
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: "New Lead" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Contacted" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Showing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Offer" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Closed Won" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Closed Lost" })).toBeVisible();
  });

  test("should show a lead in the New Lead section after creation", async ({
    authenticatedPage: page,
  }) => {
    await seedLead(page, "Pipeline Test Lead", "pipeline@test.com");
    await page.goto("/pipeline");
    await expect(page.locator("text=Pipeline Test Lead")).toBeVisible();
  });

  test("should render the accordion board with collapsible stage sections", async ({
    authenticatedPage: page,
  }) => {
    await seedLead(page, "Accordion Seed Lead", "accordion@test.com");
    await page.goto("/pipeline");
    // Accordion redesign (June 2026): stages are collapsible header buttons.
    const stageHeaders = page.locator("button:has(h2)");
    await expect(stageHeaders.first()).toBeVisible();
  });

  test("should expose a per-lead stage dropdown (replaces drag handles)", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/leads/new");
    await page.fill("#fullName", "Stage Menu Lead");
    await page.fill("#email", "stagemenu@test.com");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/pipeline");
    // Every lead card carries a stage dropdown trigger next to its name.
    const cardLink = page.locator('a:has-text("Stage Menu Lead")').first();
    await expect(cardLink).toBeVisible();
    const stageTrigger = cardLink
      .locator("xpath=ancestor::div[contains(@class,'mb-2')]")
      .locator("button[aria-haspopup='menu']")
      .first();
    await expect(stageTrigger).toBeVisible();
  });

  test("should navigate to lead detail from pipeline card", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/leads/new");
    await page.fill("#fullName", "Pipeline Detail Lead");
    await page.fill("#email", "detail@test.com");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/leads\/?$/, { timeout: 10000 });

    await page.goto("/pipeline");
    await page.locator(`a:has-text("Pipeline Detail Lead")`).first().click();
    await expect(page).toHaveURL(/\/leads\/[a-f0-9-]+/);
  });
});
