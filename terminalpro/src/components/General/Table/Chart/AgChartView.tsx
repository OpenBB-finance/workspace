import type { ChartModel, ColDef, CreateRangeChartParams } from "ag-grid-community";
import { useCallback, useEffect, useRef } from "react";
import { SetLoadingOnResize } from "~/components/DraggableCard";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import useIsMobile from "~/hooks/useIsMobile";
import { useComposeRefs } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { cn } from "~/lib/utils";
import { useAgGridContext } from "../hooks";
import type { ChartDataT } from "../hooks/types";

export type CreateRangeChartProps = {
  chartData: ChartDataT;
  chartModel?: Partial<ChartModel>;
};

export type CreateRangeChart = {
  rowData: any[];
  columnDefs: ColDef[];
  chartParams: CreateRangeChartParams;
};

export function createRangeChart(props: CreateRangeChartProps): CreateRangeChart {
  const { chartModel = {}, chartData } = props;

  const { rowData, columnDefs, columns } = chartData;

  const chartParams = {
    chartType: chartData.chartType ?? "groupedColumn",
    suppressChartRanges: true,
    cellRange: { columns },
    switchCategorySeries: !!chartData?.transpose || chartModel?.switchCategorySeries,
    aggFunc: chartModel?.aggFunc,
    seriesChartTypes: chartModel?.seriesChartTypes,
    seriesGroupType: chartModel?.seriesGroupType,
  } as CreateRangeChartParams;

  return { rowData, columnDefs, chartParams };
}

export function ChartViewElement() {
  const chartPlaceholderRef = useRef<HTMLDivElement | null>(null);
  const { chartRef, chartViewElementRef } = useAgGridContext();

  const composeRef = useComposeRefs(chartPlaceholderRef, chartViewElementRef);

  useEffect(() => {
    if (chartRef?.current && chartPlaceholderRef.current) {
      chartPlaceholderRef.current.appendChild(chartRef.current?.chartElement);
    }
  }, [chartRef?.current, chartPlaceholderRef]);

  return (
    <SetLoadingOnResize chartView={true}>
      <div
        ref={composeRef}
        className="chart-wrapper h-[98%] overflow-hidden -mt-1 _widget-content"
      />
    </SetLoadingOnResize>
  );
}
export const customChartWidgetIds = [
  "analyst_estimates",
  "earnings_trends",
  "revenue_trends",
  "revenue_per_bus_line",
  "revenue_per_geography",
];

export function ChartViewButton() {
  const isMobile = useIsMobile();
  const { widget: { storage: { chartView } = {} } = {}, updateWidget } =
    useWidgetContext();
  const {
    gridState,
    handleChartViewToggleRef,
    previousChartEnabledRef,
    flushColumnStateRef,
  } = useAgGridContext();

  const [state, dispatch] = useStateReducer({
    tooltipmessage: null as string | null,
    disabled: false,
  });

  const enabled = chartView?.enabled;

  const setView = useCallback(() => {
    previousChartEnabledRef.current = enabled;
    // Persist any pending column-state save before chartView.enabled flips —
    // once it flips, the debounced save would be dropped
    flushColumnStateRef?.current?.();
    updateWidget((prev) => {
      return {
        ...prev,
        storage: {
          ...prev.storage,
          chartView: {
            ...prev.storage?.chartView,
            enabled: !enabled,
          },
        },
      };
    });
    handleChartViewToggleRef.current?.(enabled);
    if (enabled) {
      // reset previousChartEnabledRef after a delay to avoid race conditions
      setTimeout(() => {
        previousChartEnabledRef.current = !enabled;
      }, 1000);
    }
  }, [
    enabled,
    updateWidget,
    handleChartViewToggleRef,
    previousChartEnabledRef,
    flushColumnStateRef,
  ]);

  useEffect(() => {
    const columnDefs: ColDef[] = gridState?.columnDefs;
    if (!columnDefs?.length) return;

    const hasSeriesData = columnDefs?.some((col) => {
      // @ts-expect-error
      if (col?.children)
        // @ts-expect-error
        return col.children.some((child: ColDef) => child.chartDataType === "series");

      return col?.chartDataType === "series";
    });

    if (hasSeriesData) {
      dispatch({ tooltipmessage: null, disabled: false });
    } else {
      dispatch({
        tooltipmessage: "No series data available for chart view",
        disabled: true,
      });
    }
  }, [gridState?.dataRevision]);

  const defaultMessage = `Switch to ${enabled ? "table" : "chart"} view`;

  return (
    <Tooltip message={state.tooltipmessage || defaultMessage} hide={isMobile}>
      <button
        disabled={state.disabled && !enabled}
        onClick={setView}
        id="chart-view-button"
        className={cn("obb-small-navbar-btn", {
          "bg-brand-main! text-white! hover:bg-brand-main!": enabled,
        })}
      >
        <Icon id="chart-view-icon" className="h-3.5 w-3.5 ml-[1px]" />
      </button>
    </Tooltip>
  );
}
