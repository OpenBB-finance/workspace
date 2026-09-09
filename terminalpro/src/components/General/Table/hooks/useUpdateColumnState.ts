import type {
  CellRangeParams,
  ChartDestroyedEvent,
  ChartModel,
  ChartRangeSelectionChangedEvent,
  ColDef,
  Column,
  ColumnState,
  GridPreDestroyedEvent,
  GridReadyEvent,
  GridState,
  NewColumnsLoadedEvent,
  StateUpdatedEvent,
  VirtualColumnsChangedEvent,
} from "ag-grid-community";
import "ag-grid-enterprise";
import { useShallowAppStore, type Widget } from "~/lib/state/app";

import "ag-grid-enterprise";
import type { AgGridReact } from "ag-grid-react";
import isEqual from "lodash.isequal";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useWidgetContext } from "~/components/Widget.context";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { isSSRMType } from "~/lib/utils";
import { ensureAgGrid, someTruthy } from "../utils";
import { doAutoFitColumns, ignoreSources } from "./constants";
import type { AgGridEvents, AgGridProps, GridStateT, SavedState } from "./types";
import { useAgGridContext } from "./useTableContext";
import {
  getAverageWidth,
  getSavedColumnState,
  getSavedState,
  isSavedState,
  useIsFirstRender,
} from "./utils";

const defaultArgs = { ignoreChart: false, checkColDefs: true, skipSavedState: false };

const argKeys = Object.keys(defaultArgs);
type ApplyColumnOptions = Partial<typeof defaultArgs>;

type ApplyColumnArgs = (boolean | ApplyColumnOptions)[];

export function getWidgetStorage(widget: Widget) {
  const selectedGroup =
    widget?.storage?.selectedGroup ?? widget?.storage?.params?.selectedGroup;
  if (selectedGroup && widget?.storage?.[selectedGroup]) {
    return widget?.storage?.[selectedGroup];
  }

  return widget?.storage;
}

export function getStateKey(widget: Widget, isPivotMode?: boolean) {
  const storage = getWidgetStorage(widget);
  const period = storage?.period || "default";
  const reversed = storage?.reversed ? "reversed" : "";
  const transpose = storage?.transpose ? "transpose" : "";
  const pivotMode = (isPivotMode ?? storage?.isPivotMode) ? "pivot" : "";
  const { currentSheet, selectedRatio } = storage ?? {};

  return [
    period,
    transpose,
    widget?.storage?.selectedGroup,
    reversed,
    currentSheet?.name,
    selectedRatio,
    pivotMode,
  ]
    .filter(Boolean)
    .join("_");
}

export function getStateStorage(widget: Widget, isPivotMode?: boolean) {
  const stateKey = getStateKey(widget, isPivotMode);

  return widget?.storage?.[stateKey];
}

export function getCellRangeState(
  widget: Widget,
  chartType?: ChartModel["chartType"],
  isPivotMode?: boolean,
) {
  const noChartType = chartType === undefined;
  const { chartView = {} } = widget.storage;
  const storedState = getStateStorage(widget, isPivotMode);
  const chartModel: Partial<ChartModel> =
    storedState?.chartModel ?? widget?.storage?.chartModel ?? {};
  chartType = chartType ?? chartModel?.chartType ?? chartView?.chartType;

  const stateCellRange: CellRangeParams =
    storedState?.[chartType]?.cellRange ?? chartModel?.cellRange ?? (noChartType && {});

  return { stateCellRange, chartType, chartModel };
}

export function getNewCellRange(
  gridState: GridState,
  columnState: GridState | undefined,
  stateCellRange: CellRangeParams | undefined,
) {
  let newCellRange: undefined | any;
  const newColIds = gridState?.columnOrder?.orderedColIds;

  const stateColOrder = columnState?.columnOrder?.orderedColIds || [];
  const newColumnsAdded = newColIds?.filter((colId) => !stateColOrder?.includes(colId));
  const newColumnsRemoved = stateColOrder?.filter(
    (colId) => !newColIds?.includes(colId),
  );

  if (stateCellRange && newColIds) {
    const columns = stateCellRange.columns
      ?.filter((col: string) => !newColumnsRemoved?.includes(col))
      .concat(newColumnsAdded ?? []);

    newCellRange = { ...stateCellRange, columns };
  }

  return newCellRange;
}

