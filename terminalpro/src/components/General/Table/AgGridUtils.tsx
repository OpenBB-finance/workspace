import type {
  CellSelectionChangedEvent,
  ChartType,
  ColDef,
  DefaultMenuItem,
  GetContextMenuItemsParams,
  MenuItemDef,
} from "ag-grid-community";
import dayjs from "dayjs";
import { isCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import type { AgGridEvents } from "~/components/General/Table/hooks/types";
import type { WidgetColumnDefT, WidgetContextType } from "~/components/types";
import type { Widget } from "~/lib/state/app";
import { useFeatureFlagsStore } from "~/lib/state/featureFlags";
import { formatNumber } from "~/lib/utils/utils";
import {
  CellOnClickRenderer,
  CustomCellRenderer,
  HoverCardCellRenderer,
} from "./AgGrid";
import ShowChangeCell from "./CellRenderers/ShowChangeCell";
import { getSelectedRangeData } from "./hooks/useCreateChart";

const datePattern = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}\/\d{1,2}\/\d{4}$/;
const dateTimePattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d*)?/;
const isYearOrDateRegex = /(^|_)(year|date|day)/i;

const chartCellLimit =
  Number(import.meta.env.VITE_CHART_FROM_TABLE_CELL_LIMIT) || 200000;

export function isDate(value: any): boolean {
  return datePattern.test(value?.toString()) && dayjs(value).isValid();
}

export function isDateTime(value: any): boolean {
  return dateTimePattern.test(value?.toString()) && dayjs(value).isValid();
}

export function isDateorYearField(key: string): boolean {
  return isYearOrDateRegex.test(key);
}

export function isBigNumber(value: unknown): boolean {
  return typeof value === "number" && (value > 1000000 || value < -1000000);
}

export function isLink(value: unknown): boolean {
  return typeof value === "string" && value.startsWith("http");
}

export function formatDate(date: dayjs.ConfigType, template = "YYYY-MM-DD"): string {
  // Use UTC mode to avoid timezone shifts when formatting dates
  return dayjs.utc(date).format(template);
}

export function formatTime(date: dayjs.ConfigType): string {
  return dayjs(date).format("hh:mm A");
}

export function getTimezoneCompact() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function convertToReadableLabel(key: string): string {
  return key
    ?.toString()
    ?.replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    ?.replace(/([a-z\d])([A-Z])/g, "$1 $2")
    ?.replace(/_/g, " ")
    ?.replace(/\b\w/g, (char) => char?.toUpperCase());
}

function extractYearOrReturnInput(input: string): string {
  const pattern = /^(\d{4})-\d{2}-\d{2}$/;
  const match = input.match(pattern);
  return match ? match[1] : input;
}

export function determineFilterType(
  cellDataType: string | undefined | boolean,
  key: string,
  firstValue: unknown,
): "agNumberColumnFilter" | "agTextColumnFilter" | "agDateColumnFilter" {
  if (cellDataType) {
    if (cellDataType === "number") {
      return "agNumberColumnFilter";
    }
    if (cellDataType === "date" || key.toLocaleLowerCase().includes("date")) {
      return "agDateColumnFilter";
    }
    return "agTextColumnFilter"; // default to text filter for specified cellDataType
  }
  // if cellDataType does not exist, infer from data
  if (typeof firstValue === "number") {
    return "agNumberColumnFilter";
  }
  if (isDate(firstValue) || key.toLocaleLowerCase().includes("date")) {
    return "agDateColumnFilter";
  }
  return "agTextColumnFilter"; // default to text filter when inferring
}

function inferDataType(
  value: unknown,
  key: string,
): "number" | "object" | "boolean" | "link" | "date" | "text" {
  function processDefault(key: string): "date" | "text" {
    if (isDateorYearField(key)) {
      return "date";
    }
    return "text";
  }

  function processString(value: string): "link" | "date" | "text" {
    if (isLink(value)) {
      return "link";
    }
    // Check if the string matches a specific date pattern
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (datePattern.test(value) && isDate(value)) {
      return "date";
    }

    return processDefault(key);
  }

  switch (typeof value) {
    case "number":
      return "number";
    case "object":
      return "object";
    case "boolean":
      return "boolean";
    case "string":
      return processString(value);
    default:
      return processDefault(key);
  }
}

export function getDateFilterParams() {
  return {
    buttons: ["apply", "clear"],
    closeOnApply: true,
    defaultOption: "inRange",
    comparator: (
      filterLocalDateAtMidnight: Date,
      cellValue: string | number | Date,
    ) => {
      if (typeof cellValue === "number" && cellValue.toString().length === 4)
        cellValue = new Date(cellValue, 0, 1);

      if (!dayjs(cellValue).isValid()) {
        return 0;
      }
      const cellDate = dayjs(cellValue).toDate();
      if (cellDate < filterLocalDateAtMidnight) {
        return -1;
      }
      if (cellDate > filterLocalDateAtMidnight) {
        return 1;
      }
      return 0;
    },
  };
}

