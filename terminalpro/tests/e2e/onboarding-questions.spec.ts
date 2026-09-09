import { test } from "@playwright/test";
import { login, proUrl } from "./helpers";

test("test", async ({ page }) => {
  test.setTimeout(40000);
  await page.goto(`${proUrl}`);
  await page.waitForLoadState("networkidle");
  await login(page);
  await page.waitForLoadState("networkidle");

  await page.goto(`${proUrl}/onboarding`);
  await page.waitForLoadState("networkidle");

  await page.getByPlaceholder("Enter your first name").waitFor({ timeout: 5000 });
  await page.getByPlaceholder("Enter your first name").click();
  await page.getByPlaceholder("Enter your first name").fill("FstName");
  await page.getByPlaceholder("Enter your last name").click();
  await page.getByPlaceholder("Enter your last name").fill("LstName");
  await page.getByRole("combobox").first().click();
  await page.getByLabel("University").getByText("University").click();
  await page.getByRole("combobox").nth(1).click();
  await page
    .getByLabel("Student / Professor /")
    .getByText("Student / Professor /")
    .click();
  await page.getByRole("button", { name: "Continue" }).click();
});
