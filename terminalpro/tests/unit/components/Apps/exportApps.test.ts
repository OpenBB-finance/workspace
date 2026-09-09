import { beforeEach, describe, expect, it, vi } from "vitest";
import type { App } from "~/components/Apps/adminApps";
import { buildAppExportRows, exportAppsToFile } from "~/components/Apps/exportApps";

const makeApp = (over: Partial<App> = {}): App => ({
  uuid: "a1",
  name: "Risk App",
  url: "https://risk.example.com",
  user_uuid: "u1",
  user_email: "alice@example.com",
  created_date: "2026-01-01T10:00:00Z",
  updated_date: "2026-02-01T10:00:00Z",
  ...over,
});

describe("buildAppExportRows", () => {
  it("maps apps to export records with formatted dates", () => {
    const rows = buildAppExportRows([makeApp()]);
    expect(rows[0]).toMatchObject({
      Name: "Risk App",
      URL: "https://risk.example.com",
      "User Email": "alice@example.com",
    });
    expect(rows[0]["Created Date"]).toMatch(/2026/);
    expect(rows[0]["Last Updated"]).toMatch(/2026/);
  });
});

describe("exportAppsToFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a CSV with the Excel-locale sep=; prefix", async () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await exportAppsToFile(buildAppExportRows([makeApp()]), "apps", "csv");

    const parts = blobSpy.mock.calls.at(-1)?.[0] as BlobPart[];
    const content = String(parts?.[0]);
    expect(content.startsWith("sep=;")).toBe(true);
    expect(content).toContain("Risk App");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("downloads an XLSX for the xls format", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await exportAppsToFile(buildAppExportRows([makeApp()]), "apps", "xls");

    expect(clickSpy).toHaveBeenCalled();
  });
});