export function formatObjectValue<T>(value: T): string | T {
  if (typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return value
      ?.map((v) => (typeof v === "object" ? JSON.stringify(v) : v))
      ?.join(", ");
  }

  return value;
}

export function inferChartDataType(
  value: unknown,
  { isDateCol, isIndex }: { isDateCol?: boolean; isIndex?: boolean } = {},
): "category" | "series" {
  if (isDateCol || isIndex || typeof value === "string") {
    return "category";
  }
  if (typeof value === "number") {
    return "series";
  }

  return "category";
}

const CellRendererTypes = {
  hoverCard: HoverCardCellRenderer,
  cellOnClick: CellOnClickRenderer,
  showCellChange: ShowChangeCell,
};

const ChartTypeToCellType = { category: "text" } as const;

const RendererPriority = ["hoverCard", "cellOnClick", "showCellChange"] as const;

function CellRendererComponent(renderFn: WidgetColumnDefT["renderFn"]) {
  if (!renderFn?.length) return undefined;

  const type = RendererPriority.find((type) => renderFn?.includes(type));

  return CellRendererTypes?.[type] ?? CustomCellRenderer;
}

// Helper function to process sparkline configuration
function processSparklineConfig(
  colDef: any,
  sparklineConfig: any,
  fullData: any[] = [],
) {
  if (!sparklineConfig) return {};

  const { type, dataField, options = {} } = sparklineConfig;

  // Handle legacy "column" type by converting to "bar" with vertical direction
  let sparklineType = type || "line";
  let sparklineDirection = options.direction;

  if (type === "column") {
    sparklineType = "bar";
    sparklineDirection = "vertical";
  }

  // Base sparkline configuration with supported AG Grid options
  const sparklineOptions: any = {
    type: sparklineType,
  };

  // Add basic styling options
  if (options.stroke) sparklineOptions.stroke = options.stroke;
  if (options.strokeWidth) sparklineOptions.strokeWidth = options.strokeWidth;
  if (options.fill) sparklineOptions.fill = options.fill;
  if (options.fillOpacity) sparklineOptions.fillOpacity = options.fillOpacity;

  // Add min/max values if specified
  if (options.min !== undefined) sparklineOptions.min = options.min;
  if (options.max !== undefined) sparklineOptions.max = options.max;

  // Add direction for bar charts
  if (sparklineDirection) sparklineOptions.direction = sparklineDirection;

  // Add xKey and yKey for object-based data
  if (options.xKey) sparklineOptions.xKey = options.xKey;
  if (options.yKey) sparklineOptions.yKey = options.yKey;

  // Configure tooltip if specified
  if (options.tooltip) {
    sparklineOptions.tooltip = {
      enabled: options.tooltip.enabled !== false,
    };
    if (options.tooltip.renderer) {
      sparklineOptions.tooltip.renderer = options.tooltip.renderer;
    }
  }

  // Configure axis using correct AG Grid syntax
  if (options.axis) {
    sparklineOptions.axis = {};
    if (options.axis.type) sparklineOptions.axis.type = options.axis.type;
    if (options.axis.stroke) sparklineOptions.axis.stroke = options.axis.stroke;
    if (options.axis.strokeWidth)
      sparklineOptions.axis.strokeWidth = options.axis.strokeWidth;
    if (options.axis.paddingInner !== undefined)
      sparklineOptions.axis.paddingInner = options.axis.paddingInner;
    if (options.axis.paddingOuter !== undefined)
      sparklineOptions.axis.paddingOuter = options.axis.paddingOuter;
  }

  // Configure markers using correct AG Grid syntax
  if (options.markers) {
    sparklineOptions.marker = {};
    if (options.markers.enabled !== undefined)
      sparklineOptions.marker.enabled = options.markers.enabled;
    if (options.markers.size !== undefined)
      sparklineOptions.marker.size = options.markers.size;
    if (options.markers.fill) sparklineOptions.marker.fill = options.markers.fill;
    if (options.markers.stroke) sparklineOptions.marker.stroke = options.markers.stroke;
    if (options.markers.strokeWidth)
      sparklineOptions.marker.strokeWidth = options.markers.strokeWidth;

    // Add itemStyler for points of interest OR custom formatter (line/area sparklines)
    if (
      options.markers.enabled &&
      (options.pointsOfInterest || options.customFormatter)
    ) {
      // Pre-calculate the sparkline data values for manual detection (only if points of interest are used)
      let sparklineData: any[] = [];
      let minValue = 0;
      let maxValue = 0;

      if (options.pointsOfInterest) {
        sparklineData = fullData
          .flatMap((row: any) => {
            const value = dataField ? row[dataField] : row[colDef.field];
            return Array.isArray(value) ? value : [value];
          })
          .filter((val) => val !== null && val !== undefined);

        minValue = Math.min(...sparklineData);
        maxValue = Math.max(...sparklineData);
      }

      sparklineOptions.marker.itemStyler = (params: any) => {
        const { first, last, min, max, yValue, highlighted, datum } = params;

        // Create base style
        let style: any = {};

        // Handle custom formatter first (if provided)
        if (options.customFormatter) {
          console.log("🎨 Applying custom formatter to line/area sparkline");

          // Convert string to function if needed
          let formatterFunction = options.customFormatter;
          if (typeof formatterFunction === "string") {
            try {
              // Safely evaluate the string as a function
              formatterFunction = new Function(
                "params",
                `return (${formatterFunction})(params)`,
              );
            } catch (error) {
              console.error("Error parsing customFormatter string:", error);
              formatterFunction = null;
            }
          }

          if (typeof formatterFunction === "function") {
            const customStyle = formatterFunction({ yValue, ...params });
            style = {
              ...style,
              ...customStyle,
              size: customStyle.size || options.markers.size || 3,
            };
          }
        }
        // Handle points of interest (only if configured and not overridden by custom formatter)
        else if (options.pointsOfInterest) {
          const poi = options.pointsOfInterest;

          // Handle highlighted state first
          if (highlighted && poi.highlighted) {
            return {
              size: poi.highlighted.size || options.markers.highlightSize || 7,
              fill: poi.highlighted.fill,
              stroke: poi.highlighted.stroke,
              strokeWidth: poi.highlighted.strokeWidth,
            };
          }

          // Manual min/max detection using pre-calculated values
          const isManualMin = yValue === minValue;
          const isManualMax = yValue === maxValue;
          const isManualFirst = datum && datum.x === 0;
          const isManualLast = datum && datum.x === sparklineData.length - 1;

          // Handle first/last points (check both AG Grid and manual detection)
          if ((first || last || isManualFirst || isManualLast) && poi.firstLast) {
            style = {
              size: poi.firstLast.size || options.markers.size || 3,
              fill: poi.firstLast.fill,
              stroke: poi.firstLast.stroke,
              strokeWidth: poi.firstLast.strokeWidth,
            };
          }
          // Handle min/max points (check both AG Grid and manual detection)
          else if ((min || isManualMin) && poi.minimum) {
            style = {
              size: poi.minimum.size || options.markers.size || 3,
              fill: poi.minimum.fill,
              stroke: poi.minimum.stroke,
              strokeWidth: poi.minimum.strokeWidth,
            };
          } else if ((max || isManualMax) && poi.maximum) {
            style = {
              size: poi.maximum.size || options.markers.size || 3,
              fill: poi.maximum.fill,
              stroke: poi.maximum.stroke,
              strokeWidth: poi.maximum.strokeWidth,
            };
          }
          // Handle positive/negative values
          else if (poi.positiveNegative) {
            const isNegative = yValue < 0;
            const config = isNegative
              ? poi.positiveNegative.negative
              : poi.positiveNegative.positive;
            if (config) {
              style = {
                size: config.size || options.markers.size || 3,
                fill: config.fill,
                stroke: config.stroke,
                strokeWidth: config.strokeWidth,
              };
            }
          }
        }

        return style;
      };
    }
    // Legacy support for highlight size
    else if (options.markers.enabled && options.markers.highlightSize) {
      sparklineOptions.marker.itemStyler = (params: any) => {
        if (params.highlighted) {
          return {
            size: options.markers.highlightSize || 7,
          };
        }
      };
    }
  }

  // Add itemStyler for bar/column sparklines (points of interest OR custom formatter)
  if (
    (sparklineType === "bar" || sparklineType === "column") &&
    (options.pointsOfInterest || options.customFormatter)
  ) {
    console.log("🎯 Setting up sparkline itemStyler:", {
      pointsOfInterest: options.pointsOfInterest,
      customFormatter: options.customFormatter,
    });

    // Pre-calculate the sparkline data values for manual detection (only if points of interest are used)
    let sparklineData: any[] = [];
    let minValue = 0;
    let maxValue = 0;

    if (options.pointsOfInterest) {
      sparklineData = fullData
        .flatMap((row: any) => {
          const value = dataField ? row[dataField] : row[colDef.field];
          return Array.isArray(value) ? value : [value];
        })
        .filter((val) => val !== null && val !== undefined);

      console.log("📊 Sparkline data for detection:", sparklineData);

      minValue = Math.min(...sparklineData);
      maxValue = Math.max(...sparklineData);

      console.log("📊 Calculated min/max:", { minValue, maxValue });
    }

    sparklineOptions.itemStyler = (params: any) => {
      const { first, last, min, max, yValue, highlighted, datum } = params;

      console.log("🔍 ItemStyler called with params:", {
        first,
        last,
        min,
        max,
        yValue,
        highlighted,
        datum,
      });

      // Create base style
      let style: any = {};

      // Handle custom formatter first (if provided)
      if (options.customFormatter) {
        console.log("🎨 Applying custom formatter");

        // Convert string to function if needed
        let formatterFunction = options.customFormatter;
        if (typeof formatterFunction === "string") {
          try {
            // Safely evaluate the string as a function
            formatterFunction = new Function(
              "params",
              `return (${formatterFunction})(params)`,
            );
          } catch (error) {
            console.error("Error parsing customFormatter string:", error);
            formatterFunction = null;
          }
        }

        if (typeof formatterFunction === "function") {
          const customStyle = formatterFunction({ yValue, ...params });
          style = { ...style, ...customStyle };
        }
      }

      // Handle points of interest (only if configured and not overridden by custom formatter)
      if (options.pointsOfInterest && !options.customFormatter) {
        const poi = options.pointsOfInterest;

        // Handle highlighted state first
        if (highlighted && poi.highlighted) {
          console.log("✨ Applying highlighted style");
          return {
            fill: poi.highlighted.fill,
            stroke: poi.highlighted.stroke,
            strokeWidth: poi.highlighted.strokeWidth,
          };
        }

        // Manual min/max detection using pre-calculated values
        const isManualMin = yValue === minValue;
        const isManualMax = yValue === maxValue;
        const isManualFirst = datum && datum.x === 0;
        const isManualLast = datum && datum.x === sparklineData.length - 1;

        // Handle first/last points (check both AG Grid and manual detection)
        if ((first || last || isManualFirst || isManualLast) && poi.firstLast) {
          console.log("🎯 Applying first/last style");
          style = {
            fill: poi.firstLast.fill,
            stroke: poi.firstLast.stroke,
            strokeWidth: poi.firstLast.strokeWidth,
          };
        }
        // Handle min/max points (check both AG Grid and manual detection)
        else if ((min || isManualMin) && poi.minimum) {
          style = {
            fill: poi.minimum.fill,
            stroke: poi.minimum.stroke,
            strokeWidth: poi.minimum.strokeWidth,
          };
        } else if ((max || isManualMax) && poi.maximum) {
          style = {
            fill: poi.maximum.fill,
            stroke: poi.maximum.stroke,
            strokeWidth: poi.maximum.strokeWidth,
          };
        }
        // Handle positive/negative values
        else if (poi.positiveNegative) {
          const isNegative = yValue < 0;
          const config = isNegative
            ? poi.positiveNegative.negative
            : poi.positiveNegative.positive;
          if (config) {
            style = {
              fill: config.fill,
              stroke: config.stroke,
              strokeWidth: config.strokeWidth,
            };
          }
        }
      }

      console.log("🎨 Returning style:", style);
      return style;
    };
  }

  // Legacy highlight configuration removed - use pointsOfInterest instead

  // Configure label if specified
  if (options.label) {
    sparklineOptions.label = {};
    if (options.label.enabled !== undefined)
      sparklineOptions.label.enabled = options.label.enabled;
    if (options.label.fontWeight)
      sparklineOptions.label.fontWeight = options.label.fontWeight;
    if (options.label.fontStyle)
      sparklineOptions.label.fontStyle = options.label.fontStyle;
    if (options.label.fontSize !== undefined)
      sparklineOptions.label.fontSize = options.label.fontSize;
    if (options.label.fontFamily)
      sparklineOptions.label.fontFamily = options.label.fontFamily;
    if (options.label.color) sparklineOptions.label.color = options.label.color;
    if (options.label.placement)
      sparklineOptions.label.placement = options.label.placement;
  }

  // Configure padding if specified
  if (options.padding) {
    sparklineOptions.padding = {};
    if (options.padding.top !== undefined)
      sparklineOptions.padding.top = options.padding.top;
    if (options.padding.right !== undefined)
      sparklineOptions.padding.right = options.padding.right;
    if (options.padding.bottom !== undefined)
      sparklineOptions.padding.bottom = options.padding.bottom;
    if (options.padding.left !== undefined)
      sparklineOptions.padding.left = options.padding.left;
  }

  const result = {
    cellRenderer: "agSparklineCellRenderer",
    // Must be a top-level ColDef property — AG Grid computes params.value from
    // colDef.valueGetter, and agSparklineCellRenderer throws on a non-array
    // value (null.length), which crashes the whole widget via the error boundary
    valueGetter: (params: any) => {
      const value = params.data?.[dataField ?? colDef.field];
      return Array.isArray(value) ? value : [];
    },
    cellRendererParams: {
      sparklineOptions,
    },
  };

  return result;
}

