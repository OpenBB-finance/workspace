import type {
  AgAxisCaptionOptions,
  AgAxisLabelFormatterParams,
  AgBubbleSeriesTooltipRendererParams,
  AgCartesianSeriesTooltipRendererParams,
  AgCategoryAxisThemeOptions,
  AgDonutSeriesTooltipRendererParams,
  AgGroupedCategoryAxisThemeOptions,
  AgNumberAxisOptions,
  AgPyramidSeriesTooltipRendererParams,
  AgRadarSeriesTooltipRendererParams,
  AgRadialSeriesTooltipRendererParams,
  AgTimeAxisOptions,
  AgTooltipRendererResult,
  AgTreemapSeriesTooltipRendererParams,
} from "ag-charts-community";
import { AgChartsEnterpriseModule } from "ag-charts-enterprise";
import type {
  ChartType,
  ChartTypeExCombo,
  ColDef,
  Column,
  GridChartContext,
} from "ag-grid-community";
import { AllEnterpriseModule, ModuleRegistry } from "ag-grid-enterprise";
import dayjs from "dayjs";
import type { WidgetColumnDefT, WidgetT } from "~/components/types";
import { CHART_TYPE_TO_SERIES_TYPE } from "~/lib/constants";
import { formatNumber, formatNumberMagnitude } from "~/lib/utils";
import { colDefFormatter } from "../AgGrid";
import { getColumnDefs, isDate, isDateTime } from "../AgGridUtils";
import { getWidgetStorage } from "../hooks";
import type { AgGridElement, ChartDataT } from "../hooks/types";
import { getSelectedRangeData } from "../hooks/useCreateChart";
import { customChartWidgetIds } from "./AgChartView";

ModuleRegistry.registerModules([AllEnterpriseModule.with(AgChartsEnterpriseModule)]);

type ToolTipRendererParams<
  T = any,
  CTX = GridChartContext,
> = AgCartesianSeriesTooltipRendererParams<T, CTX> &
  AgRadarSeriesTooltipRendererParams<T, CTX> &
  AgRadialSeriesTooltipRendererParams<T, CTX> &
  AgBubbleSeriesTooltipRendererParams<T, CTX> &
  AgTreemapSeriesTooltipRendererParams<T, CTX> &
  AgDonutSeriesTooltipRendererParams<T, CTX> &
  AgPyramidSeriesTooltipRendererParams<T, CTX>;

type CreateDefaultProps = {
  chartType: string;
  title?: { xLabel: string; yLabel: string };
  getParsedPeriod?: () => { isQuarterly: boolean; isAnnual: boolean };
  getDecimalPlaces?: () => number | undefined;
};

const parsedPeriodDefault = () => ({ isQuarterly: false, isAnnual: false });

export function getFiscalPeriodString(
  value: string | Date,
  getParsedPeriod: CreateDefaultProps["getParsedPeriod"],
  chartType = "",
): string {
  const hasTime = isDateTime(value);

  if (value instanceof Date) {
    const valueStr = value.toISOString().replace("T", " ");
    return valueStr.slice(0, 19).replace(" 00:00:00", "");
  }

  if (!(isDate(value) || hasTime)) return value;

  const dateObj = dayjs(value);

  if (hasTime && dateObj.format("HH:mm:ss").includes("00:00:00")) {
    return dateObj.format("YYYY-MM-DD");
  }

  const { isQuarterly, isAnnual } = getParsedPeriod();
  if (isQuarterly) {
    const newLine = chartType?.includes("Column") ? "\n" : " ";
    return `Q${dateObj.quarter()}${newLine}${dateObj.year()}`;
  }

  if (isAnnual) return `FY ${dateObj.year()}`;

  return value;
}

function getLgToSm(values: Record<string, any>, decimals?: number) {
  return Object.keys(values || {})
    .filter((key) => values[key] !== undefined && typeof values[key] === "number")
    .sort((a, b) => values[b] - values[a])
    .map((key) => ({ label: key, value: formatNumber(values[key], decimals) }));
}

