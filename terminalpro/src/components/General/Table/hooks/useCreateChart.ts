import type { ChartRef, ColDef, IRowNode, RowNode } from "ag-grid-enterprise";
import "ag-grid-enterprise";
import { usePostHog } from "posthog-js/react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useWidgetContext } from "~/components/Widget.context";
import { useCreateRef } from "~/hooks/useRefHooks";
import { useAppStore, useShallowAppStore, type Widget } from "~/lib/state/app";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import { getJsonWidget, uuidv4 } from "~/lib/utils";
import { getChartData } from "../Chart/utils";
import { useAgGridContext } from "./useTableContext";

export type RestProps = {
  rowData?: any[];
  columnDefs?: any[] | ColDef[];
  rowModelType?: string;
};

export function getSelectedRangeData<T = Record<string, any>>(
  node: IRowNode<T>,
  options: {
    rowStartIndex?: number;
    rowEndIndex?: number;
    selectedRowNodes?: T[];
    isServerSide?: boolean;
    filterFn?: (key: string, value: any) => boolean;
  } = {},
  processData?: (data: T) => void,
) {
  // Default options
  const {
    rowStartIndex = 0,
    rowEndIndex = Number.MAX_SAFE_INTEGER,
    selectedRowNodes = [],
    isServerSide = false,
    filterFn = (_key, value) => typeof value !== "object",
  } = options;

  if (
    node.rowIndex === null ||
    node.rowIndex < rowStartIndex ||
    node.rowIndex > rowEndIndex
  )
    return;

  const processNode = (data: T) => {
    if (processData) return processData(data);
    const nodeData = Object.entries(data).reduce((acc, [key, value]) => {
      if (filterFn(key, value)) acc[key] = value;
      return acc;
    }, {} as T);

    if (Object.keys(nodeData).length === 0) return;
    selectedRowNodes.push(nodeData);
  };

  if (node.data && node.displayed && !node.group) return processNode(node.data);

  if (isServerSide && node.group && node.expanded) return;

  const hiddenChildren = node.childrenAfterFilter?.some((child) => !child.displayed);

  if (node.group && (node.displayed || hiddenChildren)) {
    const baseRow = { ...(isServerSide && node.data) } as T;
    const colId = node.rowGroupColumn?.getColId();
    if (colId) baseRow[colId] = node.key;

    if (node.childrenAfterSort) {
      const rowData = node.childrenAfterSort.reduce((acc, child) => {
        if (!(child.rowGroupColumn && !child.data)) return acc;

        const row = child.aggData ?? child.groupData;
        const colId = child.rowGroupColumn.getColId();
        if (colId) row[colId] = child.key;
        acc.push({ ...baseRow, ...row });

        return acc;
      }, []);
      for (const row of rowData) processNode(row);
      return;
    }

    let parentData = {};
    if (isServerSide) {
      const recursiveParent = (data: T, parent: RowNode<T>): T => {
        const { field, groupValue } = parent;
        if (field && groupValue !== undefined) data[field] = groupValue;
        if (!parent.parent) return data;
        return recursiveParent(data, parent.parent);
      };
      parentData = recursiveParent({} as T, node.parent as RowNode<T>);
    }

    processNode({
      ...parentData,
      ...baseRow,
      ...(node.aggData || {}),
      ...(node.groupData || {}),
    });
  }
}