const getCellClass = (align: "left" | "center" | "right") => {
  if (align === "center") return "text-center";
  if (align === "right") return "ag-right-aligned-cell";
  if (align === "left") return "ag-left-aligned-cell";
};

export function getColumnDefs(
  data: object[] | object,
  widget: Pick<
    Partial<Widget & { widgetId?: Widget["widgetId"] }>,
    "data" | "widgetId" | "external" | "storage"
  >,
  decimalPlaces = 3,
  considerHide = true,
): ColDef[] {
  if (!data) return [];
  const newColumnDefs: ColDef[] = [];

  const globalFormatterFn = widget?.data?.table?.formatterFn;

  const columnDefs = Object.fromEntries(
    widget?.data?.table?.columnsDefs?.map((column) => {
      return [
        column.field,
        {
          field: column.field,
          headerName: column.headerName,
          cellDataType: column.cellDataType,
          chartDataType: column.chartDataType,
          renderFn: column.renderFn,
          renderFnParams: column.renderFnParams ?? {},
          formatterFn: column.formatterFn || globalFormatterFn,
          decimalPlaces: column.decimalPlaces,
          prefix: column.prefix,
          suffix: column.suffix,
          rowGroup: column.rowGroup,
          hide: column.hide,
          headerTooltip: column.headerTooltip,
          width: column.width,
          maxWidth: column.maxWidth,
          minWidth: column.minWidth,
          aggFunc: column.aggFunc,
          pinned: column.pinned,
          sparkline: column.sparkline,
          align: column.align,
        } as Partial<ColDef> & {
          renderFn?: WidgetColumnDefT["renderFn"];
          formatterFn?: WidgetColumnDefT["formatterFn"];
          decimalPlaces?: WidgetColumnDefT["decimalPlaces"];
          renderFnParams?: WidgetColumnDefT["renderFnParams"];
          prefix?: WidgetColumnDefT["prefix"];
          suffix?: WidgetColumnDefT["suffix"];
          sparkline?: WidgetColumnDefT["sparkline"];
          align?: WidgetColumnDefT["align"];
        },
      ];
    }) ?? [],
  );

  const fullData = Array.isArray(data) ? data : [data];

  data = fullData[0];

  const transpose = widget?.data?.table?.transpose;

  const typeCheckData = [
    fullData?.[Math.floor(fullData.length / 2)],
    fullData?.[Math.floor(fullData.length / 3)],
    fullData?.[Math.floor(fullData.length / 4)],
    fullData?.[fullData.length - 1],
    ...(fullData?.slice(0, 100) || []),
  ];

  for (const key in data) {
    const type = typeCheckData
      .filter((item) => item?.[key] !== null && item?.[key] !== undefined)
      .map((item) => typeof item?.[key])
      .reduce(
        (a, b, _i, arr) =>
          arr.filter((v) => v === a).length >= arr.filter((v) => v === b).length
            ? a
            : b,
        null,
      );

    const colDef = columnDefs?.[key];

    if (!colDef && globalFormatterFn) {
      columnDefs[key] = { formatterFn: globalFormatterFn };
    }

    const nonNullValue = fullData?.find((item) => typeof item?.[key] === type)?.[key];
    const cellDataType =
      colDef?.cellDataType?.toString() || ChartTypeToCellType?.[colDef?.chartDataType];

    const dataType =
      cellDataType || inferDataType(nonNullValue, colDef?.headerName ?? key);

    const isIndex = key.toLocaleLowerCase() === "index";

    const isDateCol =
      dataType === "date" ||
      (colDef?.chartDataType !== "series" && isDateorYearField(key));

    const chartDataType =
      colDef?.chartDataType || inferChartDataType(nonNullValue, { isDateCol, isIndex });

    const isNumericType = (transpose && !isIndex) || typeof nonNullValue === "number";

    if (columnDefs?.[key]) {
      columnDefs[key].chartDataType = chartDataType;
      columnDefs[key].cellDataType = dataType;
    }

    // Process sparkline configuration if present
    const sparklineConfig = colDef?.sparkline
      ? processSparklineConfig(colDef, colDef.sparkline, fullData)
      : {};

    const cellClass = getCellClass(colDef?.align);

    const columnConfig = {
      colId: key,
      field: key,
      headerName: transpose
        ? extractYearOrReturnInput(colDef?.headerName ?? key)
        : (colDef?.headerName ?? convertToReadableLabel(key)),
      aggFunc: colDef?.aggFunc ?? null,
      pinned: isIndex ? "left" : (colDef?.pinned ?? null),
      suppressAutoSize: false,
      chartDataType,
      cellDataType: dataType.replace("link", "text"),
      rowGroup: colDef?.rowGroup ?? false,
      ...((colDef?.minWidth || colDef?.width) && {
        width: colDef?.width ?? colDef?.minWidth,
      }),
      minWidth: isIndex ? 120 : 50,
      maxWidth: isIndex ? 500 : (colDef?.maxWidth ?? null),
      type: isNumericType ? "numericColumn" : "",
      filter: determineFilterType(dataType, colDef?.headerName ?? key, nonNullValue),
      filterParams: {
        ...(dataType === "date" ? getDateFilterParams() : {}),
      },
      hide: considerHide ? (transpose ? false : (colDef?.hide ?? false)) : false,
      headerTooltip: colDef?.headerTooltip,
      ...(cellClass && { cellClass }),
      // Add filterValueGetter for columns with hoverCard renderFn to ensure filtering works correctly
      // This extracts the numeric value for filtering without affecting cell rendering
      ...(colDef?.renderFn?.includes("hoverCard") && {
        filterValueGetter: (params) => {
          const cellData = params.getValue(params.column.getColId());

          // Handle aggregated values that come as objects
          const value = cellData?.value || cellData;

          if (colDef?.renderFn?.includes("hoverCard") && typeof cellData === "object") {
            const { cellField = "value" } = colDef?.renderFnParams?.hoverCard ?? {};

            return cellData?.[cellField] ?? null;
          }

          return value;
        },
      }),
      valueFormatter: (params) => {
        // Handle aggregated values that come as objects
        const value = params.value?.value || params.value;

        if (
          colDef?.renderFn?.includes("hoverCard") &&
          typeof params.value === "object"
        ) {
          const { cellField = "value" } = colDef?.renderFnParams?.hoverCard ?? {};

          return params?.value?.[cellField] ?? "";
        }

        if (params.colDef?.field === "Index" && transpose)
          return (
            columnDefs?.[params.value]?.headerName ??
            convertToReadableLabel(params.value || "")
          );

        if (typeof value === "number" && !isDateCol) {
          return formatNumber(value, colDef?.decimalPlaces ?? decimalPlaces);
        }
        return formatObjectValue(value) ?? "-";
      },
      // Use sparkline renderer if configured, otherwise use regular cell renderer
      cellRenderer:
        (sparklineConfig as any).cellRenderer ||
        CellRendererComponent(colDef?.renderFn),
      ...((sparklineConfig as any).valueGetter && {
        valueGetter: (sparklineConfig as any).valueGetter,
      }),
      cellRendererParams: (sparklineConfig as any).cellRendererParams || {
        transpose,
        widgetColDefs: columnDefs,
        decimalPlacesToUse: decimalPlaces,
        ...colDef?.renderFnParams,
      },
      ...(widget?.storage?.enableAdvanced && {
        enableRowGroup: chartDataType === "category",
        enableValue: dataType === "number",
        enablePivot: chartDataType === "category" || dataType === "number",
        ...(dataType === "number" && {
          allowedAggFuncs: ["sum", "min", "max", "avg", "count", "first", "last"],
          defaultAggFunc: "sum",
        }),
      }),
    } as ColDef;

    newColumnDefs.push(columnConfig);
  }

  const colOrderMap = new Map(
    (widget?.data?.table?.columnsDefs || []).map((col, index) => [col.field, index]),
  );

  newColumnDefs.sort((a, b) => {
    const aIndex = colOrderMap.get(a.field);
    const bIndex = colOrderMap.get(b.field);

    if (aIndex !== undefined && bIndex !== undefined) {
      return aIndex - bIndex;
    }

    if (aIndex !== undefined) return -1;
    if (bIndex !== undefined) return 1;
    return 0;
  });

  return newColumnDefs;
}

