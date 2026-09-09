// Import existing utilities from AgGridUtils
import { getColumnDefs } from "~/components/General/Table/AgGridUtils";
import type { ParamDef, WidgetColumnDefT } from "~/components/types";
import { isAgGridWidget } from "~/components/Widgets";
import type { WidgetVizType } from "~/lib/types/app";
import type { FormState } from "./types";

export function generateMockDataForType(type: string) {
  switch (type) {
    case "table":
      return [
        { symbol: "AAPL", price: 150.25, change: 2.5, volume: 1000000 },
        { symbol: "GOOGL", price: 2500.5, change: -10.25, volume: 500000 },
        { symbol: "MSFT", price: 300.75, change: 5.0, volume: 800000 },
      ];
    case "chart":
      return {
        data: [
          {
            x: Array.from(
              { length: 30 },
              (_, i) => new Date(2024, 0, i + 1).toISOString().split("T")[0],
            ),
            y: Array.from({ length: 30 }, () => 0.45 + Math.random() * 0.3),
            type: "scatter",
            mode: "lines+markers",
            name: "Stock A",
          },
          {
            x: Array.from(
              { length: 30 },
              (_, i) => new Date(2024, 0, i + 1).toISOString().split("T")[0],
            ),
            y: Array.from({ length: 30 }, () => 0.5 + Math.random() * 0.25),
            type: "scatter",
            mode: "lines+markers",
            name: "Stock B",
          },
        ],
        layout: {
          title: "Stock Price Movement",
          xaxis: { title: "Date" },
          yaxis: { title: "Price" },
        },
      };
    case "markdown":
      return `# Market Update

## Key Highlights
- Markets opened higher today
- Tech stocks lead gains
- Energy sector underperforms

## Top Movers
| Ticker | Change | Volume |
|--------|--------|--------|
| AAPL   | +2.5%  | 1.2M   |
| TSLA   | -1.2%  | 2.1M   |
| MSFT   | +1.8%  | 0.9M   |`;
    case "newsfeed":
      return [
        {
          title: "Market Update",
          date: "2024-01-15",
          summary: "Markets close higher today...",
        },
        {
          title: "Tech Earnings",
          date: "2024-01-14",
          summary: "Tech companies report strong earnings...",
        },
      ];
    case "live_grid":
      return [
        { symbol: "BTC", price: 42000, change: 1.5, marketCap: "800B" },
        { symbol: "ETH", price: 2500, change: -0.8, marketCap: "300B" },
      ];
    case "metric":
      return { value: 100, change: 5.2, label: "Sample KPI" };
    default:
      return { value: 100, change: 5.2 };
  }
}

export function analyzeDataForWidgetType(
  data: any,
  contentType?: string,
): WidgetVizType {
  if (!data) return "table";

  if (contentType) {
    if (contentType.includes("text/markdown") || contentType.includes("text/plain")) {
      return "markdown";
    }
  }

  if (typeof data === "string") {
    if (
      data.includes("# ") ||
      data.includes("## ") ||
      data.includes("**") ||
      data.includes("- ") ||
      data.includes("| ")
    ) {
      return "markdown";
    }
    return "markdown";
  }

  if (typeof data === "object" && data !== null) {
    if (
      data.data &&
      Array.isArray(data.data) &&
      data.layout &&
      typeof data.layout === "object"
    ) {
      const hasPlotlyTraces = data.data.some(
        (trace: any) =>
          trace &&
          typeof trace === "object" &&
          (trace.type || trace.x || trace.y || trace.mode),
      );

      if (hasPlotlyTraces) {
        return "chart";
      }
    }

    if (
      data?.rowData &&
      Array.isArray(data.rowData) &&
      typeof data.rowCount === "number"
    ) {
      return "ssrm_advanced";
    }
  }

  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
    if (
      data[0].title &&
      (data[0].date || data[0].createdAt || data[0].published) &&
      (data[0].summary ||
        data[0].text ||
        data[0].content ||
        data[0].body ||
        data[0].description)
    ) {
      return "newsfeed";
    }

    if (Object.keys(data[0]).length <= 5) {
      const firstItem = data[0];
      const values = Object.values(firstItem);
      if (values.some((v) => typeof v === "number")) {
        return "metric";
      }
    }

    return "table";
  }

  if (typeof data === "object" && data !== null) {
    if (data.values || data.timeSeries || data.series) {
      return "chart";
    }

    if (
      (data.value !== undefined || data.metric !== undefined) &&
      Object.keys(data).length <= 5
    ) {
      return "metric";
    }

    if (data.data && (Array.isArray(data.data) || typeof data.data === "object")) {
      return "chart";
    }

    return "table";
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return "metric";
  }

  return "table";
}

