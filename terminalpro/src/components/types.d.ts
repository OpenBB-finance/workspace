import type {
  BaseCellDataType,
  ChartModel,
  ChartType,
  Column,
  GridState,
} from "ag-grid-enterprise";
import type { MutableRefObject } from "react";
import type { Layout } from "react-grid-layout";
import type { InnerTab } from "~/lib/state/app";
import type { EditorLanguage, RenderFn, WidgetVizType } from "~/lib/types/app";
import type { DateModifierValue } from "~/lib/utils/widgetParams";
import type { ConnectionType } from "../lib/state/backendConnector";
import { useGetAppWidgets } from "./AI/hooks/useGetAppWidgets";
import type { SecurityType } from "./Charting/constants";
import type { ChartDataT } from "./General/Table/hooks/types";
import type { WidgetId } from "./Widgets";

export type GridData = Partial<Layout> & {
  i?: string; // Unique identifier for the widget.
  x?: number; // Horizontal grid position.
  y?: number; // Vertical grid position.
  w?: number; // Width for the widget in the grid.
  h?: number; // Height for the widget in the grid.
  minH?: number; //
  minW?: number; //
  maxH?: number; //
  maxW?: number; //
  originalMinH?: number; // Original minimum height before minimization.
  mobileH?: number; // Height for mobile view.
  moved?: boolean; // Indicates if the widget has been moved.
  static?: boolean; // Indicates if the widget is static and cannot be moved.
  isDraggable?: boolean; // Specifies if the widget can be dragged.
};

type GridInnerTab<T = string> = T;

export type GridLayout = {
  [key: GridInnerTab]: GridData[];
};

export type Expression = {
  type: "column" | "number" | "operator" | "function" | "parenthesis" | "separator";
  headerName?: string;
  value: string;
};

export type Formula = {
  id: string;
  name: string;
  expression: Expression[];
};

export type GroupTypes = "ticker" | "endpointParam" | "param";

interface GroupBase<T> {
  type: T;
  id: string;
  name: string;
  color: string;
  groupById: unknown;
}

export type EndpointParam = {
  label: string;
  paramName: string;
  value: string;
};

interface LinkedParamGroup extends GroupBase<"param"> {
  type: "param";
  groupById: string;
  value: string;
}

interface TickerGroup extends GroupBase<"ticker"> {
  type: "ticker";
  value: Ticker;
  acceptAssetClasses?: string[];
}

interface EndpointParamGroup extends GroupBase<"endpointParam"> {
  type: "endpointParam";
  groupById: string;
  value: string | string[];
}

export type Group = TickerGroup | EndpointParamGroup | LinkedParamGroup;
export type GroupTypeT<T extends GroupTypes> = Extract<Group, { type: T }>;

export type TickerCategory =
  | "crypto"
  | "equity"
  | "forex"
  | "index"
  | "futures"
  | "derivative"
  | "country"
  | "etf";

export type Ticker = {
  id: string;
  symbol: string;
  category: TickerCategory;
  color?: string;
  type: "index" | "etf" | "economic" | "stock" | "indices" | "country";
  name?: string;
  exchange?: string;
  currency?: string | null;
  industry?: string | null;
  sector?: string | null;
  country?: string | null;
  cik?: string | null;
  isin?: string | null;
  cusip?: string | null;
  has_options?: boolean;
};

export type AgGridSSRMOptions = {
  query?: string;
  startRow: number;
  endRow: number;
  rowGroupCols: any[];
  valueCols: any[];
  pivotCols: any[];
  pivotMode: boolean;
  groupKeys: any[];
  filterModel: any;
  sortModel: any[];
  disableCache?: boolean;
};

/**
 * Represents a formatter function type.
 ** `int` - Formats the number as an integer.
 ** `none` - Does not format the number
 ** `percent` - Adds `%` to the number.
 ** `normalized` - Multiplies the number by 100.
 ** `normalizedPercent` - Multiplies the number by 100 and adds `%` (e.g., `0.5` becomes `50 %`).
 ** `dateToYear` - Converts a date to a year.
 */
