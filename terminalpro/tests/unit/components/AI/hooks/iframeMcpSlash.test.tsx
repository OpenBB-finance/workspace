/**
 * Regression: iframe MCP tools must surface in the `/` slash dropdown once their
 * server connects. Uses the REAL mcpTools store — the sibling
 * useMcpToolSuggestions.test.tsx mocks the whole store, so it cannot exercise
 * reactivity to connection-state changes (mcpConnectionRegistry).
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMcpToolSuggestions } from "~/components/AI/hooks/useMcpToolSuggestions";
import { type McpConnection, useMcpToolsStore } from "~/lib/state/mcpTools";

vi.mock("~/api/auth.api", () => ({ postMCPServers: vi.fn().mockResolvedValue({}) }));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const conn = (state: McpConnection["state"]): McpConnection => ({
  callTool: undefined,
  state,
  tools: [],
  error: undefined,
  disconnect: () => {},
  clearStorage: () => {},
  retry: () => {},
});

beforeEach(() => {
  useMcpToolsStore.setState({ servers: [], mcpConnectionRegistry: {} });
});

describe("iframe MCP tools in slash suggestions (real store)", () => {
  it("happy path: iframe tools appear when server enabled + connection ready", () => {
    const store = useMcpToolsStore.getState();
    act(() => {
      store.addServer({
        id: "iframe-mcp-w1",
        name: "Portfolio Widget",
        url: "https://w.example/mcp",
        enabled: true,
        tools: [],
        iframeWidgetId: "w1",
      });
      store.addToolsToServer("iframe-mcp-w1", [
        { id: "rebalance", name: "rebalance", description: "Rebalance", enabled: true },
      ]);
      store.updateMCPConnectionRegistry("iframe-mcp-w1", conn("ready"));
    });

    const { result } = renderHook(() => useMcpToolSuggestions());
    expect(result.current.mcpToolOptions.map((t) => t.toolName)).toContain("rebalance");
  });

  it("does not show unselected iframe tools", () => {
    const store = useMcpToolsStore.getState();
    act(() => {
      store.addServer({
        id: "iframe-mcp-w1",
        name: "Portfolio Widget",
        url: "https://w.example/mcp",
        enabled: true,
        tools: [],
        iframeWidgetId: "w1",
      });
      store.addToolsToServer("iframe-mcp-w1", [
        { id: "rebalance", name: "rebalance", description: "Rebalance", enabled: true },
        {
          id: "disabled_tool",
          name: "disabled_tool",
          description: "Disabled",
          enabled: true,
        },
      ]);
      store.toggleTool("iframe-mcp-w1", "disabled_tool", false);
      store.updateMCPConnectionRegistry("iframe-mcp-w1", conn("ready"));
    });

    const { result } = renderHook(() => useMcpToolSuggestions());
    const toolNames = result.current.mcpToolOptions.map((t) => t.toolName);

    expect(toolNames).toContain("rebalance");
    expect(toolNames).not.toContain("disabled_tool");
  });

  it("recomputes when connection flips to ready with no servers change", () => {
    const store = useMcpToolsStore.getState();
    act(() => {
      store.addServer({
        id: "iframe-mcp-w1",
        name: "Portfolio Widget",
        url: "https://w.example/mcp",
        enabled: true,
        tools: [],
        iframeWidgetId: "w1",
      });
      store.addToolsToServer("iframe-mcp-w1", [
        { id: "rebalance", name: "rebalance", description: "Rebalance", enabled: true },
      ]);
      // tools already in store, but connection still mid-handshake
      store.updateMCPConnectionRegistry("iframe-mcp-w1", conn("connecting"));
    });

    const { result } = renderHook(() => useMcpToolSuggestions());
    expect(result.current.mcpToolOptions).toHaveLength(0);

    act(() => {
      // ONLY a registry change — servers array untouched
      store.updateMCPConnectionRegistry("iframe-mcp-w1", conn("ready"));
    });

    expect(result.current.mcpToolOptions.map((t) => t.toolName)).toContain("rebalance");
  });
});