export function generateColumnDefinitionsFromData(data: any): WidgetColumnDefT[] {
  // Handle nested data structures - check for common patterns
  let tableData = data;

  if (data && typeof data === "object" && Array.isArray(data.data)) {
    tableData = data.data;
  } else if (data && typeof data === "object" && Array.isArray(data.results)) {
    tableData = data.results;
  } else if (data && typeof data === "object" && Array.isArray(data.items)) {
    tableData = data.items;
  }

  if (!(tableData && Array.isArray(tableData)) || tableData.length === 0) {
    return [];
  }

  // Use the existing getColumnDefs function from AgGridUtils
  // This is the same function used by the actual table component
  const agGridColumns = getColumnDefs(
    tableData,
    {
      data: { table: { columnsDefs: [] } }, // Empty column defs to generate from data
      external: true, // Mark as external widget
    },
    3, // decimal places
    false, // don't consider hide property since we're generating
  );

  // Convert AgGrid ColDef format to our ColumnDefinition format
  const columns = agGridColumns.map(
    (col) =>
      ({
        field: col.field || "",
        headerName: col.headerName || "",
        chartDataType: col.chartDataType || "category",
        cellDataType: col.cellDataType || "text",
        renderFn: [],
        width: col.width || 150,
        hide: false,
        pinned: col.pinned === "left" ? "left" : undefined,
      }) as WidgetColumnDefT,
  );

  return columns;
}

export function isTableWidgetType(type: WidgetVizType) {
  const widgetId = type === "table" ? "ag_grid_table" : type;
  return isAgGridWidget(widgetId as any);
}

export async function testEndpoint(props: {
  endpoint: string;
  state?: Pick<FormState, "authRequired" | "authHeaderKey" | "tokenBearer">;
  paramDefs?: ParamDef[];
  method?: "GET" | "POST";
  dataKey?: string;
}) {
  const { endpoint, state, dataKey, method = "GET" } = props;
  if (!endpoint.startsWith("http")) throw new Error("Invalid endpoint URL");

  const url = new URL(endpoint);
  const headers: Record<string, string> = {};
  let body: string | undefined;

  const paramDefs = props.paramDefs || [];
  if (method === "GET") {
    for (const { paramName, value } of paramDefs) {
      url.searchParams.append(paramName, value.toString());
    }
  }

  if (method === "POST") {
    const bodyParams = {};
    for (const { paramName, value } of paramDefs) {
      bodyParams[paramName] = value;
    }
    body = JSON.stringify(bodyParams);
    headers["Content-Type"] = "application/json";
  }

  if (state?.authRequired && state?.authHeaderKey && state?.tokenBearer) {
    headers[state.authHeaderKey] = state.tokenBearer;
  }

  const response = await fetch(url, { method, headers, body });

  if (response.status === 405) {
    return await testEndpoint({ ...props, method: "POST" });
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let data: any;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else if (contentType.includes("text/")) {
    data = await response.text();
  } else {
    try {
      data = await response.json();
    } catch {
      data = await response.text();
    }
  }

  const isSSRM = data?.rowData && data?.rowCount;
  if (!isSSRM && dataKey && data?.[dataKey]) data = data[dataKey];

  return { data, contentType, headers };
}