// biome-ignore format: off
export type FormatterFn = "int" | "none" | "percent" | "normalized" | "normalizedPercent" | "dateToYear";

export type ChartViewOptionsT = {
  enabled?: boolean; // Indicates if the chart view is the default view.
  chartType?: ChartType; // Type of chart to display.
  ignoreCellRange?: boolean; // Ignores stored cell range.
  cellRangeCols?: Partial<Record<ChartType, (string | Column)[]>>; // Default columns for each chart type
  chartSettingsOpen?: boolean; // Indicates if the chart settings should open.
  xLabel?: string; // Label for the x-axis.
  yLabel?: string; // Label for the y-axis.
  chartNavigatorEnabled?: boolean; // Enables the chart navigator.
  chartMiniChartEnabled?: boolean; // Enables the mini chart inside the navigator.
};

export type ColorRule = {
  // Rules for the conditional color.
  // eq: equal,
  // ne: not equal,
  // gt: greater than,
  // lt: less than,
  // gte: greater than or equal,
  // lte: less than or equal
  // contains: contains
  // notContains: does not contain
  // between: between two values
  // biome-ignore format: off
  condition: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "between" | "contains" | "notContains";
  value: string | number; // Value for the conditional color.
  range?: {
    // Range for the conditional color.
    min: number; // Minimum value for the conditional color.
    max: number; // Maximum value for the conditional color.
  };
  color: `#${string}` | "green" | "red" | "blue"; // Color for the conditional color.
  fill?: boolean; // Indicates if the color should fill the cell.
};

