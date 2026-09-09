import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getApps } from "~/api/admin.api";
import AppUsersDialog from "~/components/Apps/AppUsersDialog";
import { type App, dedupeApps, formatDate } from "~/components/Apps/adminApps";
import ExportAppsDialog from "~/components/Apps/ExportAppsDialog";
import ManageAppDialog from "~/components/Apps/ManageAppDialog";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import type { DataTableColumn, SortState } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import Icon from "~/components/Icon";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import type { Source } from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import { RenderNoData } from "~/routes/admin";

const DEFAULT_SORT: SortState = { id: "updated_date", dir: "desc" };

const getAppRowId = (app: App) => app.uuid;

const ACTION_BTN =
  "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center";

function UrlCell({ url }: { url: string }) {
  if (!url) return <>-</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link-color hover:underline truncate"
    >
      {url}
    </a>
  );
}

function appGroupKey(app: App): string {
  return `${app.name}|||${app.url}`;
}

function appSortValue(
  app: App,
  id: string,
  userCounts: Map<string, number>,
): string | number {
  switch (id) {
    case "name":
      return (app.name ?? "").toLowerCase();
    case "url":
      return (app.url ?? "").toLowerCase();
    case "user_email":
      return (app.user_email ?? "").toLowerCase();
    case "total_users":
      return userCounts.get(appGroupKey(app)) ?? 0;
    case "created_date":
      return Date.parse(app.created_date) || 0;
    case "updated_date":
      return Date.parse(app.updated_date) || 0;
    default:
      return "";
  }
}

