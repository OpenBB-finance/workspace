import { useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { deleteApiSource, deleteWidgetMetadata } from "~/api/auth.api";
import { useStateReducer } from "~/hooks/useStateReducer";
import type { Source, WidgetMetadataItem } from "~/lib/state/backendConnector";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  formatBackendErrorMessage,
  formatBackendWarningMessage,
} from "~/utils/zodErrors";
import {
  deleteSourceWidgets,
  updateWidgetEndpoints,
} from "../DataConnectors/common/helpers";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Input } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { ConfirmDialog } from "../ds/dialogs/ConfirmDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";
import { cn } from "../ds/utils";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

type ManageAppsState = {
  loading: boolean;
  search: string;
  selectedSources: string[];
  deleteConfirmOpen: boolean;
  deleting: boolean;
  refreshLoadingId: string;
  deleteWidgetsFromStudioAssociated: boolean; // widgets from widget studio
};

export default function ManageAppsDialog() {
  const { manageAppsDialogOpen, setManageAppsDialogOpen, setManageAppDialog } =
    useShallowThemeStore((state) => ({
      manageAppsDialogOpen: state.manageAppsDialogOpen,
      setManageAppsDialogOpen: state.setManageAppsDialogOpen,
      setManageAppDialog: state.setManageAppDialog,
    }));
  const {
    apiSources,
    removeApiSource,
    updateApiSource,
    widgetMetadata,
    setWidgetMetadata,
    getApiSourceById,
  } = useShallowBackendConnectorStore((state) => ({
    apiSources: state.apiSources,
    removeApiSource: state.removeApiSource,
    updateApiSource: state.updateApiSource,
    widgetMetadata: state.widgetMetadata,
    setWidgetMetadata: state.setWidgetMetadata,
    getApiSourceById: state.getApiSourceById,
  }));

  const [state, dispatch] = useStateReducer<ManageAppsState>({
    loading: false,
    search: "",
    selectedSources: [],
    deleteConfirmOpen: false,
    deleting: false,
    refreshLoadingId: "",
    deleteWidgetsFromStudioAssociated: true,
  });

  const closeManageApps = useCallback(() => {
    setManageAppsDialogOpen(false);
  }, [setManageAppsDialogOpen]);

  const handleToggleAll = useCallback(() => {
    dispatch({
      selectedSources: (prev) => {
        if (prev.length === apiSources.length) return [];

        return apiSources.map((source) => source.id);
      },
    });
  }, [apiSources]);

  const handleToggleSource = useCallback((sourceId: string) => {
    dispatch({
      selectedSources: (prev) =>
        prev.includes(sourceId)
          ? prev.filter((id) => id !== sourceId)
          : [...prev, sourceId],
    });
  }, []);

  const handleDeleteClick = useCallback(() => {
    dispatch({ deleteConfirmOpen: true });
  }, []);

  const handleDelete = useCallback(async () => {
    dispatch({ deleteConfirmOpen: false, deleting: true });
    const updatedState = { deleting: false } as ManageAppsState;
    try {
      await Promise.all(
        state.selectedSources.map(async (sourceId) => {
          const source = getApiSourceById(sourceId);
          if (source) {
            if (state.deleteWidgetsFromStudioAssociated) {
              // we need to check for all widget studio elements with widget.widgetConfig.sourceId and widget.widgetConfig.sourceName
              const widgetStudioToDelete = widgetMetadata.filter(
                (widget) =>
                  widget.widgetType === "widget_studio" &&
                  widget.widgetConfig.sourceId === source.id &&
                  widget.widgetConfig.sourceName === source.name,
              );

              let lastResult: WidgetMetadataItem[] = [];

              for (const widget of widgetStudioToDelete) {
                lastResult = await deleteWidgetMetadata(widget.widgetId);
              }

              setWidgetMetadata(lastResult);
            }

            deleteSourceWidgets(source);
            await deleteApiSource(sourceId);
            removeApiSource(sourceId);
          }
        }),
      );

      toast.success(
        `${state.selectedSources.length > 1 ? "Apps" : "App"} deleted successfully`,
      );
      updatedState.selectedSources = [];
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete apps");
    } finally {
      dispatch(updatedState);
    }
  }, [state.selectedSources, getApiSourceById, updateApiSource, closeManageApps]);

  const handleAddAppClick = useCallback(() => {
    setManageAppDialog({ isOpen: true, mode: "add", data: null });
  }, [setManageAppDialog]);

  const handleEditSource = useCallback(
    (source: Source) => {
      setManageAppDialog({ isOpen: true, mode: "edit", data: source });
    },
    [setManageAppDialog],
  );

  const handleRefreshSource = useCallback(
    async (source: Source) => {
      const updatedState = { loading: false, refreshLoadingId: "" } as ManageAppsState;
      try {
        dispatch({ refreshLoadingId: source.id, loading: true });
        const { widgets, errorMessage, templateErrorMessage, templateWarningMessage } =
          await updateApiSource(source);

        if (errorMessage || templateErrorMessage) {
          toast.error("Failed to refresh backend", {
            id: "refresh-error",
            description: (
              <div className="max-h-80 overflow-y-auto">
                {formatBackendErrorMessage(errorMessage, templateErrorMessage)}
              </div>
            ),
            duration: 5000,
          });

          return dispatch(updatedState);
        }

        if (templateWarningMessage) {
          toast.warning("Backend refreshed with warnings", {
            id: "refresh-warning",
            description: (
              <div className="max-h-80 overflow-y-auto">
                {formatBackendWarningMessage(templateWarningMessage)}
              </div>
            ),
            duration: 5000,
          });
        }

        updateWidgetEndpoints({ ...source, widgets });
        setTimeout(() => dispatch(updatedState), 1000);
      } catch (error) {
        console.error(error);
        dispatch(updatedState);
      }
    },
    [updateApiSource],
  );

  const handleDeleteSource = useCallback((source: Source) => {
    dispatch({ deleteConfirmOpen: true, selectedSources: [source.id] });
  }, []);

  const filteredSources = useMemo(() => {
    if (!state.search) return apiSources;

    return apiSources.filter(
      (source) =>
        source.name.toLowerCase().includes(state.search.toLowerCase()) ||
        source.url.toLowerCase().includes(state.search.toLowerCase()),
    );
  }, [apiSources, state.search]);

  const affectedWidgets = useMemo(() => {
    const selectedSourcesData = apiSources.filter((source) =>
      state.selectedSources.includes(source.id),
    );

    return selectedSourcesData.flatMap((source) =>
      widgetMetadata.filter(
        (widget) =>
          widget.widgetType === "widget_studio" &&
          widget.widgetConfig.sourceId === source.id &&
          widget.widgetConfig.sourceName === source.name,
      ),
    );
  }, [apiSources, state.selectedSources, widgetMetadata]);

  return (
    <>
      <BaseDialog
        open={manageAppsDialogOpen}
        onClose={closeManageApps}
        className="max-h-[80vh] only-sm:min-h-[60vh] lg:min-w-[692px] lg:min-h-[504px]"
      >
        <DialogTitle>Manage Backends</DialogTitle>
        <DialogDescription className="sr-only">
          Manage the backends available in the OpenBB Workspace.
        </DialogDescription>
        <div className="flex only-sm:flex-wrap sm:justify-between gap-2.5 items-center">
          <div className="only-sm:w-full">
            <Input
              placeholder="Search for a backend"
              className="w-full min-w-0 sm:flex-1 h-[32px] [&_input]:h-[32px]"
              value={state.search}
              onChange={(search: string) => dispatch({ search })}
              prefix={<Icon id="search" className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddAppClick}
              disabled={state.deleting}
              loading={state.deleting}
              className="flex-1 sm:flex-none"
            >
              Connect Backend
            </Button>
            <div className="h-8 flex p-1 items-center rounded bg-white border-light-200 dark:bg-dark-800 border dark:border-dark-750">
              <button
                className="obb-small-navbar-btn rounded flex items-center justify-center size-7"
                onClick={handleDeleteClick}
                disabled={state.selectedSources.length === 0}
              >
                <Icon id="trash-04" className="size-3.5" />
              </button>
              <div className="w-px h-5 mx-1 bg-light-200 dark:bg-dark-400" />
              <div className="size-6 flex items-center justify-center">
                <Checkbox
                  checked={
                    state.selectedSources.length === 0
                      ? false
                      : state.selectedSources.length === apiSources.length
                        ? true
                        : "indeterminate"
                  }
                  onCheckedChange={handleToggleAll}
                  disabled={apiSources.length === 0}
                  className={cn({
                    "opacity-50 cursor-not-allowed": apiSources.length === 0,
                  })}
                />
              </div>
            </div>
          </div>
        </div>
        {apiSources.length === 0 ? (
          <SearchResultsNotFound
            icon={false}
            firstMessage="No backends found"
            secondMessage="You haven't added any backend URLs yet."
            children={
              <Button
                className="mt-4"
                variant="primary"
                size="sm"
                onClick={handleAddAppClick}
              >
                Connect Backend
              </Button>
            }
            extraClassName="flex-1 flex flex-col gap-2 dark:bg-dark-850 bg-light-50 rounded py-2.5"
          />
        ) : filteredSources.length === 0 ? (
          <SearchResultsNotFound
            icon={true}
            firstMessage="No results found"
            secondMessage="Try adjusting your search criteria."
            extraClassName="flex-1 flex flex-col gap-2 dark:bg-dark-850 bg-light-50 rounded py-2.5"
          />
        ) : (
          <div
            className={cn(
              "flex-1 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto",
              {
                "opacity-50 cursor-not-allowed pointer-events-none": state.deleting,
              },
            )}
          >
            {filteredSources.map((source) => (
              <div
                key={source.id}
                className="group flex items-center gap-2.5 justify-between py-[13px] px-2.5 dark:bg-dark-800 bg-light-50 rounded"
              >
                <div className="flex flex-row items-center gap-1.5 flex-1 min-w-0">
                  <p className="body-xs-medium text-light-900 dark:text-light-100 whitespace-nowrap flex-shrink-0">
                    {source.name}
                  </p>
                  <p className="body-xs-regular text-light-600 dark:text-dark-50 truncate min-w-0">
                    {source.url}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <div
                    className={cn(
                      "group-hover:opacity-100 only-sm:opacity-100 flex items-center gap-2 opacity-0",
                      "border-r border-light-200 pr-2 dark:border-dark-500 transition-opacity duration-200",
                      state.refreshLoadingId === source.id ? "opacity-100" : "",
                    )}
                  >
                    <Tooltip message="Delete">
                      <button
                        className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                        onClick={() => handleDeleteSource(source)}
                      >
                        <Icon id="trash-04" className="size-4" />
                      </button>
                    </Tooltip>
                    <Tooltip message="Edit">
                      <button
                        className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                        onClick={() => handleEditSource(source)}
                      >
                        <Icon id="pencil-02" className="size-4" />
                      </button>
                    </Tooltip>
                    <Tooltip message="Refresh">
                      <button
                        className="obb-small-navbar-btn rounded flex items-center justify-center size-5"
                        onClick={() => handleRefreshSource(source)}
                      >
                        <Icon
                          id="refresh-icon"
                          className={cn("size-4", {
                            "animate-spin": state.refreshLoadingId === source.id,
                          })}
                        />
                      </button>
                    </Tooltip>
                  </div>
                  <Tooltip
                    message={
                      source.status === "success" ? (
                        "Backend is connected"
                      ) : source.status === "pending" ? (
                        "Backend is connecting"
                      ) : (
                        <span>
                          Backend not connected. Please check your{" "}
                          <Link to="/app/widgets" className="obb-hyper-link">
                            connections
                          </Link>
                        </span>
                      )
                    }
                  >
                    <span
                      className={cn("w-4 h-4 rounded-full", {
                        "bg-green-500": source.status === "success",
                        "bg-red-500": source.status === "error",
                        "bg-yellow-500": source.status === "pending",
                      })}
                    />
                  </Tooltip>
                  <Checkbox
                    checked={state.selectedSources.includes(source.id)}
                    onCheckedChange={() => handleToggleSource(source.id)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </BaseDialog>

      <ConfirmDialog
        open={state.deleteConfirmOpen}
        onClose={() => dispatch({ deleteConfirmOpen: false })}
        title="Delete Apps"
        description={
          <div className="flex flex-col gap-3">
            <p className="text-sm text-light-600 dark:text-dark-50">
              Are you sure you want to delete the selected apps?
            </p>
            <div className="flex flex-col gap-2 text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border-[1.5px] border-amber-700 dark:border-amber-700">
              <div className="flex items-center gap-2">
                <Icon
                  id="warning-icon"
                  className="h-4 w-4 flex-shrink-0 text-amber-500"
                />
                <p className="font-bold text-light-800 dark:text-white text-xs leading-[18px]">
                  Warning
                </p>
              </div>
              <p className="text-xs text-light-800 dark:text-white">
                Widgets already added to dashboards will be disabled. This action cannot
                be undone.
              </p>

              {affectedWidgets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={state.deleteWidgetsFromStudioAssociated}
                      onCheckedChange={(checked) =>
                        dispatch({
                          deleteWidgetsFromStudioAssociated: checked as boolean,
                        })
                      }
                    />
                    <span className="body-xs-regular text-light-900 dark:text-light-100">
                      Also delete associated widgets from Widget Studio (
                      {affectedWidgets.length})
                    </span>
                  </div>

                  {state.deleteWidgetsFromStudioAssociated && (
                    <div className="ml-6 space-y-1">
                      <p className="body-xs-regular text-light-600 dark:text-dark-50">
                        The following widgets will be deleted:
                      </p>
                      <div className="max-h-24 overflow-y-auto space-y-1">
                        {affectedWidgets.map((widget) => (
                          <p
                            key={widget.widgetId}
                            className="body-xs-regular text-light-600 dark:text-dark-50 ml-2"
                          >
                            • {widget.widgetConfig.name || `Widget ${widget.widgetId}`}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        }
        confirmButton={
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
    </>
  );
}
