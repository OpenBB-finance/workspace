import type {
  AgChartOptions,
  AgLineSeriesOptions,
  AgRangeAreaSeriesOptions,
} from "ag-charts-enterprise";
import { AgCharts } from "ag-charts-react";
import type {
  ChartRangeSelectionChangedEvent,
  ChartRef,
  ColDef,
  CreateRangeChartParams,
  FirstDataRenderedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import clsx from "clsx";
import dayjs from "dayjs";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadData } from "~/components/Charting/utils";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import type { NavBarProps } from "~/components/DraggableCard/NavBar";
import Tooltip from "~/components/Tooltip";
import { useWidgetContext } from "~/components/Widget.context";
import ForecastingNixtlaPopup, {
  type SeriesData,
} from "~/components/Widgets/AI/NixtlaPopup";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, formatNumberMagnitude } from "~/lib/utils";
import Icon from "../../Icon";
import { isDateorYearField } from "./AgGridUtils";
import { ChartViewButton } from "./Chart/AgChartView";
import useChartOptions, { getTotalSeries } from "./Chart/hooks/useChartOptions";
import { createItemStyler, useAgThemes } from "./Chart/themes";
import { Table } from "./hooks";

const servicesNixtlaFF = getConfig().services.nixtla;

/// Fixes CellComp crashing widget
function cleanColumnDefs(columnDefs: ColDef[]) {
  return columnDefs.map((col) => {
    const { cellRenderer, ...rest } = col;
    return rest;
  });
}

