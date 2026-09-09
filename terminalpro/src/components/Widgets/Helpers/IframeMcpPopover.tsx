import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import {
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "~/components/ds/atoms/Popover";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import {
  type McpTool,
  PENDING_CONNECTION_STATES,
  useMcpToolsStore,
} from "~/lib/state/mcpTools";
import { cn } from "~/lib/utils";
import { getServerName } from "~/lib/utils/mcp";

interface IframeMcpPopoverProps {
  widgetId: string;
  widgetName: string;
  mcpUrl?: string;
}

interface McpState {
  serverId: string | null;
  serverUrl: string | null;
  serverEnabled: boolean;
  connectionState: string;
  connectionError: string | undefined;
  toolCount: number;
  tools: McpTool[];
  iframeParams: Record<string, string> | undefined;
}

const EMPTY_TOOLS: McpTool[] = [];
const EMPTY_STATE: McpState = {
  serverId: null,
  serverUrl: null,
  serverEnabled: false,
  connectionState: "disconnected",
  connectionError: undefined,
  toolCount: 0,
  tools: EMPTY_TOOLS,
  iframeParams: undefined,
};

const mcpStateEqual = (a: McpState, b: McpState) =>
  a.serverId === b.serverId &&
  a.serverUrl === b.serverUrl &&
  a.serverEnabled === b.serverEnabled &&
  a.connectionState === b.connectionState &&
  a.connectionError === b.connectionError &&
  a.toolCount === b.toolCount &&
  a.tools === b.tools &&
  a.iframeParams === b.iframeParams;

export const IframeMcpPopover = memo(
  ({ widgetId, widgetName, mcpUrl }: IframeMcpPopoverProps) => {
    const [url, setUrl] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const urlInitialized = useRef(false);
    const lockedMcpUrl = mcpUrl?.trim() ?? "";

    // Single subscription with fast field-level equality
    const {
      serverId,
      serverUrl,
      serverEnabled,
      connectionState,
      connectionError,
      toolCount,
      tools,
      iframeParams,
    } = useMcpToolsStore((s): McpState => {
      const srv = s.servers.find((srv) => srv.iframeWidgetId === widgetId);
      if (!srv) return EMPTY_STATE;
      const conn = s.getMCPConnection(srv.id);
      return {
        serverId: srv.id,
        serverUrl: srv.url,
        serverEnabled: srv.enabled,
        connectionState: conn?.state ?? "disconnected",
        connectionError: conn?.error ? String(conn.error) : undefined,
        toolCount: srv.tools?.length ?? 0,
        tools: srv.tools ?? EMPTY_TOOLS,
        iframeParams: srv.iframeParams,
      };
    }, mcpStateEqual);

    // Stable action refs
    const addServer = useMcpToolsStore((s) => s.addServer);
    const removeServer = useMcpToolsStore((s) => s.removeServer);
    const updateServer = useMcpToolsStore((s) => s.updateServer);

    // Initialize URL input from persisted server on mount
    useEffect(() => {
      const configuredUrl = serverUrl || lockedMcpUrl;
      if (configuredUrl && (!urlInitialized.current || lockedMcpUrl)) {
        setUrl(configuredUrl);
        urlInitialized.current = true;
      }
    }, [serverUrl, lockedMcpUrl]);

    const isConnected = serverEnabled && connectionState === "ready";
    const isPending =
      serverEnabled &&
      (PENDING_CONNECTION_STATES as readonly string[]).includes(connectionState);
    const isFailed = serverEnabled && connectionState === "failed";
    const hasServer = !!serverId;
    const hasLockedUrl = !!lockedMcpUrl;
    const hasConfiguredUrl = hasServer || hasLockedUrl;
    const displayUrl = serverUrl || lockedMcpUrl || url;

    const handleConnect = useCallback((): boolean => {
      const trimmed = (lockedMcpUrl || url).trim();
      if (!trimmed) return false;

      try {
        new URL(trimmed);
      } catch {
        return false;
      }

      const updates = {
        name: widgetName || getServerName(trimmed),
        url: trimmed,
        enabled: true,
        isLocal: trimmed.includes("localhost") || trimmed.includes("127.0.0.1"),
      };

      if (serverId) {
        updateServer(serverId, updates, true);
        return true;
      }

      addServer({
        id: `iframe-mcp-${widgetId}`,
        tools: [],
        iframeWidgetId: widgetId,
        ...updates,
      });
      return true;
    }, [lockedMcpUrl, url, widgetId, widgetName, serverId, addServer, updateServer]);

    const startEditing = useCallback(() => {
      setUrl(serverUrl ?? "");
      setIsEditing(true);
    }, [serverUrl]);

    const cancelEditing = useCallback(() => {
      setUrl(serverUrl ?? lockedMcpUrl);
      setIsEditing(false);
    }, [serverUrl, lockedMcpUrl]);

    const handleSaveEdit = useCallback(() => {
      if (handleConnect()) setIsEditing(false);
    }, [handleConnect]);

    const handleDisconnect = useCallback(() => {
      if (serverId) {
        if (lockedMcpUrl) {
          updateServer(serverId, { enabled: false });
          return;
        }

        removeServer(serverId);
        urlInitialized.current = false;
      }
    }, [serverId, lockedMcpUrl, removeServer, updateServer]);

    const handleRetry = useCallback(() => {
      if (serverId) updateServer(serverId, {}, true);
    }, [serverId, updateServer]);

    const statusColor = isConnected
      ? "bg-alert-success"
      : isFailed
        ? "bg-alert-error"
        : isPending
          ? "bg-alert-warning"
          : "bg-light-400 dark:bg-dark-300";

    const statusText = isConnected
      ? "Connected"
      : isFailed
        ? "Failed"
        : isPending
          ? "Connecting..."
          : "Disconnected";

    const tooltipMessage = useMemo(() => {
      if (!hasConfiguredUrl) return "Connect MCP Server";
      if (isConnected && toolCount > 0) return `MCP: ${toolCount} tools`;
      return `MCP: ${statusText}`;
    }, [hasConfiguredUrl, isConnected, toolCount, statusText]);

    return (
      <PopoverRoot>
        <PopoverTrigger asChild>
          <div>
            <Tooltip message={tooltipMessage}>
              <Button
                type="button"
                className={cn("flex gap-1 items-center w-fit px-1.5", {
                  "text-brand-main dark:text-brand-lighter": isConnected,
                })}
                size="xs"
                variant="secondary"
                data-testid="iframe-mcp-trigger"
              >
                <Icon id="mcp" className="min-w-4 w-4 h-4" />
                {hasConfiguredUrl && toolCount > 0 && (
                  <span className="text-xs tabular-nums">{toolCount}</span>
                )}
                {hasConfiguredUrl && !isConnected && (
                  <div
                    className={cn(
                      "absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full",
                      statusColor,
                    )}
                  />
                )}
              </Button>
            </Tooltip>
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={4}
          className="w-80 p-3"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between pb-2 border-b border-light-200 dark:border-dark-500">
            <span className="font-semibold text-sm text-light-900 dark:text-light-200">
              MCP Server
            </span>
            {hasConfiguredUrl && (
              <div className="flex items-center gap-1.5">
                {isPending && (
                  <div className="w-[9px] h-[9px] rounded-full border border-warning-100 border-t-transparent animate-spin" />
                )}
                <div className={cn("w-2 h-2 rounded-full", statusColor)} />
                <span className="text-2xs text-ds-text-caption">{statusText}</span>
              </div>
            )}
          </div>

          {hasConfiguredUrl ? (
            <div className="mt-2 space-y-3">
              {isEditing ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveEdit();
                  }}
                >
                  <Input
                    placeholder="MCP server URL"
                    value={url}
                    onChange={setUrl}
                    className="w-full [&_input]:h-[32px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="xs"
                      className="flex-1"
                      disabled={!url.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outlined"
                      size="xs"
                      className="flex-1"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-ds-text-caption break-all flex-1">
                    {displayUrl}
                  </div>
                  {!lockedMcpUrl && (
                    <Tooltip message="Edit URL">
                      <button
                        type="button"
                        onClick={startEditing}
                        className="text-ds-text-caption hover:text-light-900 dark:hover:text-light-200 shrink-0 mt-0.5"
                        aria-label="Edit URL"
                        data-testid="iframe-mcp-edit-url"
                      >
                        <Icon id="edit" className="size-3.5" />
                      </button>
                    </Tooltip>
                  )}
                </div>
              )}

              {!isEditing && connectionError && (
                <div className="text-xs text-alert-error break-words">
                  {connectionError}
                </div>
              )}

              {!isEditing && isConnected && toolCount > 0 && (
                <div>
                  <div className="text-xs font-medium text-light-900 dark:text-light-200 mb-1.5">
                    Tools ({toolCount})
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-0.5">
                    {tools.map((tool) => {
                      const params = tool.inputSchema?.properties;
                      return (
                        <Tooltip
                          key={tool.id}
                          position="left"
                          className="max-w-[300px] break-words"
                          message={
                            <div>
                              <div className="font-semibold mb-1">{tool.name}</div>
                              {tool.description && (
                                <div className="text-xs text-ds-text-caption mb-1">
                                  {tool.description}
                                </div>
                              )}
                              {params && Object.keys(params).length > 0 && (
                                <div className="text-xs mt-1.5 pt-1.5 border-t border-light-300 dark:border-dark-500">
                                  <div className="font-medium mb-0.5">Parameters:</div>
                                  {Object.entries(params).map(
                                    ([key, schema]: [string, any]) => (
                                      <div
                                        key={key}
                                        className="flex justify-between gap-2"
                                      >
                                        <span className="text-ds-text-caption">
                                          {key}
                                        </span>
                                        <span className="font-mono text-brand-main dark:text-brand-lighter">
                                          {iframeParams?.[key] ??
                                            schema?.default ??
                                            "—"}
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              )}
                            </div>
                          }
                        >
                          <div className="text-xs text-ds-text-caption px-2 py-1 rounded bg-light-50 dark:bg-dark-800 truncate">
                            {tool.name}
                          </div>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="flex gap-2">
                  {isFailed && (
                    <Button
                      onClick={handleRetry}
                      variant="secondary"
                      size="xs"
                      className="flex-1"
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    onClick={serverEnabled ? handleDisconnect : handleConnect}
                    variant="outlined"
                    size="xs"
                    className="flex-1"
                  >
                    {serverEnabled ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form
              className="mt-2 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleConnect();
              }}
            >
              <Input
                placeholder="MCP server URL"
                value={url}
                onChange={setUrl}
                className="w-full [&_input]:h-[32px]"
              />
              <Button
                type="submit"
                variant="primary"
                size="xs"
                className="w-full"
                disabled={!url.trim()}
              >
                Connect
              </Button>
            </form>
          )}
        </PopoverContent>
      </PopoverRoot>
    );
  },
);