export const useUpdateColumnState = (
  gridReady: AgGridProps["onGridReady"],
  gridPreDestroyed: AgGridProps["onGridPreDestroyed"],
) => {
  const { gridRef, chartRef, updateAgGrid, getGridState, flushColumnStateRef } =
    useAgGridContext();
  const { widget, getWidget, updateWidget } = useWidgetContext();

  const restGridReady = useCallbackRef(gridReady ?? (() => {}));
  const restGridPreDestroyed = useCallbackRef(gridPreDestroyed ?? (() => {}));
  const isServerSide = useMemo(() => isSSRMType(widget.type), [widget.type]);

  const stateKeyRef = useRef(getStateKey(widget));
  const isFirstRender = useIsFirstRender();
  const isFirstServerSideRender = useRef(true);
  const currentChartEnabledRef = useRef(widget?.storage?.chartView?.enabled);

  const updateColumnState = useCallback(
    (params: StateUpdatedEvent) => {
      if (chartRef.current) return;
      const sources = params?.sources || [];
      const widget = getWidget();

      const isPivotMode = params.api?.isPivotMode();
      const stateKey = getStateKey(widget, isPivotMode);

      const chartEnabled = widget?.storage?.chartView?.enabled;

      if (chartEnabled) {
        currentChartEnabledRef.current = chartEnabled;
        return;
      }

      if (currentChartEnabledRef.current) {
        currentChartEnabledRef.current = chartEnabled;
      }

      if (stateKeyRef.current !== stateKey) {
        stateKeyRef.current = stateKey;
        return;
      }

      if (!ensureAgGrid(params) || isFirstRender) return;

      const { columnDefs } = getGridState();
      if (columnDefs?.length === 0) return;

      const { scroll, cellSelection, rangeSelection, focusedCell, ...gridState } =
        params?.state ?? {};
      const orderedColIds = gridState?.columnOrder?.orderedColIds;
      const openToolPanel = gridState?.sideBar?.openToolPanel;

      if (
        !someTruthy(
          widget?.storage?.[stateKey]?.reversed,
          widget?.data?.table?.showAll,
        ) &&
        // @ts-expect-error
        orderedColIds?.every((id, i) => columnDefs?.[i]?.field === id)
      ) {
        gridState.columnOrder = undefined;
      }

      const columnState = widget?.data?.table?.columnState?.[stateKey];
      const updateState = !isEqual(columnState, gridState);

      const pageSize = gridState?.pagination?.pageSize;
      const updatePageSize = widget?.storage?.paginationPageSize !== pageSize;
      const filterModel = gridState?.filter?.filterModel;

      if (!(updateState || updatePageSize)) return;

      const toggledHide =
        sources?.includes("columnVisibility") && sources?.length === 1;

      const { chartType, stateCellRange } = getCellRangeState(
        widget,
        undefined,
        isPivotMode,
      );

      let newCellRange = getNewCellRange(gridState, columnState, stateCellRange);

      if (toggledHide && stateCellRange?.columns?.length > 0) {
        const newHiddenColIds = gridState?.columnVisibility?.hiddenColIds || [];
        const stateHiddenColIds = columnState?.columnVisibility?.hiddenColIds || [];

        // check what the difference in columnVisibility is
        const changedCols = stateHiddenColIds?.filter(
          (colId) => !newHiddenColIds?.find((c) => c === colId),
        );
        if (changedCols?.length > 0) {
          // if there are changed columns, we need to update the cellRange
          const columns = (newCellRange ?? stateCellRange)?.columns
            .filter((col: string) => !changedCols?.includes(col))
            .concat(changedCols);

          newCellRange = { ...stateCellRange, columns };
        }
      }

      updateWidget((prev) => {
        const newPrev = { ...prev };
        if (newCellRange && chartType) {
          newPrev.storage = {
            ...newPrev.storage,
            chartType,
            isPivotMode,
            [stateKey]: {
              ...(newPrev.storage?.[stateKey] || {}),
              [chartType]: {
                ...(newPrev.storage?.[stateKey]?.[chartType] || {}),
                cellRange: newCellRange,
              },
            },
          };
        }

        newPrev.data.table = {
          ...(newPrev.data?.table || {}),
          filterModel: {
            ...(newPrev?.data?.table?.filterModel || {}),
            [stateKey]: filterModel as any,
          },
          columnState: {
            ...(newPrev?.data?.table?.columnState || {}),
            [stateKey]: gridState,
          },
        };

        return {
          ...newPrev,
          storage: {
            ...newPrev.storage,
            isPivotMode,
            openToolPanel,
            paginationPageSize: pageSize,
          },
        };
      });
    },
    [
      getWidget,
      updateWidget,
      stateKeyRef,
      currentChartEnabledRef,
      chartRef,
      isFirstRender,
      isFirstServerSideRender,
      getGridState,
    ],
  );

  const applyColumnState = useApplyColumnState();
  const sizeColumns = useSizeColumns();

  const updatedDebounce = useDebouncedCallback(updateColumnState, 300, {
    trailing: true,
  });

  const currentPixelRatioRef = useRef<number | null>(null);

  const handleResize = useCallback(() => {
    if (window.devicePixelRatio !== currentPixelRatioRef.current) {
      currentPixelRatioRef.current = window.devicePixelRatio;
      sizeColumns(gridRef.current);
    }
  }, [sizeColumns, currentPixelRatioRef, gridRef]);

  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    if (currentPixelRatioRef.current === null) {
      currentPixelRatioRef.current = window.devicePixelRatio;
    }

    window.addEventListener("resize", handleResize, { signal });

    return () => ctrl.abort();
  }, [handleResize]);

  useEffect(() => {
    if (!flushColumnStateRef) return;
    // Lets the chart-view toggle persist a pending (debounced) column-state
    // save before chartView.enabled flips, which would otherwise drop it
    flushColumnStateRef.current = () => updatedDebounce.flush();
    return () => {
      flushColumnStateRef.current = () => {};
    };
  }, [flushColumnStateRef, updatedDebounce]);
  const sizeColumnsDebounce = useDebouncedCallback(sizeColumns, 200, { leading: true });

  const onChartRangeSelectionChanged = useCallbackRef(
    (params: ChartRangeSelectionChangedEvent) => {
      const { chartId, cellRange } = params;

      if (chartId !== chartRef.current?.chartId) return;
      if (!widget?.storage?.chartView?.enabled) return;
      const stateKey = getStateKey(widget);
      const storedState = widget?.storage?.[stateKey] ?? widget?.storage;

      const { chartView = {}, chartModel = {} } = storedState ?? {};

      const chartType = chartModel?.chartType ?? chartView?.chartType;

      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          chartType,
          [stateKey]: {
            ...(prev.storage?.[stateKey] || {}),
            [chartType]: {
              ...(prev.storage?.[stateKey]?.[chartType] || {}),
              cellRange,
            },
          },
        },
      }));
    },
  );

  const resizedColsRef = useRef<string[]>([]);

  const onVirtualColumnsChanged = useCallbackRef(
    (params: VirtualColumnsChangedEvent) => {
      if (chartRef.current || isFirstRender) return;

      if (params.afterScroll && params.api?.getAllDisplayedColumns()?.length >= 10) {
        const gridColumns = params.api?.getAllDisplayedVirtualColumns();
        const colsToSize = gridColumns
          ?.filter(
            (col) =>
              !(col?.isPinned() || resizedColsRef.current?.includes(col?.getId())),
          )
          ?.map((col) => col?.getId());

        if (colsToSize?.length === 0) return;
        resizedColsRef.current = resizedColsRef.current.concat(colsToSize);
        sizeColumns(params, null, colsToSize);
      }
    },
  );

  const onNewColumnsLoaded = useCallbackRef((params: NewColumnsLoadedEvent) => {
    if (["gridInitializing", "gridOptionsChanged"].includes(params.source)) return;

    if (chartRef.current) return;

    if (getGridState()?.needsUpdate) {
      updateAgGrid({ needsUpdate: false });
      if (isServerSide && isFirstServerSideRender.current) {
        isFirstServerSideRender.current = false;
        return;
      }
      applyColumnState(params);
    }
  });

  const onStateUpdated = useCallbackRef((params: StateUpdatedEvent) => {
    const sources = params.sources;
    if (sources?.includes("gridInitializing") && sources?.length === 1) return;
    if (sources.every((source) => ignoreSources.includes(source))) return;

    if (chartRef.current) return;
    queueMicrotask(() => updatedDebounce(params));
  });

  const onGridReady = useCallbackRef((params: GridReadyEvent) => {
    updateAgGrid({ gridReady: true });
    if (chartRef.current) return;

    queueMicrotask(() => {
      restGridReady?.(params);
      setTimeout(() => {
        applyColumnState(params, false);
      });
    });
  });

  const onGridPreDestroyed = useCallbackRef((params: GridPreDestroyedEvent) => {
    chartRef.current = null;
    setTimeout(() => {
      restGridPreDestroyed?.(params);
    });
  });

  const onChartDestroyed = useCallbackRef((params: ChartDestroyedEvent) => {
    if (!isServerSide) applyColumnState(params as any);
  });

  const initialState = useMemo(() => {
    const widget = getWidget();
    const stateKey = getStateKey(widget);
    const columnState = widget?.data?.table?.columnState?.[stateKey] as GridState;

    if (Array.isArray(columnState) || isSavedState(columnState)) return undefined;

    const { scroll, cellSelection, focusedCell, ...rest } = columnState ?? {};

    return rest;
  }, [getWidget]);

  return [
    onGridReady,
    onStateUpdated,
    onNewColumnsLoaded,
    onGridPreDestroyed,
    onChartRangeSelectionChanged,
    onVirtualColumnsChanged,
    onChartDestroyed,
    initialState,
  ] as const;
};

