import type { AgBarSeriesThemeableOptions } from "ag-charts-community";
import clsx from "clsx";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import { getContextMenuItems } from "~/components/General/Table/AgGridUtils";
import {
  ChartViewButton,
  ChartViewElement,
} from "~/components/General/Table/Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "~/components/General/Table/Chart/hooks/useChartOptions";
import { AgGridProvider, useAgGridContext } from "~/components/General/Table/hooks";
import { PeriodParams } from "~/components/General/Table/NavBar/QueryParams";
import { useWidgetContext } from "~/components/Widget.context";
import { processForwardTrendsData } from "~/components/Widgets/dataProcessors";
import { useProEarningTrends, useProRevenueTrends } from "~/lib/api/sdkComponents";
import { formatNumber, getJsonColDefs } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

function getQueryFnc(sdkFunc: string) {
  return sdkFunc === "earnings_trends" ? useProEarningTrends : useProRevenueTrends;
}

export default function ForwardTrends() {
  const {
    widget: {
      id: uuId,
      widgetId,
      storage: {
        chartView: { enabled: chartView } = {},
        params: { period = "quarter" as "annual" | "quarter" },
      } = {},
      data: { mainTicker } = {},
    },
    updateWidget,
    getWidget,
  } = useWidgetContext();
  const chartViewElementRef = useAgGridContext()?.chartViewElementRef;

  const columnDefsFromJSON = useMemo(() => getJsonColDefs(widgetId), [widgetId]);
  const useQueryFnc = useMemo(() => getQueryFnc(widgetId), []);

  const { isLoading, data, dataUpdatedAt } = useQueryFnc(
    {
      queryParams: {
        symbol: mainTicker?.symbol,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
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

  const { rowData, columnDefs, gridOptions, numberOfAnalysts } = useMemo(
    () => processForwardTrendsData(data, widgetMemo),
    [data?.results, widgetMemo],
  );

  const contextMenuItems = useCallback(
    (params) => getContextMenuItems(params, { widgetId: uuId, enableChart: false }),
    [],
  );

  const chartSeries = useMemo(() => {
    if (!rowData?.length) return {};
    return {
      connectMissingData: true,
      data: rowData,
      tooltip: {
        enabled: true,
        renderer: (params) => {
          // @ts-expect-error
          const { angleKey, radiusKey, angleName } = params;
          const yName = angleName ?? params.yName;
          const yKey = angleKey ?? radiusKey ?? params.yKey;
          let content = `<b>${yName === "Forward" ? "Mean" : yName}</b>: ${formatNumber(params.datum[yKey])} <br>`;
          const filtered = Object.keys(params.datum).filter(
            (key) => !["date", yKey].includes(key) && params.datum[key],
          );
          for (const key of filtered) {
            const headerName =
              columnDefsFromJSON.find((col) => col.field === key)?.headerName ?? key;
            const value = formatNumber(params.datum[key]);
            content += `<b>${headerName}</b>: ${value}  <br>`;
          }
          const date = dayjs(params.datum.date);
          const parsedPeriod =
            period === "annual"
              ? `FY ${date.year()}`
              : `Q${date.quarter()} ${date.year()}`;
          return {
            content,
            title: `${params.title ? `${params.title} -` : ""} ${parsedPeriod}`,
          };
        },
      },
    } as AgBarSeriesThemeableOptions;
  }, [rowData, chartView, period]);

  const elementNextToTitle = useMemo(() => <PeriodParams />, []);
  const extraNavbarElements = useMemo(() => <ChartViewButton />, []);
  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" />,
    [],
  );

  const agChartViewProps = useChartOptions({ chartSeries });
  const ChartToolPanelActions = useChartToolPanelAction();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={elementRightNextToTitle}
      elementNextToTitle={elementNextToTitle}
      extraNavbarElements={extraNavbarElements}
      extraSettings={chartView ? ChartToolPanelActions : []}
      loading={isLoading}
      error={!data?.results}
      extraClassName="overflow-y-hidden"
    >
      {chartView && <ChartViewElement />}
      <div
        className={clsx("grid", {
          "h-[calc(100%-20px)]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        {rowData?.length > 0 && columnDefs.length > 0 ? (
          <AgGridProvider
            columnDefs={columnDefs}
            rowData={rowData}
            gridOptions={gridOptions}
            getContextMenuItems={contextMenuItems}
            popupParent={chartViewElementRef.current}
            {...agChartViewProps}
          />
        ) : (
          rowData?.length !== 0 &&
          !isLoading && (
            <SearchResultsNotFound
              icon={true}
              firstMessage="Data not found"
              secondMessage={`No Analyst Estimates for ${mainTicker?.symbol}`}
            />
          )
        )}
      </div>
      {rowData?.length > 0 && !chartView && (
        <HideOnResize>
          <div className="flex items-center justify-between mr-2">
            <p className="flex items-center text-light-300 dark:text-light-600 text-xs mt-2">
              {mainTicker?.currency && `Current Currency: ${mainTicker?.currency}`}
            </p>
            <p className="mt-2 flex items-center gap-2 whitespace-nowrap pl-5">
              No. of Analysts: <strong>{numberOfAnalysts}</strong>
            </p>
          </div>
        </HideOnResize>
      )}
    </DraggableCard>
  );
}