export type WidgetColumnDefT = {
  // Configuration for table columns.
  field?: string; // field name from the json we get from sdk
  enableCellChangeWs?: boolean; // enable cell change on live_grid data
  headerName?: string; // what we actually want the header to display as
  chartDataType?: "category" | "series" | "time" | "excluded"; // chartDataType - 'category' | 'series' | 'time' | 'excluded'
  cellDataType?: BaseCellDataType; // 'text' | 'number' | 'boolean' | 'date' | 'dateString' | 'object'.
  formatterFn?: FormatterFn; // 'int' | 'none' | 'percent' | 'normalized' | 'normalizedPercent' | 'dateToYear'
  decimalPlaces?: number; // Per-column decimal places override (0-6). Used as default when no global decimal setting exists.
  // biome-ignore format: off
  // 'greenRed' | 'titleCase' | 'hoverCard' | 'cellOnClick' | 'columnColor' | 'showCellChange'
  renderFn?:  RenderFn[];
  prefix?: string;
  suffix?: string;
  renderFnParams?: {
    // "openUrl" | "openModal" | "openWidget" not implemented yet
    actionType?: "groupBy" | "sendToAgent"; // Action type for the render function.
    groupBy: {
      forceUpdate?: boolean; // Force update the widget when the group by action is triggered.
      paramName: string; // Group by parameter for the render function.
      /** Field to get the value from the row data
       * (default: {@link WidgetColumnDefT.field})
       */
      valueField?: string;
    };
    hoverCard?: {
      // Hover card configuration.
      cellField?: string; // Field to display on table cell.
      title?: string; // Title for the hover card.
      markdown?: string; // Markdown content for the hover card.
    };
    sendToAgent?: {
      // Send to agent configuration.
      markdown?: string; // Markdown content to send to the agent.
      agentId?: string; // Agent ID to send the message to.
    };
    colorRules?: ColorRule[]; // Color rules for the render function.
    colorValueKey?: string; // Color value key for the render function.
  };
  // Sparkline configuration
  sparkline?: {
    type: "line" | "area" | "bar"; // Type of sparkline
    dataField?: string; // Field containing the sparkline data array (if different from field)
    options?: {
      // Basic styling options
      stroke?: string; // Line/bar stroke color
      strokeWidth?: number; // Line/bar stroke width
      fill?: string; // Fill color for area/bar charts
      fillOpacity?: number; // Fill opacity for area/bar charts
      min?: number; // Minimum value constraint
      max?: number; // Maximum value constraint
      direction?: "vertical" | "horizontal"; // Bar chart direction
      xKey?: string; // Property name for x values in object arrays
      yKey?: string; // Property name for y values in object arrays
      // Tooltip configuration
      tooltip?: {
        enabled?: boolean;
        renderer?: string; // Custom tooltip renderer function name
      };
      // Axis configuration
      axis?: {
        type?: "number" | "category" | "time"; // Axis type
        stroke?: string; // Axis line color
        strokeWidth?: number; // Axis line width
        paddingInner?: number; // Inner padding for category axes
        paddingOuter?: number; // Outer padding for category axes
      };
      // Markers configuration (for point highlighting)
      markers?: {
        enabled?: boolean;
        shape?: "circle" | "diamond" | "square" | "plus" | "cross" | "triangle";
        size?: number;
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
        highlightSize?: number; // Size when highlighted
      };
      // Highlighting configuration
      highlightStyle?: {
        fill?: string;
        stroke?: string;
        strokeWidth?: number;
      };
      // Points of interest configuration
      pointsOfInterest?: {
        // Configuration for highlighting special points
        firstLast?: {
          // Style for first and last points
          size?: number; // Size for markers (line/area only)
          fill?: string; // Fill color
          stroke?: string; // Stroke color
          strokeWidth?: number; // Stroke width
        };
        minimum?: {
          // Style for minimum value points
          size?: number; // Size for markers (line/area only)
          fill?: string; // Fill color
          stroke?: string; // Stroke color
          strokeWidth?: number; // Stroke width
        };
        maximum?: {
          // Style for maximum value points
          size?: number; // Size for markers (line/area only)
          fill?: string; // Fill color
          stroke?: string; // Stroke color
          strokeWidth?: number; // Stroke width
        };
        positiveNegative?: {
          // Style for positive/negative value points
          positive?: {
            size?: number; // Size for markers (line/area only)
            fill?: string; // Fill color
            stroke?: string; // Stroke color
            strokeWidth?: number; // Stroke width
          };
          negative?: {
            size?: number; // Size for markers (line/area only)
            fill?: string; // Fill color
            stroke?: string; // Stroke color
            strokeWidth?: number; // Stroke width
          };
        };
        highlighted?: {
          // Style for highlighted points (on hover)
          size?: number; // Size for markers (line/area only)
          fill?: string; // Fill color
          stroke?: string; // Stroke color
          strokeWidth?: number; // Stroke width
        };
      };
      // Custom formatter function for styling bars/columns based on values
      customFormatter?:
        | ((params: { yValue: number; [key: string]: any }) => {
            fill?: string; // Fill color
            stroke?: string; // Stroke color
            strokeWidth?: number; // Stroke width
            size?: number; // Size for markers (line/area only)
          })
        | string;
      // Label configuration
      label?: {
        enabled?: boolean;
        fontWeight?: string;
        fontStyle?: string;
        fontSize?: number;
        fontFamily?: string;
        color?: string;
        placement?:
          | "inside"
          | "outside"
          | "inside-center"
          | "inside-end"
          | "outside-center"
          | "outside-end";
      };
      // Padding configuration
      padding?: {
        top?: number;
        right?: number;
        bottom?: number;
        left?: number;
      };
    };
  };
  width?: number; // width of column - can up the default if you want
  maxWidth?: number; // max width of column - can up the default if you want
  minWidth?: number; // min width of column - can up the default if you want
  hide?: boolean; // hide column
  headerTooltip?: string; // tooltip textfor the column header
  rowGroup?: boolean; // row group column
  aggFunc?: string; // agg function for column
  pinned?: "left" | "right" | boolean; // pinned column
  pivot?: boolean; // pivot column
  align?: "left" | "center" | "right"; // text alignment for column
};
export type Widget = {
  // 🔹 Core Identity & Classification
  id: string; // Unique identifier for the widget.
  name: string; // Name of the widget in the list the user sees. Displayed on top left of widget
  type: WidgetVizType; // Main widget type
  widgetId?: WidgetId; // Identifier for the specific widget instance. Used to map with openbb ui widgets
  description?: string; // description to show to user on the info button and on the search/add widget menu
  category?: string; // Category for the widget. Used to group widgets in the widget list
  subCategory?: string; // Subcategory for the widget. Used to group widgets in the widget list
  // biome-ignore format: off
  widgetType?: "single" | "backend" | "file" | "copilot_table" | "widget_studio" | "html"; // Type of widget
  raw?: boolean; // Indicates if the widget supports raw data toggle.
  imgUrl?: string; // Image URL for the widget - will show on preview when hovering in search/add widget menu
  innerTab?: string; // if it's from a template it may have a tab assigned. e.g., equity template
  /** @internal only available before widget {@link useGetAppWidgets | creation} */
  readonly defaultViz?: WidgetVizType; // Default visualization for the widget. (backward compatibility)

  // 🔹 Layout / Grouping
  gridData?: GridData; // Grid data for the widget.
  showTitle?: boolean; // Indicates if the widget title should be shown.
  exportable?: boolean; // Whether this widget can be exported. Defaults to true.
  /** @internal **/
  groupId?: string; // Identifier for a widget group.
  /** @internal **/
  groupById?: string;
  /** @internal **/
  paramGroups?: { [key: string]: string }; // Param groups for the widget.

  // 🔹 Supported Context - only used for Internal Widgets
  supportedAssetClasses?: string[];
  defaultAssetClass?: string;

  // 🔹 Data Model
  data?: {
    /** Used for `advanced_charting` widget, to set the default symbol to load on the tv chart */
    defaultSymbol?: string;
    /** Used for `advanced_charting` widget, to set the update frequency of the tv chart */
    updateFrequency?: number;
    /** Array of x and y coordinate values.
     * - Raw data of a widget
     * - If for some reason we want to make it usable without API request
     */
    values?: { x: number; y: number }[];
    /** ### Main ticker information.
     * - Displayed on top left after the widget name.
     * - Normally can be changed on this dropdown
     */
    mainTicker?: Ticker;
    /** Array of secondary tickers.
     * ### Example `watchlist`:
     * - We have `mainTicker` ***(selected)***
     * - We have `secondaryTickers` ***(not selected)***
     */
    secondaryTickers?: Ticker[];
    securities?: SecurityType[];
    /** Indicates `rich_note` controls should be hidden. */
    hideControls?: boolean; // Indicates if controls should be hidden.
    /** Color configuration for the widget.
     * ### Used in:
     * -  Notes to store the color of the note;
     */
    color?: string; // Color configuration for the widget - Used in Notes to store the color of the note.
    /** HTML content to be displayed.
     * ### Used in:
     * -  Notes to save the note content;
     * -  in clock to store the timezone;
     */
    html?: string;
    /** Nested reference to the data used in the widget. */
    dataKey?: string;
    /**
     * @internal Used for `live_grid` widget to identify the row id column in the data.
     * ### Deprecated - use `wsRowIdColumns` instead
     * */
    readonly wsRowIdColumn?: string;
    /** Column names for the row id in the `live_grid` data. */
    wsRowIdColumns?: string[];
    /** @internal callback function called to create the chart from data */
    chart?: { callback?: string /* Callback function for the chart. */ };
    table?: {
      /** Column state for the table. */
      columnState?: { [key: string]: GridState };
      // if its a table - then we can pass more info here
      transpose?: boolean; // Indicates if the table should be transposed.
      enableCharts?: boolean; // Indicates if the table should have charts enabled.
      enableAdvanced?: boolean; // Indicates if the table should have advanced features enabled e.g., sidebar.
      enableFormulas?: boolean; // Indicates if the table should have formulas enabled.
      period?: string[] | boolean; // Period information for the table.
      showAll?: boolean; // Indicates if all data should be shown.
      chartView?: ChartViewOptionsT; // Chart view options for the table.
      columnsDefs?: WidgetColumnDefT[];
      formatterFn?: FormatterFn; // formatterFn to be applied globally to the table
      filterModel?: {
        // Filter model for the table.
        [key: string]: {
          filterType: string; // Filter type.
          type: string; // Type of the filter.
          filter?: any; // Filter value.
        };
      };
    };
  };

  // 🔹 API / Data Fetching
  endpoint?: {
    // Endpoint or endpoints for the widget data.
    url: string; // URL for the endpoint.
    method: "GET" | "POST"; // Method for the endpoint.
    headers?: {
      // Headers for the endpoint.
      [key: string]: string; // Headers for the endpoint.
    };
    query?: {
      // Query for the endpoint.
      [key: string]: string; // Query for the endpoint.
    };
  };
  endpointMethod?: "GET" | "POST"; // Endpoint method
  proEndpoint?: string; // Pro endpoint for the widget. - this is from our backend for internal widgets
  wsEndpoint?: string; // Websocket endpoint for the widget. - used with live_grid
  fileEndpoint?: string; // File endpoint for FileViewer widget. - used with file widget (only used in causeway poc)
  params?: ParamDef[]; // url params to send to endpoint - ie. callback endpoint in "analyst_consensus"
  /** Fixed parameters for the widget. */
  inputs?: { fixed?: { name: string; value: string }[] };

  // 🔹 External Integration
  external?: boolean; // Indicates if the widget is external, i.e., if data is loaded from outside OpenBB API
  connectionType?: ConnectionType; // Connection type for the widget data. Used to know if single or advanced
  schemaName?: string; // SQL Schema name for the widget - only used for ssrm_advanced widgets
  source?: string | string[]; // Source for the widget. Where the data for the widget is coming from.
  sourceId?: string; // Source id for the widget.
  sourceName?: string; // Source name for the widget for external widgets.
  sourceDatabase?: string; // Source database for the widget - only used for snowflake and database widgets

  // 🔹 Computed / Derived Data
  sdkFunc?: string; // SDK function for the widget data.
  platformDataFunction?: string[]; // platform functions for the widget data.
  excelDataFunction?: string[]; // Excel functions for the widget data.

  // 🔹 Runtime / Storage
  storage?: Partial<
    {
      // Storage for the widget that doesnt fit in the other fields.
      [key: string]: any;
    } & {
      chartView?: Omit<
        ChartViewOptionsT,
        "ignoreCellRange" | "chartNavigatorEnabled" | "chartMiniChartEnabled"
      >; // Chart view options for the widget.
      chartModel?: Partial<ChartModel>;
      chartType?: ChartType; // Chart type for the widget.
      tabs?: InnerTab[];
      formulas?: Formula[];
      ssmRequest?: Partial<AgGridSSRMOptions>;
      mcpUrl?: string; // Iframe-only: pre-set MCP server URL from widgets.json — auto-connects on mount
      decimalDigits?: number;
      // SQL parameters for the widget, with type information for endpoint parameters.
      sqlParamDefs?: SqlParamDef[];
      params?: Record<string, any>;
      chartNavigatorEnabled?: boolean; // Enables the chart navigator.
      chartMiniChartEnabled?: boolean; // Enables the mini chart inside the navigator.
      createdAt?: string; // ISO datetime a static artifact (note/file/AI artifact) was added.
      lastEdited?: string; // ISO datetime a markdown note was last edited.
    }
  >;

  // 🔹 Copilot & Experimental
  disableRetrievalForCopilot?: boolean; // Indicates if the widget can be used by Copilot.
  // Metadata to send to the copilot
  metadata?: { [key: string]: any };

  // 🔹 Input Configuration
  inputType?: string; // Input type for omni widgets (e.g., "sql", "javascript", "python", etc.)

  /**
   * @internal **Only available before widget {@link useGetAppWidgets | creation}**
   * @use `data.dataKey` on creation
   */
  readonly dataKey?: string; // Nested reference to the data.
  /**
   * @internal **Only available before widget {@link useGetAppWidgets | creation}**
   * @use `endpoint.headers` | `endpoint.query` on creation */
  readonly endpointHeaders?: {
    key: string;
    value: string;
    location?: "headers" | "query";
  }[];
  /**
   * @internal **Only available before widget {@link useGetAppWidgets | creation}**
   */
  readonly extension?: string; // File extension for the widget. Used to identify the file type.
  /**
   *  @internal **Set to true on widget creation.**
   */
  isNew?: boolean; // Indicates if the widget is newly created. Set to false after the first save.
  dataUpdateDisplay?: string; // 5-field cron expression used to display the data update schedule.
};

