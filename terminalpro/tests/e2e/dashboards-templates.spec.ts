import { test } from "@playwright/test";
import { proUrl } from "./helpers";

test("dashboards-test-all-free-templates", async ({ page }) => {
  await page.goto(`${proUrl}/app`);

  // Helper function to click on New Dashboard, Add Template, and then a specific template
  const clickTemplate = async (templateName: string) => {
    await page.locator("#tabs").getByRole("button").first().click();
    await page.getByRole("button", { name: "New Dashboard (Ctrl+Alt+T)" }).click();
    await page.getByRole("button", { name: "Add Template" }).click();
    await page.getByRole("button", { name: templateName }).click();
  };

  const clickDashboards = async (dashboardNames: string[]) => {
    for (const dashboardName of dashboardNames) {
      await page.getByText(dashboardName).first().click();
    }
  };

  // Click on each template button using the helper function
  await clickTemplate("Equity Template Research any");
  await clickTemplate("Analyst Template Manage your");
  await clickTemplate("World Economics Template Stay");
  await clickTemplate("Country Economics Template");
  // await clickTemplate('ETF Template Research ETFs');
  await clickTemplate("Comparison Template Quickly");
  await clickTemplate("News Template Stay updated");
  await clickTemplate("Charting Create");
  await clickTemplate("Onboarding Template Get");

  // verify stuff worked - Need to delete all dashboards in the future -
  // but if one template works - they all work lets assume :D
  // Click on each dashboard using the helper function
  const dashboardNames = [
    "News Dashboard",
    "Charting Dashboard",
    "Equity Dashboard",
    "World Economics",
    "Country Economics",
    "Analyst Dashboard",
    "Earnings Update",
    "Comparison Dashboard",
  ];

  await clickDashboards(dashboardNames);
});
