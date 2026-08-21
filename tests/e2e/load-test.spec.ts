import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

test.describe("Load Test: 5 Concurrent Users", () => {
  test.setTimeout(120000);

  test("5 concurrent users: login page loads", async ({ browser }) => {
    const startTime = Date.now();
    const NUM_USERS = 5;

    console.log(`[LOAD TEST] Starting ${NUM_USERS} concurrent login page loads...`);

    const results = await Promise.all(
      Array.from({ length: NUM_USERS }, async (_, i) => {
        const userStart = Date.now();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await page.goto(`${BASE_URL}/login`);
          await page.waitForLoadState("networkidle");

          const title = await page.title();
          const hasEmailInput = await page.locator('input[type="email"]').isVisible();
          const hasGoogleButton = await page.locator("text=Continue with Google").isVisible();
          const loadTime = Date.now() - userStart;

          console.log(`[User ${i + 1}] Login page loaded in ${loadTime}ms - Title: ${title}`);

          await context.close();

          return {
            success: true,
            userIndex: i,
            loadTime,
            title,
            hasEmailInput,
            hasGoogleButton,
          };
        } catch (error) {
          await context.close();
          return { success: false, userIndex: i, error: String(error) };
        }
      })
    );

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const avgLoadTime = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.loadTime || 0), 0) / successCount;

    console.log("\n" + "=".repeat(60));
    console.log("LOAD TEST REPORT - Login Page");
    console.log("=".repeat(60));
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Successful: ${successCount}/${NUM_USERS}`);
    console.log(`Average load time: ${avgLoadTime.toFixed(0)}ms`);
    console.log("=".repeat(60));

    expect(successCount).toBe(NUM_USERS);
    results.forEach((r) => {
      if (r.success) {
        expect(r.title).toContain("AgentFlow");
        expect(r.hasEmailInput).toBe(true);
        expect(r.hasGoogleButton).toBe(true);
      }
    });
  });

  test("5 concurrent users: API health check", async ({ browser }) => {
    const startTime = Date.now();
    const NUM_USERS = 5;

    console.log(`[LOAD TEST] Starting ${NUM_USERS} concurrent API health checks...`);

    const results = await Promise.all(
      Array.from({ length: NUM_USERS }, async (_, i) => {
        const userStart = Date.now();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          const response = await page.request.get(`${BASE_URL}/api/health`);
          const data = await response.json();
          const apiTime = Date.now() - userStart;

          console.log(`[User ${i + 1}] Health check: ${response.status()} in ${apiTime}ms`);

          await context.close();

          return {
            success: response.status() === 200,
            userIndex: i,
            apiTime,
            status: response.status(),
            data,
          };
        } catch (error) {
          await context.close();
          return { success: false, userIndex: i, error: String(error) };
        }
      })
    );

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const avgApiTime = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.apiTime || 0), 0) / successCount;

    console.log("\n" + "=".repeat(60));
    console.log("LOAD TEST REPORT - API Health Check");
    console.log("=".repeat(60));
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Successful: ${successCount}/${NUM_USERS}`);
    console.log(`Average API response time: ${avgApiTime.toFixed(0)}ms`);
    console.log("=".repeat(60));

    expect(successCount).toBe(NUM_USERS);
    results.forEach((r) => {
      if (r.success) {
        expect(r.data.status).toBe("ok");
      }
    });
  });

  test("5 concurrent users: page navigation race", async ({ browser }) => {
    const startTime = Date.now();
    const NUM_USERS = 5;
    const pages = ["/login", "/signup", "/login", "/signup", "/login"];

    console.log(`[LOAD TEST] Starting ${NUM_USERS} concurrent page navigations...`);

    const results = await Promise.all(
      Array.from({ length: NUM_USERS }, async (_, i) => {
        const userStart = Date.now();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          await page.goto(`${BASE_URL}${pages[i]}`);
          await page.waitForLoadState("networkidle");

          const loadTime = Date.now() - userStart;
          const url = page.url();

          console.log(`[User ${i + 1}] Navigated to ${pages[i]} in ${loadTime}ms`);

          await context.close();

          return { success: true, userIndex: i, loadTime, url };
        } catch (error) {
          await context.close();
          return { success: false, userIndex: i, error: String(error) };
        }
      })
    );

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const avgLoadTime = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.loadTime || 0), 0) / successCount;

    console.log("\n" + "=".repeat(60));
    console.log("LOAD TEST REPORT - Page Navigation Race");
    console.log("=".repeat(60));
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Successful: ${successCount}/${NUM_USERS}`);
    console.log(`Average load time: ${avgLoadTime.toFixed(0)}ms`);
    console.log("=".repeat(60));

    expect(successCount).toBe(NUM_USERS);
  });

  test("5 concurrent users: API endpoints stress test", async ({ browser }) => {
    const startTime = Date.now();
    const NUM_USERS = 5;
    const endpoints = ["/api/health", "/api/leads", "/manifest.json", "/api/health", "/api/leads"];

    console.log(`[LOAD TEST] Starting ${NUM_USERS} concurrent API endpoint calls...`);

    const results = await Promise.all(
      Array.from({ length: NUM_USERS }, async (_, i) => {
        const userStart = Date.now();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          const response = await page.request.get(`${BASE_URL}${endpoints[i]}`);
          const apiTime = Date.now() - userStart;

          console.log(`[User ${i + 1}] ${endpoints[i]}: ${response.status()} in ${apiTime}ms`);

          await context.close();

          return {
            success: response.status() === 200 || response.status() === 401,
            userIndex: i,
            apiTime,
            status: response.status(),
            endpoint: endpoints[i],
          };
        } catch (error) {
          await context.close();
          return { success: false, userIndex: i, error: String(error) };
        }
      })
    );

    const totalTime = Date.now() - startTime;
    const successCount = results.filter((r) => r.success).length;
    const avgApiTime = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.apiTime || 0), 0) / successCount;

    console.log("\n" + "=".repeat(60));
    console.log("LOAD TEST REPORT - API Endpoints Stress");
    console.log("=".repeat(60));
    console.log(`Total time: ${totalTime}ms`);
    console.log(`Successful: ${successCount}/${NUM_USERS}`);
    console.log(`Average response time: ${avgApiTime.toFixed(0)}ms`);
    console.log("=".repeat(60));

    expect(successCount).toBe(NUM_USERS);
  });
});