export function createDefaultSeries(props: CreateDefaultProps) {
  const { chartType, getParsedPeriod = parsedPeriodDefault, getDecimalPlaces } = props;

  return {
    label: {
      enabled: false,
      formatter: (params) => {
        if (typeof params.value === "number") {
          return formatNumber(params.value, 0);
        }

        if (!dayjs(params.value).isValid()) {
          return `${params.value}`.split(" ").reduce((acc, word, i) => {
            if (i % 2 === 0 && `${acc} ${word}`.length < 20) {
              return `${acc} ${word}`;
            }
            return `${acc} ${word}\n`;
          });
        }

        return getFiscalPeriodString(params.value, getParsedPeriod, chartType);
      },
    },
    tooltip: {
      enabled: true,
      renderer: (params: ToolTipRendererParams): AgTooltipRendererResult => {
        const { xKey, yKey, seriesId, context, stageKey, valueKey, ...rest } = params;
        const {
          datum,
          angleName,
          angleKey,
          sizeKey,
          labelKey = yKey,
          labelName,
        } = rest;

        const dKey = [xKey, yKey, angleKey, sizeKey, labelKey, stageKey].find(
          (key) => datum?.[key] !== undefined,
        );
        const lKey = [labelKey, valueKey].find((key) => datum?.[key] !== undefined);

        const dateString = getFiscalPeriodString(datum?.[dKey], getParsedPeriod);
        const labelValue = getFiscalPeriodString(datum?.[lKey], getParsedPeriod);
        // const newLabel = labelName?.includes("AG-GRID") ? labelValue : labelName;
        // const label = datum?.[labelKey] && `${newLabel || labelKey}: ${labelValue}`;

        const indexColDef = context?.api.getColumnDef("Index");
        let headerName: string | undefined;

        if (indexColDef) {
          // @ts-expect-error
          headerName = indexColDef?.valueFormatter({
            value: dateString?.toString(),
            colDef: indexColDef,
          });
        }

        const colDef = context?.api.getColumn(lKey);

        if (
          [
            "RadialColumn",
            "Radar",
            "Nightingale",
            "BoxPlotSeries",
            "FunnelSeries",
            "RadialBar",
            "HistogramSeries",
          ].find((item) => seriesId.includes(item))
        )
          return {};

        if (seriesId.includes("HeatmapSeries")) {
          const dateString = getFiscalPeriodString(
            datum?.[params.yKey],
            getParsedPeriod,
          );
          const values = {
            [datum?.[xKey]]: datum?.[params.colorKey],
          };

          return {
            title: dateString?.toString(),
            data: getLgToSm(values, getDecimalPlaces?.()),
          };
        }

        if (seriesId.includes("TreemapSeries")) {
          const values = {
            [params.colorName]: datum?.[params.colorKey],
            [params.yName || yKey]: datum?.[yKey],
            [params.sizeName || sizeKey]: datum?.[sizeKey],
          };

          return {
            title: labelValue?.toString(),
            data: getLgToSm(values, getDecimalPlaces?.()),
          };
        }

        if (seriesId.includes("BubbleSeries")) {
          const values = {
            [params.xName || xKey]: datum?.[xKey],
            [params.yName || yKey]: datum?.[yKey],
            [params.sizeName || sizeKey]: datum?.[sizeKey],
          };
          return { data: getLgToSm(values, getDecimalPlaces?.()) };
        }

        if (seriesId.includes("ScatterSeries")) {
          const values = {
            [params.xName || xKey]: datum?.[xKey],
            [params.yName || yKey]: datum?.[yKey],
          };
          return { data: getLgToSm(values, getDecimalPlaces?.()) };
        }
        if (angleName && datum?.[angleKey]) {
          const angleValue = datum?.[angleKey];
          const dateString = getFiscalPeriodString(
            datum?.[params.radiusKey] || datum?.[params.calloutLabelKey],
            getParsedPeriod,
          );
          return {
            data: [{ label: "", value: angleValue?.toLocaleString() }],
            title: labelName || angleName,
            heading: dateString?.toString(),
          };
        }

        const data = getLgToSm(
          {
            [colDef?.getColDef()?.headerName || lKey]: labelValue,
          },
          getDecimalPlaces?.(),
        );

        const title = getFiscalPeriodString(params.title, getParsedPeriod);

        return {
          heading: headerName || dateString?.toString(),
          data,
          title: data?.length > 0 ? undefined : title,
        };
      },
    },
  };
}

