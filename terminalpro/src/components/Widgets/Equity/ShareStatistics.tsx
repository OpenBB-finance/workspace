import type { ColDef } from "ag-grid-community";
import { type JSX, useEffect, useMemo } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard from "~/components/DraggableCard";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { useWidgetContext } from "~/components/Widget.context";
import { processShareStatisticsData } from "~/components/Widgets/dataProcessors";
import { useEquityOwnershipShareStatistics } from "~/lib/api/sdkComponents";
import { formatNumber, formatNumberMagnitude } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function ShareStatistics() {
  const { gridRef } = useAgGridContext();
  const { widget } = useWidgetContext();
  const { isLoading, data, error, dataUpdatedAt, isSuccess } =
    useEquityOwnershipShareStatistics(
      {
        queryParams: {
          provider: "fmp",
          symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
        },
      },
      {
        enabled: true,
        staleTime: 1000 * 60 * 60 * 24 * 7,
      },
    );

  const rowData = useMemo(() => {
    return processShareStatisticsData(data)?.rowData;
  }, [data?.results]);

  const colDefs = useMemo(() => {
    return [
      {
        field: "index",
        headerName: "Metric",
      },
      {
        field: "value",
        headerName: "Value",
        cellClass: "text-right",
        valueFormatter: (params) => params.value,
        cellRenderer: (cell) => {
          let formattedValue: string | number | JSX.Element;
          switch (cell.data.index) {
            case "Free Float":
              formattedValue = `${formatNumber(cell.value)}%`;
              break;

            case "Source":
              formattedValue = (
                <a
                  href={cell.value}
                  target="_blank"
                  rel="noreferrer"
                  className="obb-hyper-link"
                >
                  View source
                </a>
              );
              break;
            default:
              formattedValue = formatNumberMagnitude(cell.value);
              break;
          }
          return <span>{formattedValue}</span>;
        },
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

  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" />,
    [],
  );

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={rowData}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={elementRightNextToTitle}
      loading={isLoading}
      error={error}
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(rowData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(rowData, title, "excel", false);
        },
      }}
    >
      <div className="grid h-[calc(100%-5px)] min-h-[190px]">
        {rowData?.length ? (
          <AgGridProvider
            rowData={rowData}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            hideHeader={true}
          />
        ) : (
          <SearchResultsNotFound
            icon={true}
            firstMessage="No results found"
            secondMessage=""
          />
        )}
      </div>
    </DraggableCard>
  );
}
