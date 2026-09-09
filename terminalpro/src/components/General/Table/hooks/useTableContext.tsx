import type { AgChartThemeOverrides } from "ag-charts-enterprise";
import type {
  ChartRef,
  ColDef,
  CreateRangeChartParams,
  ManagedGridOptions,
  SideBarDef,
  ToolPanelDef,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import {
  createContext,
  type FC,
  forwardRef,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import type { ExtraActionT } from "~/components/DraggableCard/NavBar";
import { AgGridSetLoadingOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import { FormulasToolDef } from "~/components/General/Table/SubMenus/FormulasToolPanel";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useComposeRefs } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, isSSRMType } from "~/lib/utils";
import { createRangeChart, customChartWidgetIds } from "../Chart/AgChartView";
import { useChartCloseButtonListener } from "../Chart/hooks/useChartOptions";
import { useCreateChartData } from "../Chart/hooks/useCreateChartData";
import { useAgThemes } from "../Chart/themes";
import { ActiveFiltersBanner } from "../components/ActiveFiltersBanner";
import { NoRowsOverlay } from "../components/NoRowsOverlay";
import { compileExpression } from "../SubMenus/formulaParser";
import { areTruthy, ensureAgGrid, someTruthy } from "../utils";
import type {
  AgGridContextValue,
  AgGridElement,
  AgGridProps,
  GridStateT,
  TableProps,
} from "./types";
import { useCreateChart } from "./useCreateChart";
import {
  getCellRangeState,
  useApplyColumnState,
  useUpdateColumnState,
} from "./useUpdateColumnState";
import { useIsFirstRender } from "./utils";

const paginationPageSizeSelector = [100, 200, 500, 1000];

export const AgGridContext = createContext<AgGridContextValue | null>(null);

export const useAgGridContext = () => {
  const context = useContext(AgGridContext);
  if (!context) {
    throw new Error("useAgGridContext must be used within a AgGridProvider");
  }
  return context;
};

export function useGridSync(rowData: any[], columnDefs: ColDef[]) {
  const updateAgGrid = useAgGridContext().updateAgGrid;

  const { formulas, isPivotMode } = useWidgetContext()?.widget?.storage ?? {};

  const formulaCols = useMemo(() => {
    if (isPivotMode || !formulas || formulas.length === 0) return null;
    const formulaCols = formulas.map((formula) => {
      const exprValues = compileExpression(formula.expression);
      const description = formula.expression
        .map((e) => e.headerName || e.value)
        .join(" ");

      const valueGetter = `try { return ${exprValues} } catch { return null; }`;

      return {
        headerName: formula.name,
        field: `formula_${formula.id}`,
        chartDataType: "series",
        cellDataType: "number",
        valueGetter,
        headerTooltip: description.trim(),
        enableValue: true,
        enablePivot: true,
        allowedAggFuncs: ["sum", "min", "max", "avg", "count", "first", "last"],
        defaultAggFunc: "sum",
      } as ColDef<any, any>;
    });
    return formulaCols;
  }, [formulas, isPivotMode]);

  const cleanState = useMemo<GridStateT>(() => {
    if (!formulaCols) return { rowData, columnDefs };

    return { rowData, columnDefs: [...columnDefs, ...formulaCols] };
  }, [rowData, columnDefs, formulaCols]);

  useEffect(() => {
    if (!(columnDefs?.length > 0 && rowData?.length > 0)) return;

    updateAgGrid({
      ...cleanState,
      needsUpdate: true,
      dataRevision: (prev) => (prev !== null ? prev + 1 : 0),
    });
  }, [cleanState]);

  return cleanState.columnDefs;
}

const Table: FC<TableProps> = memo((props: TableProps) => {
  const childrenMemo = useMemo(() => props.children, [props.children]);

  const gridRef = useRef<AgGridElement | null>(null);
  const columnDefsRef = useRef<ColDef<any, any>[]>([]);
  const chartRef = useRef<ChartRef>(null);
  const chartViewElementRef = useRef<HTMLDivElement>(null);
  const createRangeChartParamsCbRef = useRef<
    (params: CreateRangeChartParams) => CreateRangeChartParams
  >((params) => params);

  const handleChartViewToggleRef = useRef<(chartView: boolean) => boolean>(
    (chartView) => chartView,
  );
  const flushColumnStateRef = useRef<() => void>(() => {});
  // Shared across every useApplyColumnState instance — tracks that the chart
  // view is (or was just) enabled so table restores keep saved column widths
  const previousChartEnabledRef = useRef<boolean | undefined>(false);
  const isReallyTransposedRef = useRef(false);

  const createChartData = useCreateChartData();

  const [gridState, dispatch] = useStateReducer<GridStateT>({
    columnDefs: [],
    rowData: [],
    gridReady: false,
    needsUpdate: false,
    resized: {},
    dataRevision: null,
  });

  const updateAgGrid = useCallback(
    (options: GridStateT | ((prev: GridStateT) => GridStateT)) => {
      if (typeof options === "function") {
        dispatch((prev) => options(prev));
        return;
      }

      dispatch({
        ...options,
        needsUpdate: (prev) => options.needsUpdate ?? prev,
      });
    },
    [],
  );

  const [columnVisibility, setColumnVisibility] = useState(
    {} as Record<string, boolean>,
  );
  const getGridState = useCallback(() => gridState, [gridState]);

  return (
    <AgGridContext.Provider
      value={{
        gridRef,
        chartRef,
        chartViewElementRef,
        columnDefsRef,
        columnVisibility,
        setColumnVisibility,
        createChartData,
        gridState,
        getGridState,
        updateAgGrid,
        createRangeChartParamsCbRef,
        handleChartViewToggleRef,
        flushColumnStateRef,
        previousChartEnabledRef,
        isReallyTransposedRef,
      }}
    >
      {childrenMemo}
    </AgGridContext.Provider>
  );
});

Table.displayName = "AgGridProvider";

export function useUpdateChartView(chartThemeOverrides: AgChartThemeOverrides) {
  const { gridState, gridRef, chartRef, ...agGrid } = useAgGridContext();
  const widget = useWidgetContext()?.widget;

  const applyColumnState = useApplyColumnState();

  const setCloseButtonListener = useChartCloseButtonListener();

  const setChartUpdateCb = useCallback(
    (
      options: Partial<ManagedGridOptions> | undefined,
      chartParams: CreateRangeChartParams,
      isUpdate = false,
    ) => {
      if (!ensureAgGrid(gridRef.current)) return;
      if (!options) options = { loading: false };
      if (!isSSRMType(widget?.type)) options.pagination = false;

      if (isUpdate) {
        gridRef.current.api.updateGridOptions(options);
        const { chartContainer, ...rest } = chartParams;
        if (options.rowData) applyColumnState(gridRef.current, true);

        return gridRef.current.api.updateChart({
          chartId: chartRef.current?.chartId,
          type: "rangeChartUpdate",
          ...rest,
        });
      }

      if (Object.keys(options).length > 0)
        gridRef.current.api.updateGridOptions(options);

      chartRef.current = gridRef.current.api.createRangeChart(chartParams);
      if (options.rowData) applyColumnState(gridRef.current, true);

      const chartSettingsOpen = !!widget?.storage?.chartSettingsOpen;
      if (chartSettingsOpen) {
        gridRef.current.api.openChartToolPanel({ chartId: chartRef?.current?.chartId });
        setTimeout(() => setCloseButtonListener(), 300);
      }

      // for some reason zoom buttons have wrong transform style on first render
      // even though `--hidden` class is added
      const zoomButtons = chartRef?.current?.chartElement?.getElementsByClassName(
        "ag-charts-toolbar ag-charts-toolbar--horizontal ag-charts-zoom-buttons__toolbar--hidden",
      )?.[0] as HTMLDivElement;
      if (zoomButtons?.style) zoomButtons.style.transform = "translateY(54px)";
    },
    [gridRef, chartRef, widget, applyColumnState],
  );

  const setChartUpdate = useDebouncedCallback(setChartUpdateCb, 100);

  useEffect(() => {
    if (!(gridState?.gridReady && widget?.storage?.chartView)) return;
    const { chartView = {} } = widget.storage;
    const { chartView: tableChartView } = widget.data?.table ?? {};

    const shouldCreate = areTruthy(
      ensureAgGrid(gridRef.current),
      gridState.rowData,
      gridState.columnDefs,
      chartView?.enabled,
    );

    if (!shouldCreate) return;
    const isSSRM = isSSRMType(widget?.type);
    if (!isSSRM) applyColumnState(gridRef.current, true);

    const gridApi = gridRef.current?.api;
    const isPivotMode = gridApi?.isPivotMode();

    const { createChartData, getGridState } = agGrid;

    const { stateCellRange, chartType, chartModel } = getCellRangeState(
      widget,
      undefined,
      isPivotMode,
    );

    const cellRangeColumns =
      !!stateCellRange?.columns && !widget?.storage?.ignoreCellRange;

    const chartData = createChartData({
      gridApi,
      rowData: getGridState().rowData,
      columnDefs: getGridState().columnDefs,
      widget,
      chartType,
    });

    const { rowData, columnDefs, chartParams } = createRangeChart({
      chartData,
      chartModel,
    });

    const rangeChartParams = agGrid.createRangeChartParamsCbRef.current(chartParams);
    const columns = rangeChartParams.cellRange.columns || [];

    const defaultColumns = tableChartView?.cellRangeCols?.[chartType]?.filter((col) =>
      columnDefs.some((def) => def.field === col),
    );

    const validStateRange = cellRangeColumns && stateCellRange?.columns?.length > 1;

    if (cellRangeColumns && validStateRange) {
      rangeChartParams.cellRange = stateCellRange;
    } else if (defaultColumns) {
      if (defaultColumns.length === 0) {
        toast.error(
          `\`cellRangeCols\` is empty for chart type \`${chartType}\` or field names do not match.
          Please check your widget configuration.`,
        );
        defaultColumns.push(...columns);
      }
      rangeChartParams.cellRange.columns = defaultColumns;
    }

    rangeChartParams.cellRange.columns = rangeChartParams.cellRange.columns.filter(
      (col) => columns.includes(col),
    );

    columnDefs.sort(
      (a, b) =>
        rangeChartParams.cellRange?.columns?.indexOf(a.field) -
        rangeChartParams.cellRange?.columns?.indexOf(b.field),
    );

    if (isSSRM && gridApi.getRowGroupColumns().length === 0) {
      const rowCount = gridApi.paginationGetRowCount();
      const pageSize = gridApi.paginationGetPageSize();
      const pageIndex = gridApi.paginationGetCurrentPage();

      Object.assign(rangeChartParams.cellRange, {
        rowStartIndex: pageIndex * pageSize,
        rowEndIndex: Math.min((pageIndex + 1) * pageSize, rowCount),
      });
    } else if (isPivotMode) {
      const columnsInPivot = gridApi
        .getAllDisplayedColumns()
        .map((col) => col.getColId());

      const filteredColumns = stateCellRange?.columns?.filter((col: string) =>
        columnsInPivot.includes(col),
      );
      const validStateRange = filteredColumns && filteredColumns.length > 1;

      rangeChartParams.cellRange.columns = validStateRange
        ? filteredColumns
        : columnsInPivot;

      const rowCount = gridApi.getDisplayedRowCount();
      Object.assign(rangeChartParams.cellRange, {
        rowStartIndex: 0,
        rowEndIndex: rowCount - 1,
      });
    }

    const chartIds = gridApi.getChartModels().map((chart) => chart.chartId);
    const isUpdate = chartIds.includes(chartRef.current?.chartId);
    rangeChartParams.chartThemeOverrides = chartThemeOverrides;

    const hasCustomChart =
      !widget.external && customChartWidgetIds.includes(widget?.widgetId);
    const withOptions =
      (chartData.isReallyTransposed || hasCustomChart) && !isPivotMode;
    agGrid.isReallyTransposedRef.current = chartData.isReallyTransposed && !isPivotMode;

    setChartUpdate(withOptions && { rowData, columnDefs }, rangeChartParams, isUpdate);
  }, [
    gridState.dataRevision,
    gridState.gridReady,
    widget.storage?.chartView?.enabled,
    chartRef,
    agGrid.createRangeChartParamsCbRef,
    agGrid.isReallyTransposedRef,
    agGrid.getGridState,
  ]);

  // Apply theme override changes (e.g. navigator toggle) to existing charts
  useEffect(() => {
    const chartId = chartRef.current?.chartId;
    if (!(chartId && ensureAgGrid(gridRef.current))) return;
    const chartNavigatorEnabled = widget?.storage?.chartNavigatorEnabled;
    const chartMiniChartEnabled = widget?.storage?.chartMiniChartEnabled;

    gridRef.current.api.updateChart({
      type: "rangeChartUpdate",
      chartId,
      chartThemeOverrides: {
        common: {
          navigator: {
            enabled: Boolean(chartNavigatorEnabled || chartMiniChartEnabled),
            miniChart: { enabled: Boolean(chartMiniChartEnabled) },
          },
        },
      },
    });
  }, [
    gridRef,
    widget?.storage?.chartNavigatorEnabled,
    widget?.storage?.chartMiniChartEnabled,
  ]);
}

type GridOptions = Partial<ManagedGridOptions>;

export function useSyncTableData(gridOptions: GridOptions) {
  const { chartRef, gridRef, columnDefsRef, gridState, ...agGrid } = useAgGridContext();

  const tablePagination = useShallowThemeStore((state) => state.tablePagination);
  const {
    chartView,
    enableStats = false,
    enablePagination = tablePagination,
  } = useWidgetContext()?.widget?.storage ?? {};
  const widgetRef = useWidgetContext()?.widgetRef;
  const isServerSide = isSSRMType(widgetRef.current?.type);

  const lastChartViewEnabledRef = useRef(chartView?.enabled);
  const lastDataRevisionRef = useRef(gridState.dataRevision);
  const isFirstRender = useIsFirstRender();
  const isFirstServerSideRenderRef = useRef(true);
  const applyColumnState = useApplyColumnState();

  const setPendingUpdate = useCallback(
    async (options: GridOptions, chartViewEnabled?: boolean) => {
      if (isFirstRender) return;
      if (!ensureAgGrid(gridRef.current)) return;
      gridRef.current.api.clearCellSelection();
      gridRef.current.api.updateGridOptions(options);

      if (options?.rowData || isServerSide)
        applyColumnState(gridRef.current, chartViewEnabled);
    },
    [gridRef, isFirstRender, applyColumnState],
  );

  const handleChartViewToggle = useCallback(
    (chartViewEnabled: boolean) => {
      if (!ensureAgGrid(gridRef.current)) return;
      const { external, widgetId } = widgetRef.current;
      const { rowData, columnDefs } = gridState;
      const pagination = isServerSide || (rowData?.length > 100 && enablePagination);
      const hasCustomChart = !external && customChartWidgetIds.includes(widgetId);
      const isReallyTransposed = agGrid.isReallyTransposedRef.current;

      const updateState = { pagination, loading: false } as GridStateT;
      if (chartViewEnabled && chartRef.current) {
        if (!isServerSide) gridRef.current?.api?.updateGridOptions({ loading: true });
        if (!ensureAgGrid(gridRef.current)) return;
        if ((isReallyTransposed || !hasCustomChart) && !isServerSide)
          Object.assign(updateState, { rowData, columnDefs });

        if (!isServerSide) setPendingUpdate(updateState, chartViewEnabled);
        if (hasCustomChart || isReallyTransposed)
          queueMicrotask(() =>
            agGrid.updateAgGrid(
              hasCustomChart ? { dataRevision: null } : { needsUpdate: true },
            ),
          );
        chartRef.current?.destroyChart();
        chartRef.current = null;
      }

      if (hasCustomChart) {
        gridRef.current?.api?.updateGridOptions({
          ...updateState,
          rowData: [],
          columnDefs: [],
        });
      }

      return !chartViewEnabled;
    },
    [
      enablePagination,
      gridRef,
      gridState.rowData,
      gridState.columnDefs,
      chartRef,
      agGrid.updateAgGrid,
      setPendingUpdate,
      agGrid.isReallyTransposedRef,
    ],
  );

  useEffect(() => {
    agGrid.handleChartViewToggleRef.current = handleChartViewToggle;
  }, [handleChartViewToggle]);

  const setPendingDebounce = useDebouncedCallback(setPendingUpdate, 300, {
    trailing: true,
    maxWait: 1000,
  });

  useEffect(() => {
    if (isFirstRender) return;
    const { rowData, columnDefs, gridReady, needsUpdate, dataRevision } = gridState;
    const pagination = rowData?.length > 100 && enablePagination;

    if (columnDefsRef.current?.length === 0 && columnDefs?.length > 0)
      columnDefsRef.current = columnDefs;

    if (!(gridReady && rowData?.length > 0 && columnDefs?.length > 0)) return;

    if (lastChartViewEnabledRef.current && !chartView?.enabled) {
      lastChartViewEnabledRef.current = chartView?.enabled;
      return;
    }
    lastChartViewEnabledRef.current = chartView?.enabled;

    if (dataRevision === 0 && !isServerSide)
      return applyColumnState(gridRef.current, {
        ignoreChart: chartView?.enabled,
        skipSavedState: true,
      });

    if (
      someTruthy(
        !needsUpdate,
        chartView?.enabled,
        lastDataRevisionRef.current === dataRevision,
        !dataRevision,
      )
    )
      return;

    const updateState = { loading: false } as GridStateT;

    if (!ensureAgGrid(gridRef?.current)) return;

    const pageSize = gridRef.current?.api.paginationGetPageSize();

    columnDefsRef.current = columnDefs;

    if (rowData?.length > 0 && !isServerSide) {
      updateState.pagination = pagination;
      updateState.paginationAutoPageSize = rowData?.length < 100;
      updateState.paginationPageSize = gridOptions?.paginationPageSize ?? pageSize;
    }

    const newGridOptions = gridOptions || {};

    if (!enableStats) newGridOptions.statusBar = undefined;
    if (isServerSide) updateState.rowData = undefined;

    setPendingDebounce({ rowData, columnDefs, ...newGridOptions, ...updateState });
    lastDataRevisionRef.current = dataRevision;
  }, [gridState?.dataRevision, isFirstServerSideRenderRef, lastDataRevisionRef]);

  useLayoutEffect(() => {
    if (isFirstRender) return;
    if (!ensureAgGrid(gridRef.current)) return;

    if (isServerSide && isFirstServerSideRenderRef.current) {
      isFirstServerSideRenderRef.current = false;
      return;
    }
    const newGridOptions = gridOptions || {};

    const rowData = gridState.rowData;
    const pageSize = gridRef.current?.api.paginationGetPageSize();
    const pagination = rowData?.length > 100 && enablePagination;

    if (rowData?.length > 0 && !isServerSide) {
      newGridOptions.pagination = pagination;
      newGridOptions.paginationAutoPageSize = rowData?.length < 100;
      newGridOptions.paginationPageSize = gridOptions?.paginationPageSize ?? pageSize;
    }

    if (!enableStats) newGridOptions.statusBar = undefined;

    newGridOptions && setPendingDebounce(newGridOptions);
  }, [gridOptions, enableStats, enablePagination, isFirstServerSideRenderRef]);
}

const AgGridProvider = memo(
  forwardRef<AgGridElement, AgGridProps>((props, ref) => {
    const { extraClassName, className = extraClassName, hideHeader, ...rest } = props;

    const gridRef = useAgGridContext()?.gridRef;

    const composeRefs = useComposeRefs(gridRef, ref);

    const { theme, tablePagination } = useShallowThemeStore((state) => ({
      theme: state.theme,
      tablePagination: state.tablePagination,
    }));

    const enablePagination =
      useWidgetContext()?.widgetRef?.current?.storage?.enablePagination;

    const { agTheme, chartThemes, customChartThemes } = useAgThemes(theme);

    const createChartContainer = useCreateChart();

    const columnDefs = useGridSync(rest?.rowData, rest?.columnDefs);

    const [
      onGridReady,
      onStateUpdated,
      onNewColumnsLoaded,
      onGridPreDestroyed,
      onChartRangeSelectionChanged,
      onVirtualColumnsChanged,
      onChartDestroyed,
      initialState,
    ] = useUpdateColumnState(props?.onGridReady, props?.onGridPreDestroyed);

    const callerOnModelUpdated = rest?.onModelUpdated;
    const onModelUpdated = useCallback(
      (event: Parameters<NonNullable<AgGridProps["onModelUpdated"]>>[0]) => {
        callerOnModelUpdated?.(event);
        const api = event.api;
        if (!api || api.isDestroyed()) return;
        if (api.getGridOption("loading")) return;
        if (api.getDisplayedRowCount() === 0) api.showNoRowsOverlay();
        else api.hideOverlay();
      },
      [callerOnModelUpdated],
    );

    const Table = useMemo(
      () => (
        <AgGridReact
          className={cn(
            "relative ag-grid h-full w-full",
            {
              "hide-grid-header": hideHeader,
            },
            className,
          )}
          theme={agTheme}
          ref={composeRefs}
          createChartContainer={createChartContainer}
          pagination={
            rest?.rowModelType === "serverSide" ||
            (rest?.rowData?.length > 100 && (enablePagination ?? tablePagination))
          }
          paginationPageSizeSelector={paginationPageSizeSelector}
          suppressColumnVirtualisation={
            rest?.rowModelType === "serverSide" || columnDefs?.length < 10
          }
          infiniteInitialRowCount={rest?.rowModelType !== "serverSide" ? 100 : 500}
          serverSideInitialRowCount={
            rest?.rowModelType === "serverSide" ? rest?.paginationPageSize : undefined
          }
          noRowsOverlayComponent={NoRowsOverlay}
          {...rest}
          popupParent={rest?.popupParent ?? document.body}
          gridOptions={rest?.gridOptions}
          rowData={rest?.rowModelType !== "serverSide" ? rest?.rowData : undefined}
          columnDefs={columnDefs}
          onGridReady={onGridReady}
          onStateUpdated={onStateUpdated}
          onNewColumnsLoaded={onNewColumnsLoaded}
          onGridPreDestroyed={onGridPreDestroyed}
          onChartRangeSelectionChanged={onChartRangeSelectionChanged}
          onVirtualColumnsChanged={onVirtualColumnsChanged}
          customChartThemes={customChartThemes}
          chartThemes={chartThemes}
          chartThemeOverrides={rest?.chartThemeOverrides}
          onChartDestroyed={onChartDestroyed}
          onModelUpdated={onModelUpdated}
          initialState={initialState}
          serverSideDatasource={rest?.serverSideDatasource}
        />
      ),
      [
        theme,
        agTheme,
        columnDefs?.length < 10,
        rest?.serverSideDatasource,
        customChartThemes,
        chartThemes,
        composeRefs,
        onGridReady,
        onStateUpdated,
        onNewColumnsLoaded,
        onGridPreDestroyed,
        onChartRangeSelectionChanged,
        onVirtualColumnsChanged,
        onChartDestroyed,
        onModelUpdated,
        createChartContainer,
      ],
    );

    useSyncTableData(rest?.gridOptions);
    useUpdateChartView(rest?.chartThemeOverrides);

    return (
      <AgGridSetLoadingOnResize>
        <div className="ag-grid-stack flex flex-col h-full w-full">
          <ActiveFiltersBanner />
          <div className="flex-1 min-h-0">{Table}</div>
        </div>
      </AgGridSetLoadingOnResize>
    );
  }),
);

export { AgGridProvider, Table };

export function useAgExportFuncs() {
  const gridRef = useAgGridContext()?.gridRef;

  return useMemo(
    () => ({
      csvFunction: (title = "report") => {
        gridRef.current?.api.exportDataAsCsv({ fileName: `${title}.csv` });
      },
      excelFunction: (title = "report") => {
        gridRef.current?.api.exportDataAsExcel({ fileName: `${title}.xlsx` });
      },
    }),
    [gridRef],
  );
}

export function useQuickActionsSettings(transpose?: boolean | undefined) {
  const { gridRef } = useAgGridContext();
  const { widgetFromJSON, updateWidget } = useWidgetContext();

  const memoizedQuickActions = useMemo<ExtraActionT>(() => {
    return {
      icon: "humbleicons-columns-three-thirds",
      id: "quick-actions",
      label: "Quick actions",
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
          hide:
            transpose === undefined ||
            ["financial_ratios", "stock_ownership"].includes(widgetFromJSON?.widgetId),
          onClick: () => {
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                transpose: !prev?.storage?.transpose,
              },
            }));
          },
        },
      ],
    };
  }, [gridRef, widgetFromJSON?.widgetId, updateWidget]);

  return memoizedQuickActions;
}

export function getSideBarOptions(storage: WidgetT["storage"]): SideBarDef | undefined {
  const isPivotMode = storage?.isPivotMode;
  const openedToolPanel = storage?.openedToolPanel;
  const sideBarToolPanels: ToolPanelDef[] = [];

  if (storage?.enableAdvanced) {
    sideBarToolPanels.push({
      id: "columns",
      labelDefault: "Columns",
      labelKey: "columns",
      iconKey: "columns",
      toolPanel: "agColumnsToolPanel",
    });
  }

  if (!isPivotMode && storage?.enableFormulas) sideBarToolPanels.push(FormulasToolDef);

  return sideBarToolPanels.length
    ? {
        toolPanels: sideBarToolPanels,
        // delete this or set to null to not show it by default
        defaultToolPanel: openedToolPanel,
      }
    : undefined;
}
