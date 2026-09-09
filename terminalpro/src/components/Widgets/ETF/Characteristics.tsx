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
import { processETFCharacteristicsData } from "~/components/Widgets/dataProcessors";
import { useEtfInfo } from "~/lib/api/sdkComponents";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function ETFCharacteristics() {
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
    return processETFCharacteristicsData(queryData)?.rowData;
  }, [queryData?.results]);

  const colDefs = useMemo(() => {
    return [
      {
        field: "ETF Characteristics",
        headerName: "ETF Characteristics",
      },
      {
        field: "Value",
        headerName: "Value",
        cellClass: "text-right",
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
      error={
        error
          ? error
          : data && !rowData?.length
            ? { message: "No results found." }
            : null
      }
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
        {rowData?.length && (
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
