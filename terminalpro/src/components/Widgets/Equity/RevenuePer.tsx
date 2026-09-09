import { useCallback, useMemo } from "react";
import { useDebounceValue } from "usehooks-ts";
import DraggableCard from "~/components/DraggableCard";

import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import {
  ChartViewButton,
  ChartViewElement,
} from "~/components/General/Table/Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "~/components/General/Table/Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  useAgExportFuncs,
  useQuickActionsSettings,
} from "~/components/General/Table/hooks";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { processRevenuePerData } from "~/components/Widgets/dataProcessors";
import {
  useEquityFundamentalRevenuePerGeography,
  useEquityFundamentalRevenuePerSegment,
} from "~/lib/api/sdkComponents";
import { cn } from "~/lib/utils";

function getQueryFnc(widgetId: string) {
  return widgetId === "revenue_per_bus_line"
    ? useEquityFundamentalRevenuePerSegment
    : useEquityFundamentalRevenuePerGeography;
}

export default function RevenuePer() {
  const {
    widget: {
      id: uuId,
      widgetId,
      storage: {
        chartView: { enabled: chartView } = {},
        params: { period = "annual" as "annual" | "quarter" },
      } = {},
      data: { mainTicker } = {},
    },
    getWidget,
  } = useWidgetContext();

  const { isLoading, data, dataUpdatedAt, error } = getQueryFnc(widgetId)(
    {
      queryParams: {
        provider: "fmp",
        symbol: mainTicker?.symbol ?? "AAPL",
        period,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      retry: false,
    },
  );

  const widgetMemo = useMemo(() => {
    const widget = getWidget();
    return {
      ...widget,
      storage: {
        ...(widget.storage ?? {}),
        params: {
          ...(widget.storage?.params ?? {}),
          period,
        },
        chartView: {
          ...(widget.storage?.chartView ?? {}),
          enabled: chartView,
        },
      },
    };
  }, [period, chartView, getWidget]);

  const { rowData, columnDefs } = useMemo(() => {
    return processRevenuePerData(data, widgetMemo);
  }, [data?.results, widgetMemo]);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: period.toLowerCase() === "quarter" ? 22 : 32,
    };
  }, [period]);

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: uuId }),
    [],
  );

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();
  const quickActions = useQuickActionsSettings();

  const extraSettings = useMemo(() => {
    return [quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);

  const { renderRow0Params } = useWidgetParamsPositions();
  const extraNavbarElements = useMemo(() => <ChartViewButton />, []);

  const exportFns = useAgExportFuncs();
  const [debounceChartView] = useDebounceValue(chartView, 300);

  const finalChartView = { quarter: chartView, annual: debounceChartView }[period];

  return (
    <DraggableCard
      aiData={data?.results}
      aiEnabled={true}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={renderRow0Params}
      exportFns={exportFns}
      extraNavbarElements={extraNavbarElements}
      extraSettings={extraSettings}
      loading={isLoading}
      error={error}
      extraClassName={chartView && !finalChartView && "overflow-hidden!"}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("grid", {
          "h-[calc(100%-5px)] min-h-[100px]": !finalChartView,
          "h-0 w-0 max-h-0": finalChartView,
        })}
      >
        <AgGridProvider
          columnDefs={columnDefs}
          rowData={rowData}
          getContextMenuItems={contextMenuItems}
          gridOptions={gridOptions}
          {...agChartViewProps}
        />
      </div>
    </DraggableCard>
  );
}
