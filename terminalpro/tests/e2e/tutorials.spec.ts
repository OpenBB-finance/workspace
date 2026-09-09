import { expect, test, type Page } from "@playwright/test";
import { proUrl } from "./helpers";

async function startTutorial(page: Page, title: string) {
  await page.goto(`${proUrl}/app`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForLoadState("networkidle");

  // Wait for sidebar to be visible and click the tutorial
  await page.waitForSelector("#tabs", { timeout: 30000 });
  await page.locator("li").filter({ hasText: title }).getByRole("button").click();
  await page.waitForLoadState("networkidle");
}

test("tutorial-part-1", async ({ page }) => {
  test.setTimeout(200000);

  await startTutorial(page, "Grouping Mechanism");

  const pageSize = await page.viewportSize();
  await page.mouse.move(pageSize.width - 2, pageSize.height / 2);
  await page.mouse.wheel(0, 100);

  // Wait for start tutorial button and click
  await page.getByRole("button", { name: "Start tutorial" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Start tutorial" }).click();

  // Tutorial step 1: Click group dropdown
  const groupDropdown = page.locator("button._group-dropdown-trigger-company_news");
  await groupDropdown.waitFor({ state: "visible", timeout: 10000 });
  await groupDropdown.click();

  // Tutorial step 2: Create a group
  await page.getByRole("button", { name: "Create a group" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Create a group" }).click();

  // Tutorial step 3: Click group button
  await page.getByRole("button", { name: "1", exact: true }).nth(3).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "1", exact: true }).nth(3).click();

  // Tutorial step 4: Click checkbox
  await page.getByRole("checkbox").nth(1).waitFor({ timeout: 5000 });
  await page.getByRole("checkbox").nth(1).click();

  // Tutorial step 5: Click AAPL button
  await page.getByRole("button", { name: "AAPL" }).nth(2).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "AAPL" }).nth(2).click();

  // Tutorial step 6: Select MSFT from dropdown
  await page.getByLabel("AAPL").getByText("MSFT").waitFor({ timeout: 5000 });
  await page.getByLabel("AAPL").getByText("MSFT").click();

  // End tutorial
  await page.getByRole("button", { name: "End tutorial" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "End tutorial" }).click();

  // Verify results
  await expect(page.getByRole("button", { name: "MSFT" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "MSFT" }).nth(1)).toBeVisible();
  await page.getByRole("button", { name: "2", exact: true }).first().click();
});

test("tutorial-part-2", async ({ page }) => {
  test.setTimeout(200000);
  await startTutorial(page, "Generate charts from raw data");

  const pageSize = await page.viewportSize();
  await page.mouse.move(pageSize.width - 2, pageSize.height / 2);
  await page.mouse.wheel(0, 100);

  // Start tutorial
  await page.getByRole("button", { name: "Start tutorial" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Start tutorial" }).click();

  // Double-click on Research And Development
  await page.getByText("Research And Development").waitFor({ timeout: 10000 });
  await page.getByText("Research And Development").dblclick();

  // Click chart selector
  await page.locator("div:nth-child(3) > .rounded-\\[2px\\]").waitFor({ timeout: 5000 });
  await page.locator("div:nth-child(3) > .rounded-\\[2px\\]").click();

  // Select Line chart
  await page.getByText("Line", { exact: true }).waitFor({ timeout: 5000 });
  await page.getByText("Line", { exact: true }).click();

  // End tutorial
  await page.getByRole("button", { name: "End tutorial" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "End tutorial" }).click();

  // Verify chart was created
  await expect(
    page
      .locator("div")
      .filter({ hasText: /^Financial Statements \[AAPL\] - Chart$/ })
      .first(),
  ).toBeVisible();
});

test("tutorial-part-3", async ({ page }) => {
  test.setTimeout(200000);
  await startTutorial(page, "Import your data");

  // Start tutorial
  await page.getByRole("button", { name: "Start tutorial" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Start tutorial" }).click();

  // Add single widget
  await page.getByRole("button", { name: "Add a single widget" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Add a single widget" }).click();

  // Fill widget details
  await page.getByPlaceholder("e.g. GDP Growth", { exact: true }).waitFor({ timeout: 5000 });
  await page.getByPlaceholder("e.g. GDP Growth", { exact: true }).click();
  await page.getByPlaceholder("e.g. GDP Growth", { exact: true }).fill("Crypto Top Protocols");
  await page.getByPlaceholder("e.g. GDP Growth in the US").fill("Protocols by TVL from DefiLlama");
  await page.getByPlaceholder("e.g. https://api.example.com/").fill("https://api.llama.fi/protocols");

  // Test the API
  await page.getByRole("button", { name: "Test" }).click();

  // Wait for API response before adding
  await page.waitForResponse(
    (response) => response.url().includes("llama.fi") && response.status() === 200,
    { timeout: 15000 },
  ).catch(() => {
    // Fallback: wait for Add button to become enabled
  });

  await page.getByRole("button", { name: "Add", exact: true }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Add", exact: true }).click();

  // Create new dashboard and add widget
  await page.locator("#tabs").getByRole("button").first().waitFor({ timeout: 5000 });
  await page.locator("#tabs").getByRole("button").first().click();

  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();

  // Search and add widget
  await page.getByRole("button", { name: "Search for tickers or widgets" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Search for tickers or widgets" }).click();

  await page.getByText("Crypto Top Protocols").waitFor({ timeout: 5000 });
  await page.getByText("Crypto Top Protocols").click();

  await page.getByRole("button", { name: "Add 1 widget" }).click();

  // Verify widget was added
  await expect(page.getByText("Crypto Top Protocols")).toBeVisible();
});

test("tutorial-part-4", async ({ page }) => {
  test.setTimeout(200000);

  await page.goto(`${proUrl}/app`);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForLoadState("networkidle");

  // Wait for sidebar and click Charting tutorial
  await page.waitForSelector("#tabs", { timeout: 30000 });
  await page.locator("li").filter({ hasText: "Charting" }).getByRole("button").click();
  await page.waitForLoadState("networkidle");

  // Verify tutorial content is shown
  await expect(page.getByText("Explore advanced charting")).toBeVisible({ timeout: 10000 });

  // Finish tutorial
  await page.getByRole("button", { name: "Finish tutorial" }).click();
});

test("tutorial-part-5", async ({ page }) => {
  test.setTimeout(200000);
  await startTutorial(page, "Research a group of sector companies");

  // Start tutorial
  await page.getByRole("button", { name: "Start tutorial" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Start tutorial" }).click();

  // Click Edit Tickers
  await page.getByRole("button", { name: "Edit Tickers" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Edit Tickers" }).click();

  // Click ADBE ticker
  await page.locator("#selectedTickers_ADBE").waitFor({ timeout: 5000 });
  await page.locator("#selectedTickers_ADBE").click();

  // Select ADBE from row
  await page.getByRole("row", { name: "ADBE Adobe Inc." }).locator("span").first().waitFor({ timeout: 5000 });
  await page.getByRole("row", { name: "ADBE Adobe Inc." }).locator("span").first().click();

  // End tutorial
  await page.getByRole("button", { name: "End tutorial" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "End tutorial" }).click();

  // Verify ADBE is visible
  await expect(page.getByRole("button", { name: "ADBE" }).nth(1)).toBeVisible();
});