export type CustomBackendWidget = {
  name: string; // Name of the widget in the list the user sees. Displayed on top left of widget
  description?: string; // description to show to user on the info button and on the search/add widget menu
  endpoint?: string; // Backend endpoint path to hit
  type: Widget["type"]; // Main widget type
  data?: {
    dataKey?: string; // Key for the data.
    table?: {
      enableCharts?: boolean; // Indicates if the table should have charts enabled.
      enableAdvanced?: boolean; // Indicates if the table should have advanced features enabled e.g., sidebar.
      enableFormulas?: boolean; // Indicates if the table should have formulas enabled.
      showAll?: boolean; // Indicates if all data should be shown.
      chartView?: {
        enabled?: boolean; // Indicates if the chart view is the default view.
        chartType?: ChartType; // Type of chart to display.
        ignoreCellRange?: boolean; // Ignores stored cell range.
      };
      columnsDefs?: {
        // Configuration for table columns.
        field?: string; // field name from the json we get from sdk
        headerName?: string; // what we actually want the header to display as
        chartDataType?: "category" | "series" | "time" | "excluded"; // chartDataType - 'category' | 'series' | 'time' | 'excluded'
        cellDataType?: BaseCellDataType; // 'text' | 'number' | 'boolean' | 'date' | 'dateString' | 'object'.
        formatterFn?: FormatterFn; // 'int' | 'none' | 'percent' | 'normalized' | 'normalizedPercent' | 'dateToYear'
        renderFn?: RenderFn[];
        // Sparkline configuration
        sparkline?: {
          type: "line" | "area" | "bar"; // Type of sparkline
          dataField?: string; // Field containing the sparkline data array (if different from field)
          options?: {
            // Basic styling options
            stroke?: string; // Line/bar stroke color
            strokeWidth?: number; // Line/bar stroke width
            fill?: string; // Fill color for area/bar charts
            fillOpacity?: number; // Fill opacity for area/bar charts
            min?: number; // Minimum value constraint
            max?: number; // Maximum value constraint
            direction?: "vertical" | "horizontal"; // Bar chart direction
            xKey?: string; // Property name for x values in object arrays
            yKey?: string; // Property name for y values in object arrays
            // Tooltip configuration
            tooltip?: {
              enabled?: boolean;
              renderer?: string; // Custom tooltip renderer function name
            };
            // Axis configuration
            axis?: {
              type?: "number" | "category" | "time"; // Axis type
              stroke?: string; // Axis line color
              strokeWidth?: number; // Axis line width
              paddingInner?: number; // Inner padding for category axes
              paddingOuter?: number; // Outer padding for category axes
            };
            // Markers configuration (for point highlighting)
            markers?: {
              enabled?: boolean;
              shape?: "circle" | "diamond" | "square" | "plus" | "cross" | "triangle";
              size?: number;
              fill?: string;
              stroke?: string;
              strokeWidth?: number;
              highlightSize?: number; // Size when highlighted
            };
            // Highlighting configuration
            highlightStyle?: {
              fill?: string;
              stroke?: string;
              strokeWidth?: number;
            };
            // Points of interest configuration
            pointsOfInterest?: {
              // Configuration for highlighting special points
              firstLast?: {
                // Style for first and last points
                size?: number; // Size for markers (line/area only)
                fill?: string; // Fill color
                stroke?: string; // Stroke color
                strokeWidth?: number; // Stroke width
              };
              minimum?: {
                // Style for minimum value points
                size?: number; // Size for markers (line/area only)
                fill?: string; // Fill color
                stroke?: string; // Stroke color
                strokeWidth?: number; // Stroke width
              };
              maximum?: {
                // Style for maximum value points
                size?: number; // Size for markers (line/area only)
                fill?: string; // Fill color
                stroke?: string; // Stroke color
                strokeWidth?: number; // Stroke width
              };
              positiveNegative?: {
                // Style for positive/negative value points
                positive?: {
                  size?: number; // Size for markers (line/area only)
                  fill?: string; // Fill color
                  stroke?: string; // Stroke color
                  strokeWidth?: number; // Stroke width
                };
                negative?: {
                  size?: number; // Size for markers (line/area only)
                  fill?: string; // Fill color
                  stroke?: string; // Stroke color
                  strokeWidth?: number; // Stroke width
                };
              };
              highlighted?: {
                // Style for highlighted points (on hover)
                size?: number; // Size for markers (line/area only)
                fill?: string; // Fill color
                stroke?: string; // Stroke color
                strokeWidth?: number; // Stroke width
              };
            };
            // Custom formatter function for styling bars/columns based on values
            customFormatter?:
              | ((params: { yValue: number; [key: string]: any }) => {
                  fill?: string; // Fill color
                  stroke?: string; // Stroke color
                  strokeWidth?: number; // Stroke width
                  size?: number; // Size for markers (line/area only)
                })
              | string;
            // Label configuration
            label?: {
              enabled?: boolean;
              fontWeight?: string;
              fontStyle?: string;
              fontSize?: number;
              fontFamily?: string;
              color?: string;
              placement?:
                | "inside"
                | "outside"
                | "inside-center"
                | "inside-end"
                | "outside-center"
                | "outside-end";
            };
            // Padding configuration
            padding?: {
              top?: number;
              right?: number;
              bottom?: number;
              left?: number;
            };
          };
        };
        width?: number; // width of column - can up the default if you want
        maxWidth?: number; // max width of column - can up the default if you want
        minWidth?: number; // min width of column - can up the default if you want
        hide?: boolean; // hide column
        headerTooltip?: string; // tooltip for the column header
        pinned?: "left" | "right"; // pinned column
      }[];
    };
  };
  params?: [
    // url params to send to endpoint
    {
      type: "date" | "text" | "ticker" | "number" | "boolean"; // type of the param
      paramName: string; // query param name as it appears in the url
      value: string | number | boolean; // default value
      label?: string; // label to show in the UI
      show?: boolean; // show in the UI
      description?: string; // description to show on hover
      options?: { label: string; value: string | number | boolean }[]; // options for dropdowns
      optionsEndpoint?: string; // endpoint to fetch options from
    },
  ];
  source?: string[]; // Source for the widget. Where the data for the widget is coming from.
  readonly defaultViz?: WidgetVizType; // Default visualization for the widget. (backward compatibility)
  staleTime?: number; // Time in ms to refresh widget
  refetchInterval?: number | false | string; // Refetch interval in ms, false, or a 5-field cron expression.
  dataUpdateDisplay?: string; // 5-field cron expression used to display the data update schedule.
  disableRetrievalForCopilot?: boolean; // Indicates if the widget can be used by Copilot.
};

