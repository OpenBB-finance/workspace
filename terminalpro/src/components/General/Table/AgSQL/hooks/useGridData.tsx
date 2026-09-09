import { useEffect, useMemo } from "react";
import type { DBType } from "~/api/dataConnectors";
import { useWidgetContext } from "~/components/Widget.context";
import { useJsonData } from "~/lib/api";
import type { Widget } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { getColumnDefs } from "../../AgGridUtils";
import { getTableData } from "../../utils";
import { getNewQuery } from "../utils";

export function useGridData() {
  const { widget, updateWidget } = useWidgetContext();
  const dbType = widget.connectionType as DBType;
  const userUuid = useShallowAuthStore((authState) => authState.user?.uuid);

  const { isLoading, dataUpdatedAt, error, data } = useJsonData(
    {
      url: widget.endpoint?.url,
      method: "POST",
      body: {
        query: getNewQuery(widget.description, widget.storage?.SQLparams),
      },
      endpointHeaders: {
        "Content-Type": "application/json",
        authorization: `Bearer ${userUuid}`,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
      select: (data: {
        rows: number;
        data: object[];
        schema: { [key: string]: string };
        timestamp: number;
      }) => {
        return data ?? { rows: 0, data: [], schema: {}, timestamp: 0 };
      },
    },
  );

  const rowData = useMemo(() => {
    if (!data?.data) return [];

    const newData = getTableData(data?.data, { external: true } as Widget);

    return newData;
  }, [data]);

  const columnDefs = useMemo(() => {
    if (!rowData) return [];

    const newColdefs = getColumnDefs(rowData, {
      external: true,
      data: { table: { columnsDefs: [] } },
    } as Widget);

    for (const col of newColdefs) {
      if (col.chartDataType === "category") {
        col.enableRowGroup = true;
        col.enablePivot = true;
      }

      if (col.cellDataType === "number") {
        col.allowedAggFuncs = ["sum", "min", "max", "avg"];
        col.enableValue = true;
        col.enablePivot = true;
      }
    }

    return newColdefs;
  }, [rowData]);

  useEffect(() => {
    if (dbType === "snowflake" && data?.schema) {
      updateWidget(
        (prev) => ({
          ...prev,
          metadata: {
            data_interface: "SQL",
            sql_dialect: "Snowflake",
            schema: data?.schema,
          },
          storage: {
            ...prev.storage,
            SQLparams: {
              ...(prev.storage?.SQLparams ?? {}),
            },
          },
        }),
        true,
      );
    }
  }, [data?.schema, dbType]);

  return { rowData, columnDefs, isLoading, dataUpdatedAt, error };
}
