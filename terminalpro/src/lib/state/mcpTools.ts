import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { debounce } from "lodash";
import isEqual from "lodash.isequal";
import { toast } from "sonner";
import type { UseMcpResult } from "use-mcp/react";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { postMCPServers } from "~/api/auth.api";
import { clearMcpAuthStorageForServer } from "~/components/AI/hooks/mcp/browser-provider";
import type { Selector } from "./app";

// Connection states that indicate a pending/in-progress connection
export const PENDING_CONNECTION_STATES = [
  "loading",
  "connecting",
  "discovering",
  "authenticating",
] as const;

// Type for AI agent tool configuration
export interface AgentToolConfig {
  server_id: string;
  name: string; // Format: "serverName_toolName"
  description?: string;
  url: string;
  input_schema?: any;
}

export interface McpTool {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  inputSchema?: any; // Preserve input schema from MCP server
  annotations?: ToolAnnotations;
  lastExecuted?: number;
  executionCount?: number;
  lastError?: string;
}

export interface McpServer {
  id: string;
  name: string;
  clientName?: string;
  isLocal?: boolean; // Indicates if the server is local
  url: string;
  enabled: boolean; // Controls connection (used by MCP Server config)
  toolsEnabled?: boolean; // Controls bulk tool availability (used by MCP Tools dialog, not persisted)
  tools: McpTool[];
  connected?: boolean; // Connection status (read-only from connection manager)
  autoReconnect?: boolean;
  customHeaders?: Record<string, string>; // Custom headers as key-value pairs
  iframeWidgetId?: string; // Links this server to an iframe widget
  iframeParams?: Record<string, string>; // Current iframe widget param values
  vendorAppUuid?: string; // Vendor application UUID
  vendorName?: string; // Vendor name (for display purposes)
  sourceId?: string; // Custom backend source id (for non-marketplace apps)
  authType?: "oauth" | "token"; // Static-token auth suppresses the OAuth flow when "token"
}

export interface McpConnection {
  callTool: UseMcpResult["callTool"] | undefined;
  error: UseMcpResult["error"];
  state: UseMcpResult["state"] | "disconnected";
  tools: UseMcpResult["tools"];
  disconnect: UseMcpResult["disconnect"];
  retry: UseMcpResult["retry"];
  clearStorage: UseMcpResult["clearStorage"];
}

interface McpToolsState {
  servers: McpServer[];
  mcpConnectionRegistry: Record<string, McpConnection>;
  getMCPConnection: (serverId: string) => McpConnection | undefined;
  updateMCPConnectionRegistry: (
    serverId: string,
    connection: McpConnection,
    remove?: boolean,
  ) => void;
  getServerById: (serverId: string) => McpServer | undefined;
  addServer: (server: McpServer) => void;
  removeServer: (serverId: string, options?: { clearStorage?: boolean }) => void;
  updateServer: (
    serverId: string,
    updates: Partial<McpServer>,
    refresh?: boolean,
  ) => void;
  disableServerAfterAuthCancel: (serverId: string) => void;
  toggleServerTools: (serverId: string, enableAll?: boolean) => void;
  toggleTool: (serverId: string, toolId: string | string[], enable?: boolean) => void;
  addToolsToServer: (serverId: string, tools: McpTool[]) => void;
  getEnabledToolCount: () => number;
  getEnabledToolsForAgent: () => Promise<AgentToolConfig[]>;
  saveMCPServers: () => Promise<void>;
  debouncedSaveServers: () => Promise<void>;
  updateServers: (servers: McpServer[]) => void;
  removeVendorAppServer: (vendorAppUuid: string) => void;
  removeSourceServer: (sourceId: string) => void;
  clearAllStorage: () => void;
}

/**
 * Duplicate copies of the same iframe widget register one server per widget
 * instance, all pointing at the same MCP url. Collapse them to a single entry
 * so the same tools are not surfaced twice.
 *
 * Connection-blind: keeps the first same-url server regardless of connection
 * state, so callers must filter to connected servers BEFORE calling this —
 * otherwise a disconnected copy can shadow a connected one. The store methods
 * (`getEnabledToolCount`, `getEnabledToolsForAgent`) keep their own inline
 * connection-aware seen-sets for the same reason; don't "simplify" them to
 * use this helper.
 */