type WidgetT = Widget & {
  disabled?: boolean;
  /** @internal updates queryKey to force a refresh of the widget */
  refreshQuery?: number;
  storage?: ChartDataT | Widget["storage"];
  staleTime?: number; // Stale time in milliseconds for the widget data.
  refetchInterval?: number | false | string; // Refetch interval in milliseconds or as a 5-field cron expression.
  dataUpdateDisplay?: string; // 5-field cron expression used to display the data update schedule.
  runButton?: boolean; // Indicates if the widget has a run button.
  /** @internal saved when the widget is minimized */
  originalH?: number; // Original height before minimizing.
  /** @internal saved when the widget is minimized */
  isMinimized?: boolean; // Indicates if the widget is minimized.
  isSharedWidget?: boolean; // Indicates if the widget is shared.
  raw?: boolean; // Indicates if the widget supports raw data toggle.
  /** @internal `widget_studio` - used to store the current configuration of the widget */
  widgetConfig?: Partial<Widget>; // Original widget configuration.
};

export type NewWidgetT = WidgetT | ((prev: WidgetT) => WidgetT);
export type WidgetJsonT = Omit<WidgetT, "id" | "endpoint"> & {
  id?: string;
  endpoint?: string;
};

export type WidgetContextType = {
  widget: WidgetT;
  widgetRef?: MutableRefObject<WidgetT>;
  widgetFromJSON?: Partial<Widget>;
  activeDashboardId?: string;
  isShared?: boolean;
  isPreview?: boolean;
  uuid?: string;
  updateWidget?: (newWidget: NewWidgetT, forceStoreUpdate?: boolean) => void;
  getWidget?: () => WidgetT;
};