export function createDefaultAxis(props: CreateDefaultProps) {
  const { title, chartType, getParsedPeriod = parsedPeriodDefault } = props;
  const { xLabel, yLabel } = title || {};

  const defaultTitle = { fontSize: 12, spacing: 10, enabled: true };

  const formatter = (params: AgAxisLabelFormatterParams<GridChartContext>) => {
    const { context, boundSeries } = params;
    const colId = boundSeries?.find((series) => series.key)?.key;
    const indexColDef = context?.api.getColumnDef("Index");
    let headerName: string | undefined;

    if (indexColDef) {
      // @ts-expect-error
      headerName = indexColDef?.valueFormatter({
        value: params.value,
        colDef: indexColDef,
      });
    }

    const value = headerName || params.value;

    const colDef = context?.api.getColumn(colId || "");
    const cellDataType = colDef?.getColDef()?.cellDataType;
    if (cellDataType === "date" || cellDataType === "dateString") {
      return getFiscalPeriodString(value, getParsedPeriod, chartType);
    }

    return value;
  };

  const category = {
    ...(xLabel && { title: { ...defaultTitle, text: xLabel } }),
    label: {
      avoidCollisions: true,
      fontSize: 11,
      minSpacing: 5,
      formatter,
    },
  } as AgCategoryAxisThemeOptions<any, GridChartContext>;

  return {
    category: {
      ...category,
      position: "bottom",
      label: { ...category.label, autoRotate: true },
    },
    "radius-category": category,
    "angle-category": category,
    "grouped-category": {
      ...category,
      label: { ...category.label, rotation: 0 },
    } as AgGroupedCategoryAxisThemeOptions,
    number: {
      position: "left",
      ...(yLabel && { title: { ...defaultTitle, text: yLabel } }),
      crosshair: {
        label: {
          renderer: (params) => {
            if (typeof params.value === "number")
              return { text: formatNumberMagnitude(params.value, 0) };

            return { text: params.value };
          },
        },
      },
      label: {
        fontSize: 11,
        autoRotate: false,
        avoidCollisions: true,
        formatter: (params) => {
          if (typeof params.value === "number") {
            if (params.value > 1000000 || params.value < -1000000)
              return formatNumberMagnitude(params.value, 2);
            return params.value;
          }
          return params.value;
        },
      },
    } as AgNumberAxisOptions,
    time: {
      position: "bottom",
      ...(xLabel && { title: { ...defaultTitle, text: xLabel } }),
      label: {
        avoidCollisions: true,
        fontSize: 11,
        rotation: 0,
        formatter,
      },
    } as AgTimeAxisOptions,
  };
}

export function createChartArtifactAxes(chartType: string) {
  const titleOptions = {
    enabled: true,
    fontSize: 11,
    spacing: 10,
    formatter: (params) => {
      const { boundSeries } = params;

      const title = new Set(boundSeries?.map((series) => series?.name));

      return Array.from(title).join(", ");
    },
  } as AgAxisCaptionOptions;

  return {
    category: {
      label: {
        avoidCollisions: true,
        fontSize: 11,
        autoRotate: false,
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

          if (typeof params.value === "number")
            return formatNumber(params.value, 0).replace(/,/g, "");
          if (params.value?.toString()?.length < 10) return params.value;

          return dayjs(params.value).startOf("day").format("MMM DD\n YYYY");
        },
      },
      title: titleOptions,
    } as AgCategoryAxisThemeOptions,
    number: {
      label: {
        fontSize: 11,
        formatter: (params) => {
          if (typeof params.value === "number") {
            return formatNumberMagnitude(params.value, 0).replace(/,/g, "");
          }

          return params.value;
        },
      },
      title: {
        ...titleOptions,
        enabled: chartType === "scatter",
      },
    } as AgNumberAxisOptions,
  };
}

type ProcessSelectedNodeParams = {
  data: Record<string, any>;
  widgetDefs: { [field: string]: WidgetColumnDefT };
  dates: string[];
  dateField: string;
  columns: (string | Column<any>)[];
  rawRowData: Record<string, any>[];
  rawColumns: string[];
  isReallyTransposed: boolean;
  noIndex: boolean;
  indexField?: string;
  hideColumns: string[];
};