export function AgChartFromTable() {
  const { widget, updateWidget } = useWidgetContext();
  const theme = useShallowThemeStore((s) => s.theme);

  const [state, setState] = useState({
    rowData: widget.storage.rowData,
    columnDefs: cleanColumnDefs(widget.storage.columnDefs as ColDef[]),
    columns: widget.storage.columns,
  });
  const [chartRef, setChartRef] = useState<ChartRef>(null);
  const ref = useRef<HTMLDivElement>(null);
  const agRef = useRef<AgGridReact>(null);

  const stateKey = `${widget.storage.transpose ? "transposed_CellRange" : "cellRange"}`;
  const stateKeyRef = useRef(stateKey);

  const { themePalette, agTheme, chartThemes, customChartThemes } = useAgThemes(theme);

  useEffect(() => {
    stateKeyRef.current = stateKey;
  }, [stateKey]);

  const chartViewEnabled = widget.storage?.chartView?.enabled ?? true;

  const isForecast =
    widget?.storage?.forecast && widget?.storage?.forecastSeriesData?.length > 0;
  const { chartThemeOverrides } = useChartOptions();
  // Read via ref so this effect doesn't refire every render when chartThemeOverrides
  // gets a new reference — that was clobbering user edits in the Customize panel.
  const chartThemeOverridesRef = useRef(chartThemeOverrides);
  chartThemeOverridesRef.current = chartThemeOverrides;

  const { rowData, columnDefs, columns } =
    widget.storage.transpose && widget.storage.transposedT
      ? widget.storage.transposedT
      : widget.storage;

  useEffect(() => {
    if (!chartViewEnabled) return;

    chartThemeOverridesRef.current.bar.series.itemStyler = createItemStyler(
      themePalette,
      () => widget.storage.chartBarFillEnabled,
    );

    if (chartRef && agRef.current?.api) {
      agRef.current.api.updateChart({
        chartId: chartRef.chartId,
        type: "rangeChartUpdate",
        chartThemeOverrides: chartThemeOverridesRef.current,
      });
    }
  }, [chartRef, chartViewEnabled, themePalette, widget.storage.chartBarFillEnabled]);

  const onFirstDataRendered = (params: FirstDataRenderedEvent) => {
    if (isForecast) return;

    const { chartType } = widget.storage.chartModel;
    const cellRange = widget.storage?.[stateKeyRef.current];

    const cellRangeColumns = !!cellRange?.columns;

    const createRangeChartParams = {
      chartType: chartType ?? "groupedColumn",
      chartContainer: ref.current,
      suppressChartRanges: true,
      cellRange: {
        columns: columns,
      },
      chartThemeOverrides,
    } as CreateRangeChartParams;

    if (!widget.storage.transposedT) {
      createRangeChartParams.switchCategorySeries = widget.storage.transpose;
    }

    createRangeChartParams.cellRange = cellRangeColumns
      ? cellRange
      : createRangeChartParams.cellRange;

    const colDefs = cleanColumnDefs(columnDefs);
    params.api.updateGridOptions({ rowData, columnDefs: colDefs });
    const chartRef = params.api.createRangeChart(createRangeChartParams);
    const zoomButtons = chartRef?.chartElement?.getElementsByClassName(
      "ag-charts-toolbar ag-charts-toolbar--horizontal ag-charts-zoom-buttons__toolbar--hidden",
    )?.[0] as HTMLDivElement;
    if (zoomButtons?.style) zoomButtons.style.transform = "translateY(54px)";

    setChartRef(chartRef);
  };

  const onChartRangeSelectionChanged = useCallback(
    (params: ChartRangeSelectionChangedEvent) => {
      const { cellRange } = params;
      if (!cellRange) return;

      updateWidget(
        (prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            [stateKeyRef.current]: cellRange,
          },
        }),
        true,
      );
    },
    [stateKeyRef],
  );

  const series = useMemo(() => {
    if (!isForecast) return [];

    const forecastSeriesData: SeriesData[] = widget.storage.forecastSeriesData;

    return forecastSeriesData?.map((series) => {
      if (series.type === "line" || series.type === "area") {
        return {
          type: series.type,
          xKey: series.xKey,
          yKey: series.yKey,
          data: Object.entries(series.data).map(([key, value]) => ({
            [series.xKey]: key,
            [series.yKey]: value,
          })),
          stroke: series.color ?? "#5090DC",
          marker: {
            fill: series.color ?? "#5090DC",
            size: 3,
          },
          tooltip: {
            enabled: true,
            renderer: (params) => {
              return {
                content: `<b>${params.datum[params.xKey]}:</b>  ${params.datum[
                  params.yKey
                ]?.toLocaleString()}`,
              };
            },
          },
        } as AgLineSeriesOptions;
      }
      if (series.type === "rangeArea")
        return {
          type: "range-area",
          xKey: series.xKey,
          yLowKey: series.yLowKey,
          yHighKey: series.yHighKey,
          data: Object.entries(series.data).map(([key, value]) => ({
            Date: key,
            [series.yLowKey]: value[series.yLowKey],
            [series.yHighKey]: value[series.yHighKey],
          })),
        } as AgRangeAreaSeriesOptions;
    });
  }, [isForecast, widget.storage.forecastSeriesData]);

  const seriesData = useMemo(() => {
    const combinedData = series
      .flatMap((series) => series.data)
      .reduce((acc, curr) => {
        const date = curr.Date;
        if (acc[date]) {
          Object.keys(curr).forEach((key) => {
            if (key !== "Date") {
              acc[date][key] = (acc[date][key] || 0) + curr[key];
            }
          });
        } else {
          acc[date] = { ...curr };
        }
        return acc;
      }, {});
    return Object.values(combinedData);
  }, [series]);

  const chartMemo = useMemo(() => {
    if (!isForecast) return null;

    const chartOptions = {
      theme: customChartThemes[chartThemes[0]],
      data: seriesData,
      series,
      axes: [
        {
          type: "category",
          position: "bottom",
          label: {
            avoidCollisions: true,
            fontSize: 11,
            autoRotate: true,
            formatter: (params) => {
              if (
                dayjs(params.value).startOf("day").format("MMM DD\n YYYY") ===
                "Invalid Date"
              ) {
                return `${params.value}`.split(" ").reduce((acc, word, i) => {
                  if (i % 2 === 0 && `${acc} ${word}`.length < 20) {
                    return `${acc} ${word}`;
                  }
                  return `${acc} ${word}\n`;
                });
              }
              if (params.value.length <= 6) {
                return params.value;
              }
              return dayjs(params.value).startOf("day").format("MMM DD\n YYYY");
            },
          },
        },
        {
          type: "number",
          position: "left",
          label: {
            fontSize: 11,
            autoRotate: false,
            avoidCollisions: true,
            formatter: (params) => formatNumberMagnitude(params.value, 2),
          },
        },
      ],
      legend: {
        enabled: true,
        position: "top",
        maxHeight: 50,
        maxWidth: 500,
        spacing: 20,
        item: {
          paddingX: 10,
          paddingY: 3,
          marker: {
            shape: "square",
            size: 11,
          },
        },
      },
    } as AgChartOptions;

    return <AgCharts className="h-full w-full" options={chartOptions} />;
  }, [isForecast, seriesData, theme, customChartThemes, chartThemes]);

  const gridMemo = useMemo(() => {
    if (isForecast) return null;

    return (
      <AgGridReact
        className="ag-grid h-0 w-0 max-h-0"
        theme={agTheme}
        ref={(el) => (agRef.current = el)}
        getChartToolbarItems={(_) => []}
        popupParent={ref.current}
        enableCharts={true}
        chartThemeOverrides={chartThemeOverrides}
        onChartOptionsChanged={(params) => {
          const { chartType, chartOptions } = params;
          const chartModel = params.api
            .getChartModels()
            .find((model) => model.chartId === params.chartId);

          const totalSeries = getTotalSeries(params, chartModel?.cellRange);

          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              totalSeries,
              chartType,
              chartModel: {
                ...prev.storage.chartModel,
                chartType,
              },
              chartOptions,
            },
          }));
        }}
        rowData={state?.rowData}
        columnDefs={state?.columnDefs}
        onFirstDataRendered={onFirstDataRendered}
        onChartRangeSelectionChanged={onChartRangeSelectionChanged}
        customChartThemes={customChartThemes}
        chartThemes={chartThemes}
      />
    );
    // maybe add storage here later if something breaks :D
  }, [
    state,
    theme,
    ref.current,
    isForecast,
    updateWidget,
    agRef,
    chartThemes,
    customChartThemes,
    agTheme,
  ]);

  const dateField = state.columnDefs?.find(
    (column) => column?.cellDataType === "date" || isDateorYearField(column?.field),
  )?.field;

  const timeseries = widget.storage.transpose
    ? state.rowData[0]?.Index
    : state.columnDefs?.find((column) => column?.chartDataType === "series")?.field;

  const filteredData = useMemo(() => {
    if (!widget.storage.transpose)
      return rowData.map((row) => {
        return {
          Date: row[dateField],
          [timeseries]: row[timeseries],
        };
      });

    const transformedArray = [];

    for (const row of state.rowData as any[]) {
      for (const key of Object.keys(row)) {
        if (key === "Index") continue;
        transformedArray.push({
          Date: key,
          [row.Index]: row[key],
        });
      }
    }

    return transformedArray;
  }, [rowData, state.rowData, dateField, timeseries]);

  const hasOnlyOneTimeSeries = widget.storage.transpose
    ? state.rowData.length === 1
    : state.columns.length === 2;

  const enableNixtla =
    widget.storage.chartModel.chartType === "line" && hasOnlyOneTimeSeries;

  const [nixtlaPopup, setNixtlaPopup] = useState(false);

  const exportFns = useMemo(() => {
    if (!chartViewEnabled) {
      return {
        csvFunction: (title = "report") => {
          downloadData(rowData, title, "csv", false);
        },
        excelFunction: (title = "report") => {
          downloadData(rowData, title, "excel", false);
        },
      } as NavBarProps["exportFns"];
    }
    if (!isForecast)
      return {
        csvFunction: (title = "report") => {
          agRef.current?.api.exportDataAsCsv({
            fileName: `${title}.csv`,
          });
        },
        excelFunction: (title = "report") => {
          agRef.current?.api.exportDataAsExcel({
            fileName: `${title}.xlsx`,
          });
        },
        pngFunction: (title = "report") => {
          agRef.current?.api.downloadChart({
            fileName: `${title}.png`,
            fileFormat: "png",
            chartId: chartRef.chartId,
          });
        },
      } as NavBarProps["exportFns"];
    return {
      csvFunction: (title = "report") => {
        downloadData(seriesData, title, "csv", false);
      },
      excelFunction: (title = "report") => {
        downloadData(seriesData, title, "excel", false);
      },
    } as NavBarProps["exportFns"];
  }, [chartViewEnabled, seriesData, isForecast, agRef?.current, rowData]);

  return (
    <Table>
      <DraggableCard
        extraClassName={cn("overflow-hidden -mt-2", {
          "chart-wrapper h-[93%]": chartViewEnabled,
        })}
        showEllipsisMenu={true}
        exportFns={exportFns}
        aiEnabled={true}
        aiData={rowData}
        extraNavbarElements={
          <>
            <ChartViewButton />
            {servicesNixtlaFF && chartViewEnabled && (isForecast || enableNixtla) && (
              <Tooltip
                message={
                  enableNixtla
                    ? "Forecasting with TimeGEN-1 (Nixtla)"
                    : "Nixtla is only available for Line charts with one time series"
                }
              >
                <button
                  disabled={!(isForecast || enableNixtla)}
                  onClick={() => setNixtlaPopup(true)}
                  className={cn(
                    "obb-small-navbar-btn flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
                    {
                      "pulse-box-shadow bg-brand-main! text-white":
                        widget.storage.forecast,
                    },
                  )}
                >
                  <Icon id="nixtla-icon" className="w-3.5 mt-0.5" />
                </button>
              </Tooltip>
            )}
          </>
        }
        settings={{
          showMetadata: true,
          showDuplicate: true,
          showExport: true,
          showMove: true,
          showCopyToClipboard: true,
        }}
        extraSettings={
          chartViewEnabled
            ? [
                {
                  icon: "noto-letter-t",
                  id: "transpose-data",
                  label: "Transpose data",
                  onClick: () => {
                    const transpose = !widget?.storage?.transpose;
                    updateWidget((prev) => ({
                      ...prev,
                      storage: {
                        ...prev.storage,
                        transpose,
                      },
                    }));

                    const isOldSchema = !!widget.storage?.transposedT;

                    let cellRange = widget.storage?.cellRange;
                    if (isOldSchema) {
                      const data = transpose
                        ? widget.storage.transposedT
                        : widget.storage;

                      data.columnDefs = cleanColumnDefs(data.columnDefs);
                      const { rowData, columnDefs, columns } = data;

                      cellRange =
                        widget.storage?.[
                          transpose ? "transposed_CellRange" : "cellRange"
                        ];

                      setState({ rowData, columnDefs, columns });
                      agRef.current.api.updateGridOptions({ rowData, columnDefs });
                    }

                    const cellRangeColumns = !!cellRange?.columns;

                    agRef.current.api.updateChart({
                      chartId: chartRef.chartId,
                      type: "rangeChartUpdate",
                      cellRange: cellRangeColumns ? cellRange : { columns },
                      switchCategorySeries: isOldSchema ? undefined : transpose,
                    });
                  },
                },
                {
                  icon: "cog-icon",
                  id: "open-chart-settings",
                  label: "Chart settings",
                  hide: isForecast,
                  onClick: () => {
                    const agChartMenuCss = (
                      ref?.current?.getElementsByClassName(
                        "ag-chart-docked-container",
                      )?.[0] as HTMLElement
                    )?.style.cssText;

                    const params = { chartId: chartRef.chartId };

                    if (!agChartMenuCss || agChartMenuCss?.includes("min-width: 0px")) {
                      agRef.current.api.openChartToolPanel(params);
                    } else {
                      agRef.current.api.closeChartToolPanel(params);
                    }
                  },
                },
              ]
            : []
        }
      >
        {chartViewEnabled ? (
          <SetLoadingOnResize>
            {isForecast ? (
              chartMemo
            ) : (
              <>
                {gridMemo}
                <div
                  ref={ref}
                  className={clsx("chart-wrapper-body h-full w-full", {
                    "ag-theme-alpine": theme === "light",
                    "ag-theme-alpine-dark": theme === "dark",
                  })}
                />
              </>
            )}
          </SetLoadingOnResize>
        ) : (
          <div className="h-[calc(100%-5px)] min-h-[100px]">
            <AgGridReact
              className="ag-grid h-full w-full"
              theme={agTheme}
              rowData={rowData}
              columnDefs={cleanColumnDefs(columnDefs as ColDef[])}
            />
          </div>
        )}
      </DraggableCard>
      <ForecastingNixtlaPopup
        open={nixtlaPopup}
        onClose={() => setNixtlaPopup(false)}
        data={filteredData}
        timeseries={timeseries}
        forecast={widget.storage.forecast}
        onForecast={(seriesData) => {
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              forecast: !!seriesData,
              forecastSeriesData: seriesData ?? [],
            },
          }));
        }}
      />
    </Table>
  );
}

export default memo(AgChartFromTable);
