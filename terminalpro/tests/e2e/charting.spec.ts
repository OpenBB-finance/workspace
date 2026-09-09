import { expect, test } from "@playwright/test";
import { proUrl } from "./helpers";

test("charting-testing-stock", async ({ page }) => {
  test.setTimeout(40000);
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Click on Charting Dashboard
  await page.getByText("Charting Dashboard").first().waitFor({ timeout: 10000 });
  await page.getByText("Charting Dashboard").first().click();

  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("abnb");
  await tradingViewFrame.getByText("ABNB", { exact: true }).click();

  // Wait for chart to load before adding financials
  await tradingViewFrame.getByRole("button", { name: "Financials" }).waitFor({ timeout: 10000 });
  await tradingViewFrame.getByRole("button", { name: "Financials" }).click();
  await page.getByText("Revenue").nth(1).click();
  await page.getByText("Cost of Revenue").first().click();
  await page.getByRole("button", { name: "Add" }).click();

  // Verify financials were added
  await expect(tradingViewFrame.getByText("annually cost_of_revenue")).toBeVisible({ timeout: 10000 });
  await expect(tradingViewFrame.getByText("annually revenue")).toBeVisible();

  // Add indicator
  await tradingViewFrame.getByRole("button", { name: "Indicators & Strategies" }).click();
  await tradingViewFrame.getByText("Week High/Low").click();

  // Verify indicator was added
  await expect(tradingViewFrame.getByText("52W H/L")).toBeVisible({ timeout: 10000 });
});

test("charting-testing-economy", async ({ page }) => {
  test.setTimeout(40000);
  await page.goto(`${proUrl}/app`);
  await page.getByRole("link", { name: "Charting" }).click();
  await page.waitForLoadState("networkidle");

  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByText("Economy").click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("fed");
  await tradingViewFrame.getByText("FEDFUNDS").click();

  // Verify chart loaded
  await expect(
    tradingViewFrame.getByLabel("Chart for $FEDFUNDS, 1 month"),
  ).toBeVisible({ timeout: 10000 });
});
