import { beforeEach, describe, expect, it, vi } from "vitest";
import { autoAddMcpForApp } from "~/components/Apps/ListedAppsTab";
import { autoRegisterMcpForSource, type Source } from "~/lib/state/backendConnector";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import type { ListedApp } from "~/types/listedApps";

vi.mock("~/api/auth.api", () => ({
  postMCPServers: vi.fn().mockResolvedValue({}),
}));

beforeEach(() => {
  useMcpToolsStore.setState({ servers: [], mcpConnectionRegistry: {} });
});

describe("autoAddMcpForApp authType propagation", () => {
  it("marks the auto-added server with the app's mcpServers authType", async () => {
    const app: ListedApp = {
      id: "app-token",
      vendorName: "Acme",
      appName: "Acme",
      description: "",
      backendUrl: "",
      thumbnail: "",
      widgets: [],
      mcpServers: [
        { name: "Acme MCP", url: "https://acme.example.com/mcp", authType: "token" },
      ],
    };

    await autoAddMcpForApp(app);

    const servers = useMcpToolsStore.getState().servers;
    expect(servers).toHaveLength(1);
    expect(servers[0].authType).toBe("token");
    expect(servers[0].vendorAppUuid).toBe("app-token");
  });

  it("leaves authType undefined for an OAuth (no authType) app", async () => {
    const app: ListedApp = {
      id: "app-oauth",
      vendorName: "Acme",
      appName: "Acme",
      description: "",
      backendUrl: "",
      thumbnail: "",
      widgets: [],
      mcpServers: [{ name: "Acme MCP", url: "https://acme.example.com/mcp" }],
    };

    await autoAddMcpForApp(app);

    const servers = useMcpToolsStore.getState().servers;
    expect(servers).toHaveLength(1);
    expect(servers[0].authType).toBeUndefined();
  });
});

describe("autoRegisterMcpForSource authType propagation", () => {
  it("marks the auto-registered server with the template's mcpServers authType", () => {
    const source = {
      id: "source-1",
      name: "Custom Backend",
      url: "https://custom.example.com",
      uuid: "u-1",
      endpointHeaders: null,
      templates: [
        {
          name: "Tpl",
          tabs: {},
          mcpServers: [
            {
              name: "Custom MCP",
              url: "https://custom.example.com/mcp",
              authType: "token" as const,
            },
          ],
        },
      ],
    } as unknown as Source;

    autoRegisterMcpForSource(source);

    const servers = useMcpToolsStore.getState().servers;
    expect(servers).toHaveLength(1);
    expect(servers[0].authType).toBe("token");
    expect(servers[0].sourceId).toBe("source-1");
  });
});

/**
 * A token-auth server has no OAuth fallback: `useMcp` fails the connection
 * outright on a 401 instead of prompting. Auto-connecting one before the user
 * has supplied a token therefore guarantees a failed server in the AI tab, so
 * registration has to leave it disabled until a token exists.
 */
describe("token-auth servers are not auto-connected without a token", () => {
  function makeApp(authType?: "oauth" | "token"): ListedApp {
    return {
      id: "app-1",
      vendorName: "Acme",
      appName: "Acme",
      description: "",
      backendUrl: "",
      thumbnail: "",
      widgets: [],
      mcpServers: [
        {
          name: "Acme MCP",
          url: "https://acme.example.com/mcp",
          ...(authType && { authType }),
        },
      ],
    };
  }

  function makeSource(
    authType: "oauth" | "token" | undefined,
    endpointHeaders: unknown = null,
  ) {
    return {
      id: "source-1",
      name: "Custom Backend",
      url: "https://custom.example.com",
      uuid: "u-1",
      endpointHeaders,
      templates: [
        {
          name: "Tpl",
          tabs: {},
          mcpServers: [
            {
              name: "Custom MCP",
              url: "https://custom.example.com/mcp",
              ...(authType && { authType }),
            },
          ],
        },
      ],
    } as unknown as Source;
  }

  it("registers a marketplace token-auth server disabled", async () => {
    await autoAddMcpForApp(makeApp("token"));
    expect(useMcpToolsStore.getState().servers[0].enabled).toBe(false);
  });

  it("still auto-connects a marketplace OAuth server", async () => {
    await autoAddMcpForApp(makeApp());
    expect(useMcpToolsStore.getState().servers[0].enabled).toBe(true);
  });

  it("still auto-connects a marketplace server that declares oauth explicitly", async () => {
    await autoAddMcpForApp(makeApp("oauth"));
    expect(useMcpToolsStore.getState().servers[0].enabled).toBe(true);
  });

  it("registers a custom-backend token-auth server disabled", () => {
    autoRegisterMcpForSource(makeSource("token"));
    expect(useMcpToolsStore.getState().servers[0].enabled).toBe(false);
  });

  it("still auto-connects a custom-backend OAuth server", () => {
    autoRegisterMcpForSource(makeSource(undefined));
    expect(useMcpToolsStore.getState().servers[0].enabled).toBe(true);
  });

  it("auto-connects a token-auth server when the source already supplies an Authorization header", () => {
    autoRegisterMcpForSource(
      makeSource("token", [
        { key: "Authorization", value: "Bearer abc", location: "headers" },
      ]),
    );
    const server = useMcpToolsStore.getState().servers[0];
    expect(server.customHeaders?.Authorization).toBe("Bearer abc");
    expect(server.enabled).toBe(true);
  });
});
