import { useQueries, useQuery } from "@tanstack/react-query";
import {
  forwardRef,
  type MouseEvent,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getApiSources, removeCustomCopilot } from "~/api/auth.api";
import type { BackendPermissionsT } from "~/api/user_roles.api";
import { deleteSourceWidgets } from "~/components/DataConnectors/common/helpers";
import { Button } from "~/components/ds/atoms/Button";
import { CollapsibleSection } from "~/components/ds/atoms/CollapsibleSection";
import { ConnectionStatusDot } from "~/components/ds/atoms/ConnectionStatusDot";
import { HintLabel } from "~/components/ds/atoms/HintLabel";
import { Select } from "~/components/ds/atoms/Select";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import type { DataTableColumn } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { TabPageFilterGroup, TabPageSearchInput } from "~/components/shared/TabPage";
import Tooltip from "~/components/Tooltip";
import { useUserSubscriptions } from "~/hooks/useListedApps";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import {
  type Source,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import {
  type ExternalCopilotHolder,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowPermissionsStore } from "~/lib/state/permissions";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";

type SortOption = {
  label: string;
  value: "newest" | "oldest" | "a-z" | "z-a" | "last-activity";
};

type FilterOption = {
  label: string;
  value: "all" | "my-connections" | "shared";
};

const FILTER_OPTIONS: FilterOption[] = [
  { label: "All", value: "all" },
  { label: "My Connections", value: "my-connections" },
  { label: "Shared with me", value: "shared" },
];

const sortOptions: SortOption[] = [
  { label: "Last Updated", value: "last-activity" },
  { label: "Last Added", value: "newest" },
  { label: "First Added", value: "oldest" },
  { label: "Name A-Z", value: "a-z" },
  { label: "Name Z-A", value: "z-a" },
];

type ConnectionRow = {
  id: string;
  name: string;
  hostname: string;
  url: string;
  widgetCount: number;
  appCount: number;
  agentCount: number;
  promptCount: number;
  status: Source["status"];
  createdDate?: string;
  updatedDate?: string;
  isShared: boolean;
  backend?: Source;
  sharedBackend?: BackendPermissionsT;
  agentHolders: ExternalCopilotHolder[];
  type: "backend" | "agent-only" | "mixed" | "shared";
  canEdit: boolean;
};

type ConnectionsState = {
  search: string;
  sortBy: SortOption["value"];
  filterBy: FilterOption["value"];
  selectedConnections: Set<string>;
  deleteConfirmOpen: boolean;
  connectionToDelete: ConnectionRow | null;
  deleteMultipleConfirmOpen: boolean;
  isDeleting: boolean;
  isRefreshing: boolean;
  userClosed: Record<"active" | "inactive", boolean>;
};

function getHostname(url: string): string {
  try {
    const { hostname, port } = new URL(url);
    return port ? `${hostname}:${port}` : hostname;
  } catch {
    return url;
  }
}

type ConnectionsToolbarProps = {
  search: string;
  sortBy: SortOption["value"];
  filterBy: FilterOption["value"];
  dispatch: StateDispatch<ConnectionsState>;
  selectedCount: number;
  onConnectBackend: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onRefresh: () => void;
  isRefreshing: boolean;
};

const ConnectionsToolbar = memo(
  forwardRef<HTMLDivElement, ConnectionsToolbarProps>((props, _ref) => {
    const {
      search,
      sortBy,
      filterBy,
      selectedCount,
      dispatch,
      onConnectBackend,
      inputRef,
      onRefresh,
      isRefreshing,
    } = props;

    const onDeleteSelected = useCallback(() => {
      dispatch({ deleteMultipleConfirmOpen: true });
    }, []);

    return (
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <TabPageSearchInput
            ref={inputRef}
            placeholder="Search for connections"
            defaultValue={search}
            onChange={(search: string) => {
              dispatch({ search });
              if (inputRef.current) {
                inputRef.current.value = search;
              }
            }}
          />
          <TabPageFilterGroup>
            <Select
              options={sortOptions}
              placeholder="Sort by"
              className="h-8"
              value={sortBy}
              onChange={(sortBy: SortOption["value"]) => dispatch({ sortBy })}
            />
            <Select
              options={FILTER_OPTIONS}
              placeholder="Filter by"
              className="h-8"
              value={filterBy}
              onChange={(filterBy: FilterOption["value"]) => dispatch({ filterBy })}
            />
          </TabPageFilterGroup>
        </div>
        <div className="flex items-center gap-2.5">
          {selectedCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDeleteSelected}
              className="h-8"
            >
              <Icon id="trash-04" className="size-3.5" />
              Delete connection{selectedCount > 1 ? "s" : ""}
            </Button>
          )}
          <Tooltip position="top" message="Refresh all backends">
            <Button
              className="h-8 w-8"
              variant="secondary"
              onClick={onRefresh}
              disabled={isRefreshing || selectedCount > 0}
              loading={isRefreshing}
              loadingChildren={null}
            >
              <Icon
                id="refresh-icon-ds"
                className="w-4 min-w-4 h-4 min-h-4 dark:text-light-100"
              />
            </Button>
          </Tooltip>
          <Button
            size="sm"
            variant="primary"
            onClick={onConnectBackend}
            disabled={selectedCount > 0}
          >
            Connect Backend
          </Button>
        </div>
      </div>
    );
  }),
);

