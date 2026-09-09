import { test } from "@playwright/test";
import { proUrl } from "./helpers";

test("transpose-table", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Add new dashboard with financial statements widget
  await page.waitForSelector("#tabs", { timeout: 30000 });
  await page.locator("#tabs").getByRole("button").first().click();
  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();
  await page.getByRole("button", { name: "Search for tickers or widgets" }).click();
  await page.getByPlaceholder("Search for widgets,").fill("financial");
  await page.getByText("Financial Statements").click();
  await page.getByRole("button", { name: "Add 1 widget" }).click();

  // Wait for widget to load and click options
  const ellipsisButton = page.locator('button:has(svg use[href*="vertical-ellipsis-icon"])');
  await ellipsisButton.waitFor({ timeout: 15000 });
  await ellipsisButton.click();
  await page.getByRole("menuitem", { name: "Quick Actions" }).click();
  await page.getByRole("menuitem", { name: "Transpose data" }).click();
});
