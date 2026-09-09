import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildUserExportRows,
  exportUsersToFile,
} from "~/components/AdminUsers/exportUsers";
import type { User } from "~/types/user.type";

const makeUser = (over: Partial<User> = {}): User => ({
  uuid: "u1",
  first_name: "Alice",
  last_name: "Anderson",
  email: "alice@example.com",
  role: "",
  billing_active: true,
  pro_entitlements: {} as User["pro_entitlements"],
  status: "active",
  last_login: "2026-01-01T10:00:00Z",
  last_active: "2026-02-01T10:00:00Z",
  permissions_uuid: "p1",
  source: "user" as User["source"],
  renewed: false,
  ...over,
});

describe("buildUserExportRows", () => {
  it("maps users to export records with derived values", () => {
    const entityNameMap = new Map([["p1", "Admin Plan"]]);
    const userRolesMap = new Map([["alice@example.com", ["Analyst", "Viewer"]]]);

    const rows = buildUserExportRows([makeUser()], entityNameMap, userRolesMap);

    expect(rows[0]).toEqual({
      Name: "Alice Anderson",
      Email: "alice@example.com",
      Type: "Admin Plan",
      Roles: "Analyst, Viewer",
      Status: "active",
      "Billing Status": "true",
      "Last Active": "2026-02-01T10:00:00Z",
      "Last Log in": "2026-01-01T10:00:00Z",
    });
  });

  it("falls back to '-'/empty for unknown type, roles and dates", () => {
    const rows = buildUserExportRows(
      [makeUser({ last_active: null, last_login: null, billing_active: false })],
      new Map(),
      new Map(),
    );

    expect(rows[0].Type).toBe("-");
    expect(rows[0].Roles).toBe("");
    expect(rows[0]["Last Active"]).toBe("");
    expect(rows[0]["Last Log in"]).toBe("");
    expect(rows[0]["Billing Status"]).toBe("false");
  });
});

describe("exportUsersToFile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("downloads a CSV with the Excel-locale sep=; prefix", async () => {
    const blobSpy = vi.spyOn(globalThis, "Blob");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const rows = buildUserExportRows([makeUser()], new Map(), new Map());
    await exportUsersToFile(rows, "report", "csv");

    const parts = blobSpy.mock.calls.at(-1)?.[0] as BlobPart[];
    const content = String(parts?.[0]);
    expect(content.startsWith("sep=;")).toBe(true);
    expect(content).toContain("Alice Anderson");
    expect(clickSpy).toHaveBeenCalled();
  });

  it("downloads an XLSX for the xls format", async () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    const rows = buildUserExportRows([makeUser()], new Map(), new Map());
    await exportUsersToFile(rows, "myreport", "xls");

    expect(clickSpy).toHaveBeenCalled();
  });
});
