import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("visiting homepage redirects to login page", async ({ page }) => {
  await page.goto("https://pro.openbb.dev");
  await expect(page).toHaveURL("https://pro.openbb.dev/login");
});

// This test verifies that dashboard and chart states are independent:
// - Create an equity template with ADBE ticker
// - Go to charting and change ticker
// - Return to template and verify ADBE is still selected
test("verify-state-dash-and-chart", async ({ page }) => {
  test.setTimeout(300000);
  await login(page);
  await page.waitForSelector("#tabs", { timeout: 30000 });

  // Create new dashboard with equity template
  await page.locator("#tabs").getByRole("button").first().click();
  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();
  await page.getByRole("button", { name: "Equity Template" }).click();

  // Wait for template to load and change ticker to ADBE
  await page.waitForLoadState("networkidle");
  await page
    .locator(
      "button.obb-minimal-input.flex.items-center.justify-between.gap-1.bg-light-50._select-ticker",
    )
    .nth(4)
    .click();
  await page.getByText("ADBE", { exact: true }).click();

  // Verify ADBE is shown in the widgets
  await expect(page.getByText("1Ticker InformationADBE")).toBeVisible();
  await expect(page.getByText("1Price PerformanceADBE")).toBeVisible();

  // Go to charting page and change ticker to ABNB
  await page.getByRole("link", { name: "Charting" }).click();
  const tradingViewFrame = page.frameLocator('iframe[name^="tradingview_"]');

  // Wait for TradingView iframe to load
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").click();
  await tradingViewFrame.getByPlaceholder("Search").fill("abnb");
  await tradingViewFrame.getByText("ABNB", { exact: true }).click();

  await tradingViewFrame.getByRole("button", { name: "Symbol Search" }).click();
  await tradingViewFrame.getByPlaceholder("Search").fill("adbe");
  await tradingViewFrame.getByText("AADBE", { exact: true }).click();

  // Go back to equity template and verify group is still ADBE
  await page.getByText("Equity TemplateADBE").click();
  await expect(page.getByText("1Ticker InformationADBE")).toBeVisible();
  await expect(page.getByText("1Price PerformanceADBE")).toBeVisible();

  // Go back to charting - should still be ABNB
  await page.getByRole("link", { name: "Charting" }).click();

  // Wait for TradingView iframe to load again
  const tradingViewFrame2 = page.frameLocator('iframe[name^="tradingview_"]');
  await tradingViewFrame2.getByRole("button", { name: "Symbol Search" }).waitFor({ timeout: 30000 });
  await tradingViewFrame2.getByRole("button", { name: "Symbol Search" }).click();

  // Verify ABNB is still selected
  await expect(
    tradingViewFrame2
      .locator("#overlap-manager-root")
      .getByText("AABNB", { exact: true }),
  ).toBeVisible();
});
