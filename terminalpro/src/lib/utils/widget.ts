import cloneDeep from "lodash/cloneDeep";
import { useMemo } from "react";
import {
  deleteApiSource,
  deleteFileWidget,
  deleteSingleWidget,
  deleteWidgetMetadata,
  getApiSources,
  getFileWidgets,
  getSingleWidgets,
} from "~/api/auth.api";
import {
  deleteSourceWidgets,
  getCleanedCategory,
} from "~/components/DataConnectors/common/helpers";
import type { WidgetColumnDefT, WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import type { WidgetId } from "~/components/Widgets";
import { getConfig } from "~/lib/runtimeConfig";
import type { BackendConnectorStore, Source } from "~/lib/state/backendConnector";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { createURLString } from "~/lib/utils";
import WIDGET_BUNDLES from "~/lib/widget_bundles.json";
import WIDGETS from "~/lib/widgets.json";
import type { WidgetType } from "~/utils/zodForms";
import type { Widget } from "../state/app";
import { useAuthStore } from "../state/auth";
import {
  CopilotDataItemSchema,
  type CopilotError,
  type DataContent,
  type DataUrl,
  MultipleCopilotDataItemSchema,
} from "../state/copilot";
import { isExcludedWidgetId, useFeatureFlagsStore } from "../state/featureFlags";
import type { WidgetVizType } from "../types/app";

const dataPackageDataEnabledFF = getConfig().data.packageDataEnabled;

// biome-ignore format: off
export type WidgetsIds = Extract<keyof typeof WIDGETS, string> | `${string}-${number | string}`;

export function getJsonWidget(widget: WidgetId | Partial<Widget>): WidgetT | null {
  if (typeof widget === "string") {
    widget = WIDGETS[widget] as Partial<Widget>;
    if (!widget) return null;
  }
  const { id, widgetId } = widget;
  return cloneDeep({ ...(WIDGETS[widgetId] ?? widget), id, widgetId } as WidgetT);
}

export function getSupportedAssetClasses(widgetId: WidgetsIds | string): string[] {
  return cloneDeep(WIDGETS[widgetId]?.supportedAssetClasses ?? []);
}

export function getWidgetsWithSupportedAssetClass(assetClass: string, onlyIds = false) {
  return cloneDeep(
    Object.values(WIDGETS as unknown as Record<WidgetsIds, Widget>)
      .filter((widget) => widget?.supportedAssetClasses?.includes(assetClass))
      .map((widget) => (onlyIds ? widget.widgetId : widget)),
  );
}

export function getJsonColDefs(widget: WidgetId | Partial<Widget>): WidgetColumnDefT[] {
  if (typeof widget === "string") {
    widget = WIDGETS[widget] as Partial<Widget> | {};
  }
  if (!widget) return [];

  if (widget?.storage?.columnDefs?.length) {
    return widget.storage.columnDefs;
  }
  const widgetFromJSON = getJsonWidget(widget);
  return widget.external
    ? widget?.data?.table?.columnsDefs
    : widgetFromJSON?.data?.table?.columnsDefs;
}

/**
 * Reconciles a placed widget with the backend definition's current
 * `data.table.enableAdvanced`. Widget definitions are baked in at add-time, so
 * this is how a widgets.json edit reaches widgets already on a dashboard.
 * Only acts when the definition explicitly sets the flag AND its value differs
 * from the snapshot baked into `widget.data.table.enableAdvanced` — a user's
 * manual Advanced toggle (stored in `storage.enableAdvanced`) is preserved
 * while the definition is unchanged. Returns null when nothing needs updating.
 */
export function syncEnableAdvancedFromDefinition(
  widget: Widget,
  definitionEnableAdvanced: boolean | undefined,
): Widget | null {
  if (definitionEnableAdvanced === undefined) return null;
  if (widget?.data?.table?.enableAdvanced === definitionEnableAdvanced) return null;

  return {
    ...widget,
    data: {
      ...widget.data,
      table: { ...widget.data?.table, enableAdvanced: definitionEnableAdvanced },
    },
    storage: { ...widget.storage, enableAdvanced: definitionEnableAdvanced },
  };
}

export const US_EXCHANGES = [
  "NYSE",
  "AMEX",
  "NASDAQ",
  "Chicago Options",
  "SNP",
  "New York Stock Exchange",
  "DJI",
  "Cboe Indices",
  "ISE",
  "CBOE",
] as string[];

export const DEFAULT_TICKER_EXCHANGE = "NASDAQ";

export const isSSRMType = (type?: WidgetVizType) =>
  type === "ssrm_table" || type === "ssrm_advanced";

export const isOmniType = (type?: WidgetVizType) => type === "omni";

export function getWidgetSourceInfo(widget: Widget | null) {
  const widgetSource = getWidgetDataSource(widget as WidgetT);

  let sourceName = widget?.sourceName || widgetSource || widget?.source || "";

  if (Array.isArray(sourceName)) sourceName = sourceName.join(", ");
  const source = Array.isArray(widgetSource) ? widgetSource.join(", ") : widgetSource;

  return { source, sourceName };
}

export function getWidgetInfo(widget: Partial<WidgetT | WidgetType>) {
  const { type, name, description, category, subCategory, source } = widget;
  return { type, name, description, category, subCategory, source };
}

export function getWidgetDataSource(widget: Partial<WidgetT> | null): string[] {
  if (!widget) return [];

  // Handle copilot_table widgets - they should be treated as OpenBB Workspace widgets
  if (widget.widgetId?.includes("copilot_table")) {
    return ["OpenBB Workspace"];
  }

  const featureFlags = useFeatureFlagsStore.getState()?.featureFlags;
  const isFreeTier = featureFlags?.tier === "terminal";
  const supportedSources = featureFlags?.data_bundle_info?.providers ?? [];

  // if (widget.widgetId === "company_profile") {
  //   if (isFreeTier) return ["fmp"];

  //   return widget?.data?.mainTicker?.category === "etf" ? ["intrinio"] : ["fmp"];
  // }

  // if (widget.widgetId === "financial_statements") {
  //   if (isFreeTier) return ["fmp"];

  //   return US_EXCHANGES.includes(
  //     widget?.data?.mainTicker?.exchange ?? DEFAULT_TICKER_EXCHANGE,
  //   )
  //     ? ["intrinio"]
  //     : ["fmp"];
  // }

  const widgetFromJSON = getJsonWidget(widget);

  const source = (widget.external ? widget.source : widgetFromJSON?.source) ?? [];

  return (Array.isArray(source) ? source : [source]).filter(
    (s) =>
      s && (widget?.external || !isFreeTier || supportedSources.includes(s as any)),
  );
}

export function useWidgetDataSource(): string[] {
  const mainTicker = useWidgetContext()?.widget?.data?.mainTicker;
  const widgetFromJSON = useWidgetContext()?.widgetFromJSON;

  const widgetDataSource = useMemo(() => {
    const widget = {
      ...widgetFromJSON,
      data: { ...widgetFromJSON?.data, mainTicker },
    };
    return getWidgetDataSource(widget);
  }, [widgetFromJSON?.widgetId, mainTicker?.exchange]);

  return widgetDataSource;
}

export function extractColumns(data: unknown): string[] | null {
  if (!(data && Array.isArray(data)) || data.length === 0) {
    return null;
  }

  const firstRow = data[0];
  if (typeof firstRow !== "object" || firstRow === null || Array.isArray(firstRow)) {
    return null;
  }

  const columns = Object.keys(firstRow);
  return columns.length > 0 ? columns : null;
}

export const WIDGETS_WITHOUT_DISABLED = Object.entries(WIDGETS).reduce(
  (acc, [_key, value]: any) => {
    const isCoreWidget = WIDGET_BUNDLES.openbb.widgets.includes(value.widgetId);
    if (!value.disabled && (dataPackageDataEnabledFF || isCoreWidget)) {
      value.external = false;
      acc.push(value);
    }
    return acc;
  },
  [],
);

export function getAdvancedBackendChildren(id: string): string[] {
  const apiSources = useBackendConnectorStore.getState()?.apiSources ?? [];
  const filtered = apiSources.find((source) => source.id === id);
  return Object.values(filtered?.widgets ?? {}).map((item) => item.widgetId);
}

export function convertAdvancedBackend(source: Source): WidgetT[] {
  return Object.keys(source.widgets ?? {}).map((widgetId) => {
    const widget = source.widgets[widgetId];
    const newWidget = {
      ...cloneDeep({ ...widget }),
      type: widget.type ?? widget.defaultViz,
      endpoint: createURLString(widget.endpoint, source.url),
      external: true,
      widgetType: "backend",
      sourceId: source.id,
      sourceName: source.name,
      category: getCleanedCategory(widget?.category),
      connectionType: "advanced-backend",
    } as unknown as WidgetT;

    if (widget.type === "live_grid" && widget.wsEndpoint) {
      newWidget.wsEndpoint = createURLString(widget.wsEndpoint, source.url);
    }

    if (isSSRMType(widget.type)) {
      newWidget.data = {
        ...(widget.data ?? {}),
        dataKey: "rowData",
      } as WidgetT["data"];
    }

    return newWidget;
  });
}

export const WIDGETS_CONNECTION_TYPES = [
  "individual" as const,
  "single" as const,
  "backend" as const,
  "file" as const,
  "widgetMetadata" as const,
];
export type WidgetConnectionTypes = (typeof WIDGETS_CONNECTION_TYPES)[number];

export function getAllWidgets(
  ignoreSourceId?: string,
  connectionTypes: WidgetConnectionTypes[] = WIDGETS_CONNECTION_TYPES,
): WidgetT[] {
  const { apiSources, singleWidgets, storedFiles, widgetMetadata } =
    useBackendConnectorStore.getState();
  const { enabledBundles, disabledWidgets } = useAuthStore.getState();
  const result = [];

  if (connectionTypes.includes("widgetMetadata")) {
    result.push(
      ...widgetMetadata.map((widget) => ({
        ...cloneDeep({ ...widget }),
        connectionType: "widgetMetadata",
        type: widget.widgetType,
        widgetId: `${widget.widgetType}-${widget.widgetId}`,
        category: getCleanedCategory(widget?.category),
        subCategory: widget?.subCategory,
        storage: {
          ...(widget.storage ?? {}),
        },
      })),
    );
  }

  if (connectionTypes.includes("individual")) {
    result.push(
      ...WIDGETS_WITHOUT_DISABLED.filter((widget) => {
        // Check if the widget is in any of the enabled bundles
        const isInEnabledBundle = enabledBundles.some((bundleId) =>
          WIDGET_BUNDLES[bundleId]?.widgets?.includes(widget.widgetId),
        );

        // Check if the widget is not in the except_widgets list
        const isNotExcepted = !isExcludedWidgetId(widget.widgetId);

        return (
          isInEnabledBundle &&
          !disabledWidgets.includes(widget.widgetId) &&
          isNotExcepted
        );
      }).map((widget) => cloneDeep({ ...widget })),
    );
  }
  if (connectionTypes.includes("single")) {
    result.push(
      ...singleWidgets.map((widget) => {
        return {
          ...cloneDeep({ ...widget }),
          type: widget.type ?? widget.defaultViz,
          widgetType: "single",
          sourceName: "API Endpoints",
          external: true,
          category: getCleanedCategory(widget?.category),
          // @ts-expect-error
          subCategory: widget?.subCategory ?? widget?.sub_category,
          connectionType: "single",
        };
      }),
    );
  }
  if (connectionTypes.includes("backend")) {
    result.push(
      ...apiSources
        .filter(
          (elem) => elem.id !== "root" && elem.widgets && elem.id !== ignoreSourceId,
        )
        .flatMap((source) => {
          return convertAdvancedBackend(source);
        }),
    );
  }
  if (connectionTypes.includes("file")) {
    result.push(
      ...storedFiles.map((widget) => {
        return {
          ...cloneDeep({ ...widget }),
          type: "table",
          external: true,
          category: widget?.category ?? "My Data",
          // @ts-expect-error
          subCategory: widget?.subCategory ?? widget?.sub_category,
          widgetType: "file",
          endpoint: widget.url,
          widgetId: `file-${widget.id}`,
          description: widget.description,
          connectionType: "file",
          gridData: { w: 20, h: widget.extension === "pdf" ? 20 : 10 },
          extension: widget.extension,
          data: {
            dataKey: widget?.dataKey,
            table: {
              enableCharts: true,
              chartView: {
                chartType: "line" as const,
              },
            },
          },
        };
      }),
    );
  }
  return cloneDeep([...result]);
}

export function groupParamOverride(
  paramName: string,
  widgetId: WidgetId,
  invert = false,
) {
  if (widgetId === "analyst_estimates") {
    const match = invert ? "fiscal_period" : "period";
    const replace = invert ? "period" : "fiscal_period";
    if (paramName === match) return replace;
  }
  return paramName;
}

/**
 * Converts widgetId to clean widgetId because some widgetIds have the widgetId as suffix and then the uuid
 * e.g., files will have file- as prefix so they will be file-uuid
 * iframe saved to backend will have iframe- as prefix so they will be iframe-uuid
 * This function removes the prefix and returns the cleaned widgetId
 * @param widgetId
 */
export function getCleanWidgetId(
  widgetId: string,
  connectionType?: WidgetT["connectionType"],
) {
  if (connectionType === "advanced-backend") return widgetId;
  return widgetId
    ?.replace(/_per_.*/, "_per")
    ?.replace(/shared_file-.*/, "ag_grid_file")
    ?.replace(/file-.*/, "ag_grid_file")
    ?.replace(/company_news|global_news/, "news")
    ?.replace(/iframe-.*/, "iframe")
    ?.replace(/youtube-.*/, "youtube")
    ?.replace(/rss_viewer-.*/, "rss_viewer")
    ?.replace(/rich_note-.*/, "rich_note")
    ?.replace(/copilot_table-.*/, "copilot_table")
    ?.replace(/widget_studio-.*/, "widget_studio")
    ?.replace(/ag_chart-.*/, "ag_chart")
    ?.replace(/ag_chart_from_table-.*/, "ag_chart_from_table")
    ?.replace(/html-.*/, "html");
}

const WIDGET_ID_CLEANING = [
  "iframe-",
  "youtube-",
  "shared_file-",
  "file-",
  "rss_viewer-",
  "rich_note-",
  "company_news-",
  "global_news-",
  "copilot_table-",
  "ag_chart-",
  "ag_chart_from_table-",
  "widget_studio-",
  "html-",
];

const WIDGET_ID_CLEANING_REGEX = new RegExp(`^(${WIDGET_ID_CLEANING.join("|")})`);

/**
 * Removes the prefix from the widgetId, i.e., if widgetId is file-uuid, it will return uuid
 * @param widgetId
 * @returns widgetId without the prefix
 */
export function getUUIDFromWidgetId(widgetId: string) {
  return widgetId.replace(WIDGET_ID_CLEANING_REGEX, "");
}

/**
 * Processes a widgetId to extract both the UUID and the clean widget ID.
 * @param widgetId - The original widget ID to process.
 * @returns An object containing the UUID and clean widget ID.
 */
export function processWidgetId(
  widgetId: string,
  connectionType?: WidgetT["connectionType"],
): {
  uuid: string;
  cleanWidgetId: string;
} {
  const uuid = getUUIDFromWidgetId(widgetId);
  const cleanWidgetId = getCleanWidgetId(widgetId, connectionType);

  return {
    uuid,
    cleanWidgetId,
  };
}

/**
 * Checks if a widget is a SQL/Python query code widget based on its params.
 * Returns true for SQL, Python, or undefined query language (backwards compat).
 */
export function isQueryCodeWidget(params: WidgetT["params"] | undefined): boolean {
  const queryLanguage = params?.find((p) => p.paramName === "query")?.language;
  return !queryLanguage || queryLanguage === "sql" || queryLanguage === "python";
}

export const METADATA_WIDGETS = [
  "websites",
  "rss_feeds",
  "notes",
  "copilot_table",
  "widget_studio",
  "ag_chart",
  "ag_chart_from_table",
  "note", // we are adding note somewhere, we need to fix later
  "website",
  "rss",
  "youtube",
  "html",
];

/**
 * Handles the deletion of a widget based on its type and ID.
 * @param type - The type of widget to delete
 * @param id - The ID of the widget
 * @param parent - Optional parent flag for database types
 * @param backendConnector - The backend connector store instance
 * @param deleteWidgets - Function to delete widgets
 * @param deleteWidgetsConnection - Function to delete widget connections
 * @param setDatabases - Function to set databases
 */
export async function handleWidgetDeletion({
  type,
  id,
  backendConnector,
  deleteWidgets,
}: {
  type: string;
  id: string;
  backendConnector: Pick<
    BackendConnectorStore,
    "setSingleWidgets" | "updateApiSources" | "setStoredFiles" | "setWidgetMetadata"
  >;
  deleteWidgets: (id: string) => void;
}) {
  if (type === "single") {
    await deleteSingleWidget(id);
    const result = await getSingleWidgets();
    backendConnector.setSingleWidgets(result);
    return deleteWidgets(id);
  }
  if (type === "backend") {
    const { apiSources } = useBackendConnectorStore.getState();
    const source = apiSources.find((source) => source.id === id);

    deleteSourceWidgets(source);

    await deleteApiSource(id);
    const result = await getApiSources();
    return await backendConnector.updateApiSources(result);
  }
  if (type === "file") {
    await deleteFileWidget(id);
    const result = await getFileWidgets();
    backendConnector.setStoredFiles(result);
    return deleteWidgets(`file-${id}`);
  }

  if (METADATA_WIDGETS.includes(type)) {
    deleteWidgets(`${type}-${id}`);
    const result = await deleteWidgetMetadata(id);
    return backendConnector.setWidgetMetadata(result);
  }

  throw new Error("Invalid widget type");
}

export interface FileResponse {
  aiData: Partial<DataContent | DataUrl | CopilotError>;
  objectUrl: string;
}

export async function handleMultiFileResponse(
  filenames: string[],
  response: Response,
): Promise<Record<string, FileResponse>> {
  const contentType = response.headers.get("Content-Type");

  if (contentType === "application/json") {
    const json = await response.json();
    const parsedResponse = MultipleCopilotDataItemSchema.parse(json);
    if (filenames.length !== parsedResponse.length) {
      throw new Error(
        `Expected ${filenames.length} items, but got ${parsedResponse.length}`,
      );
    }
    const entries = await Promise.all(
      filenames.map(async (filename, index) => {
        const item = parsedResponse[index];
        let fileResponse: FileResponse | null = null;
        if ("data_format" in item && item.data_format?.data_type === "pdf") {
          // Base64 encoded PDF
          if ("content" in item && item.content) {
            const byteArray = base64ToUint8Array(item.content);
            fileResponse = {
              aiData: item,
              objectUrl: URL.createObjectURL(
                new Blob([byteArray], { type: "application/pdf" }),
              ),
            };
          } else if ("url" in item && item.url) {
            const blob = await fetch(item.url).then((res) => res.blob());
            fileResponse = {
              aiData: item,
              objectUrl: URL.createObjectURL(blob),
            };
          }
        } else if ("error_type" in item) {
          fileResponse = {
            aiData: item,
            objectUrl: "",
          };
        }

        return [filename, fileResponse];
      }),
    );

    return Object.fromEntries(entries);
  }
  throw new Error("Invalid content type, expected application/json");
}

export async function handleFileResponse(
  response: Response,
  options?: {
    filename?: string;
    defaultUrl?: string;
  },
): Promise<FileResponse> {
  const contentType = response.headers.get("Content-Type");

  if (contentType === "application/json") {
    const json = await response.json();
    const parsedResponse = CopilotDataItemSchema.parse(json);
    if (
      "data_format" in parsedResponse &&
      parsedResponse.data_format?.data_type === "pdf"
    ) {
      // Base64 encoded PDF
      if ("content" in parsedResponse && parsedResponse.content) {
        const byteArray = base64ToUint8Array(parsedResponse.content);
        return {
          aiData: parsedResponse,
          objectUrl: URL.createObjectURL(
            new Blob([byteArray], { type: "application/pdf" }),
          ),
        };
      }

      // URL to PDF
      if ("url" in parsedResponse && parsedResponse.url) {
        const blob = await fetch(parsedResponse.url).then((res) => res.blob());
        return {
          aiData: parsedResponse,
          objectUrl: URL.createObjectURL(blob),
        };
      }
      throw new Error("Invalid data");
    }
  }
  // PDF file blob
  if (contentType === "application/pdf") {
    const blob = await response.blob();
    return {
      aiData: {
        url: options?.defaultUrl ?? "",
        data_format: { data_type: "pdf", filename: options?.filename },
      },
      objectUrl: URL.createObjectURL(blob),
    };
  }
  throw new Error("Invalid content type");
}

function base64ToUint8Array(base64: string) {
  // Create a buffer directly from the decoded base64 string
  // This approach avoids potential ArrayBuffer detachment issues
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
