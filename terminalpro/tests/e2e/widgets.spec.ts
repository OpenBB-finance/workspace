import { type Page, test } from "@playwright/test";
import axios from "axios";
import type { AgGridComponents, NonAgGridComponents } from "~/components/Widgets";
import { proUrl } from "./helpers";

async function verifyCustomData(page: Page, widgetId: string) {
  const widgetSelector = `.widget-${widgetId.toLowerCase()}`;
  const dataDivSelector = `${widgetSelector} ._widget-content`;

  // Wait for widget to appear
  await page.waitForSelector(`.widget-${widgetId}`, { timeout: 10000 });

  // Wait for content to load inside widget
  await page.waitForSelector(dataDivSelector, { timeout: 10000 }).catch(() => {
    throw new Error(`There is no content in the custom widget ${widgetId}`);
  });

  const hasWidgetContent = (await page.locator(dataDivSelector).count()) > 0;
  if (!hasWidgetContent) {
    throw new Error(`There is no content in the custom widget ${widgetId}`);
  }
}

async function verifyTableData(page: Page, widgetId: string) {
  const widgetSelector = `.widget-${widgetId.toLowerCase()} .ag-root-wrapper`;
  const dataDivSelector = `${widgetSelector} .ag-row`;
  await page.waitForSelector(widgetSelector);
  const dataDivs = page.locator(dataDivSelector);
  const rss_widgetCount = await dataDivs.count();
  console.log("widgetRowCount:", rss_widgetCount);

  // Check if the content of RSS viewer is greater than 2, if not - throw an error
  if (rss_widgetCount <= 1) {
    throw new Error(`There is no content in the table widget ${widgetId}`);
  }
}

async function addWidget(page: Page, widgetId: string) {
  const widgetClassName = `widget-${widgetId.toLowerCase()}`;

  // Wait for search button to be ready
  await page.getByRole("button", { name: "Search for tickers or widgets" }).waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "Search for tickers or widgets" }).click();

  // Add the widget using the class name selector
  await page.locator(`.${widgetClassName}`).first().waitFor({ timeout: 5000 });
  await page.locator(`.${widgetClassName}`).first().click();
  await page.getByRole("button", { name: "Add 1 widget" }).click();
}

async function handleWidgetFunctionality(page: Page, widgetId: string) {
  console.log(widgetId);

  // class="ag-row-even ag-row-no-focus ag-row ag-row-level-0 ag-row-position-absolute ag-row-first ag-row-not-inline-editing"
  // all tables have this row for ag-grid on first one
  // everything else has a _widget-content in it

  const openSettings = page
    .locator(
      'button[id^="radix-"][aria-haspopup="menu"][data-state="closed"] svg use[href="/assets/icons/sprite.svg#vertical-ellipsis-icon"]',
    )
    .first();
  await openSettings.click();

  try {
    // Wait for the element with a specific role and name to be available
    const settingsMenuItem = page.locator('role=menuitem[name="Settings"]');
    await page.waitForSelector('role=menuitem[name="Settings"]', { timeout: 2000 });
    await settingsMenuItem.click();
    // close settings
    await page.getByRole("button", { name: "Close" }).click();
  } catch (error) {
    if (error.name === "TimeoutError") {
      // Handle the timeout, such as by logging or silently ignoring
      console.log(
        'The "Settings" menu item was not found within 2 seconds or does not exist on this Widget.',
      );
    } else {
      throw error;
    }
  }

  await openSettings.click();
  try {
    const settingsMenuItem = page.locator('role=menuitem[name="Duplicate"]');
    await page.waitForSelector('role=menuitem[name="Duplicate"]', { timeout: 2000 });
    await settingsMenuItem.click();
  } catch (error) {
    if (error.name === "TimeoutError") {
      // Handle the timeout, such as by logging or silently ignoring
      console.log(
        'The "Duplicate" menu item was not found within 2 seconds or does not exist on this Widget.',
      );
    } else {
      throw error;
    }
  }

  while (true) {
    const closeButtons = page.locator(
      '#workarea button:has(svg > use[href="/assets/icons/sprite.svg#cross-icon"])',
    );
    if ((await closeButtons.count()) > 0) {
      const closeButton = closeButtons.first();
      await closeButton.click();
    } else {
      break;
    }
    if (widgetId === "navigation_bar") {
      await page.getByRole("button", { name: "Yes, Delete" }).click();
    }
  }
}

