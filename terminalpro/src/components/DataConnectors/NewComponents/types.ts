import { inSnowflakeNativeApp } from "~/lib/constants";
import type { BackendTemplate } from "~/lib/state/backendConnector";
import type { WidgetType } from "~/utils/zodForms";

export type EndpointHeader = {
  key?: string;
  value?: string;
  location?: "headers" | "query";
};

export type POSSIBLE_SOURCES =
  | "file"
  | "single"
  | "backend"
  | "others"
  | "rss_feeds"
  | "websites"
  | "notes"
  | "youtube"
  | "widget_studio"
  | "ai_artifacts"
  | "user_widgets"
  | "copilot_chart"
  | "html";

export type BaseItem = {
  uuid?: string;
  id?: string;
  name: string;
  description: string;
  selectionId: string;
  shared: boolean;
  status: "success" | "error";
  url?: string;
  type: POSSIBLE_SOURCES;
};

export type FileItem = BaseItem & {
  id: string;
  widgets: {
    id: string;
    name: string;
    description: string;
    category: string;
    subCategory: string;
    storedFileUuid: string | null;
    url: string;
    extension: string;
    dataKey: string;
    originalFileName: string;
    source: string;
    uuid: string;
    widgetId: string;
    selectionId: string;
    shared: boolean;
    uploadedAt?: string | number;
  }[];
};

export type SingleItem = BaseItem & {
  category: string | null;
  subCategory: string;
  endpoint: string;
  gridData: {
    h: number;
    w: number;
  };
  data: {
    table: {
      showAll: boolean;
      enableCharts: boolean;
    };
  };
  endpointHeaders: EndpointHeader[];
  source: null;
  dataKey: string;
  uuid: string;
  widgetId: string;
  selectionId: string;
};

export type BackendItem = BaseItem & {
  url: string;
  endpointHeaders: EndpointHeader[];
  uuid: string;
  id: string;
  selectionId: string;
  templates?: BackendTemplate[];
  widgets?: (WidgetType & { selectionId?: string; shared?: boolean })[];
};

export type ItemType<T extends POSSIBLE_SOURCES> = T extends "file"
  ? FileItem
  : T extends "single"
    ? SingleItem
    : T extends "backend"
      ? BackendItem
      : never;

/** Fields consumed by WidgetCard — union of widget child shapes across source types. */
export type WidgetCardItem = {
  uuid?: string;
  id?: string;
  widgetId?: string;
  name?: string;
  category?: string;
  subCategory?: string;
  source?: string | string[] | null;
  selectionId?: string;
  shared?: boolean;
  description?: string;
  url?: string;
  originalFileName?: string;
  createdDate?: string;
  widgetType?: string;
  type?: string;
};

// some items are duplicated because they might have a different type, we need to fix this later
export const SourceMeta = {
  widget_studio: {
    name: inSnowflakeNativeApp ? "Custom Widgets" : "Widget Studio",
    icon: "brush-01",
    showEdit: false,
  },
  single: { name: "API Endpoints", icon: "dataflow-04" },
  backend: { name: "Backend Widgets", icon: "grid-01" },
  "advanced-backend": { name: "Backends", icon: "grid-01" },
  file: { name: "File Uploads", icon: "file-attachment-01" },
  rss: { name: "RSS / Atom Feeds", icon: "rss-01" },
  rss_feeds: { name: "RSS / Atom Feeds", icon: "rss-01" },
  websites: { name: "Iframes", icon: "globe-01" },
  website: { name: "Iframes", icon: "globe-01" },
  youtube: { name: "YouTube", icon: "transcript-icon" },
  note: { name: "Notes", icon: "file-04", showEdit: false },
  copilot_table: { name: "Tables", icon: "table-02", showEdit: false },
  copilot_chart: { name: "Charts", icon: "bar-chart-01", showEdit: false },
  html: { name: "HTML", icon: "code-02", showEdit: false },
  others: { name: "Core Widgets", icon: "plus-circle" },
  ai_artifacts: { name: "AI Artifacts", icon: "table-02", showEdit: false },
  user_widgets: { name: "My Widgets", icon: "table-02", showEdit: false },
} as const;
