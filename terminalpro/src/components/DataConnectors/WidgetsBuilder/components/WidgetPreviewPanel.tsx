import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import AddToDashboardDropdownMenu from "~/components/DataConnectors/AddToDashboardDropdownMenu";
import { LoadingElement } from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import { areTruthy } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { WidgetJsonT } from "~/components/types";
import { cn } from "~/lib/utils";
import { useWidgetActions } from "../hooks/useWidgetActions";
import { useWidgetConfigContext } from "../WidgetConfigContext";
import WidgetPreview from "../WidgetPreview";

interface WidgetPreviewPanelProps {
  onSaveWidget: () => Promise<void>;
  onAddToDashboard: (dashboards: string[]) => void;
}

const copyJSON = (previewWidget: WidgetJsonT) => {
  const jsonConfig = JSON.stringify(previewWidget, null, 2);
  navigator.clipboard
    .writeText(jsonConfig)
    .then(() => {
      toast.success("JSON configuration copied to clipboard");
    })
    .catch(() => {
      toast.error("Failed to copy to clipboard");
    });
};

export function WidgetPreviewPanel() {
  const [onSaveWidget, onAddToDashboard] = useWidgetActions();

  const { isWidgetConfigured, getPreviewWidget, state } = useWidgetConfigContext(
    (s) => ({
      isWidgetConfigured: areTruthy(s.config?.name, s.formState.endpoint),
      getPreviewWidget: s.getPreviewWidget,
      state: {
        isDragging: s.formState.isDragging,
        isUpdatingPreview: s.formState.isUpdatingPreview,
        previewData: s.formState.previewData,
        isSaving: s.formState.isSaving,
      },
    }),
  );

  const handleCopyJSON = useCallback(() => {
    const previewWidget = getPreviewWidget();
    if (previewWidget) {
      copyJSON(previewWidget);
    } else {
      toast.error("No widget configuration available to copy");
    }
  }, [getPreviewWidget]);

  const widgetPreviewMemo = useMemo(() => <WidgetPreview />, []);

  return (
    <div className="flex flex-col gap-4 p-6 border dark:border-dark-500 border-light-200 rounded h-full">
      <div className="flex flex-col gap-2 whitespace-nowrap w-full max-w-[calc(100%-10px)] overflow-hidden">
        <h3 className="body-sm-medium dark:text-light-300 text-light-700 flex items-center flex-shrink-0">
          <Icon id="eye-opened-icon" className="size-4 mr-2" />
          Widget Preview
          <p className="body-xs-regular dark:text-dark-200 text-light-600 ml-2 truncate">
            Preview of your configured widget
          </p>
        </h3>
      </div>

      <div className="relative h-full rounded border border-light-200 dark:border-dark-700 bg-white dark:bg-[#151518] flex items-center justify-center">
        {(state.isDragging || state.isUpdatingPreview) && (
          <div className="absolute inset-0 z-10 bg-white/80 dark:bg-[#151518]/80 backdrop-blur-sm">
            <LoadingElement />
          </div>
        )}
        {state.previewData ? (
          <div
            className={cn("w-full h-full", {
              "opacity-50": state.isUpdatingPreview,
              hidden: state.isDragging,
            })}
          >
            {widgetPreviewMemo}
          </div>
        ) : state.isDragging || state.isUpdatingPreview ? null : (
          <p className="text-center text-light-600 dark:text-dark-50 text-sm p-3">
            Update the URL to a valid endpoint (needs to have pro.openbb.co enabled in
            CORS). You can check{" "}
            <a
              href="https://docs.openbb.co/workspace/data-widgets"
              target="_blank"
              rel="noopener noreferrer"
              className="obb-hyper-link"
            >
              the documentation
            </a>{" "}
            for more information.
          </p>
        )}
      </div>

      <div className="mt-auto flex gap-3 justify-between">
        <div className="flex items-center gap-2.5">
          <Tooltip message="Widget will be accessible in the search menu and saved to your Widgets Library.">
            <Button
              size="sm"
              variant="primary"
              disabled={!isWidgetConfigured}
              loading={state.isSaving}
              onClick={onSaveWidget}
            >
              Save Widget
            </Button>
          </Tooltip>
          <Tooltip message="Copy the JSON configuration of the widget to your clipboard so you can use it in your custom backends.">
            <Button variant="outlined" size="sm" onClick={handleCopyJSON}>
              <Icon id="copy-03" className="size-4" />
              Copy JSON
            </Button>
          </Tooltip>
        </div>
        <AddToDashboardDropdownMenu
          onAddToDashboard={onAddToDashboard}
          disabled={!isWidgetConfigured}
          tooltipMessage="Add widget directly to one of your dashboards"
          customTrigger={
            <Button variant="outlined" size="sm" disabled={!isWidgetConfigured}>
              Add widget to Dashboard
            </Button>
          }
        />
      </div>
    </div>
  );
}

WidgetPreviewPanel.displayName = "WidgetPreviewPanel";
