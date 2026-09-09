import { describe, expect, it } from "vitest";
import {
  buildEntityNameMap,
  buildUserRolesMap,
} from "~/components/AdminRoles/adminUseQueries";
import type { RoleT } from "~/components/AdminRoles/types";
import type { EntityMapItem } from "~/types/entity.type";

describe("buildEntityNameMap", () => {
  it("maps permission-group uuid to its name", () => {
    const items = [
      { uuid: "u1", name: "Trial" },
      { uuid: "u2", name: "Administrator" },
    ] as EntityMapItem[];

    const map = buildEntityNameMap(items);

    expect(map.get("u1")).toBe("Trial");
    expect(map.get("u2")).toBe("Administrator");
    expect(map.get("missing")).toBeUndefined();
  });

  it("returns an empty map for no items", () => {
    expect(buildEntityNameMap([]).size).toBe(0);
  });
});

describe("buildUserRolesMap", () => {
  const roles = [
    { uuid: "r1", name: "Analyst", users: ["a@x.com", "b@x.com"] },
    { uuid: "r2", name: "Trader", users: ["a@x.com"] },
    { uuid: "r3", name: "Admin", users: [] },
  ] as RoleT[];

  it("collects every role a user belongs to, preserving order", () => {
    const map = buildUserRolesMap(roles);

    expect(map.get("a@x.com")).toEqual(["Analyst", "Trader"]);
    expect(map.get("b@x.com")).toEqual(["Analyst"]);
  });

  it("omits users that belong to no role", () => {
    expect(buildUserRolesMap(roles).get("c@x.com")).toBeUndefined();
  });

  it("returns an empty map for no roles", () => {
    expect(buildUserRolesMap([]).size).toBe(0);
  });
});
