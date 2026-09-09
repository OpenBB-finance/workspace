import { describe, expect, it } from "vitest";
import { resolveActiveWorkspaceDashboardId } from "~/components/AI/hooks/useActiveWorkspaceDashboardId";

describe("resolveActiveWorkspaceDashboardId", () => {
  const sideBarItems = {
    "11111111-1111-4111-8111-111111111111": { data: { name: "Route Dashboard" } },
    "22222222-2222-4222-8222-222222222222": { data: { name: "Sidebar Dashboard" } },
    "33333333-3333-4333-8333-333333333333": { data: { name: "History Dashboard" } },
  };

  it("prefers a valid route dashboard id", () => {
    expect(
      resolveActiveWorkspaceDashboardId(
        "/app/11111111-1111-4111-8111-111111111111",
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
        sideBarItems,
      ),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("prefers the active dashboard pathname when available", () => {
    expect(
      resolveActiveWorkspaceDashboardId(
        "/app/11111111-1111-4111-8111-111111111111",
        "",
        "22222222-2222-4222-8222-222222222222",
        sideBarItems,
      ),
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("trusts the active dashboard pathname before sidebar hydration", () => {
    expect(
      resolveActiveWorkspaceDashboardId(
        "/app/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "",
        "22222222-2222-4222-8222-222222222222",
        {},
      ),
    ).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("falls back to the sidebar active item when the route id is unavailable", () => {
    expect(
      resolveActiveWorkspaceDashboardId(
        "/app",
        "",
        "22222222-2222-4222-8222-222222222222",
        sideBarItems,
      ),
    ).toBe("22222222-2222-4222-8222-222222222222");
  });

  it("returns an empty string when no dashboard context is available", () => {
    expect(resolveActiveWorkspaceDashboardId("/app", "", "", sideBarItems)).toBe("");
  });
});