export function processSelectedNode(params: ProcessSelectedNodeParams) {
  const {
    data,
    widgetDefs,
    dates,
    dateField,
    columns,
    rawRowData,
    rawColumns,
    isReallyTransposed,
    noIndex,
    indexField = "Index",
    hideColumns,
  } = params;

  if (
    isReallyTransposed &&
    ["fiscal_period", "period"].some((item) => item === data?.[indexField])
  )
    return;

  for (const key of Object.keys(data)) {
    if (hideColumns.includes(key)) continue;
    if (!noIndex && columns?.length === 1) {
      if (key !== indexField && !columns.includes(key)) {
        columns.push(key);
      }
    }
    if (key === indexField && !rawColumns.includes(data[key])) {
      rawColumns.push(data[key]);
    }
  }

  if (isReallyTransposed) {
    const fieldName = data?.[indexField];
    for (const key of Object.keys(data)) {
      if (key === indexField || !dates.includes(key)) continue;
      const existing = rawRowData.findIndex((item) => item[dateField] === key);
      if (existing !== -1) {
        rawRowData[existing][fieldName] = data[key];
      } else {
        const obj = { [dateField]: key };
        obj[fieldName] = data[key];
        rawRowData.push(obj);
      }
    }
    return;
  }

  const newData = {};
  for (const key of Object.keys(data)) {
    const colDef = widgetDefs[key];
    newData[key] = data[key];

    if (
      !(
        ["normalizedPercent", "percent"].includes(colDef?.formatterFn) ||
        colDef?.renderFn?.some((fn) => ["titleCase", "hoverCard"].includes(fn))
      )
    ) {
      continue;
    }

    const params = { value: data[key] } as any;
    if (colDef?.renderFn?.includes("hoverCard") && typeof params.value === "object") {
      const { hoverCard } = colDef.renderFnParams;
      const cellField = hoverCard?.cellField || "value";
      params.value = params?.value?.[cellField] ?? "";
    }

    const value = colDefFormatter(params, { colDef })?.value || params.value;
    newData[key] = value;
    if (typeof data[key] === "number") {
      newData[key] = Number(value.replace(/[^0-9.-]+/g, "").trim());
    }
  }

  rawRowData.push(newData);
}

export type GetChartDataProps = {
  gridApi?: AgGridElement["api"];
  selectedRowNodes?: any[];
  columnDefs: ColDef[];
  chartType?: string;
  columns: (string | Column<any>)[];
  widget: WidgetT;
  isChartView?: boolean;
};