function formatLastActivity(date?: string): string {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "-";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString();
}

const navigateClick = {
  widget: "/app/widgets?backend=",
  app: "/app?backend=",
  prompt: "/app/ai?tab=prompts&backend=",
} as const;

const COUNT_LINK_CLASS =
  "text-brand-main dark:text-brand-lighter underline underline-offset-2 hover:opacity-80 transition-opacity";

function isConnected(connection: ConnectionRow): boolean {
  return connection.status === "success";
}

// "pending" sources are still being validated by the worker; "rehydrated" ones
// were restored from cache and are awaiting revalidation.
function isValidating(connection: ConnectionRow): boolean {
  return connection.status === "pending" || connection.status === "rehydrated";
}

function displayCount(connection: ConnectionRow, count: number): string | number {
  if (!isConnected(connection) || count === 0) return "-";
  return count;
}

function NameCell({ connection }: { connection: ConnectionRow }) {
  const validating = isValidating(connection);

  const handleCopyUrl = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(connection.url);
      toast.success("URL copied to clipboard");
    },
    [connection.url],
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      <HintLabel
        tooltip={
          <span className="flex items-center gap-1.5">
            <span className="truncate max-w-[240px]">{connection.url}</span>
            <button
              type="button"
              onClick={handleCopyUrl}
              className="shrink-0 rounded p-0.5 hover:bg-general-bg-primary-hover transition-colors"
            >
              <Icon id="copy-03" className="size-3" />
            </button>
          </span>
        }
        className="text-left block truncate"
      >
        {connection.name}
      </HintLabel>
      {validating && (
        <Tooltip position="top" message="Validating connection...">
          <ConnectionStatusDot status="pending" className="shrink-0" />
        </Tooltip>
      )}
      {connection.isShared && (
        <Tooltip message="Shared" position="top">
          <span className="bg-tag-orange-bg min-w-[22px] min-h-[22px] size-[22px] rounded-full flex items-center justify-center">
            <Icon id="user-group" className="text-tag-orange-label size-[12px]" />
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function CountCell({
  connection,
  kind,
  count,
  onNavigate,
}: {
  connection: ConnectionRow;
  kind: keyof typeof navigateClick;
  count: number;
  onNavigate: (path: string) => void;
}) {
  const backendId = connection.backend?.uuid ?? connection.backend?.id;
  const linkable = isConnected(connection) && count > 0 && !!connection.backend;

  if (linkable && backendId) {
    return (
      <button
        type="button"
        className={COUNT_LINK_CLASS}
        onClick={() => onNavigate(`${navigateClick[kind]}${backendId}`)}
      >
        {count}
      </button>
    );
  }
  return <>{displayCount(connection, count)}</>;
}

type ConnectionRowActionsProps = {
  connection: ConnectionRow;
  onEdit: (source: Source) => void;
  onDelete: (connection: ConnectionRow) => void;
  onRefresh: (connectionId: string) => Promise<any>;
};

const ConnectionRowActions = memo<ConnectionRowActionsProps>((props) => {
  const { connection, onEdit, onDelete, onRefresh } = props;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canRefresh = !!connection.backend;
  const disableEdit = !!connection.backend?.vendorAppUuid;

  const handleRefresh = useCallback(async () => {
    if (!connection.backend?.id) return;

    setIsRefreshing(true);

    try {
      await onRefresh(connection.backend.id);
    } catch {
      toast.error(`Failed to refresh ${connection.name}`);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, connection.backend, connection.name]);

  const handleEdit = useCallback(() => {
    if (!connection.backend) return;
    onEdit(connection.backend);
  }, [onEdit, connection.backend]);

  const handleDelete = useCallback(() => onDelete(connection), [onDelete, connection]);

  return (
    <>
      {canRefresh && (
        <Tooltip position="top" message="Refresh backend">
          <button
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center",
              { "opacity-100": isRefreshing },
            )}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <Icon
              id="refresh-icon-ds"
              className={cn("size-3.5", { "animate-spin": isRefreshing })}
            />
          </button>
        </Tooltip>
      )}

      {connection.canEdit && (
        <Tooltip
          message={
            disableEdit ? "Marketplace backends can't be edited" : "Edit backend"
          }
          position="top"
        >
          <button
            className={cn(
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "duration-300 obb-small-navbar-btn",
              "rounded flex items-center justify-center",
              disableEdit && "group-hover:opacity-40 cursor-not-allowed",
            )}
            onClick={disableEdit ? undefined : handleEdit}
          >
            <Icon id="edit" className="size-3.5" />
          </button>
        </Tooltip>
      )}

      {!connection.isShared && (
        <Tooltip position="top" message="Delete connection">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
            onClick={handleDelete}
          >
            <Icon id="trash-04" className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </>
  );
});

type ConnectionsTableProps = {
  connections: ConnectionRow[];
  selectedConnections: Set<string>;
  dispatch: StateDispatch<ConnectionsState>;
  highlightId?: string | null;
  onHighlightConsumed?: () => void;
};

const getConnectionRowId = (connection: ConnectionRow) => connection.id;
const isConnectionSelectable = (connection: ConnectionRow) => !connection.isShared;

const ConnectionsTable = memo<ConnectionsTableProps>((props) => {
  const {
    connections,
    selectedConnections,
    dispatch,
    highlightId,
    onHighlightConsumed,
  } = props;

  const navigate = useNavigate();
  const setManageAppDialog = useShallowThemeStore((s) => s.setManageAppDialog);
  const refreshApiSourceById = useShallowBackendConnectorStore(
    (s) => s.refreshApiSourceById,
  );

  const onNavigate = useCallback((path: string) => navigate(path), [navigate]);

  const onEdit = useCallback(
    (source: Source) => {
      setManageAppDialog({
        isOpen: true,
        mode: "edit",
        data: source,
      });
    },
    [setManageAppDialog],
  );

  const onRefresh = useCallback(
    async (connectionId: string) => await refreshApiSourceById(connectionId),
    [refreshApiSourceById],
  );

  const onDelete = useCallback(
    (c: ConnectionRow) => dispatch({ connectionToDelete: c, deleteConfirmOpen: true }),
    [dispatch],
  );

  const onToggleRow = useCallback(
    (connectionId: string, checked: boolean) => {
      dispatch({
        selectedConnections: (prev) => {
          const next = new Set(prev);
          if (checked) {
            next.add(connectionId);
          } else {
            next.delete(connectionId);
          }
          return next;
        },
      });
    },
    [dispatch],
  );

  const onToggleAll = useCallback(
    (rows: ConnectionRow[], checked: boolean) => {
      dispatch({
        selectedConnections: (prev) => {
          const next = new Set(prev);
          for (const c of rows) {
            if (checked) {
              next.add(c.id);
            } else {
              next.delete(c.id);
            }
          }
          return next;
        },
      });
    },
    [dispatch],
  );

  const columns = useMemo<DataTableColumn<ConnectionRow>[]>(
    () => [
      {
        id: "name",
        header: "Backends",
        width: "fill",
        minWidth: 240,
        truncate: false,
        cell: (c) => <NameCell connection={c} />,
        cellClassName: "body-xs-medium overflow-hidden",
      },
      {
        id: "apps",
        header: "Apps",
        width: 85,
        align: "center",
        truncate: false,
        cell: (c) => (
          <CountCell
            connection={c}
            kind="app"
            count={c.appCount}
            onNavigate={onNavigate}
          />
        ),
      },
      {
        id: "widgets",
        header: "Widgets",
        width: 85,
        align: "center",
        truncate: false,
        cell: (c) => (
          <CountCell
            connection={c}
            kind="widget"
            count={c.widgetCount}
            onNavigate={onNavigate}
          />
        ),
      },
      {
        id: "prompts",
        header: "Prompts",
        width: 85,
        align: "center",
        truncate: false,
        cell: (c) => (
          <CountCell
            connection={c}
            kind="prompt"
            count={c.promptCount}
            onNavigate={onNavigate}
          />
        ),
      },
      {
        id: "agents",
        header: "Agents",
        width: 85,
        align: "center",
        truncate: false,
        cell: (c) => displayCount(c, c.agentCount),
      },
      {
        id: "activity",
        header: "Last Updated",
        width: 120,
        align: "center",
        cell: (c) => formatLastActivity(c.updatedDate || c.createdDate),
      },
    ],
    [onNavigate],
  );

  const renderRowActions = useCallback(
    (c: ConnectionRow) => (
      <ConnectionRowActions
        connection={c}
        onEdit={onEdit}
        onDelete={onDelete}
        onRefresh={onRefresh}
      />
    ),
    [onEdit, onDelete, onRefresh],
  );

  return (
    <DataTable
      columns={columns}
      data={connections}
      getRowId={getConnectionRowId}
      selectedIds={selectedConnections}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
      isRowSelectable={isConnectionSelectable}
      renderRowActions={renderRowActions}
      actionsWidth={100}
      highlightRowId={highlightId}
      onHighlightConsumed={onHighlightConsumed}
    />
  );
});

const initialState: ConnectionsState = {
  search: "",
  sortBy: "last-activity",
  filterBy: "all",
  selectedConnections: new Set(),
  deleteConfirmOpen: false,
  connectionToDelete: null,
  deleteMultipleConfirmOpen: false,
  isDeleting: false,
  isRefreshing: false,
  userClosed: { active: false, inactive: false },
};

export default function ConnectionsPage() {
  const [state, dispatch] = useStateReducer(initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  // Deep-link target from a backend card's "Go to connection" action: scroll to
  // and flash the matching row (see ConnectionRowComponent).
  const [searchParams, setSearchParams] = useSearchParams();
  const connectionId = searchParams.get("connectionId");

  const onHighlightConsumed = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("connectionId");
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  useUserSubscriptions();

  const { apiSources, updateApiSources, deleteApiSource } =
    useShallowBackendConnectorStore((s) => ({
      apiSources: s.apiSources,
      updateApiSources: s.updateApiSources,
      deleteApiSource: s.deleteApiSource,
    }));

  const { externalCopilotHolders, setExternalCopilotHolders } = useShallowCopilotStore(
    (s) => ({
      externalCopilotHolders: s.externalCopilotHolders,
      setExternalCopilotHolders: s.setExternalCopilotHolders,
    }),
  );

  const permissions = useShallowPermissionsStore((s) => s.permissions);
  const setManageAppDialog = useShallowThemeStore((s) => s.setManageAppDialog);

  const { isFetching, refetch } = useQuery({
    queryKey: ["apiSources"],
    queryFn: async () => await getApiSources().then(updateApiSources),
    enabled: true,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const { connectionRows, agentOnlyRows } = useMemo(() => {
    const connectionRows = [] as ConnectionRow[];
    const agentOnlyRows = {} as { [hostname: string]: string };
    const myBackendHostnames = new Set<string>();
    const agentsByHostname = new Map<string, ExternalCopilotHolder[]>();

    for (const holder of externalCopilotHolders) {
      const hostname = getHostname(holder.url);
      const existing = agentsByHostname.get(hostname) || [];
      agentsByHostname.set(hostname, [...existing, holder]);
    }

    for (const backend of apiSources) {
      const hostname = getHostname(backend.url);
      myBackendHostnames.add(hostname);
      const matchedAgents = agentsByHostname.get(hostname) || [];
      // Use agents from backend.agents (fetched from agents.json), fall back to hostname-matched agents
      const agentCount =
        backend.agents?.length ??
        matchedAgents.reduce((acc, h) => acc + (h.copilots?.length || 0), 0);
      const promptCount = (backend.templates || []).reduce(
        (acc, t) => acc + (t.prompts?.length || 0),
        0,
      );

      connectionRows.push({
        id: backend.id,
        name: backend.name,
        hostname,
        url: backend.url,
        widgetCount: Object.keys(backend.widgets || {}).length,
        appCount: (backend.templates || []).length,
        agentCount,
        promptCount,
        status: backend.status || "pending",
        createdDate: backend.createdDate,
        updatedDate: backend.updatedDate,
        isShared: false,
        backend,
        agentHolders: matchedAgents,
        type: agentCount > 0 ? "mixed" : "backend",
        canEdit: !backend.isEntityBackend,
      });

      agentsByHostname.delete(hostname);
    }

    for (const sharedBackend of permissions.backends) {
      const hostname = getHostname(sharedBackend.url);
      const promptCount = (sharedBackend.templates || []).reduce(
        (acc, t) => acc + (t.prompts?.length || 0),
        0,
      );

      connectionRows.push({
        id: `shared-${sharedBackend.uuid}`,
        name: sharedBackend.name,
        hostname,
        url: sharedBackend.url,
        widgetCount: sharedBackend.widgets?.length || 0,
        appCount: sharedBackend.templates?.length || 0,
        agentCount: 0,
        promptCount,
        status: "success",
        createdDate: undefined,
        updatedDate: undefined,
        isShared: true,
        sharedBackend,
        agentHolders: [],
        type: "shared",
        canEdit: false,
      });
    }

    for (const [hostname, holders] of agentsByHostname) {
      const agentCount = holders.reduce((acc, h) => acc + (h.copilots?.length || 0), 0);
      const firstHolder = holders[0];
      const firstAgent = firstHolder?.copilots?.[0];

      const agentConnection: ConnectionRow = {
        id: `agent-${firstHolder?.uuid}-${hostname}`,
        name: firstAgent?.name || hostname,
        hostname,
        url: firstHolder.url,
        widgetCount: 0,
        appCount: 0,
        agentCount,
        promptCount: 0,
        status: "pending",
        createdDate: undefined,
        updatedDate: undefined,
        isShared: false,
        backend: undefined,
        agentHolders: holders,
        type: "agent-only",
        canEdit: false,
      };
      agentOnlyRows[hostname] = agentConnection.url;
      connectionRows.push(agentConnection);
    }

    return { connectionRows, agentOnlyRows };
  }, [apiSources, externalCopilotHolders, permissions.backends]);

  /**
   * Checks connectivity status for agent-only connections (those without a backend).
   * Performs a simple HTTP GET to each agent URL to determine if it's reachable.
   */
  const agentQueries = useQueries({
    queries: Object.entries(agentOnlyRows).map(([hostname, url]) => ({
      queryKey: ["agentStatus", hostname, url],
      queryFn: async () => {
        try {
          const response = await fetch(url, { method: "GET", mode: "cors" });
          return response.ok ? "success" : "error";
        } catch {
          return "error";
        }
      },
      enabled: true,
      refetchOnWindowFocus: false,
    })),
  });

  const agentOnlyStatuses = useMemo(() => {
    const agentOnlyHostnames = Object.keys(agentOnlyRows);
    return agentQueries.reduce(
      (acc, query, idx) => {
        if (query.isLoading) return acc;
        const hostname = agentOnlyHostnames[idx];
        if (query.isSuccess && query.data) {
          acc[hostname] = query.data;
        } else if (query.isError) {
          acc[hostname] = "error";
        }
        return acc;
      },
      {} as Record<string, "success" | "error">,
    );
  }, [agentQueries, agentOnlyRows]);

  const handleRefresh = useCallback(async () => {
    dispatch({ isRefreshing: true });
    try {
      const agentsRefresh = agentQueries.map(async (q) => await q.refetch());
      await refetch();
      await Promise.all(agentsRefresh);
      toast.success("Backends refreshed");
    } catch {
      toast.error("Failed to refresh backends");
    } finally {
      dispatch({ isRefreshing: false });
    }
  }, [refetch, agentQueries]);

  /**
   * Deletes a single connection after user confirmation.
   * Handles both backend deletion (via API) and associated agent holders.
   * For "mixed" connections, deletes both the backend and all linked agents.
   * Updates local state after successful API calls to keep UI in sync.
   */
  const handleConfirmDelete = useCallback(async () => {
    const { connectionToDelete } = state;
    if (!connectionToDelete) return;
    dispatch({ isDeleting: true });
    try {
      if (connectionToDelete.backend) {
        deleteSourceWidgets(connectionToDelete.backend);
        await deleteApiSource(connectionToDelete.backend);
      }

      if (connectionToDelete.agentHolders.length > 0) {
        await Promise.all(
          connectionToDelete.agentHolders.map((h) => removeCustomCopilot(h.uuid)),
        );
        const remainingHolders = externalCopilotHolders.filter(
          (h) => !connectionToDelete.agentHolders.some((ah) => ah.uuid === h.uuid),
        );
        setExternalCopilotHolders(remainingHolders);
      }

      toast.success(`Connection "${connectionToDelete.name}" deleted successfully`);
      dispatch({ deleteConfirmOpen: false, connectionToDelete: null });
    } catch (error) {
      toast.error("Failed to delete connection");
    } finally {
      dispatch({ isDeleting: false });
    }
  }, [
    state.connectionToDelete,
    deleteApiSource,
    externalCopilotHolders,
    setExternalCopilotHolders,
  ]);

  /**
   * Bulk deletes all selected connections after user confirmation.
   * Processes backends and agent holders separately to handle mixed connection types.
   * Backends are deleted via API first, then associated agent holders are removed.
   * Clears selection state after successful deletion.
   */
  const handleConfirmDeleteSelected = useCallback(async () => {
    dispatch({ isDeleting: true });
    try {
      const connectionsToDelete = connectionRows.filter((c) =>
        state.selectedConnections.has(c.id),
      );

      const backendsToDelete = connectionsToDelete.filter((c) => c.backend);
      await Promise.all(
        backendsToDelete.map(async (connection) => {
          deleteSourceWidgets(connection.backend);
          await deleteApiSource(connection.backend);
        }),
      );

      const allAgentHoldersToDelete = connectionsToDelete.flatMap(
        (c) => c.agentHolders,
      );
      if (allAgentHoldersToDelete.length > 0) {
        await Promise.all(
          allAgentHoldersToDelete.map((h) => removeCustomCopilot(h.uuid)),
        );
        const remainingHolders = externalCopilotHolders.filter(
          (h) => !allAgentHoldersToDelete.some((ah) => ah.uuid === h.uuid),
        );
        setExternalCopilotHolders(remainingHolders);
      }

      dispatch({ selectedConnections: new Set(), deleteMultipleConfirmOpen: false });
      toast.success("Connections deleted successfully");
    } catch (error) {
      toast.error("Failed to delete connections");
    } finally {
      dispatch({ isDeleting: false });
    }
  }, [
    connectionRows,
    state.selectedConnections,
    deleteApiSource,
    externalCopilotHolders,
    setExternalCopilotHolders,
  ]);

  const { connections, hasConnections, noResults } = useMemo(() => {
    const searchLower = state.search.toLowerCase();
    const connections = connectionRows.reduce(
      (acc, c) => {
        if (c.type === "agent-only" && agentOnlyStatuses[c.hostname]) {
          c.status = agentOnlyStatuses[c.hostname];
        }

        const key = c.status === "error" ? "inactive" : "active";
        if (state.filterBy === "my-connections" && c.isShared) return acc;
        if (state.filterBy === "shared" && !c.isShared) return acc;
        if (
          state.search &&
          !(
            c.name?.toLowerCase().includes(searchLower) ||
            c.url?.toLowerCase().includes(searchLower)
          )
        )
          return acc;

        acc[key].push(c);
        return acc;
      },
      {
        active: [] as ConnectionRow[],
        inactive: [] as ConnectionRow[],
      },
    );

    sortConnections(connections.active, state.sortBy);
    sortConnections(connections.inactive, state.sortBy);

    const hasConnections = connectionRows.length > 0;
    const noResults =
      hasConnections &&
      connections.active.length === 0 &&
      connections.inactive.length === 0;

    return { connections, hasConnections, noResults };
  }, [connectionRows, state.search, state.filterBy, state.sortBy, agentOnlyStatuses]);

  // In addition to highlighting the row, open the edit modal for the
  // deep-linked connection when its backend is editable (skips marketplace /
  // entity backends, which can't be edited).
  const openedEditFor = useRef<string | null>(null);
  useEffect(() => {
    if (!connectionId) {
      openedEditFor.current = null;
      return;
    }
    if (openedEditFor.current === connectionId) return;
    const target = connectionRows.find((c) => c.id === connectionId);
    if (target?.backend && target.canEdit && !target.backend.vendorAppUuid) {
      openedEditFor.current = connectionId;
      setManageAppDialog({ isOpen: true, mode: "edit", data: target.backend });
    }
  }, [connectionId, connectionRows, setManageAppDialog]);

  const handleConnectBackend = useCallback(() => {
    setManageAppDialog({ isOpen: true, mode: "add", data: null });
  }, [setManageAppDialog]);

  const onOpenChange = useCallback((section: "active" | "inactive", open: boolean) => {
    dispatch({ userClosed: (prev) => ({ ...prev, [section]: !open }) });
  }, []);

  return (
    <SettingsLayout title="Connections" tabs={[]}>
      <div className="p-6 flex flex-col gap-4 min-h-[calc(100vh-72px)]">
        <ConnectionsToolbar
          search={state.search}
          sortBy={state.sortBy}
          filterBy={state.filterBy}
          selectedCount={state.selectedConnections.size}
          dispatch={dispatch}
          onConnectBackend={handleConnectBackend}
          inputRef={inputRef}
          onRefresh={handleRefresh}
          isRefreshing={state.isRefreshing || isFetching}
        />

        {isFetching && !hasConnections ? (
          <div className="flex flex-1 items-center justify-center">
            <BrandedLoadingState message="Loading connections..." />
          </div>
        ) : noResults ? (
          <SearchResultsNotFound
            extraClassName="col-span-full rounded-lg bg-general-bg-primary p-12 h-[200px]"
            icon={true}
            firstMessage="No connections found"
            secondMessage="Try searching for a different connection."
          />
        ) : hasConnections ? (
          <>
            {connections.active.length > 0 && (
              <CollapsibleSection
                defaultOpen={true}
                open={state.search ? !state.userClosed.active : undefined}
                onOpenChange={
                  state.search ? (open) => onOpenChange("active", open) : undefined
                }
                header={({ isOpen }) => (
                  <div className="flex items-center gap-2 py-2 px-1 body-xs-medium text-ds-text-body cursor-pointer">
                    <Icon
                      id="chevron-right"
                      className={cn("size-4 transition-transform duration-200", {
                        "rotate-90": isOpen,
                      })}
                    />
                    <span>Active ({connections.active.length})</span>
                  </div>
                )}
              >
                <ConnectionsTable
                  connections={connections.active}
                  selectedConnections={state.selectedConnections}
                  dispatch={dispatch}
                  highlightId={connectionId}
                  onHighlightConsumed={onHighlightConsumed}
                />
              </CollapsibleSection>
            )}

            {connections.inactive.length > 0 && (
              <CollapsibleSection
                defaultOpen={false}
                open={state.search ? !state.userClosed.inactive : undefined}
                onOpenChange={
                  state.search ? (open) => onOpenChange("inactive", open) : undefined
                }
                header={({ isOpen }) => (
                  <div className="flex items-center gap-2 py-2 px-1 body-xs-medium text-ds-text-body cursor-pointer">
                    <Icon
                      id="chevron-right"
                      className={cn("size-4 transition-transform duration-200", {
                        "rotate-90": isOpen,
                      })}
                    />
                    <span>Inactive ({connections.inactive.length})</span>
                  </div>
                )}
              >
                <ConnectionsTable
                  connections={connections.inactive}
                  selectedConnections={state.selectedConnections}
                  dispatch={dispatch}
                />
              </CollapsibleSection>
            )}
          </>
        ) : (
          <SearchResultsNotFound
            extraClassName="col-span-full rounded-lg bg-general-bg-primary p-12 h-[200px]"
            icon={true}
            firstMessage="No connections added"
            secondMessage="Please connect your first backend"
          >
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={handleConnectBackend}
            >
              Connect Backend
            </Button>
          </SearchResultsNotFound>
        )}
      </div>

      <ConfirmDialog
        open={state.deleteConfirmOpen}
        onClose={() => dispatch({ deleteConfirmOpen: false })}
        title="Delete connection"
        description={`Are you sure you want to delete "${state.connectionToDelete?.name}"?${state.connectionToDelete?.type === "mixed" ? " This will also remove associated agents." : ""} This action cannot be undone.`}
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmDelete}
            loading={state.isDeleting}
            disabled={state.isDeleting}
          >
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />

      <ConfirmDialog
        open={state.deleteMultipleConfirmOpen}
        onClose={() => dispatch({ deleteMultipleConfirmOpen: false })}
        title="Delete connections"
        description={`Are you sure you want to delete ${state.selectedConnections.size} connection(s)? This action cannot be undone.`}
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmDeleteSelected}
            loading={state.isDeleting}
            disabled={state.isDeleting}
          >
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
    </SettingsLayout>
  );
}

const StatusOrder = { success: 0, rehydrated: 1, pending: 1, error: 2 };

function sortConnections(connections: ConnectionRow[], sortBy: SortOption["value"]) {
  connections.sort((a, b) => {
    switch (sortBy) {
      case "last-activity": {
        const statusDiff = StatusOrder[a.status] - StatusOrder[b.status];
        if (statusDiff !== 0) return statusDiff;
        const aDate = new Date(a.updatedDate || a.createdDate || 0).getTime();
        const bDate = new Date(b.updatedDate || b.createdDate || 0).getTime();
        return bDate - aDate;
      }
      case "newest":
        return (
          new Date(b.createdDate || 0).getTime() -
          new Date(a.createdDate || 0).getTime()
        );
      case "oldest":
        return (
          new Date(a.createdDate || 0).getTime() -
          new Date(b.createdDate || 0).getTime()
        );
      case "a-z":
        return (a.name || "").localeCompare(b.name || "");
      case "z-a":
        return (b.name || "").localeCompare(a.name || "");
      default:
        return 0;
    }
  });
}
