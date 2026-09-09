/**
 * Tests for useMcpExecutor hook
 *
 * Verifies that MCP tool execution errors are emitted in the correct
 * CopilotDataT format with proper error_type and content fields.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotErrorType } from "~/lib/state/copilot";
import type { McpConnection, McpServer } from "~/lib/state/mcpTools";
import { useMcpToolsStore } from "~/lib/state/mcpTools";

// Mock posthog
vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock widget utils
vi.mock("~/lib/utils/widget", () => ({
  getAllWidgets: vi.fn().mockReturnValue([]),
}));

// Mock API calls
vi.mock("~/api/auth.api", () => ({
  postMCPServers: vi.fn().mockResolvedValue({}),
}));

const createMockServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: "server-1",
  name: "Test Server",
  url: "https://test.example.com",
  enabled: true,
  toolsEnabled: true,
  tools: [],
  connected: true,
  ...overrides,
});

const createMockConnection = (
  overrides: Partial<McpConnection> = {},
): McpConnection => ({
  callTool: vi.fn().mockResolvedValue({ content: [{ text: "ok" }] }),
  error: undefined,
  state: "ready",
  tools: [],
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
  ...overrides,
});

function setupStore(server: McpServer, connection?: McpConnection) {
  act(() => {
    useMcpToolsStore.setState({
      servers: [server],
      mcpConnectionRegistry: connection ? { [server.id]: connection } : {},
    });
  });
}

/**
 * Helper to parse the error payload returned by the executor.
 * The executor returns CopilotDataT[] where each item's content is a
 * JSON-stringified object with `error_type` and `content` fields.
 */
function parseErrorPayload(result: any[]) {
  expect(result).toHaveLength(1);
  const data = result[0];
  expect(data.items).toHaveLength(1);
  return JSON.parse(data.items[0].content);
}

