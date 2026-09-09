import type { ChartType } from "ag-grid-enterprise";
import type { ArtifactT, CopilotWidget, Message } from "~/lib/state/copilot";
import { convertToReadableLabel } from "../../General/Table/AgGridUtils";
import type { WidgetColumnDefT, WidgetJsonT, WidgetT } from "../../types";

export interface ConversationContext {
  user_prompt: string;
  recent_messages: Message[];
  selected_widgets: CopilotWidget[];
  related_artifacts: ArtifactT[];
}

export interface ChartMetadata {
  xKey?: string;
  yKey?: string[];
  chartType?: string;
  angleKey?: string;
  calloutLabelKey?: string;
}

export interface ChartViewIntent {
  enabled?: boolean;
  chartType?: string;
}

/**
 * Returns a human-readable fallback name for a widget based on its type.
 */
export function getFallbackName(widgetType: string): string {
  const typeNames: Record<string, string> = {
    text: "Text Artifact",
    html: "HTML Artifact",
    table: "Table Artifact",
    chart: "Chart Artifact",
    ssrm_advanced: "SQL Query",
  };
  return typeNames[widgetType] || "Artifact";
}

/**
 * Creates a conversation context payload for the AI widget info API.
 * Limits recent messages to last 5 and artifacts to last 3.
 */
export function createConversationContextPayload(
  user_prompt: string,
  recent_messages: Message[],
  selected_widgets: CopilotWidget[],
  related_artifacts: ArtifactT[],
): ConversationContext {
  return {
    user_prompt,
    recent_messages: recent_messages.slice(-5),
    selected_widgets: selected_widgets.map((widget) => ({
      ...widget,
      metadata: widget.metadata
        ? {
            innerTabId: widget.metadata.innerTabId,
            widgetCount: widget.metadata.widgetCount,
          }
        : undefined,
    })),
    related_artifacts: related_artifacts.slice(-3),
  };
}

/**
 * Sanitizes table content by removing dots from object keys.
 * Ag-Grid has issues with dot notation in field names.
 */
export function sanitizeTableContent(content: object[]): Record<string, unknown>[] {
  return content.map((row) => {
    const sanitizedRow: Record<string, unknown> = {};
    for (const key in row) {
      const sanitizedKey = key.replace(/\./g, "");
      sanitizedRow[sanitizedKey] = row[key];
    }
    return sanitizedRow;
  });
}

/**
 * Removes citation tags from text content.
 * Handles patterns like: ". <citation>...</citation>" or "<citation>...</citation>."
 */
export function removeCitationsFromText(text: string): string {
  return text.replace(/(?:\.\s*)?<citation>.*?<\/citation>(\s*\.)?/g, "$1");
}

/**
 * Converts chart type from artifact format to Ag-Grid format.
 * E.g., "bar" becomes "column" in Ag-Grid.
 */
export function toAgGridChartType(chartType: string | undefined): ChartType {
  if (chartType === "bar") return "column";
  return (chartType as ChartType) || "line";
}

/**
 * Applies chart-view state to both widget data and storage so creation,
 * hydration, and later normalization all see the same intent.
 */
export function applyChartViewToWidget<T extends WidgetT | WidgetJsonT>(
  widget: T,
  chartView: ChartViewIntent = {},
): T {
  const enabled = chartView.enabled ?? true;
  const chartType = toAgGridChartType(chartView.chartType);

  return {
    ...widget,
    data: {
      ...widget.data,
      table: {
        ...widget.data?.table,
        enableCharts: true,
        chartView: {
          ...widget.data?.table?.chartView,
          enabled,
          chartType,
        },
      },
    },
    storage: {
      ...widget.storage,
      chartSettingsOpen: widget.storage?.chartSettingsOpen ?? false,
      chartView: {
        ...widget.storage?.chartView,
        enabled,
        chartType,
      },
    },
  };
}

/**
 * Checks if a chart type is a pie or donut chart.
 */
export function isPieOrDonutChart(chartType: string | undefined): boolean {
  return chartType === "pie" || chartType === "donut";
}

/**
 * Builds column definitions for chart widgets.
 */
export function buildChartColumnDefs(chartMeta: ChartMetadata): WidgetColumnDefT[] {
  const { xKey, yKey, chartType, angleKey, calloutLabelKey } = chartMeta;

  if (isPieOrDonutChart(chartType)) {
    return [
      {
        field: calloutLabelKey ?? "",
        headerName: convertToReadableLabel(calloutLabelKey ?? ""),
        cellDataType: "text",
        chartDataType: "category",
      },
      {
        field: angleKey ?? "",
        headerName: convertToReadableLabel(angleKey ?? ""),
        cellDataType: "number",
        chartDataType: "series",
      },
    ] as WidgetColumnDefT[];
  }

  const xCol = {
    field: xKey ?? "",
    headerName: convertToReadableLabel(xKey ?? ""),
    cellDataType: "text",
    chartDataType: "category",
  } as WidgetColumnDefT;

  const safeYKey = Array.isArray(yKey) ? yKey : [];
  return safeYKey.reduce<WidgetColumnDefT[]>(
    (acc, col) => {
      acc.push({
        field: col ?? "",
        headerName: convertToReadableLabel(col ?? ""),
        cellDataType: "number",
        chartDataType: "series",
      } as WidgetColumnDefT);
      return acc;
    },
    [xCol],
  );
}
