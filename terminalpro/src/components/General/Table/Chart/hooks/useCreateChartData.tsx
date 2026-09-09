import type { ColDef } from "ag-grid-community";
import { useCallback } from "react";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import type { AgGridElement, ChartDataT } from "../../hooks/types";
import { getChartData } from "../utils";

export type CreateChartDataProps = {
  gridApi: AgGridElement["api"];
  rowData: any[];
  columnDefs: ColDef[];
  widget: WidgetT;
  chartType?: string;
};

export function useCreateChartData() {
  const widgetFromJSON = useWidgetContext()?.widgetFromJSON;

  const createChartData = useCallback(
    (props: CreateChartDataProps): ChartDataT => {
      const { rowData: selectedRowNodes, ...rest } = props;
      const columns = rest.gridApi
        .getAllDisplayedColumns()
        .filter((col) => col?.isVisible())
        .map((col) => col.getColId());

      const w = { ...rest.widget };
      const wData = { ...(w.data || { table: {} }) };

      const wTable = w.external ? wData?.table : widgetFromJSON?.data?.table;

      const columnsDefs =
        wTable?.columnsDefs?.length > 0
          ? wTable?.columnsDefs
          : (rest.columnDefs as any[]);

      rest.widget = {
        ...w,
        data: {
          ...wData,
          table: {
            ...wTable,
            columnsDefs: columnsDefs,
          },
        },
      };

      return getChartData({
        ...rest,
        selectedRowNodes,
        columns,
        isChartView: true,
      });
    },
    [widgetFromJSON],
  );

  return createChartData;
}