export function useCreateChart() {
  const { gridRef, getGridState } = useAgGridContext();
  const { getWidget, activeDashboardId } = useWidgetContext();

  const [searchParams] = useSearchParams();
  const lastInnerTab = useShallowAppStore((state) =>
    state?.getLastInnerTab(activeDashboardId),
  );
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const innerTabRef = useCreateRef(innerTab ?? "");

  const posthog = usePostHog();
  const { currentTutorial, goToStep } = useShallowTutorialStore((state) => ({
    currentTutorial: state.currentTutorial,
    goToStep: state.goToStep,
  }));

  const getWidgetFromJSON = useCallback((widget: Widget) => {
    const fakeWidget = {
      ...widget,
      widgetId: widget?.storage?.selectedGroup ?? widget?.widgetId,
    };

    return getJsonWidget(fakeWidget);
  }, []);

  const createChartContainer = useCallback(
    (chartRef: ChartRef) => {
      const id = uuidv4();
      const { columnDefs: gridColdefs } = getGridState() as RestProps;

      const widget = getWidget();
      if (widget.storage?.chartView?.enabled) return;
      const widgetFromJSON = getWidgetFromJSON(widget);
      const wData = { ...(widget.data || { table: {} }) };
      const wTable = widgetFromJSON?.data?.table ?? {};

      const wColumnsDefs =
        wTable?.columnsDefs?.length > 0 ? wTable?.columnsDefs : gridColdefs;

      const columnDefs = gridColdefs?.length > 0 ? gridColdefs : wColumnsDefs;

      const chartModel = gridRef.current.api.getChartModels().find((model) => {
        return model.chartId === chartRef.chartId;
      });

      const rowModelType = gridRef.current.api.getGridOption("rowModelType");

      // get raw data from chart model
      const {
        rowStartIndex: startRow,
        rowEndIndex: endRow,
        columns,
      } = chartModel.cellRange;

      const hasAutoColumn = columns.some((col) =>
        col.toString().startsWith("ag-Grid-AutoColumn"),
      );

      const rowStartIndex = Math.min(startRow, endRow);
      const rowEndIndex = Math.max(startRow, endRow);

      chartModel.cellRange.rowStartIndex = rowStartIndex;
      chartModel.cellRange.rowEndIndex = rowEndIndex;

      const isServerSide = rowModelType === "serverSide";
      const nodeFunc = isServerSide ? "forEachNode" : "forEachNodeAfterFilterAndSort";

      // Get all the row nodes in the grid
      const selectedRowNodes = [] as Record<string, any>[];
      const options = { rowStartIndex, rowEndIndex, selectedRowNodes, isServerSide };

      gridRef.current.api[nodeFunc]((node) => {
        if (hasAutoColumn && node.rowGroupColumn) {
          const autoColId = node.rowGroupColumn.getColId();
          if (!columns.includes(autoColId)) columns.splice(node.level, 0, autoColId);
        }
        getSelectedRangeData(node, options);
      });

      if (hasAutoColumn) {
        const autoColIdIndexes = columns
          .map((col, index) =>
            col.toString().startsWith("ag-Grid-AutoColumn") ? index : -1,
          )
          .filter((index) => index !== -1);

        for (const index of autoColIdIndexes) columns.splice(index, 1);
      }

      // Filter the row nodes based on the start and end index

      const chartData = getChartData({
        widget: {
          ...widget,
          data: {
            ...wData,
            table: { ...wTable, columnsDefs: wColumnsDefs },
          },
        },
        selectedRowNodes,
        chartType: chartModel.chartType,
        columnDefs,
        columns,
      });

      gridRef.current.api.clearCellSelection();

      useAppStore.getState().addWidget(activeDashboardId, {
        widgetId: "ag_chart_from_table",
        id,
        type: "custom",
        innerTab: widget?.innerTab ?? innerTabRef.current,
        name: `${widget?.name} ${
          widget?.data?.mainTicker?.symbol
            ? `[${widget?.data?.mainTicker?.symbol}]`
            : ""
        } - Chart`,
        description: `${chartModel?.chartType ?? ""} Chart from ${
          widget?.name ?? widgetFromJSON?.name
        }`,
        gridData: { w: 40, h: 14 },
        storage: { ...chartData, chartModel, chartView: { enabled: true } },
        data: {},
        disableRetrievalForCopilot: false,
      });

      if (posthog) {
        posthog.capture("created_custom_chart", {
          chartType: chartModel.chartType,
          widget_id: widget?.widgetId,
          from_widget: widget?.name ?? widgetFromJSON?.name ?? "",
        });
      }

      if (currentTutorial === "table_charting") {
        goToStep(4);
      }

      setTimeout(() => {
        const element = document.querySelector(`[data-widget-id="${id}"]`);
        if (element) {
          element.scrollIntoView();
        }
      }, 200);
    },
    [
      activeDashboardId,
      getGridState,
      posthog,
      innerTabRef,
      getWidgetFromJSON,
      gridRef,
      getWidget,
    ],
  );

  return createChartContainer;
}
