import { describe, expect, it } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import {
  type MarketplaceAction,
  resolveActions,
} from "~/components/AdminMarketplace/appActionModel";
import type { AppStatus } from "~/routes/admin/marketplaceStatus";

const appWithStatus = (status: AppStatus) => ({ status }) as AdminApp;

/** The actions enabled for a status, as a sorted list for stable comparison. */
function enabledFor(status: AppStatus): MarketplaceAction[] {
  return resolveActions(appWithStatus(status))
    .filter((a) => a.enabled)
    .map((a) => a.action)
    .sort();
}

describe("resolveActions", () => {
  it("returns every action for any status, enabled or not", () => {
    const actions = resolveActions(appWithStatus("published"));
    expect(actions.map((a) => a.action)).toEqual([
      "verify",
      "publish",
      "disable",
      "enable",
      "reject",
      "remove",
    ]);
  });

  // Mirrors the backend TRANSITIONS table — see marketplaceStatus.ts.
  it.each([
    ["development", ["publish", "reject", "remove", "verify"]],
    ["submitted", ["remove", "verify"]],
    ["verified", ["publish", "remove", "verify"]],
    ["published", ["disable", "remove", "verify"]],
    ["disabled", ["enable", "remove", "verify"]],
    ["removed", ["verify"]],
  ] as [AppStatus, MarketplaceAction[]][])("enables %s → %j", (status, expected) => {
    expect(enabledFor(status)).toEqual([...expected].sort());
  });

  it("re-verify is enabled from every status, including removed", () => {
    const statuses: AppStatus[] = [
      "submitted",
      "verified",
      "development",
      "published",
      "disabled",
      "removed",
    ];
    for (const status of statuses) {
      const verify = resolveActions(appWithStatus(status)).find(
        (a) => a.action === "verify",
      );
      expect(verify?.enabled, `verify should be enabled for ${status}`).toBe(true);
    }
  });

  it("tooltips the label when enabled and the reason when not", () => {
    const published = resolveActions(appWithStatus("published"));
    expect(published.find((a) => a.action === "disable")?.tooltip).toBe("Disable");
    expect(published.find((a) => a.action === "reject")?.tooltip).toBe(
      "Only an in-review submission can be rejected",
    );
  });

  it("only `removed` disables Remove", () => {
    expect(
      resolveActions(appWithStatus("removed")).find((a) => a.action === "remove")
        ?.enabled,
    ).toBe(false);
    expect(
      resolveActions(appWithStatus("published")).find((a) => a.action === "remove")
        ?.enabled,
    ).toBe(true);
  });
});
