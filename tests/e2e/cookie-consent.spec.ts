import { test, expect } from "@playwright/test";

/**
 * E2E tests for the CookieConsent banner.
 *
 * The component renders after mount via requestAnimationFrame (see
 * src/components/cookie-consent.tsx), so all assertions wait for the
 * alertdialog role to appear rather than assuming it is immediately present.
 */
test.describe("Cookie consent", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored consent so the banner renders fresh for THIS test.
    // Guarded by a session flag: sessionStorage survives page.reload() within
    // the same tab, so mid-test reloads keep the consent chosen by the test
    // (that persistence IS what two of these tests assert), while each new
    // test's fresh context starts clean.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("consent-wiped-this-tab")) {
        localStorage.removeItem("agentflow_cookie_consent");
        sessionStorage.setItem("consent-wiped-this-tab", "1");
      }
    });
  });

  test("banner appears on first visit", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Cookie Preferences")).toBeVisible();
  });

  test("accept stores consent and hides banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accept Analytics" }).click();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    const consent = await page.evaluate(() =>
      localStorage.getItem("agentflow_cookie_consent")
    );
    expect(consent).toBe("accepted");
  });

  test("decline stores consent and hides banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Decline" }).click();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    const consent = await page.evaluate(() =>
      localStorage.getItem("agentflow_cookie_consent")
    );
    expect(consent).toBe("declined");
  });

  test("X button declines and hides banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Dismiss cookie consent" }).click();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    const consent = await page.evaluate(() =>
      localStorage.getItem("agentflow_cookie_consent")
    );
    expect(consent).toBe("declined");
  });

  test("escape key declines and hides banner", async ({ page }) => {
    await page.goto("/");
    // Wait for banner to render before sending keypress.
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    const consent = await page.evaluate(() =>
      localStorage.getItem("agentflow_cookie_consent")
    );
    expect(consent).toBe("declined");
  });

  test("does not reappear after accept on page refresh", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accept Analytics" }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    await page.reload();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();
  });

  test("does not reappear after decline on page refresh", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    await page.reload();

    await expect(page.getByRole("alertdialog")).not.toBeVisible();
  });

  test("reappears if localStorage is cleared", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Accept Analytics" }).click();
    await expect(page.getByRole("alertdialog")).not.toBeVisible();

    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await expect(page.getByRole("alertdialog")).toBeVisible();
  });

  test("both buttons are accessible by role", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Accept Analytics" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Decline" })
    ).toBeVisible();
  });

  test("dialog has correct ARIA attributes", async ({ page }) => {
    await page.goto("/");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-label", "Cookie consent");
    await expect(dialog).toHaveAttribute("aria-live", "polite");
  });
});
