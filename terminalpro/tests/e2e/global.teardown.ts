import { expect, test as teardown } from "@playwright/test";
import { deleteUser } from "./helpers";

teardown("delete the user", async ({ request, page }) => {
  const deleted = await deleteUser({ request, page });

  expect(deleted.ok()).toBeTruthy();
});