function sortApps(
  apps: App[],
  sort: SortState | null,
  userCounts: Map<string, number>,
): App[] {
  if (!sort) return apps;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...apps].sort((a, b) => {
    const av = appSortValue(a, sort.id, userCounts);
    const bv = appSortValue(b, sort.id, userCounts);
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}

function StatTile({
  label,
  value,
  isLoading,
}: {
  label: string;
  value: string | number;
  isLoading: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 rounded-md border border-general-border-secondary
        bg-general-bg-secondary min-w-[160px] flex-1"
    >
      <div className="text-ds-text-caption body-xs-medium uppercase tracking-wide">
        {label}
      </div>
      <div className="text-ds-text-heading body-lg-semibold tabular-nums">
        {isLoading ? "—" : value}
      </div>
    </div>
  );
}

export default function AdminApps() {
  const setManageAppDialog = useShallowThemeStore((s) => s.setManageAppDialog);

  const [state, dispatch] = useStateReducer({
    selectedIds: new Set<string>(),
    openExport: false,
    search: "",
    sortState: DEFAULT_SORT as SortState,
    detailApp: null as App | null,
  });

  const appsQuery = useQuery({ queryKey: ["admin", "apps"], queryFn: getApps });

  const apps = useMemo(
    () => (appsQuery.data ? dedupeApps(appsQuery.data) : undefined),
    [appsQuery.data],
  );

  const userCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of apps ?? []) {
      const k = `${a.name}|||${a.url}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [apps]);

  const stats = useMemo(() => {
    const list = apps ?? [];
    const totalApps = list.length;
    const uniqueApps = userCounts.size;
    const usersWithApps = new Set(list.map((a) => a.user_uuid)).size;
    const avgPerUser =
      usersWithApps === 0 ? 0 : Math.round((totalApps / usersWithApps) * 10) / 10;
    return { totalApps, uniqueApps, usersWithApps, avgPerUser };
  }, [apps, userCounts]);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(state.search), 250);
    return () => clearTimeout(timeout);
  }, [state.search]);

  const data = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = apps ?? [];
    if (query) {
      rows = rows.filter(
        (a) =>
          a.name?.toLowerCase().includes(query) ||
          a.url?.toLowerCase().includes(query) ||
          a.user_email?.toLowerCase().includes(query),
      );
    }
    return sortApps(rows, state.sortState, userCounts);
  }, [apps, debouncedSearch, state.sortState, userCounts]);

  const selectedApps = useMemo(
    () => (apps ?? []).filter((a) => state.selectedIds.has(a.uuid)),
    [apps, state.selectedIds],
  );

  // Every user record sharing the selected app's (name, url).
  const detailApps = useMemo(() => {
    const target = state.detailApp;
    if (!target) return [];
    return (apps ?? []).filter((a) => a.name === target.name && a.url === target.url);
  }, [apps, state.detailApp]);

  const handleConnect = useCallback(
    (app: App) => {
      setManageAppDialog({
        isOpen: true,
        mode: "add",
        data: { name: app.name, url: app.url } as Source,
      });
    },
    [setManageAppDialog],
  );

  const handleAddBackend = useCallback(() => {
    setManageAppDialog({ isOpen: true, mode: "add", data: null });
  }, [setManageAppDialog]);

  const onToggleRow = useCallback(
    (id: string, checked: boolean) => {
      dispatch({
        selectedIds: (prev) => {
          const next = new Set(prev);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        },
      });
    },
    [dispatch],
  );

  const onToggleAll = useCallback(
    (rows: App[], checked: boolean) => {
      dispatch({
        selectedIds: (prev) => {
          const next = new Set(prev);
          for (const app of rows) {
            if (checked) next.add(app.uuid);
            else next.delete(app.uuid);
          }
          return next;
        },
      });
    },
    [dispatch],
  );

  const onSortChange = useCallback(
    (sortState: SortState) => dispatch({ sortState }),
    [dispatch],
  );

  const columns = useMemo<DataTableColumn<App>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: "26%",
        minWidth: 150,
        sortable: true,
        cell: (app) => <span className="text-general-label">{app.name || "-"}</span>,
      },
      {
        id: "url",
        header: "URL",
        width: "34%",
        minWidth: 180,
        sortable: true,
        cell: (app) => <UrlCell url={app.url} />,
      },
      {
        id: "user_email",
        header: "User Email",
        width: "20%",
        minWidth: 200,
        sortable: true,
        cell: (app) => app.user_email || "-",
      },
      {
        id: "total_users",
        header: "Total Users",
        width: 110,
        sortable: true,
        align: "right",
        cell: (app) => (
          <span className="tabular-nums">
            {userCounts.get(`${app.name}|||${app.url}`) ?? 0}
          </span>
        ),
      },
      {
        id: "created_date",
        header: "Created Date",
        width: "8%",
        minWidth: 150,
        sortable: true,
        cell: (app) => formatDate(app.created_date),
      },
      {
        id: "updated_date",
        header: "Last Updated",
        width: "8%",
        minWidth: 150,
        sortable: true,
        cell: (app) => formatDate(app.updated_date),
      },
    ],
    [userCounts],
  );

  const renderRowActions = useCallback(
    (app: App) => (
      <>
        <Tooltip position="top" message="View users">
          <button
            type="button"
            className={ACTION_BTN}
            onClick={() => dispatch({ detailApp: app })}
          >
            <Icon id="user-group" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip position="top" message="Connect backend">
          <button
            type="button"
            className={ACTION_BTN}
            onClick={() => handleConnect(app)}
          >
            <Icon id="external-link-icon" className="size-3.5" />
          </button>
        </Tooltip>
      </>
    ),
    [dispatch, handleConnect],
  );

  return (
    <SettingsLayout title="App Management" tabs={[]} defaultTab="apps">
      <TabsPrimitive.Content
        value="apps"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1 h-[calc(100vh-72px)]"
      >
        <div className="flex flex-wrap gap-3">
          <StatTile
            label="Total apps"
            value={stats.totalApps}
            isLoading={appsQuery.isLoading}
          />
          <StatTile
            label="Unique apps"
            value={stats.uniqueApps}
            isLoading={appsQuery.isLoading}
          />
          <StatTile
            label="Users with apps"
            value={stats.usersWithApps}
            isLoading={appsQuery.isLoading}
          />
          <StatTile
            label="Avg apps / user"
            value={stats.avgPerUser}
            isLoading={appsQuery.isLoading}
          />
        </div>

        <div className="obb-divider my-6" />

        <div className="flex items-center gap-[10px]">
          <Input
            size="xs"
            className="min-w-[270px] h-8 [&_input]:h-8"
            placeholder="Search"
            prefix={<Icon id="search" />}
            onChange={(value: string) => dispatch({ search: value })}
          />
          <div className="flex-1" />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAddBackend}
            title="Localhost backends won't be reachable from this dashboard"
          >
            <Icon id="plus-icon" className="size-3.5 mr-1" />
            Add backend
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => dispatch({ openExport: true })}
          >
            Export apps
          </Button>
        </div>

        <div className="relative flex-1 mt-6 min-h-0">
          <DataTable
            columns={columns}
            data={data}
            getRowId={getAppRowId}
            virtualized
            estimateRowHeight={50}
            selectedIds={state.selectedIds}
            onToggleRow={onToggleRow}
            onToggleAll={onToggleAll}
            sortState={state.sortState}
            onSortChange={onSortChange}
            renderRowActions={renderRowActions}
            actionsWidth={80}
            className="h-full"
          />
          {!data.length && (
            <div className="absolute bottom-0 left-0 right-0 top-0">
              <RenderNoData isError={appsQuery.isError} isLoading={appsQuery.isLoading}>
                <div>No apps found</div>
              </RenderNoData>
            </div>
          )}
        </div>

        <ExportAppsDialog
          open={state.openExport}
          onClose={() => dispatch({ openExport: false })}
          rows={data}
          selectedRows={selectedApps}
        />
        <AppUsersDialog
          open={!!state.detailApp}
          onClose={() => dispatch({ detailApp: null })}
          appName={state.detailApp?.name ?? ""}
          apps={detailApps}
        />
      </TabsPrimitive.Content>
      <ManageAppDialog />
    </SettingsLayout>
  );
}