/**
 * Whether restoring a saved column state should re-run auto-fit.
 * Only when nothing was ever sized (no saved sizing model) or the widget is
 * explicitly allow-listed — saved widths (e.g. user autosize) must be honored.
 */
export function needsAutoFitOnRestore(
  columnSizingModel: SavedState["columnSizingModel"],
  widgetId: any,
  autoFitMaxCols?: number,
) {
  const checks = [!columnSizingModel?.length];
  if (autoFitMaxCols) checks.push(columnSizingModel?.length < autoFitMaxCols);

  return checks.some(Boolean) || doAutoFitColumns.includes(widgetId as never);
}

export function useSizeColumns() {
  const chartRef = useAgGridContext().chartRef;
  const { activeDashboardId, getWidget } = useWidgetContext();

  const getWidgetGridData = useShallowAppStore((s) => s.getWidgetGridData);

  const getAutoFitMaxCols = useCallback(() => {
    const widgetLayout = getWidgetGridData(activeDashboardId, getWidget()?.id);
    return widgetLayout?.w > 20 ? 10 : 6;
  }, [activeDashboardId, getWidget, getWidgetGridData]);

  const sizeColumns = useCallback(
    (
      params: AgGridReact | AgGridEvents,
      resized?: GridStateT["resized"],
      columnsToSize?: (string | ColDef | Column)[],
    ) => {
      if (chartRef.current) return;
      const widget = getWidget();
      const autoFitMaxCols = getAutoFitMaxCols();

      queueMicrotask(() =>
        setTimeout(() => {
          if (!ensureAgGrid(params)) return;
          if (widget?.storage?.chartView?.enabled) return;

          const { from, to } = resized ?? {};
          const wasResized = (from < to || from > to) && resized;
          const totalCols = params.api?.getAllDisplayedColumns()?.length;

          const autoFit =
            totalCols < autoFitMaxCols || doAutoFitColumns?.includes(widget?.widgetId);

          if (wasResized || (autoFit && !resized)) {
            params.api.sizeColumnsToFit({ defaultMinWidth: 100 });
          } else if (!resized) {
            if (columnsToSize?.length > 0)
              return params.api.autoSizeColumns(columnsToSize);

            params.api.autoSizeAllColumns();
          }
        }),
      );
    },
    [chartRef, getWidget, getAutoFitMaxCols],
  );

  return sizeColumns;
}

