import ExcelJS from "exceljs";
import { type MutableRefObject, useEffect, useMemo, useRef } from "react";
import DraggableCard from "~/components/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import {
  useEquityFundamentalOverview,
  useEquityOwnershipShareStatistics,
} from "~/lib/api/sdkComponents";
import type { FMPCompanyOverviewData as CompanyOverview } from "~/lib/api/sdkSchemas";
import { formatNumber, formatNumberNoMagnitude } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";
import useCopilotDataWidget from "../Helpers/useCopilotDataWidget";
import { convertToCSV, getHeaders } from "../Misc/Charting";
import type { ChartingLibraryWidget } from "../TVChartContainer/TVChartContainerFunc";
import TVChart from "../TvChart";

function useOverviewData(tvWidget: MutableRefObject<ChartingLibraryWidget | null>) {
  const widget = useWidgetContext()?.widget;
  const [state, dispatch] = useStateReducer({ aiData: [], lastUpdated: 0 });

  const {
    data: overviewQuery,
    dataUpdatedAt,
    isLoading,
  } = useEquityFundamentalOverview<{ results: CompanyOverview }>(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: widget.data?.mainTicker?.symbol !== null,
      staleTime: 1000 * 60 * 5,
    },
  );

  const { data: faShares } = useEquityOwnershipShareStatistics(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
      },
    },
    {
      enabled: widget.data?.mainTicker?.symbol !== null,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const overviewElement = useMemo(() => {
    const overviewData = overviewQuery?.results;
    return (
      <div className="flex gap-2 _widget-content">
        {overviewData?.results?.mkt_cap && (
          <>
            <p>
              Market Cap:{" "}
              <span className="font-medium">{formatNumber(overviewData?.mkt_cap)}</span>
            </p>
            |
          </>
        )}
        {faShares?.results?.[0]?.outstanding_shares && (
          <p>
            Outstanding Shares:{" "}
            <span className="font-medium">
              {formatNumber(faShares?.results?.[0]?.outstanding_shares)}
            </span>
          </p>
        )}
      </div>
    );
  }, [overviewQuery?.results?.mkt_cap, faShares?.results?.[0]?.outstanding_shares]);

  useEffect(() => {
    if (!tvWidget.current) return;
    tvWidget.current.setOnDataHandler((aiData) =>
      dispatch({ aiData, lastUpdated: Date.now() }),
    );
  }, [tvWidget.current]);

  useCopilotDataWidget({
    aiData: state.aiData,
    title: "Price Performance",
    aiEnabled: import.meta.env.VITE_TRADINGVIEW_ENABLED === "true",
    lastUpdated: state.lastUpdated,
  });

  return { dataUpdatedAt, isLoading, overviewElement };
}

function useTvExportFunction(tvWidget: MutableRefObject<ChartingLibraryWidget | null>) {
  return {
    csvFunction: async (title: string) => {
      const data = await tvWidget.current
        ?.getTvWidget()
        .activeChart()
        .exportData({ includeDisplayedValues: true });

      const csv = convertToCSV(data.displayedData, data.schema);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", `${title}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    excelFunction: async (title: string) => {
      const data = await tvWidget.current
        ?.getTvWidget()
        .activeChart()
        .exportData({ includeDisplayedValues: true });

      const headers = getHeaders(data.schema);
      const dataAsObjects = data.displayedData.map((row) => {
        return row.reduce((obj, value: string | number, index) => {
          if (
            !(
              Number.isNaN(Number.parseFloat(value as string)) ||
              ["Date", "Time"].includes(headers[index])
            )
          )
            value = formatNumberNoMagnitude(value);

          obj[headers[index]] = value;
          return obj;
        }, {});
      });

      const workbook = new ExcelJS.Workbook();

      const wb = workbook.addWorksheet("Sheet1");
      wb.columns = headers.map((header) => ({ header, key: header }));
      for (const row of dataAsObjects) wb.addRow(row);

      const wbout = await workbook.xlsx.writeBuffer();
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", `${title}.xlsx`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
  };
}

export default function PricePerformance() {
  const tvWidget = useRef<ChartingLibraryWidget | null>(null);

  const { dataUpdatedAt, isLoading, overviewElement } = useOverviewData(tvWidget);
  const elementRightNextToTitle = useMemo(
    () => <AdvancedSelectedTicker triggerSize="sm" ignoreTypes={["index"]} />,
    [],
  );
  const exportFns = useTvExportFunction(tvWidget);

  return (
    <DraggableCard
      aiEnabled={import.meta.env.VITE_TRADINGVIEW_ENABLED === "true"}
      aiData={import.meta.env.VITE_TRADINGVIEW_ENABLED === "true"}
      lastUpdated={dataUpdatedAt}
      extraClassName="overflow-y-hidden"
      title="Price Performance"
      elementRightNextToTitle={elementRightNextToTitle}
      loading={isLoading}
      exportFns={
        import.meta.env.VITE_TRADINGVIEW_ENABLED === "true" ? exportFns : undefined
      }
    >
      {overviewElement}
      <div className="min-h-[300px] h-full">
        <TVChart
          tvRef={tvWidget}
          simpleChart={true}
          extraClassName="h-[calc(100%-25px)] mt-2"
        />
      </div>
    </DraggableCard>
  );
}
