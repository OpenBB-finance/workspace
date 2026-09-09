import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import { Button } from "~/components/ds/atoms/Button";
import {
  type ConnectionStatus,
  ConnectionStatusDot,
} from "~/components/ds/atoms/ConnectionStatusDot";
import {
  LibraryItem,
  LibraryRow,
  LibrarySection,
} from "~/components/ds/molecules/LibraryList";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import { ManageMcpServer } from "~/components/McpServerModal";
import {
  TabPageEmptyState,
  TabPageLayout,
  TabPageSearchInput,
  TabPageToolbar,
} from "~/components/shared/TabPage";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  type McpServer,
  PENDING_CONNECTION_STATES,
  useShallowMcpToolsStore,
} from "~/lib/state/mcpTools";
import { cn } from "~/lib/utils";
import { McpServerSourceTag } from "./McpServerSourceTag";
import { ToolDescriptionMarkdown } from "./McpToolsDropdown";

function isPendingConnectionState(state: string): boolean {
  return (PENDING_CONNECTION_STATES as readonly string[]).includes(state);
}

type MCPTabState = {
  search: string;
  addServerOpen: boolean;
  editServerId: string | null;
};

export function MCPServersTab() {
  const [state, dispatch] = useStateReducer<MCPTabState>({
    search: "",
    addServerOpen: false,
    editServerId: null,
  });
  const [debouncedSearch] = useDebounceValue(state.search, 300);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightServerId = searchParams.get("serverId");

  const servers = useShallowMcpToolsStore((s) =>
    s.servers.filter((server) => !server.iframeWidgetId),
  );
  const removeServer = useShallowMcpToolsStore((s) => s.removeServer);

  const handleModalClose = useCallback(() => {
    dispatch({ addServerOpen: false, editServerId: null });
  }, []);

  const handleEdit = useCallback(
    (editServerId: string) => dispatch({ editServerId }),
    [],
  );
  const handleDelete = useCallback(
    (id: string) => {
      const serverName = servers.find((s) => s.id === id)?.name;
      removeServer(id);
      toast.success(`${serverName || "Server"} deleted successfully`);
    },
    [removeServer, servers],
  );

  const handleSearchChange = useCallback(
    (search: string) => {
      dispatch({ search });
      if (inputRef.current && !search) {
        inputRef.current.value = search;
      }
    },
    [inputRef],
  );

  const filteredServers = useMemo(() => {
    if (!debouncedSearch) return servers;
    const term = debouncedSearch.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.url.toLowerCase().includes(term) ||
        s.tools?.some(
          (t) =>
            t.name?.toLowerCase().includes(term) ||
            t.description?.toLowerCase().includes(term),
        ),
    );
  }, [servers, debouncedSearch]);

  return (
    <>
      <TabPageLayout>
        <TabPageToolbar className="flex-nowrap">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TabPageSearchInput
              ref={inputRef}
              placeholder="Search for MCP Servers"
              defaultValue={state.search}
              onChange={handleSearchChange}
              className="w-full min-w-[120px] max-w-[420px]"
            />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => dispatch({ addServerOpen: true })}
            >
              Add Server
            </Button>
          </div>
        </TabPageToolbar>

        {servers.length === 0 ? (
          <TabPageEmptyState
            title="No MCP Server added"
            description="You haven't added any MCP Server yet."
            action={
              <Button
                size="sm"
                variant="primary"
                className="mt-2"
                onClick={() => dispatch({ addServerOpen: true })}
              >
                Add your first MCP Server
              </Button>
            }
          />
        ) : filteredServers.length === 0 && debouncedSearch ? (
          <SearchResultsNotFound
            extraClassName="rounded-lg bg-general-bg-primary p-12 h-[200px]"
            icon={true}
          />
        ) : (
          <div>
            <hr className="mt-2 border-surface-divider" />
            <div className="flex flex-col">
              {filteredServers.map((server) => (
                <MCPServerCard
                  key={server.id}
                  server={server}
                  searchTerm={debouncedSearch}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  highlight={highlightServerId === server.id}
                  onHighlightConsumed={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete("serverId");
                    setSearchParams(next, { replace: true });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </TabPageLayout>
      <ManageMcpServer
        open={state.addServerOpen || !!state.editServerId}
        onClose={handleModalClose}
        existingServerId={state.editServerId}
      />
    </>
  );
}

type McpServerCardProps = {
  server: McpServer;
  searchTerm: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  highlight?: boolean;
  onHighlightConsumed?: () => void;
};

const MCPServerCard = memo((props: McpServerCardProps) => {
  const { server, searchTerm, onEdit, onDelete, highlight, onHighlightConsumed } =
    props;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!highlight) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlash(true);
    const t = window.setTimeout(() => {
      setFlash(false);
      onHighlightConsumed?.();
    }, 2000);
    return () => window.clearTimeout(t);
  }, [highlight, onHighlightConsumed]);
  const { connection, connectionTools, updateServer } = useShallowMcpToolsStore((s) => {
    const conn = s.getMCPConnection(server.id);
    return {
      connection: conn,
      connectionTools: conn?.tools || [],
      updateServer: s.updateServer,
    };
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [userClosed, setUserClosed] = useState(false);
  const prevConnectionStateRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const connectionState = connection?.state ?? "disconnected";
  const isPending = isPendingConnectionState(connectionState);
  const isConnected = server.enabled && (isPending || connectionState === "ready");
  const hasCachedTools = server.tools.length > 0;
  const canExpand = isConnected || hasCachedTools;

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevConnectionStateRef.current = connectionState;
      return;
    }
    if (prevConnectionStateRef.current !== connectionState) {
      if (connectionState === "ready") {
        toast.success(`Connected to ${server.name}`);
      } else if (connectionState === "failed") {
        toast.error(`Failed to connect to ${server.name}`);
      }
      prevConnectionStateRef.current = connectionState;
    }
  }, [connectionState, server.name]);

  const dotStatus = useMemo<ConnectionStatus>(() => {
    if (isPending) return "pending";
    if (!server.enabled) return "disconnected";
    if (connectionState === "ready") return "connected";
    if (connectionState === "failed") return "error";
    if (hasCachedTools) return "error";
    return "disconnected";
  }, [server.enabled, connectionState, isPending, hasCachedTools]);

  const statusLabel = useMemo(() => {
    switch (connectionState) {
      case "connecting":
        return "Connecting…";
      case "discovering":
        return "Discovering…";
      case "authenticating":
        return "Authenticating…";
      case "loading":
        return "Loading tools…";
      default:
        return undefined;
    }
  }, [connectionState]);

  const handleToggleConnection = useCallback(() => {
    updateServer(server.id, { enabled: !isConnected });
  }, [server.id, isConnected, updateServer]);

  const displayTools = useMemo(
    () => (connectionTools.length > 0 ? connectionTools : server.tools),
    [connectionTools, server.tools],
  );

  const filteredTools = useMemo(() => {
    if (!searchTerm) return displayTools;
    const term = searchTerm.toLowerCase();
    return displayTools.filter(
      (t) =>
        t.name?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term),
    );
  }, [displayTools, searchTerm]);

  const toolCount = searchTerm ? filteredTools.length : displayTools.length;

  const handleEdit = useCallback(() => onEdit(server.id), [onEdit, server.id]);
  const handleDelete = useCallback(() => onDelete(server.id), [onDelete, server.id]);

  useEffect(() => {
    if (!searchTerm && canExpand && userClosed) setUserClosed(false);
    if (searchTerm && canExpand && !userClosed) setIsExpanded(true);
  }, [canExpand, searchTerm, userClosed]);

  return (
    <LibraryRow
      ref={cardRef}
      className={cn(
        "transition-colors duration-700 ease-out",
        flash && "bg-brand-main/[0.08] dark:bg-brand-lighter/[0.08]",
      )}
    >
      <LibrarySection
        title={server.name}
        count={toolCount}
        description={<McpServerSourceTag server={server} />}
        open={isExpanded && !userClosed}
        onOpenChange={() =>
          canExpand &&
          setIsExpanded((prev) => {
            setUserClosed(prev);
            return !prev;
          })
        }
        disabled={!canExpand}
        rightSection={
          <div className="flex items-center gap-3">
            <div className="group-hover:opacity-100 opacity-0 flex items-center gap-1 transition-opacity duration-200">
              {/* waiting for @jose-donato GIVE ME THAT ICON */}
              {/* <Tooltip message="Clear authentication">
                <button
                  className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                  onClick={() => connection?.clearStorage()}
                >
                  <Icon id="refresh-icon" className="size-3.5" />
                </button>
              </Tooltip> */}
              <Tooltip message="Edit">
                <button
                  className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                  onClick={handleEdit}
                >
                  <Icon id="pencil-02" className="size-3.5" />
                </button>
              </Tooltip>
              <Tooltip message="Delete">
                <button
                  className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                  onClick={handleDelete}
                >
                  <Icon id="trash-04" className="size-3.5" />
                </button>
              </Tooltip>
            </div>
            <ConnectionStatusDot status={dotStatus} label={statusLabel} size="md" />
            <Button onClick={handleToggleConnection} variant="secondary" size="xs">
              {isConnected ? "Disconnect" : "Connect"}
            </Button>
          </div>
        }
      >
        <div className="pb-3 flex flex-col gap-2 mt-2.5">
          {filteredTools.length > 0 ? (
            filteredTools.map(
              (tool: { name: string; description?: string }, index: number) => (
                <LibraryItem
                  key={`${tool.name}-${index}`}
                  title={tool.name}
                  expandable={true}
                  variant="card"
                >
                  {tool.description && (
                    <>
                      <hr className="border-surface-divider my-2.5 ml-6" />
                      <div className="ml-6">
                        <ToolDescriptionMarkdown content={tool.description} />
                      </div>
                    </>
                  )}
                </LibraryItem>
              ),
            )
          ) : isConnected && connectionTools.length === 0 ? (
            <p className="text-xs text-light-500 dark:text-light-400 py-2">
              Discovering tools...
            </p>
          ) : searchTerm ? (
            <p className="text-xs text-light-500 dark:text-light-400 py-2">
              No tools match your search
            </p>
          ) : (
            <p className="text-xs text-light-500 dark:text-light-400 py-2">
              No tools available
            </p>
          )}
        </div>
      </LibrarySection>
    </LibraryRow>
  );
});