export const dedupeIframeServersByUrl = <T extends McpServer>(servers: T[]): T[] => {
  const seenUrls = new Set<string>();
  return servers.filter((server) => {
    if (!server.iframeWidgetId) return true;
    if (seenUrls.has(server.url)) return false;
    seenUrls.add(server.url);
    return true;
  });
};

const shouldMergeServers = (a: McpServer, b: McpServer) => {
  if (a.id === b.id) return true;
  if (a.iframeWidgetId && b.iframeWidgetId) {
    return a.iframeWidgetId === b.iframeWidgetId;
  }
  return false;
};

const upsertServer = (servers: McpServer[], server: McpServer) => {
  const index = servers.findIndex((existing) => shouldMergeServers(existing, server));
  if (index === -1) return [...servers, server];

  const next = [...servers];
  next[index] = {
    ...next[index],
    ...server,
    id: next[index].iframeWidgetId ? next[index].id : server.id,
    tools: server.tools.length > 0 ? server.tools : next[index].tools,
    toolsEnabled: next[index].iframeWidgetId
      ? (next[index].toolsEnabled ?? server.toolsEnabled ?? true)
      : (server.toolsEnabled ?? next[index].toolsEnabled ?? true),
  };
  return next;
};

// Helper function to check and show warning toast for too many tools
const checkToolCountWarning = (previousCount: number, newCount: number) => {
  if (previousCount < 100 && newCount >= 100) {
    toast.warning("Too many MCP tools available", {
      description:
        "For best results, we recommend keeping the number of active MCP server tools under 100, ideally closer to 50, since accuracy and reliability of integrations degrade as more tools are added.",
    });
  }
};

