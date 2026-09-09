import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { useEffect, useMemo } from "react";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import {
  getCleanedCategory,
  patchSnowflakeEndpoint,
} from "~/components/DataConnectors/common/helpers";
import { isTableWidgetType } from "~/components/DataConnectors/WidgetsBuilder/utils";
import useSharedResources from "~/components/LayoutAuth/Search/hooks/useSharedResources";
import type { Widget, WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import { inSnowflakeNativeApp } from "~/lib/constants";
import type { Selector } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type SingleWidget,
  type Source,
  type StoredFile,
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { isExcludedWidgetId } from "~/lib/state/featureFlags";
import { type UserGeneratedApp, useShallowUserAppsStore } from "~/lib/state/userApps";
import {
  convertAdvancedBackend,
  getJsonWidget,
  WIDGETS_WITHOUT_DISABLED as OPENBB_API_WIDGETS,
} from "~/lib/utils";
import WIDGET_BUNDLES from "~/lib/widget_bundles.json";

export function useGetAppWidgets() {
  const { singleWidgets, storedFiles, apiSources, widgetMetadata } =
    useShallowBackendConnectorStore((s) => ({
      singleWidgets: s.singleWidgets,
      storedFiles: s.storedFiles,
      apiSources: s.apiSources,
      widgetMetadata: s.widgetMetadata,
    }));

  const { enabledBundles, disabledWidgets } = useShallowAuthStore((s) => ({
    enabledBundles: s.enabledBundles ?? [],
    disabledWidgets: s.disabledWidgets ?? [],
  }));
  const setBackendNameToWidgetMap = useShallowAppWidgetsStore((s) => s.setAppWidgets);

  const apiEndpointWidgets = useMemo(
    () => apiEndpointsToWidgets(singleWidgets),
    [singleWidgets],
  );
  const customBackendWidgets = useMemo(
    () => apiSourcesToWidgets(apiSources),
    [apiSources],
  );

  const sharedUserApps = useShallowUserAppsStore((s) => s.getAllSharedUserApps());

  const sharedUserAppWidgets = useMemo(
    () => userAppsToWidgets(sharedUserApps),
    [sharedUserApps],
  );

  const openbbSandboxWidgets = useMemo(
    () =>
      openbbSandboxWidgetsToWidgets(
        OPENBB_API_WIDGETS,
        enabledBundles,
        disabledWidgets,
      ),
    [OPENBB_API_WIDGETS, enabledBundles, disabledWidgets],
  ); // all openbb native widgets - navigation_bar, company_information, ...

  const openbbHubWidgets = useMemo(
    () => storedFilesToWidgets(storedFiles),
    [storedFiles],
  ); // images, pdfs, etc

  const { openbbStudioWidgets, openbbWorkspaceWidgets } = useMemo(
    () => widgetMetadataToWidgets(widgetMetadata),
    [widgetMetadata],
  ); // includes copilot artifacts

  const sharedWidgets = useSharedResources();

  const backendNameToWidgetMap = useMemo(() => {
    const map = new Map<BackendName, Map<string, WidgetT>>();

    function addWidgets(backendName: BackendName, widgets: WidgetT[]) {
      const widgetMap = widgets.reduce((acc, widget) => {
        if (!widget.widgetId) return acc;
        acc.set(widget.widgetId, widget);
        return acc;
      }, new Map<string, WidgetT>());
      map.set(backendName, widgetMap);
    }

    addWidgets("API Endpoints", apiEndpointWidgets);
    addWidgets("OpenBB Sandbox", openbbSandboxWidgets);
    addWidgets("OpenBB Hub", openbbHubWidgets);
    addWidgets("OpenBB Workspace", openbbWorkspaceWidgets);
    addWidgets("Widget Studio", openbbStudioWidgets);

    // Handle custom backends dynamically
    for (const widget of customBackendWidgets) {
      const backendName = widget.sourceName;
      if (!(backendName && widget.widgetId)) continue;

      if (!map.has(backendName)) {
        map.set(backendName, new Map<string, WidgetT>());
      }
      map.get(backendName)!.set(widget.widgetId, widget);
    }

    for (const widget of sharedWidgets) {
      const isFileWidget = widget.connectionType === "file";
      const backendName = isFileWidget ? "OpenBB Hub" : widget.sourceName;
      if (!(backendName && widget.widgetId)) continue;

      if (!map.has(backendName)) {
        map.set(backendName, new Map<string, WidgetT>());
      }
      map.get(backendName)!.set(widget.widgetId, widget as WidgetT);
    }

    for (const widget of sharedUserAppWidgets) {
      // Skip if widgetId conflicts with built-in JSON widget
      if (!widget.external && getJsonWidget(widget.widgetId)) continue;
      const connectionMap = {
        single: "API Endpoints",
        file: "OpenBB Hub",
        widget_studio: "Widget Studio",
        widgetMetadata: "OpenBB Workspace",
      } as const;

      // Widget Studio widgets carry their viz type in `type` (e.g. "table"), so
      // resolve them by their id prefix to match the origin the copilot looks them
      // up with (`getWidgetOrigin` → "Widget Studio"). Otherwise they fall through
      // to `connectionType: "widgetMetadata"` and get misfiled under "OpenBB
      // Workspace", causing "Widget … not found" on data fetch.
      const backendName = widget.widgetId?.startsWith("widget_studio")
        ? "Widget Studio"
        : connectionMap[widget.type] ||
          connectionMap[widget.connectionType] ||
          widget.sourceName;

      if (map.get(backendName)?.has(widget.widgetId)) {
        if (import.meta.env.DEV)
          console.warn(
            `Widget ID conflict for "${widget.widgetId}" in backend "${backendName}".
            Skipping this widget to avoid overwriting.`,
          );
        continue;
      }
      if (!map.has(backendName)) {
        map.set(backendName, new Map<string, WidgetT>());
      }
      map.get(backendName)!.set(widget.widgetId, widget);
    }

    return map;
  }, [
    apiEndpointWidgets,
    openbbSandboxWidgets,
    openbbHubWidgets,
    openbbWorkspaceWidgets,
    openbbStudioWidgets,
    customBackendWidgets,
    sharedUserAppWidgets,
    sharedWidgets,
  ]);

  useEffect(() => {
    setBackendNameToWidgetMap(backendNameToWidgetMap);
  }, [backendNameToWidgetMap]);
}

type BackendTypes =
  | "API Endpoints"
  | "OpenBB Sandbox"
  | "OpenBB Hub"
  | "OpenBB Workspace"
  | "Widget Studio"
  | "Shared App Widgets";

type BackendName<T extends BackendTypes = BackendTypes> = T | (string & {});

type GetWidgetsState = {
  lastUpdated: number;
  backendNameToWidgetMap: Map<BackendName, Map<string, WidgetT>>;
  getAllAppWidgets: () => WidgetT[];
  setAppWidgets: (
    backendNameToWidgetMap: Map<BackendName, Map<string, WidgetT>>,
  ) => void;
  getAppWidget: (widgetId: WidgetId, sourceName?: BackendName) => WidgetT | undefined;
  getSqlWidget: () => WidgetT | undefined;
  getRunCodeWidget: () => WidgetT | undefined;
};

export const useGetWidgetsStore = createWithEqualityFn<GetWidgetsState>()(
  subscribeWithSelector((set, get) => ({
    lastUpdated: Date.now(),
    backendNameToWidgetMap: new Map<BackendName, Map<string, WidgetT>>(),
    getSqlWidget: () => get().getAppWidget("global_sql_builder" as WidgetId),
    getRunCodeWidget: () => get().getAppWidget("run_code" as WidgetId),
    setAppWidgets: (backendNameToWidgetMap) =>
      set({ backendNameToWidgetMap, lastUpdated: Date.now() }),
    getAppWidget: (widgetId, sourceName) => {
      const map = get().backendNameToWidgetMap;
      if (sourceName)
        return map.get(sourceName)?.get(widgetId.replace(`${sourceName}-`, ""));

      // Search all sources for the widgetId
      for (const sourceMap of map.values()) {
        if (sourceMap.has(widgetId)) {
          return sourceMap.get(widgetId);
        }
      }

      return undefined;
    },
    getAllAppWidgets: () =>
      Array.from(get().backendNameToWidgetMap.values()).flatMap((widgetMap) =>
        Array.from(widgetMap.values()).filter((widget) => !widget.disabled),
      ),
  })),
  shallow,
);

export function useShallowAppWidgetsStore<S extends GetWidgetsState, T>(
  selector: Selector<S, T>,
): T {
  return useGetWidgetsStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

function getBuiltInWidgets(): WidgetT[] {
  // Only return rich_note widget for AI/Copilot generative UI functionality
  return [
    {
      widgetId: "rich_note",
      name: "Markdown Note",
      description:
        "Create a markdown text widget for notes, documentation, or any text content",
      category: "Others",
      subCategory: "Utils",
      type: "note",
      imgUrl:
        "https://raw.githubusercontent.com/OpenBB-finance/widgets-library/main/others/utils/rich_note.png",
      connectionType: "widgetMetadata",
      params: [
        {
          paramName: "content",
          description: "The text content for the note widget",
          type: "text",
          value: "# New Note\n\nClick to edit this note and add your content...",
        },
        {
          paramName: "name",
          description:
            "A short, descriptive title for the widget (max 50 characters). AI will generate this based on the content.",
          type: "text",
          value: "Note",
        },
        {
          paramName: "description",
          description:
            "A brief description of what the content is about (max 100 characters). AI will generate this based on the content.",
          type: "text",
          value: "A note widget",
        },
      ],
    },
  ] as WidgetT[];
}

function apiSourcesToWidgets(apiSources: Source[]): WidgetT[] {
  const customBackendWidgets = apiSources
    .filter((elem) => elem.id !== "root" && elem.widgets)
    .flatMap((source) => {
      return convertAdvancedBackend(source);
    });
  // TODO: This assertion can be inaccurate, needs fix
  return customBackendWidgets as WidgetT[];
}

function storedFilesToWidgets(storedFiles: StoredFile[]): WidgetT[] {
  const openbbHubWidgets = storedFiles.map((widget) => {
    return {
      ...cloneDeep({ ...widget }),
      type: "table",
      external: true,
      category: widget?.category ?? "My Data",
      // @ts-expect-error
      subCategory: widget?.subCategory ?? widget?.sub_category,
      widgetType: "file",
      endpoint: {
        url: widget.url,
        method: "GET",
      },
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
  });
  // TODO: This assertion can be inaccurate, needs fix
  return openbbHubWidgets as WidgetT[];
}

// Widgets to hide in Snowflake native app
const SNOWFLAKE_HIDDEN_WIDGETS = ["iframe", "youtube", "rss_viewer"];

function openbbSandboxWidgetsToWidgets(
  apiWidgets: Widget[],
  enabledBundles: string[],
  disabledWidgets: string[],
): WidgetT[] {
  const openbbSandboxWidgets = apiWidgets
    .filter((widget) => {
      // Hide certain widgets in Snowflake native app
      if (inSnowflakeNativeApp && SNOWFLAKE_HIDDEN_WIDGETS.includes(widget.widgetId)) {
        return false;
      }

      // Check if the widget is in any of the enabled bundles
      const isInEnabledBundle = enabledBundles.some((bundleId) =>
        WIDGET_BUNDLES[bundleId]?.widgets?.includes(widget.widgetId),
      );

      // Check if the widget is not in the except_widgets list
      const isNotExcepted = !isExcludedWidgetId(widget.widgetId);

      return (
        isInEnabledBundle && !disabledWidgets.includes(widget.widgetId) && isNotExcepted
      );
    })
    .map((widget) => cloneDeep({ ...widget }));
  // TODO: This assertion can be inaccurate, needs fix
  return openbbSandboxWidgets as WidgetT[];
}

function apiEndpointsToWidgets(singleWidgets: SingleWidget[]): WidgetT[] {
  const apiEndpointWidgets = singleWidgets.map((widget) => {
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
  });
  return apiEndpointWidgets as unknown as WidgetT[];
}

// we need to transform widget studio widgets from widget metadata format to WidgetT format, we are saving them in widget metadata with the majority of the fields in widgetConfig (this is so it matches the structure of the other widget metadata items)
// but in the app we need them in the WidgetT format so they can be added to a dashboard
export function createWidgetStudioWidget(widget: WidgetMetadataItem): WidgetT {
  const { widgetType, widgetConfig, ...rest } = widget;
  const isTableWidget = isTableWidgetType(widgetConfig.type);
  const isLiveGrid = widgetConfig?.type === "live_grid";

  return {
    ...cloneDeep({ ...rest }),
    id: widget.widgetId, // Add required id field
    connectionType: "widgetMetadata",
    widgetId: `${widget.widgetType}-${widget.widgetId}`,
    category: getCleanedCategory(widget?.category),
    subCategory: widget?.subCategory,
    external: true,
    // Extract properties from widgetConfig
    type: widgetConfig?.type || "table",
    endpoint: widgetConfig?.endpoint?.url || widgetConfig?.endpoint || "",
    runButton: widgetConfig?.runButton,
    gridData: widgetConfig?.gridData || {
      w: 20,
      h: 9,
      minW: 10,
      minH: 5,
      maxW: 40,
      maxH: 100,
    },
    refetchInterval: widgetConfig?.refetchInterval ?? 900000,
    dataUpdateDisplay: widgetConfig?.dataUpdateDisplay,
    staleTime: widgetConfig?.staleTime || 300000,
    ...(widgetConfig?.params &&
      widgetConfig.params.length > 0 && {
        params: widgetConfig.params.map((param: any) => ({
          paramName: param.paramName,
          description: param.description,
          type: param.type,
          value: param.value,
          ...(param.label && { label: param.label }),
          ...(param.show !== undefined && { show: param.show }),
          ...(param.placeholder && { placeholder: param.placeholder }),
          ...(param.options && { options: param.options }),
          ...(param.multiSelect !== undefined && { multiSelect: param.multiSelect }),
          ...(param.multiple !== undefined && { multiple: param.multiple }),
          ...(param.optionsEndpoint && {
            optionsEndpoint: param.optionsEndpoint,
          }),
          ...(param.language && { language: param.language }),
        })),
      }),
    data: {
      ...(widgetConfig?.data?.dataKey && { dataKey: widgetConfig.data.dataKey }),
      ...(isLiveGrid &&
        // @ts-expect-error
        widgetConfig?.data?.wsEndpoint && {
          // @ts-expect-error
          wsEndpoint: widgetConfig.data.wsEndpoint,
        }),
      ...(isLiveGrid &&
        widgetConfig?.data?.wsRowIdColumn && {
          wsRowIdColumn: widgetConfig.data.wsRowIdColumn,
        }),
      ...(isTableWidget &&
        widgetConfig?.data?.table && {
          table: {
            enableCharts: widgetConfig.data.table.enableCharts,
            showAll: widgetConfig.data.table.showAll,
            ...(widgetConfig.data.table.chartView && {
              chartView: {
                enabled: widgetConfig.data.table.chartView.enabled,
                chartType: widgetConfig.data.table.chartView.chartType,
              },
            }),
            ...(widgetConfig.data.table.columnsDefs?.length > 0 && {
              columnsDefs: widgetConfig.data.table.columnsDefs.map((column: any) => ({
                field: column.field,
                headerName: column.headerName,
                chartDataType: column.chartDataType,
                cellDataType: column.cellDataType,
                formatterFn: column.formatterFn,
                ...(column.renderFn?.length > 0 && {
                  renderFn: column.renderFn,
                }),
                ...(column.width && { width: column.width }),
                ...(column.minWidth && { minWidth: column.minWidth }),
                ...(column.maxWidth && { maxWidth: column.maxWidth }),
                ...(column.hide && { hide: column.hide }),
                ...(column.pinned && { pinned: column.pinned }),
              })),
            }),
          },
        }),
    },
    // Preserve sourceId and sourceName for deletion handling
    ...(widgetConfig?.sourceId && { sourceId: widgetConfig.sourceId }),
    ...(widgetConfig?.sourceName && { sourceName: widgetConfig.sourceName }),
    storage: {
      ...(widget.storage ?? {}),
    },
  } as WidgetT;
}

function userAppsToWidgets(userApps: UserGeneratedApp[]): WidgetT[] {
  return userApps.flatMap((app) =>
    app.widgets.map(
      (widget) =>
        ({
          ...cloneDeep({ ...widget }),
          id: undefined, // Clear id to avoid conflicts
          category: getCleanedCategory(widget?.category) || "User Apps",
          sourceName: widget.sourceName || "Shared App Widgets",
          storage: { ...(widget.storage ?? {}), userAppId: app.uuid },
        }) as WidgetT,
    ),
  );
}

function widgetMetadataToWidgets(widgetMetadata: WidgetMetadataItem[]): {
  openbbStudioWidgets: WidgetT[];
  openbbWorkspaceWidgets: WidgetT[];
} {
  const openbbStudioWidgets = widgetMetadata
    .filter((widget) => widget.widgetType === "widget_studio")
    .map(createWidgetStudioWidget);

  const locationHref =
    typeof window !== "undefined" ? new URL(window.location.href) : undefined;

  const workspaceWidgets = widgetMetadata
    .filter((widget) => widget.widgetType !== "widget_studio")
    .map((widget) => {
      if (widget.widgetConfig?.endpoint) {
        widget.widgetConfig.endpoint = patchSnowflakeEndpoint(
          widget.widgetConfig.endpoint,
          locationHref!,
        );
      }

      return {
        ...cloneDeep({ ...widget }),
        connectionType: "widgetMetadata",
        type: widget.widgetType,
        widgetId: `${widget.widgetType}-${widget.widgetId}`,
        category: getCleanedCategory(widget?.category),
        subCategory: widget?.subCategory,
        storage: { ...(widget.storage ?? {}) },
      } as WidgetT;
    });

  const openbbWorkspaceWidgets = workspaceWidgets.concat(getBuiltInWidgets());

  return { openbbStudioWidgets, openbbWorkspaceWidgets };
}
