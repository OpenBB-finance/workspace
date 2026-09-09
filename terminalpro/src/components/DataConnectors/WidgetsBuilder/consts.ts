import { inSnowflakeNativeApp } from "~/lib/constants";
import type { ExampleWidget } from "./types";

export const EXAMPLE_WIDGETS: ExampleWidget[] = [
  {
    id: "polymarket-top-events",
    title: "Polymarket Top Events",
    description: "Top events from Polymarket",
    category: "Polymarket",
    icon: "newspaper-icon",
    formState: {
      endpoint:
        "https://openbb-polymarket.jose-donato.workers.dev/polymarket/top_events",
      authRequired: false,
      authHeaderKey: "",
      tokenBearer: "",
    },
    widgetConfig: {
      name: "Polymarket Top Events",
      description: "Top events from Polymarket",
      type: "table",
      category: "Polymarket",
      subCategory: "Top Events",
      runButton: true,
      gridData: { w: 25, h: 12, minW: 15, minH: 8, maxW: 40, maxH: 20 },
      dataKey: "",
      params: [
        {
          paramName: "limit",
          description: "Maximum number of events to return",
          type: "number",
          value: 10,
        },
      ],
      enableCharts: true,
      showAll: true,
      chartViewEnabled: true,
      chartType: "line",
      refetchInterval: 30000,
      staleTime: 10000,
      source: ["polymarket"],
      columnsDefs: [],
    },
  },
  {
    id: "event-price-history",
    title: "Event Price History",
    description:
      "Get the price history of all markets in an event on Polymarket (Yes outcomes)",
    category: "Polymarket",
    icon: "chart-icon",
    formState: {
      endpoint:
        "https://openbb-polymarket.jose-donato.workers.dev/polymarket/event_price_history",
      authRequired: false,
      authHeaderKey: "",
      tokenBearer: "",
    },
    widgetConfig: {
      name: "Event Price History",
      description:
        "Get the price history of all markets in an event on Polymarket (Yes outcomes)",
      type: "chart",
      category: "Polymarket",
      subCategory: "Event Price History",
      runButton: true,
      gridData: { w: 30, h: 16, minW: 20, minH: 12, maxW: 40, maxH: 25 },
      dataKey: "",
      params: [
        {
          paramName: "id",
          description: "The id of the event to get price history for all markets",
          type: "number",
          value: 19694,
        },
      ],
      enableCharts: false,
      showAll: false,
      chartViewEnabled: false,
      chartType: "line",
      refetchInterval: 300000,
      staleTime: 180000,
      source: ["polymarket"],
      columnsDefs: [],
    },
  },
  {
    id: "market-details-markdown",
    title: "Market Details",
    description: "Detailed market information in markdown format",
    category: "Polymarket",
    icon: "newspaper-icon",
    formState: {
      endpoint:
        "https://openbb-polymarket.jose-donato.workers.dev/polymarket/market_details",
      authRequired: false,
      authHeaderKey: "",
      tokenBearer: "",
    },
    widgetConfig: {
      name: "Market Details",
      description: "Comprehensive market analysis in markdown format",
      type: "markdown",
      category: "Polymarket",
      subCategory: "Market Analysis",
      runButton: true,
      gridData: { w: 25, h: 15, minW: 20, minH: 10, maxW: 40, maxH: 25 },
      dataKey: "",
      params: [
        {
          paramName: "id",
          description: "Market ID to get detailed information",
          type: "number",
          value: 516792,
        },
      ],
      enableCharts: false,
      showAll: false,
      chartViewEnabled: false,
      chartType: "line",
      refetchInterval: 600000,
      staleTime: 300000,
      source: ["polymarket"],
      columnsDefs: [],
    },
  },
] as const;

const DEFAULT_WIDGET_TYPES = [
  { label: "Table", value: "table" },
  { label: "Chart", value: "chart" },
  { label: "Markdown", value: "markdown" },
  { label: "Metric", value: "metric" },
  { label: "Note", value: "note" },
  { label: "Multi File Viewer", value: "multi_file_viewer" },
  { label: "Live Grid", value: "live_grid" },
  { label: "Newsfeed", value: "newsfeed" },
  { label: "Advanced Chart", value: "advanced-chart" },
  { label: "Highcharts Chart", value: "chart-highcharts" },
  { label: "Vega-Lite Chart", value: "chart-vegalite" },
  { label: "SSRM Advanced", value: "ssrm_advanced" },
];
const SNOWFLAKE_TYPES = [{ label: "SSRM Advanced", value: "ssrm_advanced" as const }];

export const WIDGET_TYPES = inSnowflakeNativeApp
  ? SNOWFLAKE_TYPES
  : DEFAULT_WIDGET_TYPES;

export const CHART_TYPES = [
  { label: "Column", value: "column" },
  { label: "Grouped Column", value: "groupedColumn" },
  { label: "Stacked Column", value: "stackedColumn" },
  { label: "Normalized Column", value: "normalizedColumn" },
  { label: "Bar", value: "bar" },
  { label: "Grouped Bar", value: "groupedBar" },
  { label: "Stacked Bar", value: "stackedBar" },
  { label: "Normalized Bar", value: "normalizedBar" },
  { label: "Line", value: "line" },
  { label: "Scatter", value: "scatter" },
  { label: "Bubble", value: "bubble" },
  { label: "Pie", value: "pie" },
  { label: "Donut", value: "donut" },
  { label: "Doughnut", value: "doughnut" },
  { label: "Area", value: "area" },
  { label: "Stacked Area", value: "stackedArea" },
  { label: "Normalized Area", value: "normalizedArea" },
  { label: "Histogram", value: "histogram" },
  { label: "Radar Line", value: "radarLine" },
  { label: "Radar Area", value: "radarArea" },
  { label: "Nightingale", value: "nightingale" },
  { label: "Radial Column", value: "radialColumn" },
  { label: "Radial Bar", value: "radialBar" },
  { label: "Sunburst", value: "sunburst" },
  { label: "Range Bar", value: "rangeBar" },
  { label: "Range Area", value: "rangeArea" },
  { label: "Box Plot", value: "boxPlot" },
  { label: "Treemap", value: "treemap" },
  { label: "Heatmap", value: "heatmap" },
  { label: "Waterfall", value: "waterfall" },
];

export const CHART_DATA_TYPES = [
  { label: "Category", value: "category" },
  { label: "Series", value: "series" },
];

export const CELL_DATA_TYPES = [
  { label: "Text", value: "text" },
  { label: "Number", value: "number" },
  { label: "Boolean", value: "boolean" },
  { label: "Date", value: "date" },
];

export const FORMATTER_FUNCTIONS = [
  { label: "None", value: "none" },
  { label: "Integer", value: "int" },
  { label: "Percent", value: "percent" },
  { label: "Normalized", value: "normalized" },
  { label: "Normalized Percent", value: "normalizedPercent" },
  { label: "Date to Year", value: "dateToYear" },
];

export const RENDER_FUNCTIONS = [
  { label: "None", value: "none" },
  { label: "Title Case", value: "titleCase" },
  { label: "Green Red", value: "greenRed" },
  { label: "Red Green", value: "redGreen" },
  { label: "Hover Card", value: "hoverCard" },
  { label: "Cell On Click", value: "cellOnClick" },
  { label: "Column Color", value: "columnColor" },
  { label: "Show Cell Change", value: "showCellChange" },
];

export const PINNED_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Left", value: "left" },
  { label: "Right", value: "right" },
];
