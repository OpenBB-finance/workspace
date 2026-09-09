export interface NativeConfig {
  id: string;
  name: string;
  query: string;
}
export interface WidgetRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  dataKey?: string;
}

export interface ParamType {
  type: "date" | "text" | "ticker" | "number" | "boolean";
  paramName: string;
  value?: string | number | boolean; // default value
  show: boolean; // whether the parameter should be shown in the UI
  description?: string;
}

export interface WidgetDefinition {
  name: string;
  description: string;
  category?: string;
  searchCategory?: string;
  widgetType?: string;
  widgetId: string;
  params?: ParamType[];
  endpoint: string;
  gridData?: {
    w: number;
    h: number;
  };
  data?: {
    dataKey?: string;
    table: {
      index: string;
      showAll: boolean;
      columnsDefs: {
        headerName: string;
        field: string;
        chartDataType: string;
      }[];
    };
  };
}

export type BackendId = string;
export type WidgetId = string;
export type BackendsMap = Record<BackendId, Record<WidgetId, WidgetDefinition>>;
