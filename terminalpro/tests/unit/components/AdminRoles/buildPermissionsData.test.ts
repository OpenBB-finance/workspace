import { describe, expect, it } from "vitest";
import type { EntityRolePermissions } from "~/api/entity_roles.api";
import { buildPermissionsData } from "~/components/AdminRoles/EditPermissionsDialog";
import type { ElementType } from "~/lib/contexts/MyDataConnectorsContext";

// Minimal connector universe: one backend with one widget.
const elemsDc = [
  {
    type: "backend",
    items: [
      {
        uuid: "b1",
        id: "b1",
        name: "Backend A",
        description: "",
        status: "success",
        widgets: [{ widgetId: "w1", id: "w1", name: "Widget 1", description: "" }],
      },
    ],
  },
] as unknown as ElementType[];

const rolePerms = (access: "access" | "no-access"): EntityRolePermissions[] => [
  {
    uuid: "b1",
    access,
    category: "data-connectors",
    type: "backend",
    widgets: [{ widgetId: "w1", access }],
    file_extension: null,
  },
];

const backendOf = (data: ReturnType<typeof buildPermissionsData>) =>
  data["data-connectors"].find((item) => item.uuid === "b1");

describe("buildPermissionsData", () => {
  it("overlays a role's granted access onto the connector tree", () => {
    const backend = backendOf(buildPermissionsData(elemsDc, [], rolePerms("access")));
    expect(backend?.access).toBe("access");
    expect(backend?.widgets?.find((w) => w.uuid === "b1:::w1")?.access).toBe("access");
  });

  it("reflects a different role's access (switching roles re-hydrates the tree)", () => {
    const backend = backendOf(
      buildPermissionsData(elemsDc, [], rolePerms("no-access")),
    );
    expect(backend?.access).toBe("no-access");
    expect(backend?.widgets?.find((w) => w.uuid === "b1:::w1")?.access).toBe(
      "no-access",
    );
  });

  it("resets to a clean tree for a role with no permissions (no stale access)", () => {
    // Regression: an empty role must not keep the previously selected role's access.
    const backend = backendOf(buildPermissionsData(elemsDc, [], []));
    expect(backend?.access).toBeUndefined();
    expect(backend?.widgets?.find((w) => w.uuid === "b1:::w1")?.access).toBeUndefined();
  });
});