export const useMcpToolsStore = createWithEqualityFn<McpToolsState>()(
  subscribeWithSelector((set, get) => ({
    servers: [],
    mcpConnectionRegistry: {},
    clearAllStorage: () => {
      const { mcpConnectionRegistry } = get();
      for (const serverId in mcpConnectionRegistry) {
        mcpConnectionRegistry[serverId].clearStorage?.();
      }
    },
    updateServers: (servers) => {
      const mcpConnectionRegistry = { ...get().mcpConnectionRegistry };
      const iframeServers = get().servers.filter((server) => server.iframeWidgetId);
      const nextServers = servers.filter((server) => !server.iframeWidgetId);

      for (const iframeServer of iframeServers) {
        if (!nextServers.some((server) => shouldMergeServers(server, iframeServer))) {
          nextServers.push(iframeServer);
        }
      }

      for (const server of nextServers) {
        if (!mcpConnectionRegistry[server.id]) {
          mcpConnectionRegistry[server.id] = {
            callTool: undefined,
            state: "disconnected",
            tools: [],
            error: undefined,
            disconnect: () => {},
            clearStorage: () => {
              clearMcpAuthStorageForServer(server.url);
            },
            retry: () => {},
          };
        }
      }

      set({ servers: nextServers, mcpConnectionRegistry });
    },
    saveMCPServers: async () => {
      const { servers } = get();
      try {
        // Assuming you have a function to post servers to your backend
        await postMCPServers(servers.filter((server) => !server.iframeWidgetId));
      } catch (error) {
        console.error("Failed to save MCP servers:", error);
      }
    },
    debouncedSaveServers: debounce(async () => {
      get().saveMCPServers();
    }, 2000),
    getMCPConnection: (serverId) => get().mcpConnectionRegistry?.[serverId],
    updateMCPConnectionRegistry: (serverId, connection, remove = false) =>
      set((state) => {
        const newRegistry = { ...state.mcpConnectionRegistry };
        // If remove is true, delete the connection
        if (remove) delete newRegistry[serverId];
        else if (connection) newRegistry[serverId] = connection;

        return { mcpConnectionRegistry: newRegistry };
      }),
    getServerById: (serverId) => {
      const server = get().servers.find((s) => s.id === serverId);
      if (server) {
        const connection = get().getMCPConnection(serverId);
        return {
          ...server,
          connected: connection?.state === "ready" && server.enabled,
        };
      }
    },
    addServer: (server) => {
      set((state) => ({
        servers: upsertServer(state.servers, {
          ...server,
          toolsEnabled: server.iframeWidgetId ? true : undefined,
        }),
      }));
      if (!server.iframeWidgetId) get().debouncedSaveServers();
    },

    removeServer: (serverId, options) => {
      const shouldSave = !get().servers.find((s) => s.id === serverId)?.iframeWidgetId;
      const shouldClearStorage = options?.clearStorage ?? true;

      set((state) => {
        // Find the server being removed to clean up its connection
        const serverToRemove = state.servers.find((s) => s.id === serverId);
        if (serverToRemove) {
          const connection = get().getMCPConnection(serverToRemove.id);
          // Disconnect the MCP connection if it exists
          connection?.disconnect?.();
          if (shouldClearStorage) connection?.clearStorage?.();
          // Remove from the registry
          get().updateMCPConnectionRegistry(serverId, connection, true);
        }

        return {
          servers: state.servers.filter((s) => s.id !== serverId),
        };
      });

      if (shouldSave) get().debouncedSaveServers();
    },

    updateServer: (serverId, updates, refresh = false) => {
      const connection = get().getMCPConnection(serverId);
      // If enabling a server that previously failed, retry connection
      if (connection?.state === "failed" && updates.enabled) connection?.retry?.();

      set((state) => {
        const servers = state.servers.map((s) =>
          s.id === serverId ? { ...s, ...updates } : s,
        );

        if (updates.enabled !== undefined) {
          // If server is being disabled, disconnect it
          const connection = get().getMCPConnection(serverId);
          if (connection && !updates.enabled) {
            const state = connection.state;
            connection.disconnect?.();
            // Update state to disconnected or failed based on current state
            connection.state = state === "failed" ? "failed" : "disconnected";
            get().updateMCPConnectionRegistry(serverId, connection);
          }
        }

        const serverToUpdate = servers.find((s) => s.id === serverId);
        // If refresh is true, retry connection for enabled servers
        if (refresh && serverToUpdate?.enabled) {
          queueMicrotask(() => {
            const connection = get().getMCPConnection(serverId);
            connection?.retry?.();
          });
        }

        return { servers };
      });

      const server = get().servers.find((server) => server.id === serverId);
      if (!server?.iframeWidgetId) get().debouncedSaveServers();
    },

    disableServerAfterAuthCancel: (serverId) => {
      const server = get().getServerById(serverId);
      if (!server?.enabled) return; // already disabled, nothing to do
      get().updateServer(serverId, { enabled: false });

      toast.error(`${server.name} authentication cancelled`, {
        description: "Reconnect from MCP settings to try again.",
        action: {
          label: "Open MCP settings",
          onClick: () => {
            const url = new URL(window.location.href);
            url.pathname = "/app/ai";
            url.searchParams.set("tab", "mcp-servers");
            url.searchParams.set("serverId", serverId);
            window.history.replaceState({}, "", url.toString());
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
        },
      });
    },

    toggleServerTools: (serverId, enableAll) => {
      const previousEnabledCount = get().getEnabledToolCount();

      set((state) => ({
        servers: state.servers.map((s) => {
          if (s.id !== serverId) return s;

          // If enableAll is explicitly provided, use that value
          if (enableAll !== undefined) {
            return {
              ...s,
              toolsEnabled: enableAll,
              tools: s.tools.map((t) => ({ ...t, enabled: enableAll })),
            };
          }

          // Otherwise, toggle the toolsEnabled state
          return { ...s, toolsEnabled: !s.toolsEnabled };
        }),
      }));

      // Check for warning after state update
      const newEnabledCount = get().getEnabledToolCount();
      checkToolCountWarning(previousEnabledCount, newEnabledCount);

      // Save if we're changing individual tool states
      const server = get().servers.find((server) => server.id === serverId);
      if (enableAll !== undefined && !server?.iframeWidgetId) {
        get().debouncedSaveServers();
      }
    },

    toggleTool: (serverId, toolId, enable) => {
      const previousEnabledCount = get().getEnabledToolCount();
      // Handle array of tool IDs for bulk toggling
      const toolIds = Array.isArray(toolId) ? toolId : [toolId];

      set((state) => ({
        servers: state.servers.map((s) => {
          if (s.id !== serverId) return s;

          const tools = s.tools.map((t) =>
            toolIds.includes(t.id) ? { ...t, enabled: enable ?? !t.enabled } : t,
          );

          return {
            ...s,
            tools,
            toolsEnabled: tools.some((tool) => tool.enabled),
          };
        }),
      }));

      // Check for warning after state update
      const newEnabledCount = get().getEnabledToolCount();
      checkToolCountWarning(previousEnabledCount, newEnabledCount);

      const server = get().servers.find((server) => server.id === serverId);
      if (!server?.iframeWidgetId) get().debouncedSaveServers();
    },

    addToolsToServer: (serverId, tools) =>
      set((state) => {
        const { serverChanged, servers } = state.servers.reduce(
          (acc, server) => {
            if (server.id === serverId) {
              // Create a map of new tools by ID for easy lookup. Some MCP servers can
              // return duplicate tool entries across reconnects; keep one store entry.
              const newToolsMap = new Map(tools.map((tool) => [tool.id, tool]));

              // Update existing tools and collect truly new ones
              const updatedExistingTools: McpTool[] = [];
              const actuallyNewTools: McpTool[] = [];

              // Process existing tools - update them if we have new data, otherwise keep as-is
              for (const existingTool of server.tools) {
                const newTool = newToolsMap.get(existingTool.id);
                if (newTool) {
                  // Update existing tool with new data (especially schema)
                  updatedExistingTools.push({
                    ...existingTool,
                    ...newTool,
                    // Preserve some existing properties like enabled state
                    enabled: existingTool.enabled,
                  });
                  newToolsMap.delete(existingTool.id); // Remove from new tools map
                }
              }

              // Remaining tools in newToolsMap are actually new
              actuallyNewTools.push(...Array.from(newToolsMap.values()));

              // Create new server object if there are changes

              acc.serverChanged = true;
              acc.servers.push({
                ...server,
                tools: [...updatedExistingTools, ...actuallyNewTools],
                toolsEnabled: server.toolsEnabled ?? true,
              });
              return acc;
            }

            acc.servers.push(server);
            return acc;
          },
          {
            serverChanged: false,
            servers: [] as McpServer[],
          },
        );

        // Only update state if there were actual changes
        return serverChanged ? { servers } : state;
      }),

    getEnabledToolCount: () => {
      const { servers, getMCPConnection } = get();
      const seenIframeUrls = new Set<string>();
      return servers.reduce((count, server) => {
        const connection = getMCPConnection(server.id);
        const isConnected = connection?.state === "ready" && server.enabled;

        // Duplicate copies of the same iframe widget: only the first connected
        // copy is counted — it is the one the MCP Tools dropdown represents.
        if (server.iframeWidgetId) {
          if (!isConnected || seenIframeUrls.has(server.url)) return count;
          seenIframeUrls.add(server.url);
        }

        if (!(isConnected && server.toolsEnabled)) return count;
        for (const tool of server.tools) if (tool.enabled) count += 1;
        return count;
      }, 0);
    },

    /**
     * Builds the MCP tool list sent with each agent request. Runs outside
     * React at request time, hence the imperative store access. Iframe-bound
     * servers are deduped by url — duplicate copies of the same widget emit
     * one tool entry, attributed to the first connected copy. Param values are
     * merged across the copies: keys every copy agrees on become schema
     * defaults, while diverging keys drop their default and the description
     * lists each copy's value so the agent asks instead of silently using the
     * first copy's. Regular servers wait for pending connections before their
     * enabled tools are included.
     */
    getEnabledToolsForAgent: async () => {
      const { servers, getMCPConnection } = get();
      const enabledTools: AgentToolConfig[] = [];
      const seenToolKeys = new Set<string>();
      const pushEnabledTool = (tool: AgentToolConfig) => {
        const key = `${tool.server_id}:${tool.name}`;
        if (seenToolKeys.has(key)) return;
        seenToolKeys.add(key);
        enabledTools.push(tool);
      };

      // Current param values per iframe url, merged across duplicate widget
      // copies; each key maps to the distinct values the copies are showing.
      const iframeParamValues = new Map<string, Map<string, string[]>>();
      for (const server of servers) {
        if (!server.iframeWidgetId) continue;
        if (!server.enabled || getMCPConnection(server.id)?.state !== "ready") {
          continue;
        }
        let byKey = iframeParamValues.get(server.url);
        if (!byKey) {
          byKey = new Map();
          iframeParamValues.set(server.url, byKey);
        }
        for (const [key, val] of Object.entries(server.iframeParams ?? {})) {
          const values = byKey.get(key);
          if (!values) byKey.set(key, [val]);
          else if (!values.includes(val)) values.push(val);
        }
      }

      const seenIframeUrls = new Set<string>();
      for await (const server of servers) {
        let connection = getMCPConnection(server.id);

        if (server.iframeWidgetId) {
          if (
            server.enabled &&
            connection?.state === "ready" &&
            !seenIframeUrls.has(server.url)
          ) {
            // Claim the url slot before the toolsEnabled check so a duplicate
            // copy with different toggle state cannot re-emit tools the
            // dropdown's representative (first connected) copy has disabled.
            seenIframeUrls.add(server.url);
            if (!server.toolsEnabled) continue;
            const agreedParams: [string, string][] = [];
            const divergedParams: [string, string[]][] = [];
            for (const [key, values] of iframeParamValues.get(server.url) ?? []) {
              if (values.length === 1) agreedParams.push([key, values[0]]);
              else divergedParams.push([key, values]);
            }

            const agreedText = agreedParams.map(([k, v]) => `${k}=${v}`).join(", ");
            const divergedText = divergedParams
              .map(([k, values]) => `${k}=${values.join(" / ")}`)
              .join(", ");

            let paramSuffix = "";
            if (divergedText) {
              paramSuffix =
                `\n\nIMPORTANT: The user has multiple copies of this widget open with different parameter values (${divergedText}).` +
                (agreedText ? ` All copies share: ${agreedText}.` : "") +
                " Ask or infer from context which copy the user means, and always pass these parameter values explicitly when calling this tool.";
            } else if (agreedText) {
              paramSuffix = `\n\nIMPORTANT: The user is currently viewing this data on their workspace widget with these parameters: ${agreedText}. Always pass these parameter values when calling this tool to match what the user sees, unless the user explicitly asks for different values.`;
            }

            for (const tool of server.tools) {
              if (!tool.enabled) continue;
              let schema = tool.inputSchema;
              if (agreedParams.length > 0 && schema?.properties) {
                schema = structuredClone(schema);
                for (const [key, val] of agreedParams) {
                  if (schema.properties[key]) {
                    schema.properties[key] = {
                      ...schema.properties[key],
                      default: val,
                    };
                  }
                }
              }

              pushEnabledTool({
                server_id: server.id,
                name: `${server.name}_${tool.id}`,
                description: (tool.description || "") + paramSuffix,
                url: server.url,
                input_schema: schema,
              });
            }
          }
          continue;
        }

        // Original logic for regular servers (unchanged)
        if (!(server.enabled && server.toolsEnabled)) continue;
        connection?.retry?.();

        // wait till state is finished connecting/loading
        while (connection.state === "connecting" || connection.state === "loading") {
          connection = getMCPConnection(server.id);

          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        for (const tool of server.tools) {
          if (tool.enabled) {
            pushEnabledTool({
              server_id: server.id,
              name: `${server.name}_${tool.id}`,
              description: tool.description,
              url: server.url,
              input_schema: tool.inputSchema,
            });
          }
        }
      }

      return enabledTools;
    },
    removeVendorAppServer: (vendorAppUuid) => {
      removeServersBy(get, set, (s) => s.vendorAppUuid === vendorAppUuid);
    },
    removeSourceServer: (sourceId) => {
      removeServersBy(get, set, (s) => s.sourceId === sourceId);
    },
  })),
);

function removeServersBy(
  get: () => McpToolsState,
  set: (partial: Partial<McpToolsState>) => void,
  predicate: (s: McpServer) => boolean,
) {
  const state = get();
  const serversToRemove = state.servers.filter(predicate);
  if (serversToRemove.length === 0) return;

  const newRegistry = { ...state.mcpConnectionRegistry };
  for (const server of serversToRemove) {
    const connection = state.getMCPConnection(server.id);
    connection?.disconnect?.();
    connection?.clearStorage?.();
    delete newRegistry[server.id];
  }

  const removedIds = new Set(serversToRemove.map((s) => s.id));
  set({
    servers: state.servers.filter((s) => !removedIds.has(s.id)),
    mcpConnectionRegistry: newRegistry,
  });

  get().debouncedSaveServers();
}

// Shallow selector hook for better performance
export function useShallowMcpToolsStore<S extends McpToolsState, T>(
  selector: Selector<S, T>,
): T {
  return useMcpToolsStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