export function getQuarterColumnDefs(
  rowData: any[],
  columnDefs: ColDef[],
  reversed = false,
): ColDef[] {
  const indexCol = columnDefs.find((col) => col.headerName === "Index");

  if (!indexCol) return columnDefs;

  const newColumnDefs = [indexCol];

  const years = Array.from(
    new Set(
      Object.keys(rowData[0])
        .filter((key) => key !== "Index")
        .map((date) => dayjs(date).format("YYYY")),
    ),
  ).sort((a, b) => (reversed ? Number(a) - Number(b) : Number(b) - Number(a)));

  for (const date of years) {
    const groupCol = {
      headerName: date,
      field: date,
      children: columnDefs
        .filter(
          (col) =>
            col.headerName !== "Index" && [col.field, col.headerName].includes(date),
        )
        .map((col) => {
          return {
            ...col,
            headerName: `Q${dayjs(col.field).quarter()}`,
          };
        }),
    } as ColDef;
    newColumnDefs.push(groupCol);
  }

  return newColumnDefs;
}

export const getCellRange = (
  params: GetContextMenuItemsParams | CellSelectionChangedEvent,
) => {
  const cellRangeParams = params?.api?.getCellRanges() ?? [];
  const specificRangeParams = cellRangeParams?.[cellRangeParams.length - 1];
  const { endRow, columns, startRow } = specificRangeParams ?? {};

  return {
    columns,
    rowStartIndex: Math.min(startRow?.rowIndex, endRow?.rowIndex),
    rowEndIndex: Math.max(startRow?.rowIndex, endRow?.rowIndex),
  };
};