export function getChartData(params: GetChartDataProps) {
  const {
    gridApi,
    selectedRowNodes,
    columnDefs,
    chartType,
    columns,
    widget,
    isChartView = false,
  } = params;

  const hasCustomChart =
    !widget?.external && customChartWidgetIds.includes(widget?.widgetId);

  const widgetTable = widget?.data?.table || {};
  const widgetColDefs = widgetTable?.columnsDefs ?? [];

  const storage = getWidgetStorage(widget);
  const period = storage?.period ?? storage?.params?.period;
  const transpose = hasCustomChart ? true : storage?.transpose;

  const widgetDefs = Object.fromEntries(
    widgetColDefs?.map((column) => [
      column.field,
      {
        field: column.field,
        headerName: column.headerName,
        cellDataType: column.cellDataType,
        chartDataType: column.chartDataType,
        renderFn: column.renderFn,
        formatterFn: column.formatterFn,
        renderFnParams: column.renderFnParams || {},
        rowGroup: column.rowGroup,
        hide: column.hide,
        headerTooltip: column.headerTooltip,
        maxWidth: column.maxWidth,
        minWidth: column.minWidth,
        aggFunc: column.aggFunc,
        pinned: column.pinned,
      } as WidgetColumnDefT,
    ]),
  );

  const hideColumns = widgetColDefs?.reduce((acc, curr) => {
    if (curr.hide || curr.chartDataType === "excluded") acc.push(curr.field);
    return acc;
  }, [] as string[]);

  const dateField =
    widgetColDefs?.find(
      (column) => column.headerName === "Date" || column.cellDataType === "date",
    )?.field ?? "date";

  const allKeys = Object.keys(selectedRowNodes[0] || {});
  const hasDates = allKeys.includes(dateField);

  // In case the table is transposed and selectedNodes has only dates
  let indexField = "Index";
  let noIndex = !columns.includes("Index");
  const rowDataHasIndex = allKeys?.some((key) => key === "Index");

  let isReallyTransposed = transpose && rowDataHasIndex;
  // If the widget is external, we determine whether it's really transposed
  // based on the presence of date fields and non-date fields, rather than relying on the storage value
  if (widget?.external) {
    const { nonDate, dateCols } = columns.reduce(
      (acc, key: string) => {
        if (isDate(key) || isDateTime(key)) acc.dateCols.push(key);
        else acc.nonDate.push(key);
        return acc;
      },
      { nonDate: [] as string[], dateCols: [] as string[] },
    );

    if (nonDate.length === 1 && dateCols.length === columns.length - 1) {
      isReallyTransposed = true;
      indexField = nonDate[0];
      noIndex = false;
    }
  }

  const dates = isReallyTransposed
    ? columns.filter((item) => item !== indexField)
    : hasDates && !isChartView
      ? selectedRowNodes.map((item) => item?.[dateField] || item?.date)
      : [];

  const chartData = {
    columns,
    rowData: null,
    widgetId: widget?.widgetId,
    transpose: false,
    period,
    columnDefs,
    chartType: (dates?.length === 1 && ["area", "line"].includes(chartType)
      ? "groupedColumn"
      : chartType) as ChartType,
    isReallyTransposed,
  } as ChartDataT;

  if (!(isReallyTransposed || hasCustomChart) && isChartView) return chartData;

  const rawRowData = [] as Record<string, any>[];
  const rawColumns = (isReallyTransposed ? [] : columns) as string[];

  const processData = (data: Record<string, any>) => {
    processSelectedNode({
      data,
      widgetDefs,
      dates,
      dateField,
      columns,
      rawRowData,
      rawColumns,
      isReallyTransposed,
      noIndex,
      indexField,
      hideColumns,
    });
  };

  // Extract the data from the selected row nodes
  if (hasCustomChart || !isChartView)
    for (const data of selectedRowNodes) processData(data);
  else if (gridApi) {
    gridApi.forEachNodeAfterFilterAndSort((node) => {
      if (node.rowGroupColumn) {
        const autoColId = node.rowGroupColumn.getColId();
        if (!columns.includes(autoColId)) columns.splice(node.level, 0, autoColId);
      }
      getSelectedRangeData(node, undefined, processData);
    });
  }
  const needsColumnDefs =
    (widget?.external ? isReallyTransposed : transpose) ?? !columnDefs?.length;

  if (
    !rawColumns.includes(dateField) &&
    Object.keys(rawRowData[0] || {}).includes(dateField)
  ) {
    rawColumns.unshift(dateField);
  }

  if (rawColumns.includes(dateField)) {
    const dateSorted = gridApi?.getColumn(dateField)?.getSort();
    rawRowData?.sort((a, b) => {
      if (dateSorted === "desc") {
        return dayjs(b?.[dateField]).diff(dayjs(a?.[dateField]));
      }
      return dayjs(a?.[dateField]).diff(dayjs(b?.[dateField]));
    });
  }

  return {
    ...chartData,
    columns: isReallyTransposed
      ? Array.from(
          new Set([
            dateField,
            ...Object.keys(rawRowData[0] || {}).filter(
              (col) => !hideColumns.includes(col),
            ),
          ]),
        )
      : rawColumns.filter((col) => !hideColumns.includes(col)),
    rowData: rawRowData,
    columnDefs: (needsColumnDefs
      ? getColumnDefs(rawRowData, {
          external: widget?.external,
          data: { table: { ...widgetTable, transpose: false } },
        } as WidgetT)
      : columnDefs
    )
      .filter((col) => rawRowData[0]?.[col.field] !== undefined)
      .sort((a, b) => {
        if (a.cellDataType === "date") return -1;
        if (b.cellDataType === "date") return 1;
        return 0;
      }),
  };
}

type SeriesMapping = typeof CHART_TYPE_TO_SERIES_TYPE;
export type ChartSeriesT = SeriesMapping[ChartTypeExCombo];

export function getSeriesType(chartType: ChartType): ChartSeriesT {
  return CHART_TYPE_TO_SERIES_TYPE[chartType as ChartTypeExCombo] ?? "line";
}
