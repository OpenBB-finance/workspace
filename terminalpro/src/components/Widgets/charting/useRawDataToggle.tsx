import { type ReactNode, useCallback, useMemo } from "react";
import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider, Table } from "~/components/General/Table/hooks";
import { getTableData } from "~/components/General/Table/utils";
import Icon from "~/components/Icon";
import type { IconId } from "~/components/Icon.types";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import { cn } from "~/lib/utils";

type RawQueryResult = {
  data?: unknown;
  isLoading: boolean;
  error?: unknown;
};

type QueryFn = (
  options: Record<string, unknown>,
  queryOptions: { enabled: boolean; staleTime: number },
) => RawQueryResult;

const RAW_DATA_STALE_TIME = 0;

/**
 * Shared raw-data toggle for chart widgets. When the widget has `raw: true`,
 * exposes a navbar button that switches the widget between its chart view and a
 * tabular view of the same endpoint (re-fetched with `raw: true`). Used by both
 * the Plotly `Chart` and `ChartVegaLite` widgets so the behavior lives in one place.
 */
export function useRawDataToggle({
  baseOptions,
  useQueryFn = useJsonData as unknown as QueryFn,
  icon = "table-02",
  chartLabel = "chart",
}: {
  baseOptions: Record<string, unknown>;
  useQueryFn?: QueryFn;
  icon?: IconId;
  chartLabel?: string;
}) {
  const { widget, updateWidget } = useWidgetContext();

  const hasRawFlag = Boolean(widget?.raw);
  const rawDataView = Boolean(widget?.storage?.rawDataView);
  const showTable = rawDataView && hasRawFlag;

  const setRawDataView = useCallback(
    (enabled: boolean) => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          rawDataView: enabled,
        },
      }));
    },
    [updateWidget],
  );

  const rawDataOptions = useMemo<Record<string, unknown>>(() => {
    if (!hasRawFlag) return {};
    return {
      ...baseOptions,
      params: {
        ...(baseOptions.params as Record<string, unknown> | undefined),
        raw: true,
      },
    };
  }, [baseOptions, hasRawFlag]);

  const {
    data: rawResponse,
    isLoading: rawLoading,
    error: rawError,
  } = useQueryFn(rawDataOptions, {
    enabled: showTable,
    staleTime: RAW_DATA_STALE_TIME,
  });

  const rawData = useMemo(() => {
    if (!rawResponse) return null;
    const response = rawResponse as { results?: unknown };
    return response?.results ?? rawResponse;
  }, [rawResponse]);

  const toggle = useMemo<ReactNode>(() => {
    if (!hasRawFlag) return null;

    return (
      <Tooltip message={`Switch to ${rawDataView ? chartLabel : "raw data"} view`}>
        <button
          type="button"
          onClick={() => setRawDataView(!rawDataView)}
          className={cn("obb-small-navbar-btn", {
            "bg-brand-main! text-white! hover:bg-brand-main!": !rawDataView,
          })}
          aria-label={`Switch to ${rawDataView ? "chart" : "raw data"} view`}
          id="raw-data-toggle-button"
        >
          <Icon id={icon} className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    );
  }, [hasRawFlag, rawDataView, chartLabel, icon, setRawDataView]);

  const tableNode = useMemo<ReactNode>(() => {
    if (!showTable) return null;
    const rowData = getTableData(Array.isArray(rawData) ? rawData : [], widget);
    const columnDefs = getColumnDefs(rowData, widget);
    return (
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>
    );
  }, [showTable, rawData, widget?.data?.table?.columnsDefs, widget?.data?.dataKey]);

  return {
    hasRawFlag,
    rawDataView,
    showTable,
    setRawDataView,
    toggle,
    tableNode,
    rawData,
    rawLoading,
    rawError,
  };
}