export function checkCellRange(
  params: GetContextMenuItemsParams | CellSelectionChangedEvent,
) {
  const cellRange = getCellRange(params);
  const { rowStartIndex, rowEndIndex, columns = [] } = cellRange ?? {};

  const selectedColumns = columns.map(
    (col) => col.getColDef()?.showRowGroup || col.getColId(),
  );
  const filterFn = (key: string, value: any) =>
    selectedColumns.includes(key) && typeof value === "number";

  const isServerSide = params?.api?.getGridOption("rowModelType") === "serverSide";
  const nodeFunc = isServerSide ? "forEachNode" : "forEachNodeAfterFilterAndSort";

  const selectedRowNodes = [] as Record<string, any>[];

  params.api[nodeFunc]((node) => {
    getSelectedRangeData(node, {
      rowStartIndex,
      rowEndIndex,
      selectedRowNodes,
      filterFn,
      isServerSide,
    });
  });

  const totalSeries = selectedRowNodes.reduce(
    (acc, row) => Math.max(acc, Object.keys(row).length),
    0,
  );

  const totalSelectedCells = (rowEndIndex - rowStartIndex + 1) * columns.length;

  return { totalSeries, cellRange, totalSelectedCells };
}

export const getChartContextMenuItems = (
  params: GetContextMenuItemsParams,
  onChartCreation = () => {},
) => {
  const chartTypes = [
    { name: "Bar", subTypes: ["groupedColumn", "stackedColumn"], minSeries: 1 },
    { name: "Horizontal Bar", subTypes: ["groupedBar", "stackedBar"], minSeries: 1 },
    { name: "Line", subTypes: ["line"], minSeries: 1 },
    { name: "Scatter", subTypes: ["scatter"], minSeries: 2 },
    { name: "Bubble", subTypes: ["bubble"], minSeries: 1 },
    { name: "Pie", subTypes: ["pie"], minSeries: 1 },
    { name: "Doughnut", subTypes: ["doughnut"], minSeries: 1 },
    { name: "Area", subTypes: ["stackedArea"], minSeries: 1 },
    { name: "Histogram", subTypes: ["histogram"], minSeries: 1 },
    { name: "Column Line Combo", subTypes: ["columnLineCombo"], minSeries: 1 },
  ] as { name: string; subTypes: ChartType[]; minSeries: number }[];

  const rename = (subType: string) => {
    const listofname = ["groupedColumn", "stackedColumn", "groupedBar", "stackedBar"];
    if (listofname.includes(subType)) {
      //remove Column or Bar from word and capitalize first letter
      return subType
        .split(/(?=[A-Z])/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
        .replace(/Column|Bar/g, "");
    }
    return subType
      .split(/(?=[A-Z])/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const { totalSeries, cellRange, totalSelectedCells } = checkCellRange(params);
  const cellLimitExceeded = totalSelectedCells > chartCellLimit;

  const menuItems = [
    "separator",
    {
      name: "Chart",
      icon: `<svg class="w-3.5 h-3.5 mr-2"><use href="/assets/icons/sprite.svg#chart-icon"></use></svg>`,
      disabled: cellLimitExceeded,
      tooltip: cellLimitExceeded
        ? `Too many cells selected (${totalSelectedCells}). Maximum ${chartCellLimit} cells allowed.`
        : "",
      subMenu: chartTypes.map((chartType) => {
        if (chartType.subTypes.length > 1) {
          return {
            name: chartType.name,
            disabled: totalSeries < chartType.minSeries,
            tooltip:
              totalSeries < chartType.minSeries
                ? `Minimum ${chartType.minSeries} numeric columns required.`
                : "",
            subMenu: chartType.subTypes.map((subType) => {
              return {
                name: rename(subType),
                action: () => {
                  const chartRef = params?.api?.createRangeChart({
                    cellRange,
                    chartType: subType,
                    suppressChartRanges: true,
                    unlinkChart: true,
                  });
                  if (onChartCreation) onChartCreation();
                  chartRef?.destroyChart();
                },
              };
            }),
          };
        }
        return {
          name: chartType.name,
          disabled: totalSeries < chartType.minSeries,
          tooltip:
            totalSeries < chartType.minSeries
              ? `Minimum ${chartType.minSeries} numeric columns required.`
              : "",
          action: () => {
            const chartRef = params?.api?.createRangeChart({
              cellRange,
              chartType: chartType.subTypes[0],
              suppressChartRanges: true,
              unlinkChart: true,
            });
            if (onChartCreation) onChartCreation();
            chartRef?.destroyChart();
          },
        };
      }),
    },
  ] as (string | MenuItemDef)[];

  return menuItems;
};

type GetContextMenuItemsProps = {
  enableChart?: boolean;
  onChartCreation?: () => void;
  widgetId?: string;
};

export const getContextMenuItems = (
  params: GetContextMenuItemsParams,
  props?: GetContextMenuItemsProps,
): (DefaultMenuItem | MenuItemDef)[] => {
  const {
    widgetId = null,
    enableChart = true,
    onChartCreation = () => {},
  } = props ?? {};

  const isProTier = useFeatureFlagsStore.getState()?.featureFlags?.tier === "pro";

  const menuItems = [
    "autoSizeAll",
    "expandAll",
    "contractAll",
    "separator",
    "copy",
    "copyWithHeaders",
    ...(enableChart ? getChartContextMenuItems(params, onChartCreation) : []),
    "separator",
    ...(isProTier ? ["export"] : []),
    ...(widgetId && isCopilotAvailable()
      ? ["separator", getAddToCopilotMenuItem(params, widgetId)]
      : []),
  ] as (DefaultMenuItem | MenuItemDef)[];

  return menuItems;
};

const dispatchCopilotCommand = (command: string | ((prev: string) => string)) => {
  return window.dispatchEvent(
    new CustomEvent("copilotCommand", {
      detail: { command },
    }),
  );
};

export function getAddToCopilotMenuItem(
  params: GetContextMenuItemsParams,
  _widgetId: string,
) {
  const menuItem = {
    name: "Add context to Copilot",
    icon: `<svg class="w-3.5 h-3.5 mr-2"><use href="/assets/icons/sprite.svg#message-text-square-02"></use></svg>`,
    action: () => {
      const cellRange = getCellRange(params);
      const selectedData = [];

      for (let i = cellRange.rowStartIndex; i <= cellRange.rowEndIndex; i++) {
        const rowData = params.api.getDisplayedRowAtIndex(i).data;
        const row = {};
        cellRange.columns.forEach((col) => {
          row[col.getColId()] = rowData[col.getColId()];
        });
        selectedData.push(row);
      }

      // Format the data as a readable table for the copilot
      const formattedData = JSON.stringify(selectedData, null, 2);

      // Paste the content directly into the copilot text area
      dispatchCopilotCommand((prev: string) => {
        const newContent = prev ? `${prev}\n\n${formattedData}` : formattedData;
        return newContent;
      });

      // Expand copilot if hidden
      document.getElementById("expand-copilot-btn")?.click();
      document.getElementById("expand-copilot-mobile-btn")?.click();
    },
  };

  return menuItem;
}

export function onPivotModeChanged(
  event: AgGridEvents,
  updateWidget: WidgetContextType["updateWidget"],
) {
  const isPivotMode = event.api.isPivotMode();
  const openedToolPanel = event.api.getOpenedToolPanel();
  queueMicrotask(() => {
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...prev.storage,
        isPivotMode,
        openedToolPanel,
      },
    }));
  });
}

export const FINANCIAL_RATIO_COLS = {
  liquidity: ["Index", "current_ratio", "cash_per_share", "cash_ratio"],
  efficiency: [
    "Index",
    "days_sales_outstanding",
    "receivables_turnover",
    "inventory_turnover",
    "asset_turnover",
    "operating_cash_flow_per_share",
    "free_cash_flow_per_share",
  ],
  profitability: [
    "Index",
    "gross_profit_margin",
    "operating_profit_margin",
    "net_income_per_share",
    "return_on_assets",
    "return_on_equity",
    "earnings_yield",
    "free_cash_flow_yield",
    "income_quality",
  ],
  leverage: [
    "Index",
    "debt_ratio",
    "debt_to_equity",
    "interest_debt_per_share",
    "net_debt_to_ebitda",
  ],
  coverage: [
    "Index",
    "interest_coverage",
    "cash_flow_coverage_ratios",
    "capex_to_operating_cash_flow",
    "dividend_paid_and_capex_coverage_ratio",
  ],
  operating_cash_flow: [
    "Index",
    "operating_cash_flow_per_share",
    "free_cash_flow_per_share",
    "cash_per_share",
    "capex_per_share",
  ],
};
