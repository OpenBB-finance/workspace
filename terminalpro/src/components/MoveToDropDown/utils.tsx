import type { Extension } from "~/lib/constants";
import { useAppStore } from "~/lib/state/app";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { convertToReadableLabel } from "../General/Table/AgGridUtils";
import type { WidgetT } from "../types";
import type { MoveToOnSelectProps } from "./types";

export function getExportFns(
  exportFns?: {
    csvFunction?: (title: string) => void;
    excelFunction?: (title: string) => void;
    pngFunction?: (title: string) => void;
    pdfFunction?: (title: string) => void;
    txtFunction?: (title: string) => void;
  },
  widgetType?: WidgetT["type"],
  extension?: Extension,
) {
  const exportFunctions = [
    { value: "CSV", fn: exportFns?.csvFunction },
    { value: "XLSX", fn: exportFns?.excelFunction },
    { value: extension ? extension : "PNG", fn: exportFns?.pngFunction },
    { value: "PDF", fn: exportFns?.pdfFunction },
    { value: "TXT", fn: exportFns?.txtFunction },
  ];

  // Filter out undefined functions
  const availableExportFunctions = exportFunctions.filter(({ fn }) => fn !== undefined);

  // For Plotly widgets (identified by widget type "chart"), only show PNG export
  const isPlotlyWidget = widgetType === "chart";
  if (isPlotlyWidget) {
    return availableExportFunctions.filter(({ value }) => value === "PNG");
  }

  return availableExportFunctions;
}

export async function ScrollToWidget() {
  const element =
    document.getElementsByClassName("react-grid-layout")?.[0].lastElementChild;
  element?.scrollIntoView();
}

export async function AddWidgetOnSelect(props: MoveToOnSelectProps) {
  const { widget, tab, activeDashboardId, navigate } = props;
  const innerTab = convertToReadableLabel(widget.innerTab);

  const copiedTo = innerTab
    ? `${tab.data.name} in ${innerTab} tab`
    : `new dashboard named ${tab?.data.name}`;

  useAppStore.getState().duplicateWidget(tab.index, widget);

  const queryParam = widget.innerTab ? `?tab=${widget.innerTab}` : "";

  let action = { label: "Scroll to widget", onClick: ScrollToWidget };
  if (activeDashboardId !== tab.index || widget.innerTab !== tab.data.currentTab) {
    action = {
      label: "Go to dashboard",
      onClick: async () => {
        navigate(`/app/${tab.index}${queryParam}`);
        setTimeout(ScrollToWidget, 500);
      },
    };
  }

  showNotificationWithRememberMe({
    id: NotificationId.WidgetMoved,
    message: "Widget copied",
    description: `Widget ${widget.name} copied to ${copiedTo}`,
    action,
    toastType: "success",
  });

  if (!action) ScrollToWidget();
}
