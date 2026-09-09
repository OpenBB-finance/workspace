import posthog from "posthog-js";
import { useCallback } from "react";
import { toast } from "sonner";
import { getIframeWidget } from "~/lib/iframeWidgetRegistry";
import type { CopilotDataT } from "~/lib/state/copilot";
import { CopilotErrorType } from "~/lib/state/copilot";
import { useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { getAllWidgets } from "~/lib/utils/widget";

type ExecuteAgentTool = (
  serverId: string,
  toolName: string,
  parameters?: Record<string, unknown>,
) => Promise<CopilotDataT[]>;

interface WidgetCitation {
  widgetId: string;
  source: string;
  name?: string;
  description?: string;
}

interface IframeMcpCitation {
  widgetId: string;
  widgetName: string;
  serverId: string;
  serverName: string;
  toolName: string;
  toolDescription?: string;
  iframeParams?: Record<string, string>;
}

function findEquivalentWidget(
  mcpServerName: string,
  mcpToolName: string,
): WidgetCitation | null {
  // Preserve underscores and spaces; only lowercase + trim
  const norm = (s: string) => (s || "").trim().toLowerCase();

  const serverKey = norm(mcpServerName);
  const toolKey = norm(mcpToolName);

  // Get external, backend, advanced-backend widgets that declare mcp_tool
  const widgets = getAllWidgets(null, ["backend"]).filter(
    (w) =>
      // @ts-expect-error
      w?.mcp_tool?.mcp_server &&
      // @ts-expect-error
      w?.mcp_tool?.tool_id,
  );

  for (const w of widgets) {
    // @ts-expect-error
    const meta = w.mcp_tool;
    if (norm(meta.mcp_server) !== serverKey) continue;
    if (norm(meta.tool_id) !== toolKey) continue;
    return {
      widgetId: w.widgetId || "",
      source:
        w.sourceName ||
        (Array.isArray(w.source) ? w.source.join(", ") : w.source || ""),
      name: w.name,
      description: w.description,
    };
  }

  return null;
}

function getErrorContent(
  toolName: string,
  _serverName: string,
  error: Error,
): CopilotDataT {
  // Create a user-friendly error message
  const errorContent = {
    error_type: CopilotErrorType.UNEXPECTED,
    content: `Error executing MCP tool "${toolName}": ${error.message}

${error.message}`,
  };

  return {
    items: [
      {
        content: JSON.stringify(errorContent, null, 2),
      },
    ],
  };
}

export function useMcpExecutor() {
  const mcpToolsStore = useShallowMcpToolsStore((state) => ({
    getServerById: state.getServerById,
    getMCPConnection: state.getMCPConnection,
  }));

  const executeAgentTool = useCallback<ExecuteAgentTool>(
    async (serverId, toolName, parameters) => {
      // Extract server ID from tool name (format: serverId_toolName)
      const [serverName, ...toolNameParts] = toolName.split("_");
      const actualToolName = toolNameParts.join("_");

      if (!(serverId && actualToolName))
        throw new Error(`Invalid tool name format: ${toolName}`);

      // Get server info from store
      const { getServerById, getMCPConnection } = mcpToolsStore;
      const mcpConnection = getMCPConnection(serverId);
      const server = getServerById(serverId);

      try {
        if (!server) throw new Error(`Server not found: ${serverName}`);

        // Check if server is enabled (not disconnected via MCP Server config)
        if (!server.enabled) {
          throw new Error(
            `Server ${server.name} is disconnected. Connect it in the MCP Servers settings.`,
          );
        }

        // Check if server tools are enabled
        if (!server.toolsEnabled) {
          throw new Error(
            `Server ${server.name} tools are disabled. Enable them in the MCP Tools dialog to use its tools.`,
          );
        }

        // Check if server is connected
        if (!server.connected) {
          throw new Error(
            `Server ${server.name} is not connected. Check connection in MCP Servers settings.`,
          );
        }

        // Get the MCP connection from use-mcp's connection registry
        if (!mcpConnection?.callTool) {
          throw new Error(`No active MCP connection found for server ${server.name}.`);
        }

        // Additional validation - check if connection is truly ready
        if (mcpConnection.state !== "ready") {
          throw new Error(
            `MCP connection for server \`${server.name}\` is not ready (state: ${mcpConnection.state})`,
          );
        }

        const calledTool = server.tools.find((t) => t.id === actualToolName);
        if (calledTool && !calledTool.enabled) {
          throw new Error(
            `Tool ${actualToolName} is disabled. Enable it in the MCP Tools dialog to use it.`,
          );
        }

        // Add retry logic for race conditions
        let retryCount = 0;
        const maxRetries = 3;
        let result: any;

        while (retryCount < maxRetries) {
          try {
            // Ensure parameters is always an object, even for parameter-less tools
            const safeParameters = parameters || {};
            result = await mcpConnection.callTool(actualToolName, safeParameters);
            break; // Success, exit retry loop
          } catch (error) {
            if (error.message.includes("not ready") && retryCount < maxRetries - 1) {
              retryCount++;
              // Wait a bit before retrying
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Refresh connection from registry in case it was updated
              const refreshedConnection = getMCPConnection(serverId);
              if (
                refreshedConnection?.callTool &&
                refreshedConnection.state === "ready"
              ) {
                mcpConnection.callTool = refreshedConnection.callTool;
                mcpConnection.state = refreshedConnection.state;
              }
            } else {
              throw error; // Re-throw if not a retry-able error or max retries reached
            }
          }
        }

        if (posthog) {
          posthog.capture("MCP_USE_MCP_SUCCESS", {
            tool_name: toolName,
            server_id: serverId,
            result_type: typeof result,
          });
        }

        if (server.iframeWidgetId) {
          if (calledTool?.annotations?.destructiveHint === true) {
            getIframeWidget(server.iframeWidgetId)?.sendRefresh();
          }
        }

        const getContent = (result: any): string | object => {
          if (result && typeof result === "object") {
            const isMcpErrorResult = "isError" in result && result.isError === true;
            // Preserve the raw MCP error payload so backend logic can detect isError.
            if (isMcpErrorResult) return result;

            if (
              "structuredContent" in result &&
              typeof result.structuredContent?.results === "object"
            )
              return result.structuredContent;

            if ("content" in result && typeof result.content === "object") {
              const handleItem = (item: any) => {
                if (item === null || item === undefined) return item;
                if (Array.isArray(item)) return item.map(handleItem);
                if (typeof item === "object" && "text" in item) return item.text;
                return item;
              };
              return handleItem(result.content);
            }
          }

          return result;
        };

        let content = getContent(result);
        content =
          typeof content === "string" ? content : JSON.stringify(content, null, 2);

        // Find equivalent widget and build citation (if any). Iframe-bound MCP
        // calls cite the iframe widget itself because they may not have a
        // catalog widget mapping.
        const equivalentWidget = server.iframeWidgetId
          ? null
          : findEquivalentWidget(server?.clientName || server?.name, actualToolName);
        if (equivalentWidget) {
          const widgetName = equivalentWidget.name || equivalentWidget.widgetId;
          toast.info("Matching widget found", {
            description: `The widget ${widgetName} has the same id than the MCP tool call ${actualToolName}`,
          });
        }

        const toTitleCase = (s: string) =>
          s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        const buildExtraCitations = (
          match: WidgetCitation | null,
          params?: Record<string, unknown>,
          iframeCitation?: IframeMcpCitation | null,
        ) => {
          const entries = Object.entries(params || {}).filter(
            ([, v]) => v !== null && v !== undefined,
          );
          const detailsObj = Object.fromEntries(
            entries.map(([k, v]) => [toTitleCase(k), v]),
          );

          if (iframeCitation) {
            const iframeInputArgs = iframeCitation.iframeParams || {};
            return [
              {
                source_info: {
                  type: "widget",
                  name: iframeCitation.widgetName || iframeCitation.serverName,
                  origin: "OpenBB Workspace",
                  uuid: iframeCitation.widgetId,
                  widget_id: iframeCitation.widgetId,
                  description:
                    iframeCitation.toolDescription ||
                    `MCP tool ${iframeCitation.toolName} from ${iframeCitation.serverName}`,
                  citable: true,
                  metadata: {
                    iframe_mcp: true,
                    matching: true,
                    server_id: iframeCitation.serverId,
                    server_name: iframeCitation.serverName,
                    tool_name: iframeCitation.toolName,
                    widget_uuid: iframeCitation.widgetId,
                    input_args: iframeInputArgs,
                    mcp_tool_args: params || {},
                  },
                },
                details: entries.length > 0 ? [detailsObj] : [],
              },
            ];
          }

          if (!match) return [] as any[];
          const details = entries.length > 0 ? [detailsObj] : [];
          return [
            {
              source_info: {
                type: "widget",
                name: match.name || match.widgetId,
                origin: match.source,
                widget_id: match.widgetId,
                description: match.description,
                citable: true,
                metadata: {
                  matching: true,
                  input_args: params || {},
                },
              },
              details,
            },
          ];
        };

        const extraCitations = buildExtraCitations(
          equivalentWidget,
          parameters as Record<string, unknown>,
          server.iframeWidgetId
            ? {
                widgetId: server.iframeWidgetId,
                widgetName: server.name,
                serverId,
                serverName: server.clientName || server.name,
                toolName: actualToolName,
                toolDescription: calledTool?.description,
                iframeParams: server.iframeParams,
              }
            : null,
        );

        // Convert response to CopilotDataT format
        return [{ items: [{ content }], extra_citations: extraCitations }];
      } catch (error) {
        if (posthog) {
          posthog.capture("MCP_TOOL_EXECUTION_ERROR", {
            tool_name: toolName,
            server_id: serverId,
            error_message: error.message,
            error_stack: error.stack,
          });
        }

        console.error(`[MCP Executor] Tool execution failed for ${toolName}:`, error);

        // Return error in the expected format
        return [getErrorContent(toolName, server?.name || serverId, error as Error)];
      }
    },
    [mcpToolsStore],
  );

  return executeAgentTool;
}
