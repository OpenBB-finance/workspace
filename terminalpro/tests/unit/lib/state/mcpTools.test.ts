/**
 * Tests for mcpTools Zustand store
 *
 * Tests the MCP tools state management including:
 * - Server management (add, remove, update, toggle)
 * - Tool management (toggle, bulk toggle)
 * - Connection registry management
 * - Enabled tool count tracking
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { postMCPServers } from "~/api/auth.api";
import {
  dedupeIframeServersByUrl,
  type McpConnection,
  type McpServer,
  useMcpToolsStore,
} from "~/lib/state/mcpTools";

// Mock the API calls
vi.mock("~/api/auth.api", () => ({
  postMCPServers: vi.fn().mockResolvedValue({}),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: `server-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Server",
  url: "https://test.example.com",
  enabled: true,
  toolsEnabled: false,
  tools: [],
  ...overrides,
});

const createMockConnection = (
  overrides: Partial<McpConnection> = {},
): McpConnection => ({
  callTool: undefined,
  error: undefined,
  state: "disconnected",
  tools: [],
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
  ...overrides,
});

describe("useMcpToolsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    act(() => {
      useMcpToolsStore.setState({
        servers: [],
        mcpConnectionRegistry: {},
      });
    });
  });

  describe("initial state", () => {
    it("should have empty servers initially", () => {
      const state = useMcpToolsStore.getState();
      expect(state.servers).toEqual([]);
    });

    it("should have empty connection registry initially", () => {
      const state = useMcpToolsStore.getState();
      expect(state.mcpConnectionRegistry).toEqual({});
    });
  });

  describe("updateServers", () => {
    it("should update servers", () => {
      const servers = [createMockServer({ id: "server-1", name: "Server 1" })];

      act(() => {
        useMcpToolsStore.getState().updateServers(servers);
      });

      expect(useMcpToolsStore.getState().servers).toHaveLength(1);
      expect(useMcpToolsStore.getState().servers[0].name).toBe("Server 1");
    });

    it("should initialize connection registry for new servers", () => {
      const servers = [createMockServer({ id: "server-1" })];

      act(() => {
        useMcpToolsStore.getState().updateServers(servers);
      });

      const registry = useMcpToolsStore.getState().mcpConnectionRegistry;
      expect(registry["server-1"]).toBeDefined();
      expect(registry["server-1"].state).toBe("disconnected");
    });

    it("should preserve existing connections when updating servers", () => {
      const mockConnection = createMockConnection({ state: "ready" });

      act(() => {
        useMcpToolsStore.setState({
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      const servers = [createMockServer({ id: "server-1" })];

      act(() => {
        useMcpToolsStore.getState().updateServers(servers);
      });

      const registry = useMcpToolsStore.getState().mcpConnectionRegistry;
      expect(registry["server-1"].state).toBe("ready");
    });

    it("should ignore persisted iframe widget servers and preserve active local ones", () => {
      const iframeServer = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [iframeServer] });
      });

      act(() => {
        useMcpToolsStore.getState().updateServers([
          createMockServer({ id: "server-1" }),
          createMockServer({
            id: "stale-iframe-server",
            iframeWidgetId: "widget-2",
          }),
        ]);
      });

      expect(useMcpToolsStore.getState().servers.map((s) => s.id)).toEqual([
        "server-1",
        "iframe-server-1",
      ]);
    });
  });

  describe("addServer", () => {
    it("should add a new server", () => {
      const server = createMockServer({ id: "new-server", name: "New Server" });

      act(() => {
        useMcpToolsStore.getState().addServer(server);
      });

      const servers = useMcpToolsStore.getState().servers;
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe("new-server");
    });

    it("should set toolsEnabled to undefined for new servers", () => {
      const server = createMockServer({ toolsEnabled: true });

      act(() => {
        useMcpToolsStore.getState().addServer(server);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBeUndefined();
    });

    it("should upsert iframe widget servers by widget id", () => {
      const firstServer = createMockServer({
        id: "iframe-mcp-first",
        iframeWidgetId: "widget-1",
        url: "https://first.example.com/mcp",
        tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
      });
      const secondServer = createMockServer({
        id: "iframe-mcp-second",
        iframeWidgetId: "widget-1",
        url: "https://second.example.com/mcp",
        tools: [],
      });

      act(() => {
        useMcpToolsStore.getState().addServer(firstServer);
        useMcpToolsStore.getState().addServer(secondServer);
      });

      const servers = useMcpToolsStore.getState().servers;
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe("iframe-mcp-first");
      expect(servers[0].url).toBe("https://second.example.com/mcp");
      expect(servers[0].tools).toHaveLength(1);
      expect(servers[0].toolsEnabled).toBe(true);
    });
  });

  describe("removeServer", () => {
    it("should remove a server", () => {
      const server = createMockServer({ id: "to-remove" });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().removeServer("to-remove");
      });

      expect(useMcpToolsStore.getState().servers).toHaveLength(0);
    });

    it("should disconnect and clear storage when removing server", () => {
      const mockDisconnect = vi.fn();
      const mockClearStorage = vi.fn();
      const mockConnection = createMockConnection({
        disconnect: mockDisconnect,
        clearStorage: mockClearStorage,
      });
      const server = createMockServer({ id: "server-1" });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      act(() => {
        useMcpToolsStore.getState().removeServer("server-1");
      });

      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockClearStorage).toHaveBeenCalled();
    });

    it("should preserve auth storage when removing a transient server", () => {
      const mockDisconnect = vi.fn();
      const mockClearStorage = vi.fn();
      const mockConnection = createMockConnection({
        disconnect: mockDisconnect,
        clearStorage: mockClearStorage,
      });
      const server = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
      });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "iframe-server-1": mockConnection },
        });
      });

      act(() => {
        useMcpToolsStore
          .getState()
          .removeServer("iframe-server-1", { clearStorage: false });
      });

      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockClearStorage).not.toHaveBeenCalled();
    });

    it("should not throw when removing non-existent server", () => {
      expect(() => {
        act(() => {
          useMcpToolsStore.getState().removeServer("non-existent");
        });
      }).not.toThrow();
    });
  });

  describe("saveMCPServers", () => {
    it("should not persist iframe widget servers as user MCP servers", async () => {
      const regularServer = createMockServer({ id: "server-1" });
      const iframeServer = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [regularServer, iframeServer] });
      });

      await useMcpToolsStore.getState().saveMCPServers();

      expect(postMCPServers).toHaveBeenCalledWith([regularServer]);
    });

    it("should not save when removing an iframe widget server", () => {
      const iframeServer = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [iframeServer] });
      });

      act(() => {
        useMcpToolsStore.getState().removeServer("iframe-server-1");
      });

      expect(postMCPServers).not.toHaveBeenCalled();
    });
  });

  describe("updateServer", () => {
    it("should update server properties", () => {
      const server = createMockServer({ id: "server-1", name: "Original" });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().updateServer("server-1", { name: "Updated" });
      });

      expect(useMcpToolsStore.getState().servers[0].name).toBe("Updated");
    });

    it("should disconnect server when disabling", () => {
      const mockDisconnect = vi.fn();
      const mockConnection = createMockConnection({
        state: "ready",
        disconnect: mockDisconnect,
      });
      const server = createMockServer({ id: "server-1", enabled: true });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      act(() => {
        useMcpToolsStore.getState().updateServer("server-1", { enabled: false });
      });

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("should retry connection when enabling failed server", () => {
      const mockRetry = vi.fn();
      const mockConnection = createMockConnection({
        state: "failed",
        retry: mockRetry,
      });
      const server = createMockServer({ id: "server-1", enabled: false });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      act(() => {
        useMcpToolsStore.getState().updateServer("server-1", { enabled: true });
      });

      expect(mockRetry).toHaveBeenCalled();
    });
  });

  describe("toggleServerTools", () => {
    it("should toggle toolsEnabled when no enableAll provided", () => {
      const server = createMockServer({
        id: "server-1",
        toolsEnabled: false,
        tools: [{ id: "tool-1", name: "Tool 1", enabled: false }],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleServerTools("server-1");
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(true);
    });

    it("should enable all tools when enableAll is true", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [
          { id: "tool-1", name: "Tool 1", enabled: false },
          { id: "tool-2", name: "Tool 2", enabled: false },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleServerTools("server-1", true);
      });

      const tools = useMcpToolsStore.getState().servers[0].tools;
      expect(tools.every((t) => t.enabled)).toBe(true);
    });

    it("should disable all tools when enableAll is false", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [
          { id: "tool-1", name: "Tool 1", enabled: true },
          { id: "tool-2", name: "Tool 2", enabled: true },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleServerTools("server-1", false);
      });

      const tools = useMcpToolsStore.getState().servers[0].tools;
      expect(tools.every((t) => !t.enabled)).toBe(true);
    });

    it("should allow iframe widget tools to be bulk disabled without persisting", () => {
      const server = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
        toolsEnabled: true,
        tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleServerTools("iframe-server-1", false);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(false);
      expect(useMcpToolsStore.getState().servers[0].tools[0].enabled).toBe(false);
      expect(postMCPServers).not.toHaveBeenCalled();
    });
  });

  describe("toggleTool", () => {
    it("should toggle individual tool", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [{ id: "tool-1", name: "Tool 1", enabled: false }],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", "tool-1");
      });

      expect(useMcpToolsStore.getState().servers[0].tools[0].enabled).toBe(true);
    });

    it("should toggle multiple tools at once", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [
          { id: "tool-1", name: "Tool 1", enabled: false },
          { id: "tool-2", name: "Tool 2", enabled: false },
          { id: "tool-3", name: "Tool 3", enabled: true },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", ["tool-1", "tool-2"], true);
      });

      const tools = useMcpToolsStore.getState().servers[0].tools;
      expect(tools[0].enabled).toBe(true);
      expect(tools[1].enabled).toBe(true);
      expect(tools[2].enabled).toBe(true); // unchanged
    });

    it("should set specific enable state when provided", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", "tool-1", false);
      });

      expect(useMcpToolsStore.getState().servers[0].tools[0].enabled).toBe(false);
    });

    it("should update regular server toolsEnabled from selected tools", () => {
      const server = createMockServer({
        id: "server-1",
        toolsEnabled: false,
        tools: [
          { id: "tool-1", name: "Tool 1", enabled: false },
          { id: "tool-2", name: "Tool 2", enabled: false },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", "tool-1", true);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(true);

      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", "tool-1", false);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(false);
    });

    it("should let generic tool toggles disable iframe widget tools", () => {
      const server = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
        toolsEnabled: true,
        tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().toggleTool("iframe-server-1", "tool-1", false);
      });

      expect(useMcpToolsStore.getState().servers[0].tools[0].enabled).toBe(false);
      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(false);
    });
  });

  describe("addToolsToServer", () => {
    it("should add new tools to server", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().addToolsToServer("server-1", [
          { id: "tool-1", name: "Tool 1", enabled: true },
          { id: "tool-2", name: "Tool 2", enabled: false },
        ]);
      });

      const tools = useMcpToolsStore.getState().servers[0].tools;
      expect(tools).toHaveLength(2);
    });

    it("should update existing tools while preserving enabled state", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [
          {
            id: "tool-1",
            name: "Tool 1",
            enabled: true,
            description: "old description",
          },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().addToolsToServer("server-1", [
          {
            id: "tool-1",
            name: "Tool 1 Updated",
            enabled: false,
            description: "new description",
          },
        ]);
      });

      const tool = useMcpToolsStore.getState().servers[0].tools[0];
      expect(tool.name).toBe("Tool 1 Updated");
      expect(tool.description).toBe("new description");
      expect(tool.enabled).toBe(true); // preserved
    });

    it("should preserve toolsEnabled for regular servers when adding tools", () => {
      const server = createMockServer({
        id: "server-1",
        toolsEnabled: false,
        tools: [],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore
          .getState()
          .addToolsToServer("server-1", [
            { id: "tool-1", name: "Tool 1", enabled: true },
          ]);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(false);
    });

    it("should preserve toolsEnabled for iframe widget servers when adding tools", () => {
      const server = createMockServer({
        id: "iframe-server-1",
        iframeWidgetId: "widget-1",
        toolsEnabled: false,
        tools: [],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore
          .getState()
          .addToolsToServer("iframe-server-1", [
            { id: "tool-1", name: "Tool 1", enabled: false },
          ]);
      });

      expect(useMcpToolsStore.getState().servers[0].toolsEnabled).toBe(false);
    });

    it("should dedupe repeated tool discovery by tool id", () => {
      const server = createMockServer({
        id: "server-1",
        tools: [],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().addToolsToServer("server-1", [
          { id: "tool-1", name: "Tool 1", enabled: true },
          { id: "tool-1", name: "Tool 1 Duplicate", enabled: true },
        ]);
        useMcpToolsStore
          .getState()
          .addToolsToServer("server-1", [
            { id: "tool-1", name: "Tool 1 Updated", enabled: true },
          ]);
      });

      const tools = useMcpToolsStore.getState().servers[0].tools;
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("Tool 1 Updated");
    });
  });

  describe("getServerById", () => {
    it("should return server with connection status", () => {
      const mockConnection = createMockConnection({ state: "ready" });
      const server = createMockServer({ id: "server-1", enabled: true });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      const result = useMcpToolsStore.getState().getServerById("server-1");

      expect(result).toBeDefined();
      expect(result?.connected).toBe(true);
    });

    it("should return undefined for non-existent server", () => {
      const result = useMcpToolsStore.getState().getServerById("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return connected: false when server is disabled", () => {
      const mockConnection = createMockConnection({ state: "ready" });
      const server = createMockServer({ id: "server-1", enabled: false });

      act(() => {
        useMcpToolsStore.setState({
          servers: [server],
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      const result = useMcpToolsStore.getState().getServerById("server-1");
      expect(result?.connected).toBe(false);
    });
  });

  describe("getMCPConnection", () => {
    it("should return connection for server", () => {
      const mockConnection = createMockConnection({ state: "ready" });

      act(() => {
        useMcpToolsStore.setState({
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      const result = useMcpToolsStore.getState().getMCPConnection("server-1");
      expect(result).toBe(mockConnection);
    });

    it("should return undefined for non-existent connection", () => {
      const result = useMcpToolsStore.getState().getMCPConnection("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("updateMCPConnectionRegistry", () => {
    it("should add connection to registry", () => {
      const mockConnection = createMockConnection({ state: "ready" });

      act(() => {
        useMcpToolsStore
          .getState()
          .updateMCPConnectionRegistry("server-1", mockConnection);
      });

      expect(
        useMcpToolsStore.getState().mcpConnectionRegistry["server-1"],
      ).toBeDefined();
    });

    it("should remove connection when remove flag is true", () => {
      const mockConnection = createMockConnection();

      act(() => {
        useMcpToolsStore.setState({
          mcpConnectionRegistry: { "server-1": mockConnection },
        });
      });

      act(() => {
        useMcpToolsStore
          .getState()
          .updateMCPConnectionRegistry("server-1", mockConnection, true);
      });

      expect(
        useMcpToolsStore.getState().mcpConnectionRegistry["server-1"],
      ).toBeUndefined();
    });
  });

  describe("getEnabledToolCount", () => {
    it("should return 0 when no tools are enabled", () => {
      const server = createMockServer({
        id: "server-1",
        enabled: true,
        toolsEnabled: true,
        tools: [
          { id: "tool-1", name: "Tool 1", enabled: false },
          { id: "tool-2", name: "Tool 2", enabled: false },
        ],
      });

      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(0);
    });

    it("should count only enabled tools from enabled and connected servers with toolsEnabled", () => {
      const servers = [
        createMockServer({
          id: "server-1",
          enabled: true,
          toolsEnabled: true,
          tools: [
            { id: "tool-1", name: "Tool 1", enabled: true },
            { id: "tool-2", name: "Tool 2", enabled: true },
          ],
        }),
        createMockServer({
          id: "server-2",
          enabled: false, // disabled server
          toolsEnabled: true,
          tools: [{ id: "tool-3", name: "Tool 3", enabled: true }],
        }),
        createMockServer({
          id: "server-3",
          enabled: true,
          toolsEnabled: false, // toolsEnabled is false
          tools: [{ id: "tool-4", name: "Tool 4", enabled: true }],
        }),
      ];

      // Set up connection registry with "ready" state for server-1 only
      const mcpConnectionRegistry = {
        "server-1": createMockConnection({ state: "ready" }),
        "server-2": createMockConnection({ state: "disconnected" }),
        "server-3": createMockConnection({ state: "ready" }),
      };

      act(() => {
        useMcpToolsStore.setState({ servers, mcpConnectionRegistry });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(2);
    });

    it("should count across multiple enabled and connected servers", () => {
      const servers = [
        createMockServer({
          id: "server-1",
          enabled: true,
          toolsEnabled: true,
          tools: [
            { id: "tool-1", name: "Tool 1", enabled: true },
            { id: "tool-2", name: "Tool 2", enabled: true },
          ],
        }),
        createMockServer({
          id: "server-2",
          enabled: true,
          toolsEnabled: true,
          tools: [
            { id: "tool-3", name: "Tool 3", enabled: true },
            { id: "tool-4", name: "Tool 4", enabled: false },
          ],
        }),
      ];

      // Set up connection registry with "ready" state for both servers
      const mcpConnectionRegistry = {
        "server-1": createMockConnection({ state: "ready" }),
        "server-2": createMockConnection({ state: "ready" }),
      };

      act(() => {
        useMcpToolsStore.setState({ servers, mcpConnectionRegistry });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(3);
    });

    it("should count duplicate iframe widget servers with the same url only once", () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true },
            { id: "iframe-tool-2", name: "Iframe Tool 2", enabled: true },
          ],
        }),
        createMockServer({
          id: "iframe-server-2",
          enabled: true,
          iframeWidgetId: "widget-2",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true },
            { id: "iframe-tool-2", name: "Iframe Tool 2", enabled: true },
          ],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
            "iframe-server-2": createMockConnection({ state: "ready" }),
          },
        });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(2);
    });

    it("should count a connected iframe duplicate when the first same-url server is disconnected", () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
        createMockServer({
          id: "iframe-server-2",
          enabled: true,
          iframeWidgetId: "widget-2",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "disconnected" }),
            "iframe-server-2": createMockConnection({ state: "ready" }),
          },
        });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(1);
    });

    it("should count selected iframe widget tools in the MCP tool count", () => {
      const servers = [
        createMockServer({
          id: "server-1",
          enabled: true,
          toolsEnabled: true,
          tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
        }),
        createMockServer({
          id: "iframe-server-1",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true },
            { id: "iframe-tool-2", name: "Iframe Tool 2", enabled: false },
          ],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "server-1": createMockConnection({ state: "ready" }),
            "iframe-server-1": createMockConnection({ state: "ready" }),
          },
        });
      });

      expect(useMcpToolsStore.getState().getEnabledToolCount()).toBe(2);
    });
  });

  describe("getEnabledToolsForAgent", () => {
    it("should include selected regular MCP tools and iframe widget tools", async () => {
      const servers = [
        createMockServer({
          id: "server-1",
          name: "Regular",
          enabled: true,
          toolsEnabled: true,
          tools: [
            { id: "tool-1", name: "Tool 1", enabled: true },
            { id: "tool-2", name: "Tool 2", enabled: false },
          ],
        }),
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "server-1": createMockConnection({ state: "ready" }),
            "iframe-server-1": createMockConnection({ state: "ready" }),
          },
        });
      });

      const tools = await useMcpToolsStore.getState().getEnabledToolsForAgent();

      expect(tools).toEqual([
        {
          server_id: "server-1",
          name: "Regular_tool-1",
          description: undefined,
          url: "https://test.example.com",
          input_schema: undefined,
        },
        {
          server_id: "iframe-server-1",
          name: "Widget_iframe-tool-1",
          description: "",
          url: "https://test.example.com",
          input_schema: undefined,
        },
      ]);
    });

    it("should include tools from duplicate iframe widget servers with the same url only once", async () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
        createMockServer({
          id: "iframe-server-2",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-2",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
            "iframe-server-2": createMockConnection({ state: "ready" }),
          },
        });
      });

      const tools = await useMcpToolsStore.getState().getEnabledToolsForAgent();

      expect(tools).toEqual([
        {
          server_id: "iframe-server-1",
          name: "Widget_iframe-tool-1",
          description: "",
          url: "https://widget.example.com/mcp",
          input_schema: undefined,
        },
      ]);
    });

    it("should set schema defaults and describe params when all widget copies agree", async () => {
      const inputSchema = {
        type: "object",
        properties: { symbol: { type: "string" }, interval: { type: "string" } },
      };
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          iframeParams: { symbol: "A", interval: "1d" },
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true, inputSchema },
          ],
        }),
        createMockServer({
          id: "iframe-server-2",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-2",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          iframeParams: { symbol: "A", interval: "1d" },
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true, inputSchema },
          ],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
            "iframe-server-2": createMockConnection({ state: "ready" }),
          },
        });
      });

      const tools = await useMcpToolsStore.getState().getEnabledToolsForAgent();

      expect(tools).toHaveLength(1);
      expect(tools[0].input_schema.properties.symbol.default).toBe("A");
      expect(tools[0].input_schema.properties.interval.default).toBe("1d");
      expect(tools[0].description).toContain("currently viewing");
      expect(tools[0].description).toContain("symbol=A, interval=1d");
      expect(tools[0].description).not.toContain("multiple copies");
    });

    it("should drop defaults and describe each copy's value when duplicate widgets diverge", async () => {
      const inputSchema = {
        type: "object",
        properties: { symbol: { type: "string" }, interval: { type: "string" } },
      };
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          iframeParams: { symbol: "A", interval: "1d" },
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true, inputSchema },
          ],
        }),
        createMockServer({
          id: "iframe-server-2",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-2",
          toolsEnabled: true,
          url: "https://widget.example.com/mcp",
          iframeParams: { symbol: "B", interval: "1d" },
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true, inputSchema },
          ],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
            "iframe-server-2": createMockConnection({ state: "ready" }),
          },
        });
      });

      const tools = await useMcpToolsStore.getState().getEnabledToolsForAgent();

      expect(tools).toHaveLength(1);
      expect(tools[0].server_id).toBe("iframe-server-1");
      // Diverging key must not silently inherit the first copy's value
      expect(tools[0].input_schema.properties.symbol.default).toBeUndefined();
      // Agreeing key keeps its default
      expect(tools[0].input_schema.properties.interval.default).toBe("1d");
      expect(tools[0].description).toContain("multiple copies");
      expect(tools[0].description).toContain("symbol=A / B");
      expect(tools[0].description).toContain("interval=1d");
    });

    it("should not include iframe widget tools when the iframe MCP server is disabled", async () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: false,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          tools: [{ id: "iframe-tool-1", name: "Iframe Tool 1", enabled: true }],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
          },
        });
      });

      await expect(
        useMcpToolsStore.getState().getEnabledToolsForAgent(),
      ).resolves.toEqual([]);
    });

    it("should not include unselected iframe widget tools", async () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          name: "Widget",
          enabled: true,
          iframeWidgetId: "widget-1",
          toolsEnabled: true,
          tools: [
            { id: "iframe-tool-1", name: "Iframe Tool 1", enabled: false },
            { id: "iframe-tool-2", name: "Iframe Tool 2", enabled: true },
          ],
        }),
      ];

      act(() => {
        useMcpToolsStore.setState({
          servers,
          mcpConnectionRegistry: {
            "iframe-server-1": createMockConnection({ state: "ready" }),
          },
        });
      });

      await expect(
        useMcpToolsStore.getState().getEnabledToolsForAgent(),
      ).resolves.toEqual([
        {
          server_id: "iframe-server-1",
          name: "Widget_iframe-tool-2",
          description: "",
          url: "https://test.example.com",
          input_schema: undefined,
        },
      ]);
    });
  });

  describe("dedupeIframeServersByUrl", () => {
    it("should drop duplicate iframe widget servers with the same url", () => {
      const servers = [
        createMockServer({
          id: "iframe-server-1",
          iframeWidgetId: "widget-1",
          url: "https://widget.example.com/mcp",
        }),
        createMockServer({
          id: "iframe-server-2",
          iframeWidgetId: "widget-2",
          url: "https://widget.example.com/mcp",
        }),
        createMockServer({
          id: "iframe-server-3",
          iframeWidgetId: "widget-3",
          url: "https://other.example.com/mcp",
        }),
      ];

      expect(dedupeIframeServersByUrl(servers).map((s) => s.id)).toEqual([
        "iframe-server-1",
        "iframe-server-3",
      ]);
    });

    it("should keep regular servers even when they share a url", () => {
      const servers = [
        createMockServer({ id: "server-1", url: "https://shared.example.com" }),
        createMockServer({ id: "server-2", url: "https://shared.example.com" }),
      ];

      expect(dedupeIframeServersByUrl(servers)).toHaveLength(2);
    });
  });

  describe("removeSourceServer", () => {
    it("should remove servers keyed by sourceId", () => {
      const servers = [
        createMockServer({ id: "s1", sourceId: "src-1", name: "A" }),
        createMockServer({ id: "s2", sourceId: "src-1", name: "B" }),
        createMockServer({ id: "s3", sourceId: "src-2", name: "C" }),
      ];

      act(() => {
        useMcpToolsStore.setState({ servers });
      });

      act(() => {
        useMcpToolsStore.getState().removeSourceServer("src-1");
      });

      const remaining = useMcpToolsStore.getState().servers;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe("s3");
    });

    it("should disconnect and clear registry for removed sourceId servers", () => {
      const mockDisconnect = vi.fn();
      const mockClearStorage = vi.fn();
      const conn = createMockConnection({
        disconnect: mockDisconnect,
        clearStorage: mockClearStorage,
      });

      act(() => {
        useMcpToolsStore.setState({
          servers: [createMockServer({ id: "s1", sourceId: "src-1" })],
          mcpConnectionRegistry: { s1: conn },
        });
      });

      act(() => {
        useMcpToolsStore.getState().removeSourceServer("src-1");
      });

      expect(mockDisconnect).toHaveBeenCalled();
      expect(mockClearStorage).toHaveBeenCalled();
      expect(useMcpToolsStore.getState().mcpConnectionRegistry.s1).toBeUndefined();
    });

    it("should be a no-op when no servers match the sourceId", () => {
      const servers = [createMockServer({ id: "s1", sourceId: "src-1" })];

      act(() => {
        useMcpToolsStore.setState({ servers });
      });

      act(() => {
        useMcpToolsStore.getState().removeSourceServer("nonexistent");
      });

      expect(useMcpToolsStore.getState().servers).toHaveLength(1);
    });
  });

  describe("complex interactions", () => {
    it("should handle full server lifecycle", () => {
      // Add server
      const server = createMockServer({ id: "server-1", name: "Test Server" });
      act(() => {
        useMcpToolsStore.getState().addServer(server);
      });
      expect(useMcpToolsStore.getState().servers).toHaveLength(1);

      // Add tools
      act(() => {
        useMcpToolsStore.getState().addToolsToServer("server-1", [
          { id: "tool-1", name: "Tool 1", enabled: true },
          { id: "tool-2", name: "Tool 2", enabled: false },
        ]);
      });
      expect(useMcpToolsStore.getState().servers[0].tools).toHaveLength(2);

      // Toggle tool
      act(() => {
        useMcpToolsStore.getState().toggleTool("server-1", "tool-2");
      });
      expect(useMcpToolsStore.getState().servers[0].tools[1].enabled).toBe(true);

      // Update server
      act(() => {
        useMcpToolsStore
          .getState()
          .updateServer("server-1", { name: "Updated Server" });
      });
      expect(useMcpToolsStore.getState().servers[0].name).toBe("Updated Server");

      // Remove server
      act(() => {
        useMcpToolsStore.getState().removeServer("server-1");
      });
      expect(useMcpToolsStore.getState().servers).toHaveLength(0);
    });
  });

  describe("disableServerAfterAuthCancel", () => {
    it("disables an enabled server and notifies the user", async () => {
      const server = createMockServer({ id: "server-1", enabled: true });
      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().disableServerAfterAuthCancel("server-1");
      });

      expect(useMcpToolsStore.getState().servers[0].enabled).toBe(false);
      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalled();
    });

    it("is a no-op for an already-disabled server", async () => {
      const server = createMockServer({ id: "server-1", enabled: false });
      act(() => {
        useMcpToolsStore.setState({ servers: [server] });
      });

      act(() => {
        useMcpToolsStore.getState().disableServerAfterAuthCancel("server-1");
      });

      const { toast } = await import("sonner");
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
