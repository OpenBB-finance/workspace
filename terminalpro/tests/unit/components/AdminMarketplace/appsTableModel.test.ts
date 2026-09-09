import { describe, expect, it } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import {
  selectApps,
  sortApps,
  sortValue,
} from "~/components/AdminMarketplace/appsTableModel";
import type { AppStatus } from "~/routes/admin/marketplaceStatus";

function makeApp(overrides: Partial<AdminApp> = {}): AdminApp {
  return {
    name: "Alpha",
    vendor_name: "Acme",
    version: "1",
    status: "development" as AppStatus,
    last_verified_at: null,
    updated_date: null,
    ...overrides,
  } as AdminApp;
}

const names = (apps: AdminApp[]) => apps.map((a) => a.name);

describe("sortValue", () => {
  it("lowercases text keys so sorting is case-insensitive", () => {
    const app = makeApp({ name: "Zeta", vendor_name: "ACME", version: "V2" });
    expect(sortValue(app, "name")).toBe("zeta");
    expect(sortValue(app, "vendor_name")).toBe("acme");
    expect(sortValue(app, "version")).toBe("v2");
  });

  it("parses dates to epoch ms so they order chronologically, not lexically", () => {
    const app = makeApp({ updated_date: "2026-03-01T00:00:00Z" });
    expect(sortValue(app, "updated_date")).toBe(Date.parse("2026-03-01T00:00:00Z"));
  });

  it("treats a missing date as 0 so unverified apps sort last descending", () => {
    expect(sortValue(makeApp({ last_verified_at: null }), "last_verified_at")).toBe(0);
    expect(sortValue(makeApp({ updated_date: null }), "updated_date")).toBe(0);
  });

  it("returns an empty string for an unknown column", () => {
    expect(sortValue(makeApp(), "not_a_column")).toBe("");
  });
});

describe("sortApps", () => {
  const apps = [
    makeApp({ name: "beta", updated_date: "2026-01-02T00:00:00Z" }),
    makeApp({ name: "Alpha", updated_date: "2026-01-03T00:00:00Z" }),
    makeApp({ name: "Gamma", updated_date: "2026-01-01T00:00:00Z" }),
  ];

  it("sorts ascending by name, ignoring case", () => {
    expect(names(sortApps(apps, { id: "name", dir: "asc" }))).toEqual([
      "Alpha",
      "beta",
      "Gamma",
    ]);
  });

  it("sorts descending by name", () => {
    expect(names(sortApps(apps, { id: "name", dir: "desc" }))).toEqual([
      "Gamma",
      "beta",
      "Alpha",
    ]);
  });

  it("sorts newest-first by updated_date", () => {
    expect(names(sortApps(apps, { id: "updated_date", dir: "desc" }))).toEqual([
      "Alpha",
      "beta",
      "Gamma",
    ]);
  });

  it("returns the input untouched when there is no sort", () => {
    expect(sortApps(apps, null)).toBe(apps);
  });

  it("does not mutate the input array", () => {
    const original = [...apps];
    sortApps(apps, { id: "name", dir: "asc" });
    expect(apps).toEqual(original);
  });
});

describe("selectApps", () => {
  const apps = [
    makeApp({ name: "InReview Dev", status: "development" }),
    makeApp({ name: "InReview Submitted", status: "submitted" }),
    makeApp({ name: "Live One", status: "published", vendor_name: "Polymarket" }),
    makeApp({ name: "Hidden", status: "disabled" }),
    makeApp({ name: "Gone", status: "removed" }),
  ];

  it("narrows to the in-review tab (development + submitted)", () => {
    const rows = selectApps(apps, "in-review", "", null);
    expect(names(rows).sort()).toEqual(["InReview Dev", "InReview Submitted"]);
  });

  it("narrows to published and disabled tabs", () => {
    expect(names(selectApps(apps, "published", "", null))).toEqual(["Live One"]);
    expect(names(selectApps(apps, "disabled", "", null))).toEqual(["Hidden"]);
  });

  it("the all tab includes removed apps", () => {
    expect(names(selectApps(apps, "all", "", null))).toHaveLength(5);
  });

  it("matches search against name, vendor and version, case-insensitively", () => {
    expect(names(selectApps(apps, "all", "POLYMARKET", null))).toEqual(["Live One"]);
    expect(names(selectApps(apps, "all", "live", null))).toEqual(["Live One"]);
    expect(names(selectApps(apps, "all", "1", null))).toHaveLength(5);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(names(selectApps(apps, "all", "  live  ", null))).toEqual(["Live One"]);
  });

  it("applies search within the active tab, not across all tabs", () => {
    expect(selectApps(apps, "published", "Hidden", null)).toEqual([]);
  });

  it("returns an empty list for undefined data", () => {
    expect(selectApps(undefined, "all", "", null)).toEqual([]);
  });

  it("sorts the narrowed rows", () => {
    const rows = selectApps(apps, "in-review", "", { id: "name", dir: "desc" });
    expect(names(rows)).toEqual(["InReview Submitted", "InReview Dev"]);
  });
});
