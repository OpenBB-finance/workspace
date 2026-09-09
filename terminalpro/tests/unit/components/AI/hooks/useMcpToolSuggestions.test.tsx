import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MCP_TOOL_TRIGGER,
  useMcpToolSuggestions,
} from "~/components/AI/hooks/useMcpToolSuggestions";

// --- Mocks ---

const mockServers = [
  {
    id: "server-1",
    name: "Financial Data",
    url: "https://api.financial.com",
    enabled: true,
    toolsEnabled: true,
    tools: [
      {
        id: "tool-1",
        name: "get_stock_price",
        description: "Get current stock price",
        enabled: true,
        inputSchema: { type: "object", properties: { symbol: { type: "string" } } },
      },
      {
        id: "tool-2",
        name: "get_market_data",
        description: "Get market data and trends",
        enabled: true,
        inputSchema: { type: "object" },
      },
      {
        id: "tool-3",
        name: "disabled_tool",
        description: "This tool is disabled",
        enabled: false,
        inputSchema: { type: "object" },
      },
    ],
  },
  {
    id: "server-2",
    name: "Open Data",
    url: "https://api.opendata.com",
    enabled: true,
    toolsEnabled: true,
    tools: [
      {
        id: "tool-4",
        name: "search_datasets",
        description: "Search available datasets",
        enabled: true,
        inputSchema: { type: "object" },
      },
    ],
  },
  {
    id: "server-3",
    name: "Disabled Server",
    url: "https://api.disabled.com",
    enabled: false,
    toolsEnabled: true,
    tools: [
      {
        id: "tool-5",
        name: "some_tool",
        description: "Tool on disabled server",
        enabled: true,
      },
    ],
  },
];

const mockGetMCPConnection = vi.fn((serverId: string) => {
  const server = mockServers.find((s) => s.id === serverId);
  if (!server || !server.enabled) return null;
  return { state: "ready" };
});

const mockUseShallowMcpToolsStore = vi.fn();

vi.mock("~/lib/state/mcpTools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/state/mcpTools")>();
  return {
    dedupeIframeServersByUrl: actual.dedupeIframeServersByUrl,
    useShallowMcpToolsStore: (selector: (state: unknown) => unknown) =>
      mockUseShallowMcpToolsStore(selector),
  };
});

// --- Tests ---

