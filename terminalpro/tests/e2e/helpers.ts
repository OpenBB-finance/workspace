import { expect, type Page } from "@playwright/test";

//export const proUrl = "http://localhost:1420";
export const proUrl = `https://pro.openbb.${process.env.VITE_ENVIRONMENT}`;
export const hubUrl = `https://my.openbb.${process.env.VITE_ENVIRONMENT}`;
export const AUTH_HEADERS = {
  Authorization: `Bearer ${process.env.VITE_PLAYWRIGHT_TEST_KEY}`,
};

export function userInfo(): { username: string; email: string; password: string } {
  return {
    username: process.env.VITE_PLAYWRIGHT_ACCOUNT_USERNAME ?? "",
    email: process.env.VITE_PLAYWRIGHT_ACCOUNT_EMAIL ?? "",
    password: process.env.VITE_PLAYWRIGHT_ACCOUNT_PASSWORD ?? "",
  };
}

//set this up for env later - but for now we just want free users
export enum UserType {
  Free = "free",
  Paid = "paid",
}

export const userType: UserType = UserType.Free;

export async function deleteUser({ request, page }) {
  const { email, password } = userInfo();
  page.on("console", (msg) => {
    console.log(msg);
  });

  const loginInfo = await request.post(`${apiBaseUrl()}/pro/login`, {
    data: { email, password },
  });
  const loginData = await loginInfo.json();
  console.log("loginData", loginData);
  console.log("apiBaseUrl", apiBaseUrl());
  const deleted = await request.delete(
    `${apiBaseUrl()}/testing/user/${email}/${userType}`,
    {
      headers: AUTH_HEADERS,
    },
  );

  return deleted;
}

export function apiBaseUrl(): string {
  return `https://backend.openbb.${process.env.VITE_ENVIRONMENT}`;
}

export async function login(page: Page) {
  const user = userInfo();
  await page.goto(`${proUrl}/login`);
  try {
    await page
      .getByRole("button", { name: "I understand and wish to continue" })
      .click({ timeout: 2000 });
  } catch (error) {
    // Handle the error (e.g., log it or ignore it)
    console.error("Error clicking the button:", error);
  }
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Login" }).click();
}

export async function onboardUser(page: Page) {
  await expect(page).toHaveURL(`${proUrl}/onboarding`);

  // Fill out onboarding form
  await page.getByPlaceholder("Enter your first name").fill("Andrew");
  await page.getByPlaceholder("Enter your last name").fill("Kenreich");

  // Check if onboarding questions are shown (feature flag dependent)
  const organizationDropdown = page.getByRole("combobox").first();
  if (await organizationDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Select Organization Type
    await organizationDropdown.click();
    await page.getByLabel("Hedge Fund").getByText("Hedge Fund").click();

    // Select Job Role
    await page.getByRole("combobox").nth(1).click();
    await page
      .getByLabel("Student / Professor / Researcher")
      .getByText("Student / Professor / Researcher")
      .click();
  }

  // Submit the form
  await page.getByRole("button", { name: "Continue" }).click();

  // Wait for navigation away from onboarding
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 30000 });
}

export async function acceptTermsAndConditions(page: Page) {
  if (userType === UserType.Free) {
    return; // Skip the acceptance process for Free users
  }

  const tosLastElement = page.locator(`p[aria-label="tos-last-element"]`);
  await tosLastElement.scrollIntoViewIfNeeded();

  const tosAccept = page.locator(`button[aria-label="tos-accept-button"]`);
  await tosAccept.click();

  await tosLastElement.waitFor({ state: "hidden" });
}

export async function dismissChangeLog(page: Page) {
  await page.locator("svg.BB-Icon.block.size-4.h-4.w-4").nth(1).click();
}

export async function handleFirstTime(page: Page) {
  // Check if we're on onboarding page
  if (page.url().includes("/onboarding")) {
    await onboardUser(page);
    await acceptTermsAndConditions(page);

    // Wait for the app to be ready
    await page.waitForLoadState("networkidle");
  }
}

export async function clickOnNews(page: Page, tab: string) {
  // change to a given tab on the news page
  await page.getByRole("tab", { name: tab }).click();
  // clicks the 1st element on a given page/tab
  await page
    .locator(".group\\/widget > div:nth-child(2) > div[data-state='closed']")
    .first()
    .click();
}

export async function clickExitButton(page: Page) {
  await page.locator("._dialog-header > div > .flex > button:nth-child(2)").click();
}
