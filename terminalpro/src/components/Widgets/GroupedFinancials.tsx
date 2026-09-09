import type {
  CellContextMenuEvent,
  ColDef,
  GetContextMenuItemsParams,
} from "ag-grid-community";
import { useCallback, useEffect, useMemo, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useProGroupedFinancials } from "~/lib/api/sdkComponents";
import type { Widget } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import { cn } from "~/lib/utils";
import WIDGETS from "~/lib/widgets.json";
import type { ExtraActionT } from "../DraggableCard/NavBar";
import {
  getColumnDefs,
  getContextMenuItems,
  getQuarterColumnDefs,
} from "../General/Table/AgGridUtils";
import { ChartViewButton, ChartViewElement } from "../General/Table/Chart/AgChartView";
import useChartOptions, {
  useChartToolPanelAction,
} from "../General/Table/Chart/hooks/useChartOptions";
import {
  AgGridProvider,
  getWidgetStorage,
  useAgExportFuncs,
  useAgGridContext,
  useColumnVisibility,
} from "../General/Table/hooks";
import { useWidgetParamsPositions } from "../General/Table/NavBar/QueryParams";
import { useChartGeneration } from "../General/Table/NavBar/useChartGeneration";
import TableSettings from "../General/Table/SubMenus/TableSettings";
import { getTableData } from "../General/Table/utils";
import { useWidgetContext } from "../Widget.context";

type SelectedGroupT = "income_statement" | "balance_sheet" | "cash_flow_statement";

export function GroupedFinancials() {
  const widget = useWidgetContext()?.widget;
  const chartView = widget.storage?.chartView?.enabled;

  const { currentTutorial, currentStep, goToStep } = useShallowTutorialStore(
    (state) => ({
      currentTutorial: state.currentTutorial,
      currentStep: state.currentStep,
      goToStep: state.goToStep,
    }),
  );

  const selectedGroup = (widget?.storage?.params?.selectedGroup ??
    "income_statement") as SelectedGroupT;
  const period = widget?.storage?.params?.period ?? "annual";
  const reversed = widget?.storage?.[selectedGroup]?.reversed ?? false;

  const decimalDigits = useShallowThemeStore((state) => state.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;

  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const { isLoading, data, dataUpdatedAt, error } = useProGroupedFinancials(
    {
      queryParams: {
        data_provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol,
        period,
        limit: period === "annual" ? 12 : 40,
        // @ts-expect-error - we need this or else creates infinite loop
        selectedGroup,
      },
    },
    {
      enabled: true,
      refetchInterval: false,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 60 * 2,
    },
  );

  const { rowData, columnDefs } = useMemo(() => {
    if (!data?.results) return { rowData: [], columnDefs: [] };

    for (const row of data?.results?.[selectedGroup] ?? []) {
      for (const key in row) {
        if (row[key] === null) {
          delete row[key];
        }
      }
    }
    const newData = getTableData(
      data?.results?.[selectedGroup] ?? [],
      {
        external: false,
        data: {
          table: {
            transpose: widget?.storage?.[selectedGroup]?.transpose,
            columnsDefs: WIDGETS[selectedGroup]?.data?.table?.columnsDefs,
            showAll: WIDGETS[selectedGroup]?.data?.table?.showAll,
          },
        },
      } as Widget,
      { period },
    );

    if (newData.length === 0) return { rowData: [], columnDefs: [] };

    const coldefs = getColumnDefs(newData, {
      widgetId: selectedGroup,
      external: false,
      data: {
        table: {
          transpose: widget?.storage?.[selectedGroup]?.transpose,
          columnsDefs: WIDGETS[selectedGroup]?.data?.table?.columnsDefs,
          showAll: WIDGETS[selectedGroup]?.data?.table?.showAll,
        },
      },
    } as Widget);

    if (["annual", "ttm"].includes(period))
      return { rowData: newData, columnDefs: coldefs };

    return {
      rowData: newData,
      columnDefs: getQuarterColumnDefs(newData, coldefs, reversed),
    };
  }, [
    data?.results,
    selectedGroup,
    widget?.storage?.[selectedGroup]?.transpose,
    period,
    reversed,
  ]);

  const reportedCurrency = useMemo(() => {
    const currencySet = (data?.results?.[selectedGroup] || []).reduce((acc, curr) => {
      if (curr?.reported_currency?.length === 3) {
        acc.add(curr.reported_currency.toUpperCase());
      }
      return acc;
    }, new Set<string>());

    if (currencySet?.size !== 0) {
      return Array.from(currencySet).at(0);
    }
    return null;
  }, [data?.results?.[selectedGroup]]);

  const { handleRangeSelection, rangeSelection } = useChartGeneration();

  useEffect(() => {
    if (rangeSelection) {
      if (currentTutorial === "table_charting" && currentStep === 1) {
        setTimeout(() => {
          goToStep(2);
        }, 500);
      }
    }
  }, [currentStep, currentTutorial, rangeSelection]);

  const handleSave = useColumnVisibility(decimalDigitsSettings);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: period === "quarter" ? 22 : 32,
      statusBar: {
        statusPanels: [
          {
            statusPanel: "agAggregationComponent",
            statusPanelParams: {
              aggFuncs: ["count", "sum", "min", "max", "avg"],
            },
          },
        ],
      },
    };
  }, [period]);

  const cellContextMenu = useCallback(
    (_params: CellContextMenuEvent) => {
      if (currentTutorial === "table_charting") {
        setTimeout(() => {
          goToStep(3);
        }, 500);
      }
    },
    [currentTutorial],
  );

  const contextMenuItems = useCallback(
    (params: GetContextMenuItemsParams) =>
      getContextMenuItems(params, {
        widgetId: widget?.id,
        onChartCreation: () => {
          if (currentTutorial === "table_charting") {
            goToStep(4);
          }
        },
      }),

    [currentTutorial],
  );

  const extraSettings = useExtraSettings(period, chartView);
  const agChartViewProps = useChartOptions();
  const exportFns = useAgExportFuncs();
  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      extraSettings={extraSettings}
      showActionsSettings={true}
      onSaveSettings={handleSave}
      settingsModalChildren={
        <TableSettings
          decimalDigitsSettings={decimalDigitsSettings}
          setDecimalDigitsSettings={setDecimalDigitsSettings}
        />
      }
      lastUpdated={dataUpdatedAt}
      exportFns={exportFns}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={<ChartViewButton />}
      loading={isLoading}
      error={error || (!isLoading && rowData?.length === 0)}
      extraClassName="h-[calc(100%-26px)] overflow-hidden"
    >
      {chartView && <ChartViewElement />}

      <div
        className={cn("grid", {
          "h-[calc(100%-30px)] min-h-[100px]": !chartView,
          "h-0 w-0 max-h-0": chartView,
        })}
      >
        {rowData?.length > 0 && (
          <AgGridProvider
            rowData={rowData}
            columnDefs={columnDefs}
            onCellContextMenu={cellContextMenu}
            getContextMenuItems={contextMenuItems}
            onCellSelectionChanged={handleRangeSelection}
            gridOptions={gridOptions}
            {...agChartViewProps}
          />
        )}
      </div>
      {!chartView && (
        <p className="text-light-300 dark:text-light-600 text-xs my-2">
          {reportedCurrency &&
            `Note: Millions of ${reportedCurrency} except Per Share Values`}
        </p>
      )}
    </DraggableCard>
  );
}