export interface WidgetProps {
  uuid?: string;
  isShared?: boolean;
  isPreview?: boolean;
  activeDashboardId?: string;
  contextOverride?: WidgetContextType;
}
type ParamValueT<T extends ParamType> = Extract<ParamDef, { type: T }>["value"];
type ParamType =
  | "date"
  | "text"
  | "ticker"
  | "number"
  | "boolean"
  | "endpoint"
  | "button"
  | "form"
  | "tabs";
type ParamValue = string | number | boolean | undefined;
type ParamRoles = "fileSelector";

interface BaseParamDef<PT extends ParamType = "text"> {
  type: PT;
  paramName: string; // query param name as it appears in the url
  value?: ParamValue; // default value
  label?: string; // label to show in the UI
  show?: boolean; // show in the UI
  description?: string; // description to show on hover
  options?: { label: string; value: ParamValueT<PT> }[]; // options for dropdowns
  multiSelect?: boolean; // allow multiple selections
  placeholder?: string;
  row?: number;
  style?: { popupWidth?: number };
  roles?: ParamRoles[]; // defines custom roles for the param, like being a file switcher
  multiple?: boolean;
  language?: EditorLanguage; // Monaco editor language for omni/ssrm_advanced widgets
  hidden?: boolean; // hide the param in the UI
}