describe("useMcpExecutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useMcpToolsStore.setState({
        servers: [],
        mcpConnectionRegistry: {},
      });
    });
  });

  // Dynamically import so mocks are in place
  async function getExecutor() {
    const { useMcpExecutor } = await import("~/components/AI/hooks/mcp/useMcpExecutor");
    const { result } = renderHook(() => useMcpExecutor());
    return result.current; // executeAgentTool function
  }

  describe("error emission format", () => {
    it("should emit error with CopilotErrorType.UNEXPECTED when server is not found", async () => {
      // No server in store
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {
        query: "test",
      });

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("Server not found");
    });

    it("should emit error when server is disabled (not connected via config)", async () => {
      setupStore(createMockServer({ enabled: false }));
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("disconnected");
    });

    it("should emit error when server tools are disabled", async () => {
      setupStore(createMockServer({ toolsEnabled: false }));
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("tools are disabled");
    });

    it("should emit error when server is not connected", async () => {
      setupStore(createMockServer({ connected: false }));
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("not connected");
    });

    it("should emit error when no MCP connection exists for server", async () => {
      // Server exists but no connection in registry.
      // getServerById derives `connected` from connection state, so with no
      // connection the server is treated as "not connected".
      setupStore(createMockServer());
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("not connected");
    });

    it("should emit error when MCP connection is not in ready state", async () => {
      // getServerById derives `connected` from connection.state === "ready",
      // so a "connecting" state means server.connected is false.
      const connection = createMockConnection({ state: "connecting" });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("not connected");
    });

    it("should emit error when callTool throws", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockRejectedValue(new Error("Tool execution failed")),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {
        param: "value",
      });

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("Tool execution failed");
    });

    it("should include tool name in error content", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockRejectedValue(new Error("something broke")),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_my_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.content).toContain("TestServer_my_tool");
    });

    it("should emit error when an individual MCP tool is disabled", async () => {
      const connection = createMockConnection();
      setupStore(
        createMockServer({
          tools: [{ id: "some_tool", name: "Some Tool", enabled: false }],
        }),
        connection,
      );
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("Tool some_tool is disabled");
    });

    it("should return items array with JSON-stringified error content", async () => {
      setupStore(createMockServer({ enabled: false }));
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      // Verify the raw structure matches CopilotDataT
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("items");
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0]).toHaveProperty("content");

      // Content should be valid JSON
      const parsed = JSON.parse((result[0].items[0] as { content: string }).content);
      expect(parsed).toHaveProperty("error_type");
      expect(parsed).toHaveProperty("content");
    });
  });

  describe("error telemetry", () => {
    it("should capture MCP_TOOL_EXECUTION_ERROR in posthog on error", async () => {
      const posthog = await import("posthog-js");
      const connection = createMockConnection({
        callTool: vi.fn().mockRejectedValue(new Error("boom")),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      await executeAgentTool("server-1", "TestServer_some_tool", {});

      expect(posthog.default.capture).toHaveBeenCalledWith(
        "MCP_TOOL_EXECUTION_ERROR",
        expect.objectContaining({
          tool_name: "TestServer_some_tool",
          server_id: "server-1",
          error_message: "boom",
        }),
      );
    });
  });

  describe("invalid tool name format", () => {
    it("should throw when tool name has no underscore separator", async () => {
      const executeAgentTool = await getExecutor();

      await expect(executeAgentTool("server-1", "invalidtoolname", {})).rejects.toThrow(
        "Invalid tool name format",
      );
    });
  });

  describe("retry logic on not-ready errors", () => {
    it("should retry up to 3 times when callTool throws a 'not ready' error", async () => {
      const callTool = vi
        .fn()
        .mockRejectedValueOnce(new Error("Client is not ready"))
        .mockRejectedValueOnce(new Error("Client is not ready"))
        .mockResolvedValueOnce({ content: [{ text: "success" }] });

      const connection = createMockConnection({ callTool });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      // Should succeed after retries, not return error
      expect((result[0].items[0] as { content: string }).content).toContain("success");
      expect(callTool).toHaveBeenCalledTimes(3);
    });

    it("should emit error after exhausting retries on 'not ready' errors", async () => {
      const callTool = vi.fn().mockRejectedValue(new Error("Client is not ready"));

      const connection = createMockConnection({ callTool });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const errorPayload = parseErrorPayload(result);
      expect(errorPayload.error_type).toBe(CopilotErrorType.UNEXPECTED);
      expect(errorPayload.content).toContain("not ready");
      expect(callTool).toHaveBeenCalledTimes(3);
    });
  });

  describe("MCP-spec isError handling", () => {
    it("should preserve raw MCP error payload with isError: true", async () => {
      const mcpErrorResult = {
        isError: true,
        content: [{ type: "text", text: "Invalid ticker symbol" }],
      };
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue(mcpErrorResult),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {
        ticker: "INVALID",
      });

      // Should pass through as content, not throw
      const content = (result[0].items[0] as { content: string }).content;
      const parsed = JSON.parse(content);
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toEqual(mcpErrorResult.content);
    });

    it("should preserve isError payload with multiple content items", async () => {
      const mcpErrorResult = {
        isError: true,
        content: [
          { type: "text", text: "Validation failed" },
          { type: "text", text: "Field 'date' is required" },
        ],
      };
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue(mcpErrorResult),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const content = (result[0].items[0] as { content: string }).content;
      const parsed = JSON.parse(content);
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toHaveLength(2);
      expect(parsed.content[0].text).toBe("Validation failed");
      expect(parsed.content[1].text).toBe("Field 'date' is required");
    });

    it("should preserve isError payload even with empty content array", async () => {
      const mcpErrorResult = { isError: true, content: [] };
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue(mcpErrorResult),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      const content = (result[0].items[0] as { content: string }).content;
      const parsed = JSON.parse(content);
      expect(parsed.isError).toBe(true);
      expect(parsed.content).toEqual([]);
    });

    it("should not treat isError: false as an error", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue({
          isError: false,
          content: [{ type: "text", text: "success data" }],
        }),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      // Should be treated as success — content extracted normally
      const content = (result[0].items[0] as { content: string }).content;
      expect(content).toContain("success data");
      // Should NOT contain isError in the output
      expect(content).not.toContain("isError");
    });

    it("should not skip content processing for results without isError", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "normal tool output" }],
        }),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      // Content should be extracted from text items, not raw JSON
      const content = (result[0].items[0] as { content: string }).content;
      expect(content).toContain("normal tool output");
      expect(content).not.toContain("isError");
    });

    it("should still fire success telemetry for isError results (no throw)", async () => {
      const posthog = await import("posthog-js");
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue({
          isError: true,
          content: [{ type: "text", text: "server-side failure" }],
        }),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      await executeAgentTool("server-1", "TestServer_some_tool", {});

      // With passthrough approach, the result is not thrown, so
      // MCP_USE_MCP_SUCCESS fires (the call itself succeeded at transport level)
      expect(posthog.default.capture).toHaveBeenCalledWith(
        "MCP_USE_MCP_SUCCESS",
        expect.objectContaining({
          tool_name: "TestServer_some_tool",
          server_id: "server-1",
        }),
      );
    });
  });

  describe("successful tool execution", () => {
    it("should return content from callTool response", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue({
          content: [{ text: "tool result data" }],
        }),
      });
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "TestServer_some_tool", {});

      expect((result[0].items[0] as { content: string }).content).toContain(
        "tool result data",
      );
    });

    it("should include an iframe widget citation for iframe-bound MCP tools", async () => {
      const connection = createMockConnection({
        callTool: vi.fn().mockResolvedValue({
          content: [{ text: "iframe tool result" }],
        }),
      });
      setupStore(
        createMockServer({
          name: "Portfolio Iframe",
          clientName: "Portfolio MCP",
          iframeWidgetId: "iframe-widget-1",
          iframeParams: { symbol: "AAPL" },
          toolsEnabled: true,
          tools: [
            {
              id: "holdings",
              name: "Holdings",
              description: "Returns current holdings",
              enabled: true,
            },
          ],
        }),
        connection,
      );
      const executeAgentTool = await getExecutor();

      const result = await executeAgentTool("server-1", "Portfolio_holdings", {
        account_id: "demo-account",
      });

      expect((result[0].items[0] as { content: string }).content).toContain(
        "iframe tool result",
      );
      expect(result[0].extra_citations).toEqual([
        expect.objectContaining({
          source_info: expect.objectContaining({
            type: "widget",
            name: "Portfolio Iframe",
            origin: "OpenBB Workspace",
            uuid: "iframe-widget-1",
            widget_id: "iframe-widget-1",
            description: "Returns current holdings",
            citable: true,
            metadata: expect.objectContaining({
              iframe_mcp: true,
              server_id: "server-1",
              server_name: "Portfolio MCP",
              tool_name: "holdings",
              widget_uuid: "iframe-widget-1",
              matching: true,
              input_args: { symbol: "AAPL" },
              mcp_tool_args: { account_id: "demo-account" },
            }),
          }),
          details: [{ "Account Id": "demo-account" }],
        }),
      ]);
    });

    it("should capture MCP_USE_MCP_SUCCESS in posthog on success", async () => {
      const posthog = await import("posthog-js");
      const connection = createMockConnection();
      setupStore(createMockServer(), connection);
      const executeAgentTool = await getExecutor();

      await executeAgentTool("server-1", "TestServer_some_tool", {});

      expect(posthog.default.capture).toHaveBeenCalledWith(
        "MCP_USE_MCP_SUCCESS",
        expect.objectContaining({
          tool_name: "TestServer_some_tool",
          server_id: "server-1",
        }),
      );
    });
  });
});
