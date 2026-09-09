import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { toast } from "sonner";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { deleteApiSource, unsubscribeListedApp } from "~/api/auth.api";
import type { DatabaseT, DBType } from "~/api/dataConnectors";
import ValidateApiSourceWorker from "~/apiSource.worker?worker";

import {
  type CATEGORY_OPTIONS,
  patchSnowflakeEndpoint,
  patchSnowflakeSourceId,
  updateWidgetEndpoints,
} from "~/components/DataConnectors/common/helpers";
import type { GroupTypes, WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import type { ProcessedBackendT } from "~/hooks/useProcessBackendWidgets";
import type { ProcessedTemplate, SharedPromptT } from "~/hooks/useSharedTemplates";
import type { Selector, Widget } from "~/lib/state/app";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { useSidebarStore } from "~/lib/state/sidebar";
import { createIndexedDBStorage } from "~/lib/utils/indexDB";
import { type ShowNotificationProps, showNotification } from "~/lib/utils/toast";
import {
  getApiSourceWidgets,
  processWorkerResults,
  type WorkerResult,
} from "~/lib/utils/validateBackend";
import { addExtraHeaders } from "~/lib/utils/widgetParams";
import type { MetaDataWidgetType } from "~/types/auth.type";
import { mcpServerUsesTokenAuth } from "~/types/listedApps";
import { formatZodErrorMessage, showUnrecognizedKeysToast } from "~/utils/zodErrors";
import type { UnrecognizedKeysReport, WidgetsType } from "~/utils/zodForms";
import { type Extension, inSnowflakeNativeApp } from "../constants";
import type { TabLayout } from "../templates";
import type { WidgetVizType } from "../types/app";
import { createParamDefs, dispatchSaveState, getJsonWidget } from "../utils";

let validateApiSourceWorker: Worker | null = null;

// Register MCP servers declared on a custom backend's apps.json templates so
// they show up under "MCP Servers" in the AI tab, the same way marketplace
// apps wire up via autoAddMcpForApp(). Idempotent — re-running on refresh is
// a no-op if a server with the same sourceId+url is already present.
export function autoRegisterMcpForSource(source: Source) {
  const sourceId = source.id;
  if (!sourceId) return;
  const mcpEntries = (source.templates || []).flatMap((t) => t.mcpServers || []);
  if (mcpEntries.length === 0) return;

  const store = useMcpToolsStore.getState();
  const headers = source.endpointHeaders ?? [];
  const customHeaders = headers.reduce<Record<string, string>>((acc, h) => {
    if (h.location === "headers" && h.key && h.value) acc[h.key] = h.value;
    return acc;
  }, {});

  for (const entry of mcpEntries) {
    const alreadyRegistered = store.servers.some(
      (s) => s.sourceId === sourceId && s.url === entry.url,
    );
    if (alreadyRegistered) continue;

    store.addServer({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: entry.name,
      url: entry.url,
      // A token-auth server has no OAuth fallback, so connecting before the user
      // has supplied a token just fails. Stay disabled until `saveToken` runs.
      enabled: !mcpServerUsesTokenAuth(entry) || !!customHeaders.Authorization,
      autoReconnect: true,
      tools: [],
      customHeaders: Object.keys(customHeaders).length > 0 ? customHeaders : undefined,
      sourceId,
      vendorName: source.name,
      authType: entry.authType,
    });
  }
}

// biome-ignore format: off
export const ConnectionTypes= ["file", "single", "advanced-backend", "snowflake", "database", "widgetMetadata"] as const;

export type ConnectionType = (typeof ConnectionTypes)[number];

export type WidgetMetadataItem = {
  // not to be confused with WidgetMetadata, these are the items in the MyWidgetsTab that come from the backend
  widgetId: string;
  widgetType: MetaDataWidgetType;
  name: string;
  description?: string | null;
  storage?: {
    autoUpdateMetadataOnRun?: boolean;
    params?: Record<string, string>;
    [key: string]: any;
  };
  category?: string | null;
  subCategory?: string | null;
  source?: string | null;
  widgetConfig?: Partial<WidgetT>;
};

export type WidgetMetadata = {
  description?: null | string;
  category?: null | (typeof CATEGORY_OPTIONS)[number];
  subCategory?: null | string;
};

export type SingleWidget = WidgetMetadata & {
  id?: string;
  uuid: string;
  widgetId: string;
  endpoint: string;
  name: string;
  gridData?: null | Widget["gridData"];
  data?: null | Widget["data"];
  endpointHeaders: null | { key: string; value: string }[];
  source?: string | null;
  type?: WidgetVizType;
  // Backwards compatibility
  defaultViz?: WidgetVizType;
  dataKey?: null | string;
};

export type StoredFile = WidgetMetadata & {
  uuid: string;
  id: string;
  url: string;
  extension: Extension;
  name: string;
  dataKey: null | string;
  originalFileName: null | string;
  source?: null | string;
  updatedDate?: string;
  createdDate?: string;
};

export interface BackendTemplate {
  templateId?: string;
  id?: `custom-${string}`;
  name: string;
  description: string;
  selected_agent?: string;
  img?: string;
  img_dark?: string;
  img_light?: string;
  authentication?: string;
  tabs: Record<
    string,
    { id: string; name: string; layout: TabLayout<{ groups: string[] }>[] }
  >;
  groups?: {
    name: string;
    paramName?: string;
    type: GroupTypes;
    widgetIds?: string[];
    defaultValue: string; // we can probably remove this later and infer from the widget
  }[];
  prompts?: string[];
  mcpServers?: {
    name: string;
    description?: string;
    url: string;
    authType?: "oauth" | "token";
  }[];
  // Included so unrecognized-keys detection does not flag it as unknown.
  allowCustomization?: boolean;
}

export type BackendAgent = {
  id: string;
  name: string;
};

export interface SemanticView {
  // FQN = Fully Qualified Name: DATABASE.SCHEMA.VIEW_NAME
  fqn: string;
  baseTable: string;
  database: string;
  schema: string;
  viewName: string;
  /** Comment or description about the semantic view. Optional. */
  comment?: string;
}

export type VenderApp = {
  uuid: string;
  name: string;
  version?: string;
  vendorName: string;
  shortDescription: string;
  appsJsonUrl: string;
  widgetsJsonUrl: string;
  appsJsonCache: BackendTemplate[];
  widgetsJsonCache: WidgetsType;
  thumbnail: string;
  thumbnailDark: string;
  thumbnailLight: string;
  widgets: { id?: string; name: string; description?: string; count?: number }[];
  totalWidgets?: number;
  prompts: string[];
  mcpServers?: {
    name: string;
    description?: string;
    url: string;
    authType?: "oauth" | "token";
  }[];
  isDevelopment?: boolean;
};

export type Source = {
  endpointHeaders:
    | { key: string; value: string; location?: "headers" | "query" }[]
    | null;
  uuid?: string;
  id: string;
  name: string;
  url: string;
  vendorApp?: VenderApp | null;
  vendorAppUuid?: string | null;
  status?: "success" | "error" | "pending" | "rehydrated";
  widgets?: WidgetsType;
  templates?: BackendTemplate[];
  agents?: BackendAgent[];
  isSharedSource?: boolean;
  createdDate?: string;
  updatedDate?: string;
  // #TODO - implement for snowflake app ?
  schemas?: {
    [schemaName: string]: {
      tableName: string;
      database: string;
      schema: string;
      columns: { name: string; type: string }[];
    };
  };
  semanticViews?: { [fqn: string]: SemanticView };
  isOpenBBPlatform?: boolean | null;
  isEntityBackend?: boolean | null;
  hasApiKey?: boolean | null;
};

export type WidgetMetaDataT<T extends WidgetT["connectionType"]> = T extends "file"
  ? StoredFile
  : T extends "single"
    ? SingleWidget | undefined
    : T extends DBType
      ? DatabaseT<T>
      : WidgetMetadataItem;

export function isMetadataType<T extends WidgetT["connectionType"]>(
  widget: WidgetT,
  metadata: unknown,
  connectionType: T | T[],
): metadata is WidgetMetaDataT<T> {
  if (Array.isArray(connectionType)) {
    return connectionType.some((type) => widget.connectionType === type);
  }
  return widget.connectionType === connectionType;
}

export function getTemplateWidgetsMetadata(
  template: BackendTemplate | ProcessedTemplate<SharedPromptT>,
  backend: Source | ProcessedBackendT<false, SharedPromptT>,
) {
  if (!template && !("access" in backend) && backend.vendorApp) {
    const app = backend.vendorApp;
    return {
      widgets: app.widgets || [],
      totalWidgets: app.totalWidgets,
    };
  }

  const builtInWidgetIds = new Set<WidgetId>();

  const widgetCounts = Object.values(template.tabs || {}).reduce(
    (acc, tab) => {
      for (const layout of Object.values(tab.layout || {})) {
        const widgetId = layout.i;
        const isBuiltIn = getJsonWidget(widgetId) !== null;
        const backendWidget = backend?.widgets?.[widgetId];
        if (backendWidget?.disabled || !(backendWidget || isBuiltIn)) continue;
        acc[widgetId] = (acc[widgetId] || 0) + 1;

        if (isBuiltIn) builtInWidgetIds.add(widgetId);
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const widgets = Object.values(backend.widgets || {})
    .filter((w) => widgetCounts[w.widgetId] !== undefined && w.name)
    .map((item) => ({
      id: item?.widgetId,
      name: item?.name,
      description: item?.description ?? undefined,
      count: widgetCounts[item.widgetId],
    }));

  if (builtInWidgetIds.size > 0) {
    for (const widgetId of builtInWidgetIds) {
      const count = widgetCounts[widgetId];
      const w = getJsonWidget(widgetId);
      if (!w?.name) continue;
      const { name, description } = w;
      widgets.push({ id: widgetId, name, description, count });
    }
  }

  const totalWidgets = Object.values(widgetCounts).reduce((a, b) => a + b, 0);

  return { widgets, totalWidgets };
}

export type ValidateBackend = {
  widgets: WidgetsType;
  errorMessage: string | null;
  templateErrorMessage: string | null;
  templateWarningMessage?: string | null;
  unrecognizedKeysMessage?: UnrecognizedKeysReport[] | null;
  totalFailed: number;
  templates: BackendTemplate[];
  agents: BackendAgent[];
  schemas?: Source["schemas"];
  semanticViews?: Source["semanticViews"];
  isOpenBBPlatform?: boolean | null;
};

export interface BackendConnectorStore {
  semanticViews?: Source["semanticViews"];
  widgetMetadata: WidgetMetadataItem[];
  setWidgetMetadata: (values: WidgetMetadataItem[]) => void;
  getWidgetMetadataById: (id: string) => WidgetMetadataItem | undefined;
  getSingleWidgetById: (id: string) => SingleWidget | undefined;
  singleWidgets: SingleWidget[];
  setSingleWidgets: (values: SingleWidget[]) => void;
  hasApiSources: () => boolean;
  apiSources: Source[];
  isLoadingBackends: boolean;
  checkExistingBackend: (params: Record<"name" | "url" | "id", string>) => {
    name?: string;
    url?: string;
  };
  addApiSource: (source: Source) => Source;
  getApiSourceById: (id: string) => Source | undefined;
  deleteApiSource: (
    source: Partial<Source> & { sourceId?: string; vendorAppUuid?: string },
    notify?: ShowNotificationProps,
  ) => Promise<boolean>;
  updateApiSources: (values: Source[], showToastOnError?: boolean) => Promise<boolean>;
  updateApiSource: <PT extends boolean = false>(
    source: PT extends false
      ? Source
      : Partial<Pick<Source, "id" | "url" | "name" | "endpointHeaders">>,
    partial?: PT,
  ) => Promise<Omit<ValidateBackend, "totalFailed">>;
  refreshApiSourceById: (
    sourceId: string,
    activeDashboardId?: string,
  ) => Promise<{ success: boolean }>;
  removeApiSource: (id: string) => void;
  getStoredFileById: (id: string) => StoredFile | undefined;
  storedFiles: StoredFile[];
  setStoredFiles: (values: StoredFile[]) => void;
  updateBackendConnector: (
    value: Partial<
      Pick<
        BackendConnectorStore,
        "apiSources" | "singleWidgets" | "storedFiles" | "widgetMetadata"
      >
    >,
  ) => Promise<void>;
  getTemplatePrompts: (templateId: string) => string[];
  queuedRefreshIds?: string[];
  updateQueuedRefreshId: (id: string, refresh?: boolean) => void;
}

// This is for data connectors that sync with the backend
export const useBackendConnectorStore = createWithEqualityFn<BackendConnectorStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        semanticViews: {},
        queuedRefreshIds: [],
        updateQueuedRefreshId: (id, refresh = false) => {
          if (get().apiSources.length === 0) return;
          const queuedIds = new Set(get().queuedRefreshIds);

          if (refresh) {
            queuedIds.add(id);
          } else {
            queuedIds.delete(id);
          }
          set({ queuedRefreshIds: Array.from(queuedIds) });
        },
        checkExistingBackend: ({ name, url, id }) => {
          const cleanUrl = url.trim().replace(/\/+$/, "").trim();

          const apiSources = get().apiSources;
          const result = apiSources.reduce(
            (acc, backend) => {
              if (backend.id === id) return acc;
              if (backend.url === cleanUrl) {
                acc.url = `"${backend.name}" is already using this URL`;
              }
              if (backend.name === name) {
                acc.name = `A backend with the name "${name}" already exists`;
              }
              return acc;
            },
            {} as { name?: string; url?: string },
          );

          return Object.keys(result).length > 0 ? result : null;
        },

        getTemplatePrompts: (templateId) =>
          get().apiSources.flatMap(
            (source) =>
              source.templates?.find((t) => t.id === templateId)?.prompts ?? [],
          ),
        getWidgetMetadataById: (id) =>
          get().widgetMetadata.find((item) => item.widgetId === id),
        widgetMetadata: [],
        getSingleWidgetById: (id) =>
          get().singleWidgets.find((item) => item.widgetId === id),
        setWidgetMetadata: (widgetMetadata) => set({ widgetMetadata }),
        apiSources: [],
        isLoadingBackends: false,
        singleWidgets: [],
        storedFiles: [],
        getApiSourceById: (id) =>
          get().apiSources.find(
            (source) =>
              source.id === id ||
              (source.vendorApp?.uuid && source.vendorApp.uuid === id),
          ),
        deleteApiSource: async (source, notify) => {
          let sourceId = source.sourceId || source.id;
          const vendorAppUuid = source.vendorAppUuid || source.vendorApp?.uuid;

          try {
            if (vendorAppUuid) {
              useMcpToolsStore.getState().removeVendorAppServer(vendorAppUuid);
              await unsubscribeListedApp(vendorAppUuid);

              const vendorSourceId = get().getApiSourceById(vendorAppUuid)?.id;
              if (!sourceId && vendorSourceId) {
                sourceId = vendorSourceId;
              }
            } else if (sourceId) {
              useMcpToolsStore.getState().removeSourceServer(sourceId);
            }

            if (!sourceId) return false;
            await deleteApiSource(sourceId);
            get().removeApiSource(sourceId);
            if (notify) showNotification(notify);
          } catch (error) {
            console.error("Error deleting API source:", error);
            return false;
          }
          return true;
        },
        hasApiSources: () => get().apiSources.length > 0,
        getStoredFileById: (id) => get().storedFiles.find((item) => item.id === id),
        setStoredFiles: (storedFiles) => set({ storedFiles }),
        setSingleWidgets: (singleWidgets) => set({ singleWidgets }),
        refreshApiSourceById: async (sourceId, activeDashboardId) => {
          const apiSources = cloneDeep(get().apiSources);

          const source = apiSources.find((s) => s.id === sourceId);
          if (!source) return { success: false };

          const { errorMessage, widgets, templateErrorMessage } =
            await get().updateApiSource(source);

          if (errorMessage || templateErrorMessage) {
            // Mark backend as inactive when refresh fails
            get().addApiSource({ ...source, status: "error" });
            toast.error("Backend connection failed", {
              id: `refresh-${source.id}`,
              description: `${source.name} moved to inactive connections.`,
            });
            return { success: false };
          }

          updateWidgetEndpoints({ ...source, widgets }, activeDashboardId);
          toast.success("Backend refreshed", {
            id: `refresh-${source.id}`,
            description: activeDashboardId
              ? `${source.name} widgets in current dashboard have been updated.`
              : `${source.name} refreshed successfully.`,
          });

          return { success: true };
        },
        updateApiSource: async (source, partial = false) => {
          if (partial && !source.id) {
            throw new Error("Source ID is required for partial updates.");
          }
          let {
            widgets,
            errorMessage,
            templateErrorMessage,
            templateWarningMessage,
            unrecognizedKeysMessage,
            templates,
            schemas,
            semanticViews,
            agents,
          } = await getApiSourceWidgets(source as Source);

          let updatedSource: Source;
          const existingSource = get().getApiSourceById(source.id!) || ({} as Source);

          if (!(errorMessage || templateErrorMessage)) {
            const updatedWidgets = Object.entries(widgets).reduce(
              (acc, [key, widget]) => {
                widget.params = createParamDefs(widget, source.url);
                const subCategory = widget.sub_category ?? widget.subCategory;

                acc[key] = {
                  ...widget,
                  widgetId: key,
                  subCategory,
                  endpointHeaders: source.endpointHeaders,
                };
                return acc;
              },
              {},
            );

            updatedSource = {
              ...existingSource,
              ...source,
              widgets: updatedWidgets,
              templates,
              schemas,
              semanticViews,
              agents,
              status: "success",
            };
          } else if (partial) {
            updatedSource = {
              ...existingSource,
              ...source,
              agents,
              schemas,
              semanticViews,
              status: "error",
            };
            widgets = existingSource?.widgets || {};
            templates = existingSource?.templates || [];
            agents = existingSource?.agents || [];
          }

          if (updatedSource) {
            const promise = new Promise<void>((resolve) => {
              const checkLoading = () => {
                const { isLoadingBackends } = get();
                if (!isLoadingBackends) {
                  get().addApiSource(updatedSource);
                  return resolve();
                }
                setTimeout(checkLoading, 100); // check again after 100ms
              };
              checkLoading();
            });
            await promise;
          }

          const isPublishedMarketplaceApp =
            updatedSource?.vendorApp && !updatedSource.vendorApp?.isDevelopment;
          if (unrecognizedKeysMessage && !isPublishedMarketplaceApp) {
            showUnrecognizedKeysToast(updatedSource, unrecognizedKeysMessage);
          }

          return {
            widgets,
            errorMessage,
            templateErrorMessage,
            templateWarningMessage,
            unrecognizedKeysMessage,
            templates,
            agents,
            schemas,
            semanticViews,
          };
        },
        addApiSource: (source: Source) => {
          const apiSources = cloneDeep(get().apiSources);
          const existingSource = apiSources.find((s) => s.id === source.id);
          const isNewSource = !existingSource;
          const vendorApp = source.vendorApp;
          source.vendorAppUuid = vendorApp?.uuid;

          if (vendorApp && source.status === "error") {
            source.widgets = vendorApp?.widgetsJsonCache || {};
            source.templates = vendorApp?.appsJsonCache || [];
          }

          source.hasApiKey = source.endpointHeaders?.some(
            (h) =>
              h.key.toLowerCase() === "authorization" && h.value.startsWith("Bearer "),
          );

          if (existingSource) Object.assign(existingSource, source);
          else apiSources.push(source);

          const semanticViews = source.semanticViews;
          set({ apiSources, ...(semanticViews ? { semanticViews } : {}) });

          // Only fire on first connect, not on refresh. If the user removed the
          // MCP server manually, refreshing the backend must not bring it back.
          if (isNewSource && !vendorApp && source.status === "success") {
            autoRegisterMcpForSource(source);
          }

          return source;
        },
        updateApiSources: async (values, showToastOnWarning = false) => {
          const currentApiSources = get().apiSources.reduce(
            (acc, source) => {
              acc[source.id] = source;
              return acc;
            },
            {} as Record<string, Source>,
          );

          if (!import.meta.env.DEV && inSnowflakeNativeApp) {
            const locationHref =
              typeof window !== "undefined" ? new URL(window.location.href) : undefined;
            if (values.length > 1) {
              values = await patchSnowflakeSourceId(
                values,
                get().widgetMetadata,
                locationHref!,
              );
            }

            for (const source of values) {
              source.url = patchSnowflakeEndpoint(source.url, locationHref!);
            }
          }

          const apiSources = values.map((source) => {
            const { endpointHeaders = [] } = source;
            const curr = currentApiSources[source.id];
            return {
              ...source,
              endpointHeaders,
              widgets: curr?.widgets || {},
              templates: curr?.templates || [],
              schemas: curr?.schemas || undefined,
              semanticViews: curr?.semanticViews || undefined,
              agents: curr?.agents || [],
              status: curr?.status || "pending",
              hasApiKey: endpointHeaders.some(
                (h) =>
                  h.key.toLowerCase() === "authorization" &&
                  h.value.startsWith("Bearer "),
              ),
            } as Source;
          });

          set({ apiSources, isLoadingBackends: apiSources.length > 0 });

          if (apiSources.length === 0) return true;
          let needsSaveState = false;
          const saveState = () => needsSaveState && dispatchSaveState();

          const onMessage = (event: MessageEvent<WorkerResult>) => {
            const data = event.data;
            let finalSources = data.apiSources;

            const { semanticViews, toastErrors, unrecognizedKeysMessages } = data;

            // Streaming partial: merge validated sources into existing
            // apiSources without disrupting the rest. Slow sources don't block
            // the UI swap for already-finished ones.
            if (data.__partial) {
              const vendorApps = finalSources.filter(
                (s) => s.status === "success" && (s.vendorApp?.uuid || s.vendorAppUuid),
              );
              if (vendorApps.length > 0 && !needsSaveState) needsSaveState = true;

              // Update widget endpoints for all vendor app sources after the final validation is complete
              for (const s of vendorApps) {
                const activeDashboardId = useSidebarStore.getState().activeItem;
                updateWidgetEndpoints(s, activeDashboardId as string, false);
              }

              const updatedMap = new Map(finalSources.map((s) => [s.id, s]));
              const mergedSources = get().apiSources.map((s) =>
                updatedMap.has(s.id) ? { ...s, ...updatedMap.get(s.id)! } : s,
              );
              finalSources = mergedSources;
            }

            if (showToastOnWarning) {
              for (const { source, message } of toastErrors) {
                toast.warning(`App Warning: ${source.name}`, {
                  id: `backend-app-warning-${source.id}`,
                  descriptionClassName: "max-h-80 overflow-y-auto",
                  description: formatZodErrorMessage(message),
                });
              }

              for (const { source, reports } of unrecognizedKeysMessages) {
                showUnrecognizedKeysToast(source, reports);
              }
            }

            if (!data.__partial) saveState();

            set({
              isLoadingBackends: data.__partial,
              apiSources: finalSources,
              ...(semanticViews ? { semanticViews } : {}),
            });
          };

          const fallbackToMainThread = async () => {
            const results = await Promise.all(
              apiSources.map(async (source) => {
                const result = await getApiSourceWidgets(source);
                return { source, result };
              }),
            );
            onMessage({ data: processWorkerResults(results) } as MessageEvent);
          };

          // In tests, we want to bypass the worker and validate sources immediately
          if (import.meta.env.VITEST) {
            await fallbackToMainThread();
            return true;
          }

          if (!validateApiSourceWorker) {
            validateApiSourceWorker = new ValidateApiSourceWorker();
          }

          validateApiSourceWorker.onmessage = onMessage;
          validateApiSourceWorker.onerror = async (error) => {
            console.error("Worker error:", error.message);
            await fallbackToMainThread();
          };

          const extraHeaders = addExtraHeaders();
          validateApiSourceWorker.postMessage({ apiSources, extraHeaders });

          return new Promise((resolve) => {
            const checkLoading = () => {
              if (!get().isLoadingBackends) return resolve(true);

              setTimeout(checkLoading, 100); // check again after 100ms
            };
            checkLoading();
          });
        },
        removeApiSource: (id) => {
          const apiSources = get().apiSources.filter(
            (source) =>
              !(
                (source.vendorApp?.uuid && source.vendorApp.uuid === id) ||
                source.id === id
              ),
          );
          set({ apiSources });
        },
        updateBackendConnector: async (params) => {
          const { apiSources, singleWidgets, storedFiles, widgetMetadata } = params;
          if (Array.isArray(apiSources)) get().updateApiSources(apiSources);
          set({ singleWidgets, storedFiles, widgetMetadata });
        },
      }),
      {
        name: "backend-connector",
        storage: createIndexedDBStorage(),
        partialize: (state) =>
          ({
            apiSources: state.apiSources
              .filter((source) => source.status === "success")
              .map((source) => ({
                ...source,
                endpointHeaders: undefined,
                status: "rehydrated" as const,
              })),
          }) as unknown as BackendConnectorStore,
      },
    ),
  ),
  shallow,
);

export function useShallowBackendConnectorStore<S extends BackendConnectorStore, T>(
  selector: Selector<S, T>,
): T {
  return useBackendConnectorStore(useShallow(selector), (prev, next) =>
    isEqual(prev, next),
  );
}
