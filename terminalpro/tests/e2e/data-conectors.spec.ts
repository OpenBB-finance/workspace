import path from "node:path";
import { test } from "@playwright/test";
import { proUrl } from "./helpers";

test("csv-widget", async ({ page }) => {
  const mockDataDir = path.join(process.cwd(), "tests", "mock_data");

  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  const fileChooserPromise = page.waitForEvent("filechooser");

  // Go to data connectors tab and add a new file
  await page.getByRole("link", { name: "Data Connectors" }).click();
  await page.getByRole("button", { name: "Upload file(s)" }).click();
  await page.getByRole("button", { name: "Choose file(s)" }).click();

  // Wait for file chooser and set file
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(mockDataDir, "sample_data.csv"));

  // Wait for file to be processed
  await page.getByRole("button", { name: "Continue" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Continue" }).click();

  const nameInput = page.locator("input[name='0.name']");
  await nameInput.waitFor({ timeout: 5000 });
  await nameInput.fill("CSV test data");

  const uploadSubmitButton = page.getByRole("button", { exact: true, name: "Upload" });
  await uploadSubmitButton.click();

  await page.waitForURL(`${proUrl}/app/data-connectors?tab=my-widgets`, {
    waitUntil: "domcontentloaded",
    timeout: 10000,
  });

  const csvWidget = page
    .locator("p[class='font-medium line-clamp-1']")
    .getByText("CSV");
  await csvWidget.waitFor({ state: "visible", timeout: 10000 });
  await csvWidget.first().click();

  // Ensure the file was added as a widget
  await page.getByLabel("My Widgets").getByText("CSV test data").click();
});

test("json-widget", async ({ page }) => {
  const mockDataDir = path.join(process.cwd(), "tests", "mock_data");

  await page.goto(`${proUrl}/app`);
  await page.waitForLoadState("networkidle");

  const fileChooserPromise = page.waitForEvent("filechooser");

  // Go to data connectors tab and add a new file
  await page.getByRole("link", { name: "Data Connectors" }).click();
  await page.getByRole("button", { name: "Upload file(s)" }).click();
  await page.getByRole("button", { name: "Choose file(s)" }).click();

  // Wait for file chooser and set file
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(path.join(mockDataDir, "sample_data.json"));

  // Wait for file to be processed
  await page.getByRole("button", { name: "Continue" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Continue" }).click();

  const nameInput = page.locator("input[name='0.name']");
  await nameInput.waitFor({ timeout: 5000 });
  await nameInput.fill("JSON test data");

  const uploadSubmitButton = page.getByRole("button", { exact: true, name: "Upload" });
  await uploadSubmitButton.click();

  await page.waitForURL(`${proUrl}/app/data-connectors?tab=my-widgets`, {
    waitUntil: "domcontentloaded",
    timeout: 10000,
  });

  const jsonWidget = page
    .locator("p[class='font-medium line-clamp-1']")
    .getByText("JSON");
  await jsonWidget.waitFor({ state: "visible", timeout: 10000 });
  await jsonWidget.first().click();

  // Ensure the file was added as a widget
  await page.getByLabel("My Widgets").getByText("JSON test data").click();
});
