import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useStateReducer } from "~/hooks/useStateReducer";
import { extractTabsFromItem } from "~/hooks/useTabsInfo";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { type DashboardInfo, generateFolderReport, slugify } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Select } from "../ds/atoms/Select";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ds/dialogs/Dialog";
import { ExportProgress } from "../ds/molecules/ExportProgress";

type ExportFolderState = {
  loading: boolean;
  exportType: "png" | "pdf";
  exportScope: "current" | "all-tabs";
  exportProgress: {
    dashboard: {
      current: number;
      total: number;
      name: string;
    };
    tab: {
      current: number;
      total: number;
      name: string;
    } | null;
  } | null;
};

export default function ExportFolderDialog() {
  const [state, dispatch] = useStateReducer<ExportFolderState>({
    loading: false,
    exportType: "pdf",
    exportScope: "current",
    exportProgress: null,
  });

  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const isLoadingData = isFetching > 0 || isMutating > 0;

  const isLoadingDataRef = useRef(isLoadingData);
  useEffect(() => {
    isLoadingDataRef.current = isLoadingData;
  }, [isLoadingData]);

  const checkIfLoadingData = useCallback(() => {
    return isLoadingDataRef.current;
  }, [isLoadingDataRef]);

  const {
    exportFolderPopup,
    setExportFolderPopup,
    exportFolderItem,
    theme,
    setPendingExport,
  } = useShallowThemeStore((state) => ({
    exportFolderPopup: state.exportFolderPopup,
    setExportFolderPopup: state.setExportFolderPopup,
    exportFolderItem: state.exportFolderItem,
    theme: state.theme,
    setPendingExport: state.setPendingExport,
  }));

  const items = useShallowAppStore((state) => state.items);

  const dashboards = useMemo(() => {
    if (!(exportFolderItem?.id && items)) return [];

    const result: DashboardInfo[] = [];

    function recurse(children: string[]) {
      for (const childId of children) {
        const child = items[childId];
        if (child?.isFolder && child?.children) {
          recurse(child.children);
        } else if (child && !child.isFolder && child.data) {
          const tabs = extractTabsFromItem(child);

          result.push({
            id: childId,
            name: child.data.name || childId,
            tabs,
          });
        }
      }
    }

    const folder = items[exportFolderItem.id];
    if (folder?.children) {
      recurse(folder.children);
    }

    return result;
  }, [exportFolderItem?.id, items]);

  const totalTabs = useMemo(() => {
    return dashboards.reduce((acc, d) => acc + Math.max(d.tabs.length, 1), 0);
  }, [dashboards]);

  const handleClose = useCallback(() => {
    setExportFolderPopup(false);
    dispatch({
      loading: false,
      exportType: "pdf",
      exportScope: "current",
      exportProgress: null,
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (dashboards.length === 0) {
      toast.error("No dashboards to export", {
        description: "This folder doesn't contain any dashboards.",
      });
      return;
    }

    setPendingExport(true);
    dispatch({
      loading: true,
      exportProgress: {
        dashboard: { current: 0, total: dashboards.length, name: "" },
        tab: null,
      },
    });

    await generateFolderReport(
      checkIfLoadingData,
      dashboards,
      exportFolderItem?.name || "folder",
      slugify(exportFolderItem?.name || "folder"),
      state.exportType,
      state.exportScope,
      theme === "dark",
      (current, total, dashboardName, tabCurrent, tabTotal, tabName) => {
        dispatch({
          exportProgress: {
            dashboard: { current, total, name: dashboardName },
            tab:
              tabCurrent && tabTotal
                ? { current: tabCurrent, total: tabTotal, name: tabName || "" }
                : null,
          },
        });
      },
      () => {
        const itemCount =
          state.exportScope === "all-tabs"
            ? `${dashboards.length} dashboards (${totalTabs} tabs)`
            : `${dashboards.length} dashboards`;
        toast.success("Folder exported successfully", {
          description: `${itemCount} exported to your downloads folder.`,
        });
        setPendingExport(false);
        handleClose();
      },
      (error) => {
        toast.error("Error exporting folder", {
          description: error.message,
        });
        setPendingExport(false);
        dispatch({ loading: false, exportProgress: null });
      },
    );
  }, [
    dashboards,
    exportFolderItem,
    state.exportType,
    state.exportScope,
    theme,
    totalTabs,
    setPendingExport,
    checkIfLoadingData,
  ]);

  return (
    <BaseDialog open={exportFolderPopup} onClose={handleClose}>
      <DialogHeader>
        <DialogTitle>Export Folder</DialogTitle>
        <DialogDescription>
          Export all dashboards in "{exportFolderItem?.name}" as a ZIP file.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        <div className="text-light-600 dark:text-light-400">
          {dashboards.length === 0 ? (
            <p>This folder is empty.</p>
          ) : (
            <p>
              {dashboards.length} dashboard{dashboards.length !== 1 ? "s" : ""} will be
              exported
              {state.exportScope === "all-tabs" && ` (${totalTabs} tabs total)`}.
            </p>
          )}
        </div>
        <Select
          label="Export as"
          options={[
            { label: "PDF", value: "pdf" },
            { label: "PNG", value: "png" },
          ]}
          onChange={(exportType: "png" | "pdf") => dispatch({ exportType })}
          value={state.exportType}
        />
        <Select
          label="Export scope"
          options={[
            { label: "Current tab only", value: "current" },
            { label: "All tabs", value: "all-tabs" },
          ]}
          onChange={(exportScope: "current" | "all-tabs") => dispatch({ exportScope })}
          value={state.exportScope}
        />
        {state.exportProgress && (
          <ExportProgress
            current={state.exportProgress.dashboard.current}
            total={state.exportProgress.dashboard.total}
            label={`Dashboard${state.exportProgress.dashboard.name ? `: ${state.exportProgress.dashboard.name}` : ""}`}
            subProgress={
              state.exportProgress.tab
                ? {
                    current: state.exportProgress.tab.current,
                    total: state.exportProgress.tab.total,
                    label: `Tab${state.exportProgress.tab.name ? `: ${state.exportProgress.tab.name}` : ""}`,
                  }
                : undefined
            }
          />
        )}
      </div>
      <DialogFooter className="flex gap-2 items-center">
        <DialogClose asChild={true}>
          <Button type="button" variant="outlined" size="sm" disabled={state.loading}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          size="sm"
          loading={state.loading}
          disabled={dashboards.length === 0}
          onClick={handleExport}
        >
          Export
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
