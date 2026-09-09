/* DEPRECATED USING WIDGETS.JSON INSTEAD */

import dayjs from "dayjs";
import { useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import { getDateFilterParams } from "~/components/General/Table/AgGridUtils";
import { AgGridProvider } from "~/components/General/Table/hooks";
import { useWidgetContext } from "~/components/Widget.context";
import { useEquityFundamentalHistoricalSplits } from "~/lib/api/sdkComponents";
import type { FMPHistoricalSplitsData as HistoricalSplits } from "~/lib/api/sdkSchemas";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function StockSplits() {
  const { widget } = useWidgetContext();

  const symbol = widget.data?.mainTicker?.symbol ?? "AAPL";

  const {
    data,
    error: splitError,
    isLoading: splitIsLoading,
  } = useEquityFundamentalHistoricalSplits(
    {
      queryParams: {
        provider: "fmp",
        symbol: symbol,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24,
      retry: 2,
    },
  ) as { data: { results: HistoricalSplits[] }; error: any; isLoading: boolean };

  const tableData = data?.results;

  const columnDefs = useMemo(() => {
    if (!tableData) return null;
    return [
      {
        headerName: "Execution Date",
        field: "date",
        flex: 1,
        sortable: true,
        resizable: true,
        cellDataType: "date",
        filter: "agDateColumnFilter",
        filterParams: getDateFilterParams(),
        valueFormatter: (params: any) => {
          return dayjs(params.value).format("YYYY-MM-DD");
        },
      },
      {
        headerName: "Split From",
        field: "denominator",
        sortable: true,
        filter: true,
        filterParams: {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        },
        resizable: true,
        flex: 1,
      },
      {
        headerName: "Split To",
        field: "numerator",
        sortable: true,
        filter: true,
        filterParams: {
          buttons: ["apply", "clear"],
          closeOnApply: true,
        },
        resizable: true,
        flex: 1,
      },
    ];
  }, [tableData]);
  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  return (
    <DraggableCard
      aiData={tableData}
      aiEnabled={true}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
      loading={splitIsLoading}
      error={splitError}
    >
      <div className="grid h-full min-h-[100px]">
        {tableData && tableData.length > 0 ? (
          <AgGridProvider
            enableCharts={false}
            rowData={tableData}
            gridOptions={gridOptions}
            columnDefs={columnDefs}
          />
        ) : (
          <div className="col-span-2 text-center">No data available</div>
        )}
      </div>
    </DraggableCard>
  );
}
