import { test, expect, devices } from "@playwright/test";

const TEST_EMAIL = "mobile-captcha-test@agentflow.test";

test.describe("Mobile captcha regression (post-1cabcd6 fix)", () => {
  for (const device of [
    { name: "iPhone SE (320px)", viewport: { width: 320, height: 568 } },
    { name: "iPhone 12 (390px)", viewport: { width: 390, height: 844 } },
    { name: "iPhone 14 Plus (428px)", viewport: { width: 428, height: 932 } },
  ]) {
    test(`${device.name}: login page renders + form interactive + captcha pill visible`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      const page = await context.newPage();
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });

      await page.goto("/login");

      // 1. Page renders
      await expect(page.locator("h1")).toBeVisible({ timeout: 10000 });

      // 2. Magic link form is present
      await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();

      // 3. Email input is tappable and fillable
      const emailInput = page.locator("input[type='email']");
      await expect(emailInput).toBeVisible();
      await emailInput.fill(TEST_EMAIL);
      await expect(emailInput).toHaveValue(TEST_EMAIL);

      // 4. NO horizontal scroll (Hallmark gate 36 / Hallmark gate 62)
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = device.viewport.width;
      expect(bodyScrollWidth, `horizontal overflow on ${device.name}: body=${bodyScrollWidth}, viewport=${viewportWidth}`).toBeLessThanOrEqual(viewportWidth + 1);

      // 5. NO console errors (CSP violations, missing assets, etc.)
      const significantErrors = consoleErrors.filter(
        (e) => !e.includes("Download the React DevTools") && !e.includes("favicon")
      );
      expect(significantErrors, `console errors on ${device.name}: ${JSON.stringify(significantErrors, null, 2)}`).toEqual([]);

      // 6. The captcha-status-pill eventually settles to a non-loading state
      //    (bypass=true locally, so it should land on "Protected by Cloudflare" then "Verified")
      const pill = page.locator("#captcha-status");
      await expect(pill).toBeVisible({ timeout: 10000 });
      // wait for pill to leave the loading state
      await expect(pill).not.toHaveText(/loading verification/i, { timeout: 10000 });

      // 7. Submit button is enabled (the original bug was it stayed disabled)
      const submitBtn = page.getByRole("button", { name: /send magic link/i });
      await expect(submitBtn).toBeEnabled({ timeout: 10000 });

      // 8. The Turnstile widget off-screen wrapper exists
      const wrapper = page.locator("div.absolute.-left-\\[9999px\\].-top-\\[9999px\\]");
      await expect(wrapper).toHaveCount(1);

      await context.close();
    });
  }
});
