import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import dayjs from "dayjs";
import { usePostHog } from "posthog-js/react";
import { useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useTabsInfo } from "~/hooks/useTabsInfo";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  generateMultiTabReport,
  generateReportImage,
  getGroupLabel,
  slugify,
  waitForGridLayout,
} from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
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

type ExportState = {
  loading: boolean;
  title: string;
  exportType: "png" | "pdf";
  exportScope: "current" | "all-tabs";
  exportProgress: {
    current: number;
    total: number;
    tabName: string;
  } | null;
};

export default function ExportModal() {
  const { id } = useParams();
  const tab = useShallowAppStore((state) => state.getTabById(id));
  const sharedTab = useShallowSharedAppStore((state) => state?.sharedItems?.[id]);

  const isShared = !!sharedTab;
  const currentDashboard = isShared ? sharedTab : tab;

  const { hasMultipleTabs, tabsInfo } = useTabsInfo(currentDashboard);

  const [state, dispatch] = useStateReducer<ExportState>(null, () => {
    // Create the formatted date and time string
    const formattedDateTime = dayjs().format("YYYY-MM-DD HH:mm");

    // Get the tickers in the groups
    const groups = isShared ? sharedTab?.data?.groups : tab?.data?.groups || [];
    const tickersInGroups = (groups || []).map((group) => getGroupLabel(group));
    const tickersString =
      tickersInGroups.length > 0 ? `- ${tickersInGroups.join("_")} - ` : "- ";

    // Create the title
    const title = `${formattedDateTime} ${tickersString}${isShared ? sharedTab?.data?.name : tab?.data?.name} report`;

    return {
      loading: false,
      title,
      exportType: "pdf",
      exportScope: "current",
      exportProgress: null,
    };
  });

  const inputRef = useRef<HTMLInputElement>(null);

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

  const { exportPopup, setExportPopup, theme, setPendingExport } = useShallowThemeStore(
    (state) => ({
      pendingExport: state.pendingExport,
      exportPopup: state.exportPopup,
      setExportPopup: state.setExportPopup,
      theme: state.theme,
      setPendingExport: state.setPendingExport,
    }),
  );

  const clearSelectedWidgets = useShallowCopilotDataStore(
    (state) => state.clearSelectedWidgets,
  );

  const posthog = usePostHog();

  const generateAndDownloadReport = useCallback(async () => {
    clearSelectedWidgets();
    setPendingExport(true);
    dispatch({ loading: true });

    if (state.exportScope === "all-tabs" && hasMultipleTabs) {
      dispatch({ exportProgress: { current: 0, total: tabsInfo.length, tabName: "" } });

      await generateMultiTabReport(
        checkIfLoadingData,
        tabsInfo,
        state.title,
        slugify(state.title),
        state.exportType,
        theme === "dark",
        (current, total, tabName) => {
          dispatch({ exportProgress: { current, total, tabName } });
        },
        () => {
          toast.success("Report generated successfully", {
            description: `${tabsInfo.length} tabs exported to your downloads folder.`,
          });
          setPendingExport(false);
          setExportPopup(false);
          dispatch({ loading: false, exportProgress: null });
        },
        (error) => {
          toast.error("Error generating report", {
            description: error.message,
          });
          setPendingExport(false);
          dispatch({ loading: false, exportProgress: null });
        },
        id,
      );
    } else {
      const element = await waitForGridLayout(3000, id);

      await generateReportImage(
        checkIfLoadingData,
        element,
        slugify(state.title),
        state.title,
        true,
        state.exportType,
        theme === "dark",
        () => {
          toast.success("Report generated successfully", {
            description: "The file will be saved to your downloads folder.",
          });
          dispatch({ loading: false });
          setPendingExport(false);
          setExportPopup(false);
        },
        () => {
          toast.error("Error generating report");
          dispatch({ loading: false });
          setPendingExport(false);
        },
      );
    }
  }, [
    state.exportScope,
    hasMultipleTabs,
    tabsInfo,
    state.title,
    state.exportType,
    theme,
    clearSelectedWidgets,
    setPendingExport,
    dispatch,
    setExportPopup,
    id,
    toast,
    checkIfLoadingData,
  ]);

  return (
    <BaseDialog open={exportPopup} onClose={() => setExportPopup(false)}>
      <DialogHeader>
        <DialogTitle>Export PDF</DialogTitle>
        <DialogDescription>Export your dashboard as a PDF or PNG.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        <div className="w-full">
          <Input
            ref={inputRef}
            label="Save as"
            id="save-as"
            defaultValue={state.title}
            onChange={(title: string) => {
              dispatch({ title });
              if (inputRef.current) {
                inputRef.current.value = title;
              }
            }}
          />
        </div>
        <Select
          label="Export as"
          options={[
            {
              label: "PDF",
              value: "pdf",
            },
            {
              label: "PNG",
              value: "png",
            },
          ]}
          onChange={(exportType: "png" | "pdf") => dispatch({ exportType })}
          value={state.exportType}
        />
        {hasMultipleTabs && (
          <Select
            label="Export scope"
            options={[
              {
                label: "Current tab",
                value: "current",
              },
              {
                label: `All tabs (${tabsInfo.length})`,
                value: "all-tabs",
              },
            ]}
            onChange={(exportScope: "current" | "all-tabs") =>
              dispatch({ exportScope })
            }
            value={state.exportScope}
          />
        )}
        {state.exportProgress && (
          <ExportProgress
            current={state.exportProgress.current}
            total={state.exportProgress.total}
            label={`Exporting tab${state.exportProgress.tabName ? `: ${state.exportProgress.tabName}` : ""}`}
          />
        )}
      </div>
      <DialogFooter className="flex gap-2 items-center">
        <DialogClose asChild={true}>
          <Button type="button" variant="outlined" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button
          size="sm"
          loading={state.loading}
          onClick={async () => {
            if (posthog) {
              posthog.capture("user_exported_data_dash", {
                export_type: state.exportType,
                export_scope: state.exportScope,
                dashboard: tab?.data?.name,
              });
            }

            if (!currentDashboard || currentDashboard?.data?.widgets?.length === 0) {
              toast.error("No widgets to export", {
                description:
                  "Please add some widgets to the dashboard before exporting",
              });
              return;
            }

            await generateAndDownloadReport();
          }}
        >
          Export
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
