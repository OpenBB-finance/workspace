import type { AgBarSeriesThemeableOptions } from "ag-charts-community";
import clsx from "clsx";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo } from "react";
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
import { ensureAgGrid } from "~/components/General/Table/utils";
import { useWidgetContext } from "~/components/Widget.context";
import {
  ConsensusTypes,
  processAnalystEstimatesData,
} from "~/components/Widgets/dataProcessors";
import { useEquityEstimatesForwardEbitda } from "~/lib/api/sdkComponents";
import { formatNumber, getJsonColDefs } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function AnalystEstimates() {
  const {
    widget: {
      id: uuId,
      storage: {
        chartView: { enabled: chartView } = {},
        params: { fiscal_period, period = "quarter" as "annual" | "quarter" },
      } = {},
      data: { mainTicker } = {},
      refreshQuery,
    },
    getWidget,
  } = useWidgetContext();

  const { chartViewElementRef, gridRef } = useAgGridContext();
  const columnDefsFromJSON = useMemo(() => getJsonColDefs("analyst_estimates"), []);

  const { isLoading, data, dataUpdatedAt, isSuccess } = useEquityEstimatesForwardEbitda(
    {
      queryParams: {
        provider: "intrinio",
        symbol: mainTicker?.symbol,
        fiscal_period: fiscal_period ?? period,
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
          fiscal_period: period,
        },
        chartView: {
          ...(widget.storage?.chartView ?? {}),
          enabled: chartView,
        },
      },
    };
  }, [period, chartView, getWidget]);

  const { rowData, columnDefs, gridOptions, numberOfAnalysts } = useMemo(() => {
    return processAnalystEstimatesData(data, widgetMemo);
  }, [data?.results, widgetMemo]);

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
          let content = `<b>Mean</b>: ${formatNumber(params.datum[params.yKey])} <br>`;
          const filtered = Object.keys(params.datum).filter(
            (key) =>
              !["date", ...Object.keys(ConsensusTypes), "number_of_analysts"].includes(
                key,
              ) && params.datum[key],
          );
          for (const key of filtered) {
            const headerName =
              columnDefsFromJSON?.find((col) => col.field === key)?.headerName ?? key;
            const value = formatNumber(params.datum[key]);
            content += `<b>${headerName}</b>: ${value}  <br>`;
          }
          const date = dayjs(params.datum.date);
          const parsedPeriod =
            period === "annual"
              ? `FY ${date.year()}`
              : `Q${date.quarter()} ${date.year()}`;
          return {
            content: `${content}
                <b>Number of Analysts</b>: ${params.datum.number_of_analysts}`,
            title: `${params.title} - ${parsedPeriod}`,
          };
        },
      },
    } as AgBarSeriesThemeableOptions;
  }, [rowData, period, chartView]);

  const agChartViewProps = useChartOptions({ chartSeries });
  const ChartToolPanelActions = useChartToolPanelAction();

  useEffect(() => {
    if (chartView || period === "annual") return;
    setTimeout(() => {
      if (!ensureAgGrid(gridRef?.current)) return;
      gridRef.current.api.sizeColumnsToFit();
    }, 100);
  }, [gridRef?.current, refreshQuery, isSuccess]);

  const elementNextToTitle = useMemo(
    () => <PeriodParams paramName="fiscal_period" />,
    [],
  );
  const extraNavbarElements = useMemo(() => <ChartViewButton />, []);
  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" />,
    [],
  );

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
            rowData={rowData || []}
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
