import { describe, expect, it } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import { adminAppToListedApp } from "~/components/AdminMarketplace/adminAppToListedApp";

function makeAdminApp(overrides: Partial<AdminApp> = {}): AdminApp {
  return {
    id: "app-1",
    vendor_id: "v-1",
    vendor_name: "JoseCompany",
    name: "Options Flow Scanner",
    version: "2",
    short_description: "Live odds from prediction markets",
    category: "Prediction Markets",
    tagline: "Live odds, Real markets",
    thumbnail_url: "https://cdn.example/thumb.png",
    thumbnail_url_dark: "https://cdn.example/thumb-dark.png",
    thumbnail_url_light: "https://cdn.example/thumb-light.png",
    media: ["https://cdn.example/shot1.png"],
    screenshots: ["https://cdn.example/shot1.png"],
    api_key_url: "https://example.com/keys",
    api_key_info_url: null,
    more_information_url: "https://example.com/docs",
    backend_base_url: "https://openbb-poly.workers.dev",
    apps_json_url: "https://openbb-poly.workers.dev/apps.json",
    widgets_json_url: "https://openbb-poly.workers.dev/widgets.json",
    is_built_in: false,
    auth_type: ["api_key"],
    auth_fields: null,
    status: "development",
    created_date: "2026-01-01T00:00:00Z",
    updated_date: "2026-01-02T00:00:00Z",
    last_fetched_at: null,
    last_fetch_status: "ok",
    last_fetch_error: null,
    last_verified_at: null,
    rejection_reason: null,
    widgets_count: 21,
    prompts_count: 0,
    mcp_servers: null,
    verification: null,
    ...overrides,
  };
}

describe("adminAppToListedApp", () => {
  it("maps core listing fields from AdminApp", () => {
    const listed = adminAppToListedApp(makeAdminApp());

    expect(listed).toMatchObject({
      id: "app-1",
      appName: "Options Flow Scanner",
      vendorName: "JoseCompany",
      description: "Live odds from prediction markets",
      backendUrl: "https://openbb-poly.workers.dev",
      thumbnail: "https://cdn.example/thumb.png",
      thumbnailDark: "https://cdn.example/thumb-dark.png",
      thumbnailLight: "https://cdn.example/thumb-light.png",
      category: "Prediction Markets",
      tagline: "Live odds, Real markets",
      documentationUrl: "https://example.com/docs",
      apiKeyUrl: "https://example.com/keys",
      authType: ["api_key"],
      isBuiltIn: false,
      version: "2",
      media: ["https://cdn.example/shot1.png"],
      screenshots: ["https://cdn.example/shot1.png"],
      totalWidgets: 21,
    });
  });

  it("stubs widget entries to drive count badges", () => {
    const listed = adminAppToListedApp(makeAdminApp({ widgets_count: 3 }));
    expect(listed.widgets).toHaveLength(3);
    expect(listed.totalWidgets).toBe(3);
  });

  it("handles null optional fields without inventing vendor profile data", () => {
    const listed = adminAppToListedApp(
      makeAdminApp({
        short_description: null,
        category: null,
        tagline: null,
        thumbnail_url: null,
        thumbnail_url_dark: null,
        thumbnail_url_light: null,
        backend_base_url: null,
        more_information_url: null,
        api_key_url: null,
        media: [],
        screenshots: [],
        widgets_count: null,
        prompts_count: null,
        auth_type: null,
      }),
    );

    expect(listed.description).toBe("");
    expect(listed.backendUrl).toBe("");
    expect(listed.thumbnail).toBe("");
    expect(listed.category).toBeUndefined();
    expect(listed.tagline).toBeUndefined();
    expect(listed.documentationUrl).toBeUndefined();
    expect(listed.apiKeyUrl).toBeUndefined();
    expect(listed.vendorWebsiteUrl).toBeUndefined();
    expect(listed.vendorDescription).toBeUndefined();
    expect(listed.vendorThumbnailUrl).toBeUndefined();
    expect(listed.contactEmail).toBeUndefined();
    expect(listed.widgets).toEqual([]);
    expect(listed.totalWidgets).toBe(0);
  });

  it("threads MCP servers so the modal preview shows the same block users get", () => {
    const listed = adminAppToListedApp(
      makeAdminApp({
        mcp_servers: [
          {
            name: "POLY MCP",
            description: "OADA",
            url: "https://mcp.example.com/mcp",
            authType: "token",
          },
        ],
      }),
    );

    expect(listed.mcpServers).toEqual([
      {
        name: "POLY MCP",
        description: "OADA",
        url: "https://mcp.example.com/mcp",
        authType: "token",
      },
    ]);
  });

  it("leaves mcpServers undefined when the backend sends none", () => {
    expect(adminAppToListedApp(makeAdminApp()).mcpServers).toBeUndefined();
    expect(
      adminAppToListedApp(makeAdminApp({ mcp_servers: [] })).mcpServers,
    ).toBeUndefined();
  });
});
