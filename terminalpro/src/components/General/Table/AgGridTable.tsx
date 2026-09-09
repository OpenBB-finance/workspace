import type { UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import { AdvancedSelect } from "~/components/NewAdvancedSelect";
import { useWidgetContext } from "~/components/Widget.context";
import { processAgGridTableData } from "~/components/Widgets/dataProcessors";
import { FINANCIAL_RATIOS } from "~/components/Widgets/Equity/ComparisonAnalysis/constants";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { useJsonData } from "~/lib/api";
import * as sdkQuery from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, getJsonColDefs, getWidgetDataSource } from "~/lib/utils";
import { getContextMenuItems, onPivotModeChanged } from "./AgGridUtils";
import { ChartViewButton, ChartViewElement } from "./Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "./Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  getSideBarOptions,
  useAgExportFuncs,
  useColumnVisibility,
  useQuickActionsSettings,
} from "./hooks";
import type { AgGridEvents } from "./hooks/types";
import { useCopilotFilteredWidgetData } from "./hooks/useCopilotFilteredData";
import { PeriodParams, useWidgetParamsPositions } from "./NavBar/QueryParams";
import TableSettings, { type EnableSettings } from "./SubMenus/TableSettings";

const DISPLAY_CURRENCY_WIDGETIDS = [
  "insider_trading",
  "stock_ownership",
  "dividend_payment",
  "analyst_consensus",
];

type AgGridTableState = {
  decimalDigitsSettings: number;
  selectedGroup: string;
  failingUrl: string | undefined;
  enableSettings?: EnableSettings;
};

export function useGetTableData(
  state: AgGridTableState,
  dispatch: StateDispatch<AgGridTableState>,
) {
  const { widget, widgetFromJSON, getWidget } = useWidgetContext();
  const columnDefsFromJSON = useMemo(
    () => getJsonColDefs(widget),
    [widget.widgetId, widget?.data?.table?.columnsDefs],
  );
  const period: "annual" | "quarter" | "ttm" =
    widget?.storage?.params?.period ?? "annual";
  const hasPeriod = !!widgetFromJSON?.data?.table?.period;

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const useQueryFn = useCallback((options: any, queryOptions: any) => {
    const query = widgetFromJSON?.sdkFunc ? "useSdk" : "useJson";
    const funcs = {
      useJson: useJsonData,
      // check if widget.endpoint is in sdkQuery
      useSdk:
        widgetFromJSON?.sdkFunc in sdkQuery
          ? // biome-ignore lint/performance/noDynamicNamespaceImportAccess: --- IGNORE --
            sdkQuery[widgetFromJSON?.sdkFunc as string]
          : useJsonData,
    };

    return funcs[query](options, queryOptions) as UseQueryResult<any, Error>;
  }, []);

  const options = useMemo(() => {
    const query = widgetFromJSON?.sdkFunc ? "useSdk" : "useJson";
    const period: "annual" | "quarter" | "ttm" =
      widget?.storage?.params?.period ?? "annual";

    const provider = getWidgetDataSource(widget)?.[0] ?? "fmp";
    if (query === "useSdk") {
      const periodParam = ["ttm", "quarter"].includes(period) ? "quarter" : "annual";
      const symbol = widget.data?.mainTicker?.symbol;

      return {
        queryParams: {
          provider: provider,
          limit: hasPeriod ? (period?.toLowerCase() === "annual" ? 12 : 40) : 1000,
          ...(symbol && { symbol }),
          sort: "asc",
          ...Object.fromEntries(
            Object.entries(widget?.storage?.params || {}).filter(
              ([key, value]) =>
                key !== "symbol" && !["", undefined, null].some((v) => v === value),
            ),
          ),
          ...(hasPeriod && { period: periodParam }),
        },
      };
    }

    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );
    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      endpointMethod: widget.endpoint?.method ?? "GET",
      params: newParams,
      onError: (error: Error) => {
        if (!widgetFromJSON?.sdkFunc && error?.message === "Failed to fetch") {
          dispatch({ failingUrl: widget.endpoint?.url });
        }
      },
    };
  }, [widget.data?.mainTicker?.symbol, widget?.endpoint, widget?.storage?.params]);

  const {
    data: queryData,
    error,
    isLoading,
    dataUpdatedAt,
  } = useQueryFn(options, {
    enabled: true,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  } as Omit<UseQueryOptions<any, Error>, "queryKey">);

  const widgetMemo = useMemo(() => {
    const w = getWidget();
    return {
      ...w,
      storage: {
        ...(w.storage ?? {}),
        transpose: widget?.storage?.transpose,
        params: {
          ...(widget.storage?.params ?? {}),
          period,
          selectedGroup: state.selectedGroup,
        },
        enableAdvanced: state.enableSettings.enableAdvanced,
      },
      data: {
        ...w.data,
        table: {
          ...w.data?.table,
          columnsDefs: columnDefsFromJSON,
          showAll: widget?.data?.table?.showAll,
          formatterFn: widget?.data?.table?.formatterFn,
        },
      },
    };
  }, [
    period,
    state.selectedGroup,
    state.enableSettings.enableAdvanced,
    widget?.storage?.transpose,
    widget?.data?.table?.showAll,
    widget?.data?.table?.formatterFn,
    columnDefsFromJSON,
  ]);

  const { rowData, columnDefs } = useMemo(() => {
    if (!queryData) return { rowData: [], columnDefs: [] };

    if (state.failingUrl) {
      dispatch({ failingUrl: undefined });
    }

    return processAgGridTableData(queryData, widgetMemo, decimalDigitsToUse);
  }, [queryData, widgetMemo, decimalDigitsToUse]);

  const gridOptions = useMemo(() => {
    const sideBar = getSideBarOptions(widget.storage);
    return {
      rowHeight: 32,
      headerHeight:
        period.toLowerCase() === "quarter" && widget?.storage?.transpose ? 22 : 32,
      statusBar: widget.storage.enableStats
        ? {
            statusPanels: [
              {
                statusPanel: "agAggregationComponent",
                statusPanelParams: {
                  aggFuncs: ["count", "sum", "min", "max", "avg"],
                },
              },
              {
                statusPanel: "agTotalRowCountComponent",
              },
            ],
          }
        : undefined,
      sideBar,
    };
  }, [
    period,
    widget.storage.enableStats,
    widget.storage.enableAdvanced,
    widget.storage.enableFormulas,
    widget.storage.transpose,
    widget.storage.openedToolPanel,
    widget.storage.isPivotMode,
  ]);

  useCopilotFilteredWidgetData(rowData, dataUpdatedAt);
  return { rowData, columnDefs, gridOptions, dataUpdatedAt, isLoading, error };
}

