import { useCallback, useMemo } from "react";
import { useDebouncedCallback } from "use-debounce";
import type { AdminApp } from "~/api/adminMarketplace.api";
import { formatDate } from "~/components/Apps/adminApps";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { Tag } from "~/components/ds/atoms/Tag";
import type { DataTableColumn, SortState } from "~/components/ds/molecules/DataTable";
import { DataTable } from "~/components/ds/molecules/DataTable";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import {
  useAdminMarketplaceApps,
  useRejectApp,
  useTransitionApp,
} from "~/hooks/useAdminMarketplace";
import { useStateReducer } from "~/hooks/useStateReducer";
import { RenderNoData } from "~/routes/admin";
import {
  MARKETPLACE_TABS,
  type MarketplaceTab,
  statusTagColor,
} from "~/routes/admin/marketplaceStatus";
import Tooltip from "../Tooltip";
import type { MarketplaceAction } from "./appActionModel";
import { selectApps } from "./appsTableModel";
import { ConfirmActionDialog, type ConfirmActionTarget } from "./ConfirmActionDialog";
import { RejectDialog } from "./RejectDialog";
import { ReviewAppDialog } from "./ReviewAppDialog";

const DEFAULT_SORT: SortState = { id: "updated_date", dir: "desc" };
const SEARCH_DEBOUNCE_MS = 250;

const getRowId = (app: AdminApp) => app.id;

export function AppsTab() {
  const {
    data: apps,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useAdminMarketplaceApps();
  const transition = useTransitionApp();
  const reject = useRejectApp();

  const [state, dispatch] = useStateReducer({
    tab: "in-review" as MarketplaceTab,
    search: "",
    sortState: DEFAULT_SORT as SortState,
    reviewApp: null as AdminApp | null,
    rejectApp: null as AdminApp | null,
    confirm: null as ConfirmActionTarget | null,
  });

  const setSearch = useDebouncedCallback(
    (search: string) => dispatch({ search }),
    SEARCH_DEBOUNCE_MS,
  );

  const data = useMemo(
    () => selectApps(apps, state.tab, state.search, state.sortState),
    [apps, state.tab, state.search, state.sortState],
  );

  const handleAction = useCallback(
    (app: AdminApp, action: MarketplaceAction) => {
      if (action === "publish" || action === "remove") {
        dispatch({ confirm: { app, action } });
        return;
      }
      if (action === "reject") {
        dispatch({ rejectApp: app });
        return;
      }
      transition.mutate({ id: app.id, action });
    },
    [dispatch, transition],
  );

  const handleConfirm = useCallback(async () => {
    const target = state.confirm;
    if (!target) return;
    try {
      await transition.mutateAsync({ id: target.app.id, action: target.action });
      dispatch({ confirm: null, reviewApp: null });
    } catch {
      // Error toast handled by the mutation; keep the dialog open to retry.
    }
  }, [state.confirm, transition, dispatch]);

  const handleReject = useCallback(
    async (reason: string) => {
      const app = state.rejectApp;
      if (!app) return;
      try {
        await reject.mutateAsync({ id: app.id, reason });
        dispatch({ rejectApp: null, reviewApp: null });
      } catch {
        // Error toast handled by the mutation.
      }
    },
    [state.rejectApp, reject, dispatch],
  );

  const columns = useMemo<DataTableColumn<AdminApp>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: "26%",
        minWidth: 160,
        sortable: true,
        cell: (app) => <span className="text-general-label">{app.name}</span>,
      },
      {
        id: "vendor_name",
        header: "Vendor",
        width: "22%",
        minWidth: 140,
        sortable: true,
        cell: (app) => app.vendor_name,
      },
      {
        id: "version",
        header: "Version",
        width: 90,
        sortable: true,
        cell: (app) => <span className="tabular-nums">{app.version}</span>,
      },
      {
        id: "status",
        header: "Status",
        width: 130,
        sortable: true,
        truncate: false,
        cell: (app) => <Tag color={statusTagColor(app.status)}>{app.status}</Tag>,
      },
      {
        id: "last_verified_at",
        header: "Last verified",
        width: "12%",
        minWidth: 130,
        sortable: true,
        cell: (app) => formatDate(app.last_verified_at ?? undefined),
      },
      {
        id: "updated_date",
        header: "Updated",
        width: "12%",
        minWidth: 130,
        sortable: true,
        cell: (app) => formatDate(app.updated_date ?? undefined),
      },
    ],
    [],
  );

  const renderRowActions = useCallback(
    (app: AdminApp) => (
      <Tooltip message="View app details">
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 obb-small-navbar-btn rounded flex items-center justify-center"
          onClick={() => dispatch({ reviewApp: app })}
        >
          <Icon id="app-details" className="size-3.5" />
        </button>
      </Tooltip>
    ),
    [dispatch],
  );

  return (
    <div className="p-6 flex flex-col flex-1 h-[calc(100vh-72px)]">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          size="xs"
          className="min-w-[240px] h-8 [&_input]:h-8"
          placeholder="Search apps"
          prefix={<Icon id="search" />}
          onChange={setSearch}
        />
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          loading={isFetching}
          onClick={() => refetch()}
        >
          <Icon id="refresh-icon-ds" className="size-3.5" />
          Refresh
        </Button>
      </div>

      <Tabs
        value={state.tab}
        onValueChange={(v) => dispatch({ tab: v as MarketplaceTab })}
        variant="filled_secondary"
        className="w-fit mt-4"
      >
        <TabsList className="bg-transparent p-0">
          {MARKETPLACE_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="w-auto">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="relative flex-1 mt-4 min-h-0">
        <DataTable
          columns={columns}
          data={data}
          getRowId={getRowId}
          virtualized
          estimateRowHeight={50}
          sortState={state.sortState}
          onSortChange={(sortState) => dispatch({ sortState })}
          renderRowActions={renderRowActions}
          actionsWidth={100}
          className="h-full"
        />
        {!data.length && (
          <div className="absolute inset-0">
            <RenderNoData isError={isError} isLoading={isLoading}>
              <div>No apps found</div>
            </RenderNoData>
          </div>
        )}
      </div>

      <ReviewAppDialog
        app={state.reviewApp}
        actionPending={transition.isPending || reject.isPending}
        onClose={() => dispatch({ reviewApp: null })}
        onAction={handleAction}
      />
      <RejectDialog
        app={state.rejectApp}
        isPending={reject.isPending}
        onClose={() => dispatch({ rejectApp: null })}
        onConfirm={handleReject}
      />
      <ConfirmActionDialog
        target={state.confirm}
        isPending={transition.isPending}
        onClose={() => dispatch({ confirm: null })}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
