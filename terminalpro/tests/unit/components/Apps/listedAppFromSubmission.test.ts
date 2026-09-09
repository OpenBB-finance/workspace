import { describe, expect, it } from "vitest";
import { submissionToListedApp } from "~/components/Apps/listedAppFromSubmission";
import type { MarketplaceSubmission } from "~/types/marketplaceSubmission";

function makeSubmission(
  formOverrides: Partial<MarketplaceSubmission["form"]> = {},
): MarketplaceSubmission {
  return {
    id: "sub-1",
    backendUrl: "https://api.acme.com",
    widgetCount: 3,
    version: "1",
    status: "pending",
    form: {
      appName: "Acme Options",
      vendorName: "Acme",
      vendorWebsiteUrl: "https://acme.com",
      vendorDescription: "Acme builds options analytics.",
      vendorThumbnailUrl: "https://acme.com/logo.png",
      tagline: "Options flow",
      category: "Crypto",
      description: "Real-time options analytics.",
      thumbnail: "https://cdn.acme.com/cover.png",
      documentationUrl: "https://docs.acme.com",
      contactEmail: "dev@acme.com",
      screenshots: ["https://cdn.acme.com/s1.png"],
      authEnabled: false,
      authMode: "api_key",
      authAllowAnonymous: false,
      authFields: [],
      mcpEnabled: false,
      mcpName: "",
      mcpUrl: "",
      mcpDescription: "",
      mcpAuthType: "oauth",
      ...formOverrides,
    },
    createdDate: "2026-01-01T00:00:00.000Z",
    updatedDate: "2026-01-01T00:00:00.000Z",
  };
}

describe("submissionToListedApp", () => {
  it("leaves authType/authFields undefined when auth is off", () => {
    const listed = submissionToListedApp(makeSubmission());
    expect(listed.authType).toBeUndefined();
    expect(listed.authFields).toBeUndefined();
  });

  it("threads auth_type for api_key with anonymous", () => {
    const listed = submissionToListedApp(
      makeSubmission({
        authEnabled: true,
        authMode: "api_key",
        authAllowAnonymous: true,
      }),
    );
    expect(listed.authType).toEqual(["none", "api_key"]);
    expect(listed.authFields).toBeUndefined();
  });

  it("threads custom auth fields when mode is custom", () => {
    const listed = submissionToListedApp(
      makeSubmission({
        authEnabled: true,
        authMode: "custom",
        authAllowAnonymous: false,
        authFields: [{ label: "API Key", key: "Authorization", prefix: "Bearer " }],
      }),
    );
    expect(listed.authType).toEqual(["custom"]);
    expect(listed.authFields).toEqual([
      {
        id: "api_key",
        label: "API Key",
        key: "Authorization",
        prefix: "Bearer ",
      },
    ]);
  });

  it("threads none auth", () => {
    const listed = submissionToListedApp(
      makeSubmission({
        authEnabled: true,
        authMode: "none",
      }),
    );
    expect(listed.authType).toEqual(["none"]);
    expect(listed.authFields).toBeUndefined();
  });

  it("threads an enabled mcp server into the preview", () => {
    const listed = submissionToListedApp(
      makeSubmission({
        mcpEnabled: true,
        mcpName: "  Acme MCP  ",
        mcpUrl: "  https://mcp.acme.com/mcp  ",
        mcpDescription: "  Query Acme data  ",
        mcpAuthType: "token",
      }),
    );
    expect(listed.mcpServers).toEqual([
      {
        name: "Acme MCP",
        url: "https://mcp.acme.com/mcp",
        description: "Query Acme data",
        authType: "token",
      },
    ]);
  });

  it("leaves mcpServers undefined when the section is off", () => {
    expect(submissionToListedApp(makeSubmission({})).mcpServers).toBeUndefined();
  });
});
