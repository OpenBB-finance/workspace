import type {
  ColumnVisibleEvent,
  FilterChangedEvent,
  FirstDataRenderedEvent,
  RowDataUpdatedEvent,
} from "ag-grid-enterprise";
import { useCallback, useEffect, useMemo } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import SOURCES from "~/lib/sources.json";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { extractColumns, useWidgetDataSource } from "~/lib/utils";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";
import { ensureAgGrid } from "../utils";
import { useAgGridContext } from "./useTableContext";

type RowDataEvent =
  | FilterChangedEvent
  | ColumnVisibleEvent
  | FirstDataRenderedEvent
  | RowDataUpdatedEvent;

export function getGridData(params: RowDataEvent) {
  const filterModel = params.api.getFilterModel();
  const hiddenColIds = params.api.getState()?.columnVisibility?.hiddenColIds || [];
  const rowNodes = [] as any[];

  params.api.forEachNodeAfterFilterAndSort((node) => {
    if (node.group && node.rowGroupColumn) {
      const groupKeys = [
        node.rowGroupColumn.getColId(),
        ...Object.keys(node.aggData || {}),
      ];

      for (const key of groupKeys) {
        if (hiddenColIds.includes(key)) {
          hiddenColIds.splice(hiddenColIds.indexOf(key), 1);
        }
      }
    }
    if (node.data)
      rowNodes.push(
        Object.fromEntries(
          Object.entries(node.data).filter(
            ([key, value]) =>
              // Keep arrays
              (Array.isArray(value) || typeof value !== "object") &&
              !hiddenColIds.includes(key),
          ),
        ),
      );
  });

  return { filterModel, rowNodes };
}

export function useCopilotFilteredWidgetData(
  aiData: any[],
  _lastUpdatedOld?: number,
  fileType?: string,
) {
  const { widget, widgetFromJSON } = useWidgetContext();
  const widgetSource = useWidgetDataSource();
  const widgetMetadata = handleWidgetMetadata(widget);

  const gridRef = useAgGridContext()?.gridRef;

  const widgetInfo = useMemo(() => {
    const name = widget?.name || widgetFromJSON?.name;
    const description = widget?.description || widgetFromJSON?.description;
    const source = widgetSource || widgetFromJSON?.source || widget?.source;
    const metadata = {
      ...(widgetMetadata || {}),
      ...(widget?.metadata || {}),
      ...{ params: widget?.storage?.params || {} },
    };

    return {
      name,
      description,
      source: Array.isArray(source) ? source[0] : source || "",
      metadata,
    };
  }, [
    widgetSource,
    widgetFromJSON,
    widget?.name,
    widget?.description,
    widget?.source,
    widget?.metadata,
    widget?.storage?.params,
    widgetMetadata,
  ]);

  const lastUpdated = useMemo(() => Date.now(), [widget?.storage?.params]);

  const { addDataOnDashboardWidget, removeDataFromDashboardWidget } =
    useShallowCopilotDataStore((state) => ({
      addDataOnDashboardWidget: state?.addDataOnDashboardWidget,
      removeDataFromDashboardWidget: state?.removeDataFromDashboardWidget,
    }));

  const addWidgetFullData = useCallback(
    (data: any, filterModel = {}) => {
      const { name, description, source, metadata } = widgetInfo;
      const withFilter = Object.keys(filterModel || {}).length > 0;
      const columns = extractColumns(data);

      addDataOnDashboardWidget(widget.id, {
        data,
        innerTab: widget.innerTab,
        title: name,
        description,
        endpointUrl: widget.endpoint?.url || "",
        metadata: {
          ...(metadata || {}),
          ...(SOURCES?.[source]?.name ? { source: SOURCES[source].name } : {}),
          ...(withFilter ? { filter: JSON.stringify(filterModel) } : {}),
          ...(lastUpdated ? { lastUpdated } : {}),
          ...(fileType ? { fileType: fileType.toString() } : {}),
          ...(columns ? { columns } : {}),
        },
      });

      return true;
    },
    [widgetInfo, widget?.id, addDataOnDashboardWidget, lastUpdated, fileType],
  );

  const onColumnVisible = useCallback(
    (params: RowDataEvent) => {
      if (!ensureAgGrid(params as any)) return;

      const { filterModel, rowNodes } = getGridData(params);

      addWidgetFullData(rowNodes, filterModel);
    },
    [addWidgetFullData],
  );

  useEffect(() => {
    if (!ensureAgGrid(gridRef?.current)) return;

    onColumnVisible(gridRef.current as any);
    gridRef.current.api.addEventListener("filterChanged", onColumnVisible);
    gridRef.current.api.addEventListener("columnVisible", onColumnVisible);
    return () => {
      if (!ensureAgGrid(gridRef?.current)) return;
      gridRef.current.api.removeEventListener("filterChanged", onColumnVisible);
      gridRef.current.api.removeEventListener("columnVisible", onColumnVisible);
    };
  }, [gridRef?.current, onColumnVisible]);

  useEffect(() => {
    if (!widget?.id) return;
    if (!aiData) {
      return removeDataFromDashboardWidget(widget.id);
    }
  }, [aiData, widgetInfo]);
}