export default function AgGridTable() {
  const { updateWidget, widget, widgetFromJSON } = useWidgetContext();

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [state, dispatch] = useStateReducer<AgGridTableState>({
    decimalDigitsSettings: decimalDigitsToUse,
    selectedGroup: widget?.storage?.selectedGroup ?? "liquidity",
    failingUrl: undefined,
    enableSettings: {
      enableStats: !!widget.storage?.enableStats,
      enableAdvanced: !!widget.storage?.enableAdvanced,
      enablePagination: widget.storage?.enablePagination,
      enableFormulas: !!widget.storage?.enableFormulas,
    },
  });

  const chartView = widget.storage?.chartView?.enabled;

  const { rowData, columnDefs, gridOptions, isLoading, dataUpdatedAt, error } =
    useGetTableData(state, dispatch);

  const quickActions = useQuickActionsSettings(widget?.storage?.transpose);

  const handleSave = useColumnVisibility(
    state.decimalDigitsSettings,
    state.enableSettings,
  );

  const contextMenuItems = useCallback(
    (params) => {
      const enableChart =
        widget?.external ?? widgetFromJSON?.data?.table?.enableCharts ?? false;

      return getContextMenuItems(params, { enableChart, widgetId: widget?.id });
    },
    [widget?.external, widgetFromJSON?.data?.table?.enableCharts],
  );

  const showCurrency = useMemo(
    () => DISPLAY_CURRENCY_WIDGETIDS.includes(widget?.widgetId),
    [],
  );

  const agChartViewProps = useChartOptions();
  const ChartToolPanelActions = useChartToolPanelAction();

  const extraSettings = useMemo(() => {
    return [quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);

  const exportFns = useAgExportFuncs();

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const onColumnPivotModeChanged = useCallback(
    (event: AgGridEvents) => onPivotModeChanged(event, updateWidget),
    [updateWidget],
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      failingUrl={state.failingUrl}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={state.decimalDigitsSettings}
          setDecimalDigitsSettings={(decimalDigitsSettings) =>
            dispatch({ decimalDigitsSettings })
          }
          enableSettings={state.enableSettings}
          setEnableSettings={(enabled) =>
            dispatch({ enableSettings: (prev) => ({ ...prev, ...enabled }) })
          }
        />
      }
      lastUpdated={dataUpdatedAt}
      loading={isLoading}
      exportFns={exportFns}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      elementNextToTitle={
        <>
          <PeriodParams />
          {widget.widgetId === "financial_ratios" && (
            <AdvancedSelect
              className="obb-parameter"
              popupWidth={200}
              label={
                FINANCIAL_RATIOS.find((r) => r.value === state.selectedGroup)?.label ??
                "Ratio"
              }
              selected={state.selectedGroup}
              onSelect={(selectedGroup) => {
                if (!selectedGroup) return;
                updateWidget((prev) => ({
                  ...prev,
                  storage: {
                    ...prev.storage,
                    selectedGroup: String(selectedGroup),
                  },
                }));
                dispatch({ selectedGroup: String(selectedGroup) });
              }}
              values={FINANCIAL_RATIOS as unknown as { label: string; value: string }[]}
            />
          )}
        </>
      }
      extraNavbarElements={
        (!!widget?.storage?.chartView ||
          widget?.external ||
          widgetFromJSON?.data?.table?.enableCharts) && <ChartViewButton />
      }
      error={error || rowData?.length === 0}
      errorMessage={widget?.external ? error?.message : "No results found"}
      extraSettings={extraSettings}
    >
      {chartView && <ChartViewElement />}
      <div
        className={cn("flex grow h-full", {
          "h-[calc(100%-20px)]": showCurrency && !chartView,
          "h-[calc(100%-6px)] min-h-[100px]": !(showCurrency || chartView),
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        <AgGridProvider
          columnDefs={columnDefs}
          rowData={rowData}
          getContextMenuItems={contextMenuItems}
          gridOptions={gridOptions}
          onColumnPivotModeChanged={onColumnPivotModeChanged}
          {...agChartViewProps}
        />
      </div>
      <HideOnResize>
        {showCurrency && widget.data?.mainTicker?.currency && (
          <p className="text-light-300 dark:text-light-600 text-xs mt-1">
            {`Current Currency: ${widget.data?.mainTicker?.currency}`}
          </p>
        )}
      </HideOnResize>
    </DraggableCard>
  );
}
