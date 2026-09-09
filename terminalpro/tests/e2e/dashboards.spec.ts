import * as fs from "node:fs";
import { expect, test } from "@playwright/test";
import { UserType, proUrl, userType } from "./helpers";

// Helper to create a new dashboard
async function createNewDashboard(page) {
  // Wait for the My Dashboards section (#tabs) to be visible
  await page.waitForSelector("#tabs", { timeout: 30000 });

  // Click the plus button in the tabs section
  await page.locator("#tabs").getByRole("button").first().click();

  // Click "New Dashboard" from the dropdown
  await page.getByRole("button", { name: /New Dashboard/ }).click();

  // Wait for navigation to the new dashboard
  await page.waitForURL(/\/app\/[a-f0-9-]+/, { timeout: 10000 });
}

// Helper to open dashboard context menu (right-click or kebab menu)
async function openDashboardContextMenu(page, dashboardName: string) {
  // Find the dashboard link by its text and right-click it
  const dashboardLink = page.locator(`#tabs a:has-text("${dashboardName}")`);
  await dashboardLink.waitFor({ state: "visible", timeout: 5000 });
  await dashboardLink.click({ button: "right" });
}

test("dashboards-rename", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Create a new dashboard
  await createNewDashboard(page);

  // Get the current dashboard name from the URL or sidebar
  // The dashboard was just created, so find the active dashboard link
  const activeDashboard = page.locator("#tabs li a.obb-navigation-item-active");
  await activeDashboard.waitFor({ state: "visible", timeout: 5000 });
  const originalName = await activeDashboard.textContent();

  // Open context menu and rename
  await openDashboardContextMenu(page, originalName || "");
  await page.getByRole("menuitem", { name: "Rename" }).click();

  // Fill in new name and confirm
  await page.getByRole("textbox").fill("Renamed Dashboard");
  await page.getByRole("button", { name: "Rename" }).click();

  // Verify the rename worked
  await expect(page.locator("#tabs")).toContainText("Renamed Dashboard");
});

test("dashboards-delete", async ({ page }) => {
  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Create a new dashboard
  await createNewDashboard(page);

  // Get the created dashboard's name
  const activeDashboard = page.locator("#tabs li a.obb-navigation-item-active");
  await activeDashboard.waitFor({ state: "visible", timeout: 5000 });
  const dashboardName = await activeDashboard.textContent();

  // Open context menu and delete
  await openDashboardContextMenu(page, dashboardName || "");
  await page.getByRole("menuitem", { name: "Delete" }).click();

  // Confirm deletion in the dialog
  await page.getByRole("button", { name: "Yes, Delete" }).click();

  // Wait for deletion to complete
  await page.waitForLoadState("networkidle");

  // Assert dashboard is deleted - it should no longer appear in the sidebar
  await expect(page.locator(`#tabs a:has-text("${dashboardName}")`)).toHaveCount(0);
});

test("dashboards-export", async ({ page }) => {
  if (userType === UserType.Free) {
    test.skip(); // Skip for Free users
    return;
  }

  test.setTimeout(60000);

  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  // Create a new dashboard
  await createNewDashboard(page);

  // Get the created dashboard's name
  const activeDashboard = page.locator("#tabs li a.obb-navigation-item-active");
  await activeDashboard.waitFor({ state: "visible", timeout: 5000 });
  const dashboardName = await activeDashboard.textContent();

  // Open context menu and export
  await openDashboardContextMenu(page, dashboardName || "");
  await page.getByRole("menuitem", { name: "Export PDF" }).click();

  // Wait for export dialog and initiate download
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export" }).click(),
  ]);

  // Check if the download was successful
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  // Remove the downloaded file
  if (downloadPath) {
    fs.unlinkSync(downloadPath);
  }
});
