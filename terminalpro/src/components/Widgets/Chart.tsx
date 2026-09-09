import type { UseQueryOptions } from "@tanstack/react-query";
import { get } from "lodash";
import type { PlotlyHTMLElement } from "plotly.js-dist-min";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadData,
  getExportData,
  lazyLoadPlotly,
} from "~/components/Charting/utils";
import { useWidgetParamsPositions } from "~/components/General/Table/NavBar/QueryParams";
import { useJsonData } from "~/lib/api";
import * as sdkQuery from "~/lib/api/sdkComponents";
import { useShallowThemeStore } from "~/lib/state/theme";
import { type ChartCallback, getChartCallback } from "../Charting/ChartCallbacks";
import PlotlyChart from "../Charting/PlotlyChart";
import DraggableCard, { SetLoadingOnResize } from "../DraggableCard";
import type { WidgetT } from "../types";
import { useWidgetContext } from "../Widget.context";
import { useRawDataToggle } from "./charting/useRawDataToggle";

type PlotData = {
  data?: any[];
  layout?: any;
  config?: any;
};

export async function getChartWidgetData(
  widget: Partial<WidgetT>,
  results: any,
  _symbol?: string,
) {
  if (!widget?.sdkFunc) {
    const exportData = await getExportData(results ?? { data: [], layout: {} });

    return { data: results, exportData };
  }

  const callback = getChartCallback(widget?.data?.chart?.callback as ChartCallback);

  if (!callback) return { data: null, exportData: null };

  const { plotData, exportData } = await callback(results);
  return { data: plotData?.data?.length > 0 ? plotData : null, exportData };
}

export default function Chart() {
  const { widget, widgetFromJSON } = useWidgetContext();
  const symbol = widget.data?.mainTicker?.symbol ?? "AAPL";
  const [plotData, setPlotData] = useState<PlotData>({
    data: [],
    layout: {},
    config: {},
  });

  const theme = useShallowThemeStore((s) => s.theme);
  const [plotDiv, setPlotDiv] = useState<PlotlyHTMLElement | null>(null);
  const [exportOutput, setExportOutput] = useState(null);
  const [failingUrl, setFailingUrl] = useState<string | undefined>(undefined);

  const useQueryFn = useCallback(
    (options: any, queryOptions: Omit<UseQueryOptions<any, Error>, "queryKey">) => {
      const query = widgetFromJSON?.sdkFunc ? "useSdk" : "useJson";
      const funcs = {
        useJson: useJsonData,
        // check if widget.endpoint is in sdkQuery
        useSdk:
          widgetFromJSON?.sdkFunc in sdkQuery
            ? // biome-ignore lint/performance/noDynamicNamespaceImportAccess: --- IGNORE --
              sdkQuery[widgetFromJSON?.sdkFunc as string]
            : useJsonData,
      };

      return funcs[query](options, queryOptions);
    },
    [],
  );

  const chartOptions = useMemo(() => {
    const query = widgetFromJSON?.sdkFunc ? "useSdk" : "useJson";
    if (query === "useSdk") {
      return {
        queryParams: {
          provider: "fmp",
          symbol: symbol ?? "AAPL",
          ...Object.fromEntries(
            Object.entries(widget?.storage?.params ?? {}).filter(
              ([key, value]) => key !== "symbol" && value !== "" && value !== undefined,
            ),
          ),
        },
      };
    }

    const newParams = Object.fromEntries(
      Object.entries({
        ...(widget?.endpoint?.query ?? {}),
        ...(widget?.storage?.params ?? {}),
      }).filter(([_key, value]) => value !== "" && value !== undefined),
    );

    newParams.theme = theme;

    return {
      url: widget.endpoint?.url,
      endpointHeaders: widget.endpoint?.headers ?? {},
      endpointMethod: widget.endpoint?.method ?? "GET",
      params: newParams,
      onError: (error: Error) => {
        if (!widgetFromJSON?.sdkFunc && error?.message === "Failed to fetch") {
          setFailingUrl(widget.endpoint?.url);
        }
      },
    };
  }, [symbol, widget?.endpoint, widget?.storage?.params, theme]);

  const {
    hasRawFlag,
    showTable,
    toggle: rawDataToggle,
    tableNode,
    rawData,
    rawLoading,
    rawError,
  } = useRawDataToggle({
    baseOptions: chartOptions,
    useQueryFn,
    icon: "plotly-icon",
    chartLabel: "Plotly chart",
  });

  const {
    isLoading: chartLoading,
    data: chartQueryData,
    dataUpdatedAt,
    error: chartError,
  } = useQueryFn(chartOptions, {
    enabled: !showTable,
    staleTime: widget?.staleTime ?? 1000 * 60 * 15,
  });

  const data = useMemo(() => {
    if (showTable) return rawData;
    if (!chartQueryData) return;

    if (widget?.external && widget?.data?.dataKey) {
      return get(chartQueryData, widget?.data?.dataKey, chartQueryData);
    }
    return chartQueryData?.results ?? chartQueryData;
  }, [chartQueryData, rawData, showTable, widget?.external, widget?.data?.dataKey]);

  const handleCallback = useCallback(
    async (results: any) => {
      const w = widget.external ? widget : widgetFromJSON;
      const { data, exportData } = await getChartWidgetData(w, results, symbol);

      if (data?.data?.length > 0) setPlotData(data);
      if (exportData) setExportOutput(exportData);
    },
    [symbol, theme],
  );

  useEffect(() => {
    if (!data) return;
    handleCallback(data);
  }, [data, handleCallback]);

  const { renderRow0Params, renderBelowNavbarRows } = useWidgetParamsPositions();

  const isLoading = showTable ? rawLoading : chartLoading;
  const error = showTable ? rawError : chartError;

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={hasRawFlag && rawData ? rawData : exportOutput}
      lastUpdated={dataUpdatedAt}
      failingUrl={failingUrl}
      elementRightNextToTitle={renderRow0Params}
      elementBelowNavbar={renderBelowNavbarRows}
      extraNavbarElements={rawDataToggle}
      exportFns={{
        ...(exportOutput
          ? {
              csvFunction: (title = "report") => {
                downloadData(exportOutput, title, "csv", false);
              },
              excelFunction: (title = "report") => {
                downloadData(exportOutput, title, "excel", false);
              },
            }
          : {}),
        pngFunction: (
          title = widget?.widgetId
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
        ) => {
          lazyLoadPlotly().then((Plotly) => {
            if (!plotDiv) return;
            // Use Plotly's native downloadImage with proper configuration for quality
            Plotly.downloadImage(plotDiv, {
              format: "png",
              filename: title.replace(/-/g, "").replace(/ /g, "_"),
              width: plotDiv.clientWidth || plotDiv.layout.width || 800,
              height: plotDiv.clientHeight || plotDiv.layout.height || 600,
              // @ts-expect-error
              scale: 2, // Higher scale for better quality
            });
          });
        },
      }}
      loading={isLoading}
      error={error || !data}
      errorMessage={widget?.external ? error?.message : "No results found"}
    >
      <SetLoadingOnResize>
        {showTable
          ? tableNode
          : !isLoading &&
            plotData?.data?.length > 0 && (
              <PlotlyChart
                key={widget.data?.mainTicker?.symbol}
                isExternal={widget.external}
                reduceSize={0}
                initialData={plotData}
                margin={{
                  t: plotData?.layout?.margin?.t || 10,
                  b: plotData?.layout?.margin?.b || 10,
                }}
                setPlotDiv={(div) => setPlotDiv(div)}
              />
            )}
      </SetLoadingOnResize>
    </DraggableCard>
  );
}