export function useExtraSettings(period: "annual" | "quarter", chartView = false) {
  const { gridRef, columnDefsRef } = useAgGridContext();
  const {
    widget: { storage },
    updateWidget,
  } = useWidgetContext();

  const transposed = getWidgetStorage({ storage } as any)?.transpose;

  const ChartToolPanelActions = useChartToolPanelAction();

  const getSelectedGroup = useCallback(
    (s: typeof storage) => s?.params?.selectedGroup ?? s?.selectedGroup,
    [],
  );

  const quickActions = useMemo<ExtraActionT[]>(() => {
    return [
      {
        icon: "columns-03",
        id: "quick-actions",
        label: "Quick Actions",
        children: [
          {
            icon: "uil-arrows-resize",
            id: "autosize-columns",
            label: "Autosize columns",
            onClick: () => {
              gridRef.current?.api.autoSizeAllColumns();
            },
          },
          {
            icon: "radix-icons-reset",
            id: "reset-columns",
            label: "Reset columns",
            onClick: () => {
              gridRef.current?.api?.resetColumnState();
              gridRef.current?.api?.resetColumnGroupState();
              gridRef.current?.api?.autoSizeAllColumns();
            },
          },
          {
            icon: "noto-letter-t",
            id: "transpose-data",
            label: "Transpose data",
            onClick: () => {
              updateWidget((prev) => {
                const group = getSelectedGroup(prev.storage);
                return {
                  ...prev,
                  storage: {
                    ...prev.storage,
                    [group]: {
                      ...prev.storage?.[group],
                      transpose: !prev?.storage?.[group]?.transpose,
                    },
                  },
                };
              });
            },
          },
          {
            icon: "jam-refresh-reverse",
            id: "reverse-years",
            label: "Reverse years",
            hide: !transposed,
            onClick: () => {
              const columnDefs = columnDefsRef.current as ColDef[];

              const indexColumnIndex = columnDefs.findIndex(
                (col) => col.field === "Index",
              );
              if (
                indexColumnIndex !== -1 &&
                columnDefs.every(
                  (col) => col.field === "Index" || /^\d{4}$/.test(col.headerName),
                ) &&
                period?.toLowerCase() === "annual"
              ) {
                const colOrder = gridRef.current?.api
                  ?.getColumnState()
                  .map((col) => col.colId);

                const indexColumnIndex = colOrder.indexOf("Index");

                if (indexColumnIndex !== -1) {
                  const indexColumn = colOrder.splice(indexColumnIndex, 1)[0];

                  colOrder.reverse();

                  colOrder.unshift(indexColumn);

                  const newColOrder = colOrder.map((colId) => {
                    return columnDefs.find((col) => col.field === colId);
                  });

                  gridRef.current?.api?.updateGridOptions({
                    columnDefs: newColOrder,
                  });
                }
              } else {
                updateWidget((prev) => {
                  const group = getSelectedGroup(prev.storage);
                  return {
                    ...prev,
                    storage: {
                      ...prev.storage,
                      [group]: {
                        ...prev.storage?.[group],
                        reversed: !prev?.storage?.[group]?.reversed,
                      },
                    },
                  };
                });
              }
            },
          },
        ],
      },
    ];
  }, [period, gridRef, columnDefsRef, updateWidget, transposed, getSelectedGroup]);

  return useMemo(() => {
    return [...quickActions, ...(chartView ? ChartToolPanelActions : [])];
  }, [chartView, quickActions, ChartToolPanelActions]);
}

export default GroupedFinancials;
