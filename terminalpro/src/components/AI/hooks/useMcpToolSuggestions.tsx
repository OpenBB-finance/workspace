import Fuse from "fuse.js";
import { useCallback, useMemo } from "react";
import {
  dedupeIframeServersByUrl,
  useShallowMcpToolsStore,
} from "~/lib/state/mcpTools";

export const MCP_TOOL_TRIGGER = "/";

export interface McpToolSuggestion {
  type: "mcpTool";
  id: string;
  serverName: string;
  serverUrl: string;
  toolName: string;
  toolId: string;
  description: string;
  /** ### MCP Tool Slash Text
   *  Formatted as `/{serverName}_{toolName}`.*/
  slashText: string;
  inputSchema?: unknown;
}

export function useMcpToolSuggestions() {
  // `connSignature` makes this subscription react to connection-state changes
  // (mcpConnectionRegistry), not just `servers`. Without it, a server flipping
  // to "ready" without a `servers` mutation — e.g. an iframe-bound MCP whose
  // tools are already in the store — left the list stale and hid its tools.
  const { servers, getMCPConnection, connSignature } = useShallowMcpToolsStore((s) => ({
    servers: s.servers,
    getMCPConnection: s.getMCPConnection,
    connSignature: s.servers
      .map((srv) => `${srv.id}:${s.getMCPConnection(srv.id)?.state ?? ""}`)
      .join("|"),
  }));

  const mcpToolOptions = useMemo((): McpToolSuggestion[] => {
    const tools: McpToolSuggestion[] = [];

    // Only include tools from servers that are enabled and connected, collapsing
    // duplicate copies of the same iframe widget into a single entry
    const connectedServers = dedupeIframeServersByUrl(
      servers.filter((server) => {
        const connection = getMCPConnection(server.id);
        return connection?.state === "ready" && server.enabled;
      }),
    );

    for (const server of connectedServers) {
      if (!server.toolsEnabled) continue;

      for (const tool of server.tools) {
        if (tool.enabled) {
          tools.push({
            type: "mcpTool",
            id: `${server.id}_${tool.id}`,
            serverName: server.name,
            serverUrl: server.url,
            toolName: tool.name,
            toolId: tool.id,
            description: tool.description || "",
            inputSchema: tool.inputSchema,
            // Non-breaking space/hyphen to prevent textarea line breaks
            slashText: `/${server.name}_${tool.name}`
              .replace(/ /g, "\u00A0")
              .replace(/-/g, "\u2011"),
          });
        }
      }
    }

    return tools;
  }, [servers, getMCPConnection, connSignature]);

  const fuse = useMemo(
    () =>
      new Fuse(mcpToolOptions, {
        keys: ["serverName", "toolName", "toolId", "description"],
        threshold: 0.3,
      }),
    [mcpToolOptions],
  );

  const searchMcpTools = useCallback(
    (query: string): McpToolSuggestion[] => {
      // Remove the "/" prefix
      const searchTerm = query.startsWith(MCP_TOOL_TRIGGER)
        ? query.slice(MCP_TOOL_TRIGGER.length)
        : query;

      if (!searchTerm) return mcpToolOptions;

      return fuse
        .search(searchTerm)
        .map((result) => {
          // Drop results that don't partially match the query if ends with a space
          // "RSS F" -> ["RSS Feeds"]
          // "RSS Feeds " -> []
          if (query.length > result.item.slashText.length) return null;
          return result.item;
        })
        .filter(Boolean);
    },
    [mcpToolOptions, fuse],
  );

  return {
    mcpToolOptions,
    searchMcpTools,
    hasMcpTools: mcpToolOptions.length > 0,
  };
}
