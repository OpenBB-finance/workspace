import { type Page, expect, test } from "@playwright/test";
import { clickExitButton, clickOnNews, proUrl } from "./helpers";

test("verify-news", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Go to the news Dashboard
  await page.getByText("News Dashboard").first().waitFor({ timeout: 10000 });
  await page.getByText("News Dashboard").first().click();

  // Verify that the news page is displayed
  await expect(page.getByText("Headlines")).toBeVisible();

  // Select the RSS viewer content
  const widgetSelector = ".widget-rss_viewer";
  const dataDivSelector = `${widgetSelector} ._widget-content`;

  // Wait for the widget content to be loaded
  await page.waitForSelector(widgetSelector, { timeout: 10000 });
  await page.waitForSelector(dataDivSelector, { timeout: 10000 });

  // Create a locator for the data divs within the widget
  const dataDivs = page.locator(dataDivSelector);

  const rss_widgetCount = await dataDivs.count();

  // Check if the content of RSS viewer is greater than 2
  if (rss_widgetCount <= 2) {
    throw new Error("There are not more than 2 _widget-content elements");
  }
});

test("click-on-news-all-tabs", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  await page.getByText("News Dashboard").first().waitFor({ timeout: 10000 });
  await page.getByText("News Dashboard").first().click();
  await clickOnNews(page, "All");
  await clickExitButton(page);
  await clickOnNews(page, "Top Stories");
  await clickExitButton(page);
  await clickOnNews(page, "Exclusives");
  await clickExitButton(page);
  await clickOnNews(page, "Hot");
  await clickExitButton(page);
});

async function createEquityDashboard(page: Page) {
  await page.locator("#tabs").getByRole("button").first().click();
  await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();
  await page.getByRole("button", { name: "Equity Dashboard" }).click();
}

test("add-news-copilot-context", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  await page.getByText("News Dashboard").first().waitFor({ timeout: 10000 });
  await page.getByText("News Dashboard").first().click();
  await clickOnNews(page, "All");

  // Add to dashboard and set as context for copilot
  await page.getByRole("button").first().click();
  await page.getByText("Context", { exact: true }).click();
});
