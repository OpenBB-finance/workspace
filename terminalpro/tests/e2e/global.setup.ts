import { expect, test as setup } from "@playwright/test";
import {
  AUTH_HEADERS,
  apiBaseUrl,
  deleteUser,
  handleFirstTime,
  hubUrl,
  login,
  userInfo,
} from "./helpers";

const authFile = "playwright/.auth/user.json";

//set this up for env later - but for now we just want free users
enum UserType {
  Free = "free",
  Paid = "paid",
}

const userType: UserType = UserType.Free;

setup("register a user", async ({ request, page }) => {
  await deleteUser({ request, page });
  setup.setTimeout(60000);
  const { username, email, password } = userInfo();

  // Register a new user
  await page.goto(`${hubUrl}/register`);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.locator("#Password").fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByText("Select an option").click();
  await page.getByText("Personal").click();
  await page.locator("#agreement").click();
  await page.getByText("Register account").click();

  // Wait for redirect to login page with confirmation
  const encoded = encodeURIComponent(email);
  const newUrl = `${hubUrl}/login?email=${encoded}&alert-confirm=true`;
  await page.waitForURL(newUrl, { timeout: 30000 });

  // Confirm the user via API
  const confirm = await request.post(
    `${apiBaseUrl()}/testing/user/${email}/${userType}`,
    {
      headers: AUTH_HEADERS,
    },
  );
  expect(confirm.ok()).toBeTruthy();

  // Login with the new user
  await login(page);

  // Wait for app to load
  await page.waitForLoadState("networkidle");

  // Handle first-time onboarding if needed
  await handleFirstTime(page);

  // Save authentication state
  await page.context().storageState({ path: authFile });
});