export function useApplyColumnState() {
  const { chartRef, getGridState, previousChartEnabledRef } = useAgGridContext();
  const { widget, activeDashboardId } = useWidgetContext();

  const getWidgetGridData = useShallowAppStore((s) => s.getWidgetGridData);

  const getAutoFitMaxCols = useCallback(() => {
    const widgetLayout = getWidgetGridData(activeDashboardId, widget?.id);
    return widgetLayout?.w > 20 ? 10 : 6;
  }, [activeDashboardId, widget?.id, getWidgetGridData]);

  const sizeColumns = useSizeColumns();

  const setPendingColumnState = useCallbackRef(
    (
      params: AgGridReact | AgGridEvents,
      columnState: ColumnState[],
      currentFilterModel: any,
      savedColumnState: SavedState | ColumnState[],
      previouslyChartEnabled: boolean,
      checkColDefs = true,
    ) => {
      const { columnDefs } = getGridState();

      if (!ensureAgGrid(params) || (columnDefs?.length === 0 && checkColDefs)) return;

      if (isSavedState(savedColumnState)) {
        const { openColumnGroupIds, expandedRowGroupIds, columnSizingModel } =
          savedColumnState || {};

        const autoFitMaxCols = getAutoFitMaxCols();

        const avgSize = getAverageWidth(columnState);
        params.api.applyColumnState({
          state: columnState,
          applyOrder: true,
          defaultState: { width: Math.ceil(avgSize) },
        });

        if (currentFilterModel) params.api.setFilterModel(currentFilterModel);
        if (savedColumnState?.groupColIds?.length > 0) {
          const groupColIds = savedColumnState?.groupColIds;
          params.api?.setRowGroupColumns(groupColIds);
        }

        const needsResize = needsAutoFitOnRestore(
          columnSizingModel,
          widget?.widgetId,
          !previouslyChartEnabled && autoFitMaxCols,
        );

        if (needsResize) sizeColumns(params);

        // check open groups/rows
        const columnGroupState = params.api?.getColumnGroupState();

        const openGroups = columnGroupState.map((group) => {
          if (group?.groupId) {
            const isOpen = openColumnGroupIds?.includes(group?.groupId);
            return {
              groupId: group?.groupId,
              open: isOpen,
            };
          }
          return group;
        });

        if (openGroups?.length > 0) params.api.setColumnGroupState(openGroups);

        if (expandedRowGroupIds) {
          params.api.forEachNode((node) => {
            if (node?.group) {
              const isExpanded = expandedRowGroupIds?.includes(node?.id);
              node?.setExpanded(isExpanded);
            }
          });
        }
      }
    },
  );

  const applyColumnState = useCallback(
    (params: AgGridReact | AgGridEvents, ...args: ApplyColumnArgs) => {
      let options = { ...defaultArgs } as ApplyColumnOptions;

      for (const [i, arg] of args.entries()) {
        if (arg === undefined) continue;
        if (typeof arg === "object") {
          options = { ...options, ...arg };
        } else if (typeof arg === "boolean") {
          options = { ...options, [argKeys[i]]: arg };
        }
      }

      const { ignoreChart, checkColDefs, skipSavedState } = options;

      if (chartRef.current && !ignoreChart) return;

      const stateKey = getStateKey(widget);

      const columnDefs = getGridState()?.columnDefs;
      if (columnDefs?.length === 0 && checkColDefs) return;
      const chartEnabled = widget?.storage?.chartView?.enabled;

      if (chartEnabled && !ignoreChart) return;

      const widgetTable = widget?.data?.table;

      const columnState = widgetTable?.columnState?.[stateKey] as GridState;
      const currentFilterModel = widgetTable?.filterModel?.[stateKey];

      const savedColumnState = getSavedState(columnState ?? {});
      // `widget` can be a stale closure while the chart-view toggle flips
      // storage, so chartEnabled=true here (only reachable with ignoreChart)
      // also means "restoring the table as the chart closes"
      const previouslyChartEnabled = previousChartEnabledRef.current;

      if (isSavedState(savedColumnState)) {
        if (skipSavedState) return;
        if (!ensureAgGrid(params)) return;

        const currentColumnState = params?.api?.getColumnState();

        const columnState = getSavedColumnState(currentColumnState, savedColumnState);

        if (savedColumnState?.sideBar?.openToolPanel)
          params.api.openToolPanel(savedColumnState?.sideBar?.openToolPanel);

        queueMicrotask(() =>
          setPendingColumnState(
            params,
            columnState,
            currentFilterModel,
            savedColumnState,
            previouslyChartEnabled,
            checkColDefs,
          ),
        );
        return;
      }

      const columnsToSize = columnDefs
        ?.filter((col: ColDef) => !col?.pinned)
        ?.map((col: ColDef) => col?.colId || col?.field);

      queueMicrotask(() => sizeColumns(params, null, columnsToSize));
    },
    [
      widget,
      previousChartEnabledRef,
      chartRef,
      sizeColumns,
      getGridState,
      setPendingColumnState,
    ],
  );

  return applyColumnState;
}