interface TextParamDef extends BaseParamDef<"text"> {
  type: "text";
  value?: string;
}

interface DateParamDef extends BaseParamDef<"date"> {
  type: "date";
  value?: DateModifierValue;
}
interface TickerParamDef extends BaseParamDef<"ticker"> {
  type: "ticker";
  value?: Ticker["symbol"];
}

interface NumberParamDef extends BaseParamDef<"number"> {
  type: "number";
  value?: number;
}

interface BooleanParamDef extends BaseParamDef<"boolean"> {
  type: "boolean";
  value?: boolean;
}

interface EndpointParamDef extends BaseParamDef<"endpoint"> {
  type: "endpoint";
  optionsEndpoint?: string;
  optionsParams?: Record<string, string>;
  groupById?: string; // enables grouping other widgets by this endpoint param
  query?: string; // SQL query to fetch options for the endpoint parameter.
}

interface FormButton extends BaseParamDef<"button"> {
  type: "button";
  label: string;
  value?: string | number | boolean;
}

interface TabsParamDef extends BaseParamDef<"tabs"> {
  type: "tabs";
  value?: string;
  options: { label: string; value: string }[];
}

type FormInputType = "date" | "boolean" | "endpoint" | "number" | "text" | "button";
export type FormInputParamDef = Exclude<ParamDef, { type: "form" | "ticker" | "tabs" }>;

export type FormInputParamDefT<T extends FormInputType = FormInputType> = Extract<
  FormInputParamDef,
  { type: T }
>;

interface FormParamDef extends BaseParamDef<"form"> {
  type: "form";
  endpoint: string;
  method: "POST" | "PUT";
  inputParams: FormInputParamDef[];
}

// biome-ignore format: on
export type ParamDef = TextParamDef | TickerParamDef | DateParamDef | NumberParamDef | BooleanParamDef | EndpointParamDef | FormParamDef | FormButton | TabsParamDef;
export type ParamDefT<T extends ParamType> = Extract<ParamDef, { type: T }>;
export type SqlParamDef = Exclude<
  ParamDef,
  { type: "button" | "tabs" | "ticker" | "form" }
>;
export type SqlParamDefT<T extends SqlParamDef["type"]> = Extract<
  SqlParamDef,
  { type: T }
>;

export type {
  GridData as GridDataT,
  GridLayout as GridLayoutT,
  Group as GroupT,
  Ticker as TickerT,
  WidgetT,
};
