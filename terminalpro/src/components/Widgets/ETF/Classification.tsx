import type { ColDef } from "ag-grid-community";
import { useEffect, useMemo } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard from "~/components/DraggableCard";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { useWidgetContext } from "~/components/Widget.context";
import { processETFClassificationData } from "~/components/Widgets/dataProcessors";
import { useEtfInfo } from "~/lib/api/sdkComponents";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function ETFClassification() {
  const { gridRef } = useAgGridContext();
  const { widget } = useWidgetContext();

  const {
    isLoading,
    data: queryData,
    error,
    dataUpdatedAt,
    isSuccess,
  } = useEtfInfo(
    {
      queryParams: {
        provider: "intrinio",
        symbol: widget.data?.mainTicker?.symbol ?? "SPY",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 5,
    },
  );

  const data = queryData?.results;

  const rowData = useMemo(() => {
    return processETFClassificationData(queryData)?.rowData;
  }, [queryData?.results]);

  const colDefs = useMemo(() => {
    return [
      {
        field: "ETF Classification",
        headerName: "ETF Classification",
      },
      {
        field: "Value",
        headerName: "Value",
        cellClass: "text-right",
        valueFormatter: (params) => params.value,
      },
    ] as ColDef[];
  }, []);

  const gridOptions = useMemo(() => {
    return {
      rowHeight: 32,
      headerHeight: 32,
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      if (!ensureAgGrid(gridRef?.current)) return;
      gridRef.current.api.sizeColumnsToFit();
    }, 100);
  }, [gridRef?.current, isSuccess]);

  return (
    <DraggableCard
      error={error ? error : data && !data ? { message: "No results found." } : null}
      loading={isLoading}
      lastUpdated={dataUpdatedAt}
      aiEnabled={true}
      aiData={rowData}
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(rowData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(rowData, title, "excel", false);
        },
      }}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
    >
      <div className="grid h-[calc(100%-5px)] min-h-[190px]">
        {queryData?.results && (
          <AgGridProvider
            rowData={rowData}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            hideHeader={true}
          />
        )}
      </div>
    </DraggableCard>
  );
}