describe("useMcpToolSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset getMCPConnection to default behavior
    mockGetMCPConnection.mockImplementation((serverId: string) => {
      const server = mockServers.find((s) => s.id === serverId);
      if (!server || !server.enabled) return null;
      return { state: "ready" };
    });
    mockUseShallowMcpToolsStore.mockImplementation(
      (
        selector: (state: {
          servers: typeof mockServers;
          getMCPConnection: typeof mockGetMCPConnection;
        }) => unknown,
      ) =>
        selector({
          servers: mockServers,
          getMCPConnection: mockGetMCPConnection,
        }),
    );
  });

  describe("MCP_TOOL_TRIGGER constant", () => {
    it("exports the correct trigger character", () => {
      expect(MCP_TOOL_TRIGGER).toBe("/");
    });
  });

  describe("mcpToolOptions", () => {
    it("returns tools from enabled and connected servers", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      // Should have 3 tools: 2 from server-1 + 1 from server-2 (server-3 is disabled)
      expect(result.current.mcpToolOptions).toHaveLength(3);
    });

    it("excludes tools from disabled servers", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const toolServerNames = result.current.mcpToolOptions.map((t) => t.serverName);
      expect(toolServerNames).not.toContain("Disabled Server");
    });

    it("excludes disabled tools", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const toolNames = result.current.mcpToolOptions.map((t) => t.toolName);
      expect(toolNames).not.toContain("disabled_tool");
    });

    it("includes iframe widget tools in MCP tool suggestions", () => {
      mockUseShallowMcpToolsStore.mockImplementation(
        (
          selector: (state: {
            servers: typeof mockServers;
            getMCPConnection: typeof mockGetMCPConnection;
          }) => unknown,
        ) =>
          selector({
            servers: [
              ...mockServers,
              {
                id: "iframe-server-1",
                name: "Widget MCP",
                url: "https://widget.example.com/mcp",
                enabled: true,
                toolsEnabled: true,
                iframeWidgetId: "widget-1",
                tools: [
                  {
                    id: "iframe-tool-1",
                    name: "widget_tool",
                    description: "Widget-local tool",
                    enabled: true,
                  },
                ],
              },
            ] as typeof mockServers,
            getMCPConnection: mockGetMCPConnection,
          }),
      );
      mockGetMCPConnection.mockReturnValue({ state: "ready" });

      const { result } = renderHook(() => useMcpToolSuggestions());

      expect(result.current.mcpToolOptions.map((t) => t.toolName)).toContain(
        "widget_tool",
      );
    });

    it("includes duplicate iframe widget servers with the same url only once", () => {
      const iframeTool = {
        id: "iframe-tool-1",
        name: "widget_tool",
        description: "Widget-local tool",
        enabled: true,
      };
      mockUseShallowMcpToolsStore.mockImplementation(
        (
          selector: (state: {
            servers: typeof mockServers;
            getMCPConnection: typeof mockGetMCPConnection;
          }) => unknown,
        ) =>
          selector({
            servers: [
              {
                id: "iframe-server-1",
                name: "Widget MCP",
                url: "https://widget.example.com/mcp",
                enabled: true,
                toolsEnabled: true,
                iframeWidgetId: "widget-1",
                tools: [iframeTool],
              },
              {
                id: "iframe-server-2",
                name: "Widget MCP",
                url: "https://widget.example.com/mcp",
                enabled: true,
                toolsEnabled: true,
                iframeWidgetId: "widget-2",
                tools: [iframeTool],
              },
            ] as unknown as typeof mockServers,
            getMCPConnection: mockGetMCPConnection,
          }),
      );
      mockGetMCPConnection.mockReturnValue({ state: "ready" });

      const { result } = renderHook(() => useMcpToolSuggestions());

      expect(
        result.current.mcpToolOptions.filter((t) => t.toolName === "widget_tool"),
      ).toHaveLength(1);
    });

    it("excludes unselected iframe widget tools from MCP tool suggestions", () => {
      mockUseShallowMcpToolsStore.mockImplementation(
        (
          selector: (state: {
            servers: typeof mockServers;
            getMCPConnection: typeof mockGetMCPConnection;
          }) => unknown,
        ) =>
          selector({
            servers: [
              {
                id: "iframe-server-1",
                name: "Widget MCP",
                url: "https://widget.example.com/mcp",
                enabled: true,
                toolsEnabled: true,
                iframeWidgetId: "widget-1",
                tools: [
                  {
                    id: "iframe-tool-1",
                    name: "enabled_widget_tool",
                    description: "Widget-local tool",
                    enabled: true,
                  },
                  {
                    id: "iframe-tool-2",
                    name: "disabled_widget_tool",
                    description: "Unselected widget-local tool",
                    enabled: false,
                  },
                ],
              },
            ] as unknown as typeof mockServers,
            getMCPConnection: mockGetMCPConnection,
          }),
      );
      mockGetMCPConnection.mockReturnValue({ state: "ready" });

      const { result } = renderHook(() => useMcpToolSuggestions());
      const toolNames = result.current.mcpToolOptions.map((t) => t.toolName);

      expect(toolNames).toContain("enabled_widget_tool");
      expect(toolNames).not.toContain("disabled_widget_tool");
    });

    it("includes correct tool properties", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const stockTool = result.current.mcpToolOptions.find(
        (t) => t.toolName === "get_stock_price",
      );

      expect(stockTool).toEqual({
        type: "mcpTool",
        id: "server-1_tool-1",
        serverName: "Financial Data",
        serverUrl: "https://api.financial.com",
        toolName: "get_stock_price",
        toolId: "tool-1",
        description: "Get current stock price",
        inputSchema: { type: "object", properties: { symbol: { type: "string" } } },
        slashText: "/Financial Data_get_stock_price"
          .replace(/ /g, "\u00A0")
          .replace(/-/g, "\u2011"),
      });
    });

    it("returns empty array when no servers are connected", () => {
      mockGetMCPConnection.mockReturnValue(null);

      const { result } = renderHook(() => useMcpToolSuggestions());

      expect(result.current.mcpToolOptions).toHaveLength(0);
    });
  });

  describe("hasMcpTools", () => {
    it("returns true when tools exist", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      expect(result.current.hasMcpTools).toBe(true);
    });

    it("returns false when no tools exist", () => {
      mockUseShallowMcpToolsStore.mockImplementation(
        (
          selector: (state: {
            servers: never[];
            getMCPConnection: typeof mockGetMCPConnection;
          }) => unknown,
        ) =>
          selector({
            servers: [],
            getMCPConnection: mockGetMCPConnection,
          }),
      );

      const { result } = renderHook(() => useMcpToolSuggestions());

      expect(result.current.hasMcpTools).toBe(false);
    });
  });

  describe("searchMcpTools", () => {
    it("returns all tools when query is just the trigger", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/");

      expect(suggestions).toHaveLength(3);
    });

    it("returns all tools when query is empty string", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("");

      expect(suggestions).toHaveLength(3);
    });

    it("filters tools by server name", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/Financial");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.every((s) => s.serverName === "Financial Data")).toBe(true);
    });

    it("filters tools by tool name", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/stock");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].toolName).toBe("get_stock_price");
    });

    it("filters tools by description", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/datasets");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.some((s) => s.toolName === "search_datasets")).toBe(true);
    });

    it("handles server names with spaces", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/Open Data");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].serverName).toBe("Open Data");
    });

    it("handles query without trigger prefix", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("market");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].toolName).toBe("get_market_data");
    });

    it("returns empty array for non-matching query", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/xyz-nonexistent-tool");

      expect(suggestions).toHaveLength(0);
    });

    it("performs fuzzy matching", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      // "stoc" should fuzzy match "stock"
      const suggestions = result.current.searchMcpTools("/stoc");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].toolName).toBe("get_stock_price");
    });

    it("is case-insensitive", () => {
      const { result } = renderHook(() => useMcpToolSuggestions());

      const suggestions = result.current.searchMcpTools("/financial");

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].serverName).toBe("Financial Data");
    });
  });

  describe("memoization", () => {
    it("returns stable mcpToolOptions reference when servers do not change", () => {
      const { result, rerender } = renderHook(() => useMcpToolSuggestions());

      const firstOptions = result.current.mcpToolOptions;
      rerender();
      const secondOptions = result.current.mcpToolOptions;

      expect(firstOptions).toBe(secondOptions);
    });

    it("returns stable searchMcpTools reference when servers do not change", () => {
      const { result, rerender } = renderHook(() => useMcpToolSuggestions());

      const firstSearch = result.current.searchMcpTools;
      rerender();
      const secondSearch = result.current.searchMcpTools;

      expect(firstSearch).toBe(secondSearch);
    });
  });
});
