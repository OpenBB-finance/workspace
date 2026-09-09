import { keepPreviousData } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";
import DraggableCard from "~/components/DraggableCard";
import { HideOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import {
  AgGridProvider,
  ensureAgGrid,
  useAgGridContext,
} from "~/components/General/Table/hooks";
import { useWidgetContext } from "~/components/Widget.context";
import { processKeyMetricsData } from "~/components/Widgets/dataProcessors";
import { useProKeyMetrics } from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import { formatNumber, formatNumberMagnitude } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

export default function KeyMetrics() {
  const gridRef = useAgGridContext()?.gridRef;
  const { widget, updateWidget } = useWidgetContext();

  const decimalDigits = useShallowThemeStore((s) => s.decimalDigits);
  const decimalDigitsToUse = widget?.storage?.decimalDigits ?? decimalDigits;
  const [decimalDigitsSettings, setDecimalDigitsSettings] =
    useState(decimalDigitsToUse);

  const { isLoading, data, error, dataUpdatedAt, isSuccess } = useProKeyMetrics(
    {
      queryParams: {
        provider: "pro",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
        category: widget.data?.mainTicker?.category as "equity" | "etf",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    },
  );

  const rowData = useMemo(() => processKeyMetricsData(data)?.rowData, [data?.results]);

  const colDefs = useMemo(() => {
    return [
      {
        field: "Key Metrics",
        headerName: "Metric",
      },
      {
        field: "Value",
        headerName: "Value",
        cellClass: "text-right",
        valueFormatter: (params) => params.value,
        cellRenderer: (cell: any) => {
          let formattedValue: any;
          switch (cell.data["Key Metrics"]) {
            case "Vol Avg":
            case "Market Cap":
            case "Volume":
            case "30D Avg Vol":
              formattedValue = formatNumberMagnitude(cell.value);
              break;
            case "Range":
              formattedValue = cell.value;
              break;
            case "52-week High":
            case "52-week Low":
              formattedValue = formatNumber(cell.value, 0);
              break;
            case "P/E Ratio":
            case "Beta":
            case "Net Asset Value":
              formattedValue = formatNumber(
                cell.value,
                Math.max(2, decimalDigitsToUse),
              );
              break;
            case "Net Expense Ratio":
            case "Portfolio Turnover":
            case "Div Yield":
              {
                const [int, decimals = "0"] = cell.value.toString().split(".");
                formattedValue = `${int}.${decimals?.slice(
                  0,
                  Math.max(2, decimalDigitsToUse),
                )} %`;
              }
              break;
            default:
              formattedValue = cell.value;
          }
          return <span>{formattedValue}</span>;
        },
      },
    ] as ColDef[];
  }, [decimalDigitsToUse]);

  useEffect(() => {
    setTimeout(() => {
      if (!ensureAgGrid(gridRef?.current)) return;
      gridRef.current.api.sizeColumnsToFit();
    }, 100);
  }, [gridRef?.current, widget?.refreshQuery, isSuccess]);

  return (
    <DraggableCard
      error={error ? error : rowData?.length ? null : { message: "No results found." }}
      loading={isLoading}
      lastUpdated={dataUpdatedAt}
      aiEnabled={true}
      aiData={rowData}
      showActionsSettings={true}
      onSaveSettings={() => {
        updateWidget((prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            decimalDigits: decimalDigitsSettings,
          },
        }));
      }}
      settingsModalChildren={
        <DecimalDigitsRadio
          decimalDigits={decimalDigitsSettings}
          setDecimalDigits={(decimalDigits) => setDecimalDigitsSettings(decimalDigits)}
        />
      }
      exportFns={{
        csvFunction: (title = "report") => {
          downloadData(rowData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(rowData, title, "excel", false);
        },
      }}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
      extraClassName="mb-1!"
    >
      <div className="grid h-[calc(100%-24px)] min-h-[190px]">
        {rowData?.length && (
          <AgGridProvider rowData={rowData} columnDefs={colDefs} hideHeader={true} />
        )}
      </div>
      <HideOnResize>
        <p className="text-light-300 dark:text-light-600 text-xs mt-2">
          {widget.data?.mainTicker?.currency &&
            `Current Currency: ${widget.data?.mainTicker?.currency}`}
        </p>
      </HideOnResize>
    </DraggableCard>
  );
}