const tableWidgets = [
  "currency_snapshot",
  "management_team",
  "analyst_price_target",
  "analyst_estimates",
  "analyst_consensus",
  "financial_ratios",
  "key_metrics",
  "company_filings",
  "earning_history",
  "stock_splits",
  "dividend_payment",
  "financial_statements",
  "share_statistics",
  "insider_trading",
  "options_chains_eod",
  "stock_ownership",
  "institutional_ownership",
  "revenue_per_geography",
  "revenue_per_bus_line",
  "valuation_multiples",
  "etf_holdings",
  "watchlist",
  "revenue_trends",
  "earnings_trends",
  "yield_curve",
  "forward_pe",
] as (keyof typeof AgGridComponents)[];

const customWidgets = [
  "global_news",
  "company_news",
  "ticker_information",
  "company_profile",
  "price_target",
  "earnings_transcripts",
  "price_performance",
  "market_indices",
] as (keyof typeof NonAgGridComponents)[];

async function initVerifyWidgets(page: Page) {
  await page.goto(`${proUrl}/app`);

  await page.waitForSelector("#tabs");

  const dashboardSelector = `div[aria-label="dashboard"]`;
  const tabs = await page.locator(dashboardSelector).count();

  console.log("tabs:", tabs);
  if (tabs > 0) {
    return await page.locator(dashboardSelector).first().click();
  }

  await page.locator("#tabs").getByRole("button").first().click();
  await page.getByRole("button", { name: "New dashboard (Ctrl+Alt+T)" }).click();
}

for (const widgetId of tableWidgets) {
  test(`verify-widgets-table-${widgetId}`, async ({ page }) => {
    await initVerifyWidgets(page);

    //    "rich_note": "Text Widget", skipped for now
    //    "rss_viewer": "RSS Feed", skipped for now - tested elsewhere

    // skipped cause settings - "navigation_bar-31": "Navigation Bar",
    // skipped 'charting-29': 'Charting' for now - issue with loading it
    await addWidget(page, widgetId);

    await page.waitForSelector(`.widget-${widgetId}`);
    const chartViewButton = `.widget-${widgetId} button[id^="chart-view"]`;
    const chartview = await page.locator(chartViewButton).count();

    if (chartview > 0) {
      await page.locator(chartViewButton).first().click();
    }
    await verifyTableData(page, widgetId);
    await handleWidgetFunctionality(page, widgetId);
  });
}

for (const widgetId of customWidgets) {
  test(`verify-widgets-custom-${widgetId}`, async ({ page }) => {
    await initVerifyWidgets(page);

    await addWidget(page, widgetId);
    await verifyCustomData(page, widgetId);
    await handleWidgetFunctionality(page, widgetId);
  });
}

test.describe("Verify widgets JSON imgUrl", () => {
  test("widgets-json-imgUrl", async ({ page }) => {
    const widgetsUrl = "https://pro.openbb.dev/assets/data/widgets.json";
    const response = await axios.get(widgetsUrl);
    const widgets = response.data;
    const widgetArray = Object.values(widgets);
    const errors = [];

    for (const widget of widgetArray) {
      if (typeof widget === "object" && widget !== null) {
        const widgetName = (widget as { name: string }).name;
        const imgUrl = (widget as { imgUrl: string }).imgUrl;

        const skipWidgets = [
          "Balance Sheet",
          "Income Statement",
          "Cash Flow Statement",
        ];
        if (!skipWidgets.includes(widgetName)) {
          // Check if imgUrl is present and not empty
          if (!("imgUrl" in widget && widget.imgUrl)) {
            errors.push(`imgUrl is not present or is empty in widget: ${widgetName}`);
            continue;
          }

          // check if it's a valid URL
          console.log("imgUrl:", imgUrl);
          console.log(widget);
          const response = await page.goto(imgUrl as string);
          if (!response.ok()) {
            errors.push(`Failed to load image URLs: ${imgUrl}`);
          }
        }
      }
    }
    if (errors.length > 0) {
      throw new Error(`\n- ${errors.join("\n- ")}`);
    }
  });
});
