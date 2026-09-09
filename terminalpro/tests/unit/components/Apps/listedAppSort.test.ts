import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sortListedApps } from "~/components/Apps/listedAppSort";
import type { ListedApp } from "~/types/listedApps";

function makeApp(overrides: Partial<ListedApp> & { id: string }): ListedApp {
  return {
    vendorName: "Vendor",
    appName: "App",
    description: "",
    backendUrl: "https://example.com",
    thumbnail: "",
    widgets: [],
    ...overrides,
  };
}

const NOW = "2026-05-13T12:00:00Z";
const RECENT = "2026-05-10T12:00:00Z"; // 3 days ago -> new
const OLD = "2026-01-01T12:00:00Z"; // months ago -> not new

describe("sortListedApps", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("default ordering (no explicit sort)", () => {
    it("pins new (recent, unsubscribed, non-built-in) apps above older apps", () => {
      const apps = [
        makeApp({ id: "z-old", appName: "Zeta", createdDate: OLD }),
        makeApp({ id: "a-new", appName: "Alpha", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, undefined, []);

      expect(sorted.map((a) => a.id)).toEqual(["a-new", "z-old"]);
    });

    it("orders multiple new apps alphabetically among themselves", () => {
      const apps = [
        makeApp({ id: "new-b", appName: "Beta", createdDate: RECENT }),
        makeApp({ id: "old", appName: "Aaa", createdDate: OLD }),
        makeApp({ id: "new-a", appName: "Alpha", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, undefined, []);

      expect(sorted.map((a) => a.id)).toEqual(["new-a", "new-b", "old"]);
    });

    it("does NOT pin a recent app that is already subscribed", () => {
      const apps = [
        makeApp({ id: "z-old", appName: "Zeta", createdDate: OLD }),
        makeApp({ id: "a-new", appName: "Alpha", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, undefined, ["a-new"]);

      // falls back to default app-a-z ordering: Alpha then Zeta
      expect(sorted.map((a) => a.id)).toEqual(["a-new", "z-old"]);
    });

    it("does NOT pin a recent built-in app", () => {
      const apps = [
        makeApp({ id: "z-old", appName: "Zeta", createdDate: OLD }),
        makeApp({
          id: "m-new",
          appName: "Mango",
          createdDate: RECENT,
          isBuiltIn: true,
        }),
      ];

      const sorted = sortListedApps(apps, undefined, []);

      // built-in is not "new"; default app-a-z: Mango then Zeta
      expect(sorted.map((a) => a.id)).toEqual(["m-new", "z-old"]);
    });

    it("keeps a recent subscribed app in alphabetical position behind a non-new app", () => {
      const apps = [
        makeApp({ id: "old-a", appName: "Aaa", createdDate: OLD }),
        makeApp({ id: "new-sub", appName: "Zzz", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, undefined, ["new-sub"]);

      expect(sorted.map((a) => a.id)).toEqual(["old-a", "new-sub"]);
    });
  });

  describe("explicit sorts do not pin new apps", () => {
    it("app-a-z keeps pure alphabetical order regardless of newness", () => {
      const apps = [
        makeApp({ id: "old-a", appName: "Aaa", createdDate: OLD }),
        makeApp({ id: "new-z", appName: "Zzz", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, "app-a-z", []);

      expect(sorted.map((a) => a.id)).toEqual(["old-a", "new-z"]);
    });

    it("oldest keeps oldest-first order regardless of newness", () => {
      const apps = [
        makeApp({ id: "new", appName: "Alpha", createdDate: RECENT }),
        makeApp({ id: "old", appName: "Zeta", createdDate: OLD }),
      ];

      const sorted = sortListedApps(apps, "oldest", []);

      expect(sorted.map((a) => a.id)).toEqual(["old", "new"]);
    });

    it("newest sorts by date descending", () => {
      const apps = [
        makeApp({ id: "old", appName: "Zeta", createdDate: OLD }),
        makeApp({ id: "new", appName: "Alpha", createdDate: RECENT }),
      ];

      const sorted = sortListedApps(apps, "newest", []);

      expect(sorted.map((a) => a.id)).toEqual(["new", "old"]);
    });

    it("vendor-a-z sorts by vendor then app name", () => {
      const apps = [
        makeApp({ id: "1", appName: "B", vendorName: "Zeta" }),
        makeApp({ id: "2", appName: "A", vendorName: "Alpha" }),
      ];

      const sorted = sortListedApps(apps, "vendor-a-z", []);

      expect(sorted.map((a) => a.id)).toEqual(["2", "1"]);
    });
  });

  it("does not mutate the input array", () => {
    const apps = [
      makeApp({ id: "z-old", appName: "Zeta", createdDate: OLD }),
      makeApp({ id: "a-new", appName: "Alpha", createdDate: RECENT }),
    ];
    const original = [...apps];

    sortListedApps(apps, undefined, []);

    expect(apps).toEqual(original);
  });
});
