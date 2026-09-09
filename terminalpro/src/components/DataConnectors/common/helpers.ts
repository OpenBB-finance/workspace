import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import { v4 as uuidv4 } from "uuid";
import { deleteApiSource, patchWidgetMetadata } from "~/api/auth.api";
import type { ParamDef, WidgetT } from "~/components/types";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useAppStore, type Widget } from "~/lib/state/app";
import type { Source } from "~/lib/state/backendConnector";
import { useCopilotStore } from "~/lib/state/copilot";
import { useUserAppsStore } from "~/lib/state/userApps";
import { isWidgetVizType, TableColumnDefsSchema } from "~/lib/types/app";
import {
  createParamDefs,
  createURLString,
  createWidgetEndpoint,
  createWidgetInitParams,
  dispatchSaveState,
  dispatchUpdateWidget,
  generateRandomName,
  isSSRMType,
  syncEnableAdvancedFromDefinition,
} from "~/lib/utils";
import type { WidgetMetadataResponse } from "~/types/auth.type";
import type { DatabaseSubmitForm, WidgetsType, WidgetType } from "~/utils/zodForms";

export function listToSortedSet(list: string[]): string[] {
  return [...new Set(list)].sort();
}

export function addNewDataConnector(
  setPendingNavigation: (value: string | null) => void,
  widgetToAdd: Partial<Omit<Widget, "endpoint" | "endpointHeaders">>,
) {
  const id = uuidv4();
  useAppStore.getState().addTab({
    index: id,
    data: {
      name: generateRandomName(),
      type: "custom",
      groups: [],
      widgets: [
        {
          ...widgetToAdd,
          id: uuidv4(),
          groupId: "",
          innerTab: "",
          external: true,
        } as Widget,
      ],
    },
  });
  setPendingNavigation(`/app/${id}`);
}

export function addMultipleNewDataConnector(
  setPendingNavigation: (value: string | null) => void,
  widgetsToAdd: Partial<Omit<Widget, "endpoint">>[],
) {
  const id = uuidv4();
  useAppStore.getState().addTab({
    index: id,
    data: {
      name: generateRandomName(),
      type: "custom",
      groups: [],
      widgets: widgetsToAdd.map(
        (widget) =>
          ({
            ...widget,
            id: uuidv4(),
            groupId: "",
            innerTab: "",
            external: true,
            name: Array.isArray(widget.name) ? widget.name.join(" ") : widget.name,
          }) as Widget,
      ),
    },
  });
  setPendingNavigation(`/app/${id}`);
}

export function createSourceWidget(
  widget: WidgetType,
  source: Source,
  withAccess = true,
): WidgetT {
  const params = createParamDefs(widget, source.url);
  const groupById = params?.find((p) => p?.type === "endpoint")?.groupById;

  const endpoint =
    typeof widget.endpoint === "string"
      ? { url: createURLString(widget.endpoint, source.url), method: "GET" }
      : widget.endpoint;

  const newWidget = {
    ...widget,
    groupById,
    id: uuidv4(),
    type: widget.type ?? widget.defaultViz,
    endpoint,
    params,
    external: true,
    sourceId: source.id,
    sourceName: source.name,
    connectionType: "advanced-backend",
    endpointHeaders: source.endpointHeaders ?? [],
  } as WidgetT;

  if (widget.type === "live_grid" && widget.wsEndpoint) {
    newWidget.wsEndpoint = createURLString(widget.wsEndpoint, source.url);
  }

  if (source.isSharedSource) {
    newWidget.isSharedWidget = true;
    newWidget.sourceName = `shared-${source.name}`;
    if (!withAccess) {
      newWidget.endpoint = { url: "", method: "GET" };
      newWidget.disabled = true;
    }
  }

  return newWidget;
}

export function getSourceWidgetsToAdd(widgets: WidgetsType, source: Source): WidgetT[] {
  return Object.keys(widgets).map((widgetId) => {
    const widget = cloneDeep({ ...widgets[widgetId], widgetId });
    return createSourceWidget(widget, source);
  });
}

export function updateWidgets(
  type: string,
  realId: string | number,
  values: DatabaseSubmitForm,
) {
  const { getWidgetsByAttribute, updateWidget } = useAppStore.getState();
  const identifier = `${type}-${realId}`;
  const selectedWidgets = getWidgetsByAttribute("widgetId", identifier);
  const { name, query, sub_category, category } = values;
  for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
    for (const widget of widgets) {
      updateWidget(dashId, {
        ...widget,
        name,
        description: query,
        subCategory: sub_category,
        category,
      });
    }
  }
}

export const CATEGORY_OPTIONS = [
  "Economy",
  "Crypto",
  "Stocks",
  "Fixed Income",
  "Equity",
  "Currency",
  "ETF",
  "Index",
  "Derivatives",
  "Others",
] as const;

export function getCleanedCategory(category: string) {
  const cleanedCategory = CATEGORY_OPTIONS.find(
    (c) => c.toLowerCase() === category?.toLowerCase()?.trim(),
  );
  return cleanedCategory || category || "My Data";
}

const reduceParams = (acc: string[], p: ParamDef) => {
  const show = p.hidden === undefined ? p.show !== false : !p.hidden;
  return show ? acc.concat(p.paramName) : acc;
};

export const getParamsOrder = (origParams: ParamDef[], params: ParamDef[]) => {
  const origParamOrder = (origParams || []).reduce(reduceParams, []);
  const paramOrder = (params || []).reduce(reduceParams, []);

  return isEqual(paramOrder, origParamOrder) ? undefined : origParamOrder;
};

export function updateParamOrder(paramOrder: string[] | undefined, params: ParamDef[]) {
  if (!paramOrder) return params;
  return params
    .map((p) => {
      const show = paramOrder?.includes(p.paramName);
      const hidden = !show;
      return { ...p, show, hidden };
    })
    .sort((a, b) => {
      const indexA = paramOrder?.indexOf(a.paramName);
      const indexB = paramOrder?.indexOf(b.paramName);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
}

export function updateWidgetParamOrder(
  params: ParamDef[],
  origParams: ParamDef[] | undefined,
) {
  const paramOrder = getParamsOrder(origParams, params);
  if (!paramOrder) return params;

  return updateParamOrder(paramOrder, params);
}

export function updateWidgetEndpoints(
  source: Partial<Source & { prevName?: string }>,
  activeDashboardId?: string,
  saveState = true,
) {
  const { items, getWidgetsByAttributes, updateWidget } = useAppStore.getState();
  const currentTab = items?.[activeDashboardId]?.data?.currentTab;
  const isSharedSource = source?.isSharedSource;
  const sourceName = source.prevName ?? source.name;

  const selectedWidgets = getWidgetsByAttributes({
    sourceId: source.id,
    sourceName,
    ...(isSharedSource && { isSharedWidget: true }),
  });

  if (source.prevName && source.prevName !== source.name) {
    const updateCitationsOrigin = useCopilotStore.getState().updateCitationsOrigin;
    updateCitationsOrigin(source.prevName, source.name);
  }

  const onUpdatedWidget = (dashId: string, widget: WidgetT, innerTab: string) => {
    if (activeDashboardId === dashId && innerTab === currentTab) {
      return dispatchUpdateWidget(widget.id, widget);
    }

    updateWidget(dashId, widget);
  };

  const endpointHeaders = source.endpointHeaders ?? [];
  for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
    for (const w of widgets) {
      const widgetId = w.widgetId.replace(`${sourceName}-`, "");
      const widgetJson = source.widgets[widgetId];
      if (!widgetJson) {
        const newEndpoint = createWidgetEndpoint(w.endpoint?.url, endpointHeaders);
        const updatedWidget = {
          ...w,
          sourceName: source.name,
          endpoint: { ...w.endpoint, ...newEndpoint },
        };
        onUpdatedWidget(dashId, updatedWidget, w.innerTab);

        continue;
      }

      const params = updateWidgetParamOrder(
        createParamDefs(widgetJson, source.url),
        w?.params,
      );
      const groupById = params?.find((p) => p?.type === "endpoint")?.groupById;
      const wTable = widgetJson?.data?.table;

      const columnsDefs = TableColumnDefsSchema.safeParse(wTable?.columnsDefs)?.data;
      const chartView = wTable?.chartView;

      const newEndpoint = createWidgetEndpoint(
        createURLString(widgetJson.endpoint, source.url),
        endpointHeaders,
      );

      const subCategory = widgetJson.sub_category ?? widgetJson.subCategory;
      const widgetType = widgetJson.type ?? widgetJson.defaultViz;
      const showAll =
        wTable?.showAll !== undefined ? wTable?.showAll : w.data?.table?.showAll;
      const dataKey = widgetJson.data?.dataKey ?? w.data?.dataKey;

      const updatedWidget = {
        ...w,
        name: widgetJson.name ?? w.name,
        description: widgetJson.description ?? "",
        groupById,
        type: isWidgetVizType(widgetType) ? widgetType : w.type,
        sourceName: source.name,
        category: widgetJson.category ?? "",
        subCategory,
        params,
        runButton: widgetJson.runButton,
        data: {
          ...(w.data ?? {}),
          dataKey,
          table: {
            ...(w.data?.table ?? {}),
            showAll,
            columnsDefs: columnsDefs ?? [],
            chartView: chartView ?? w.data?.table?.chartView,
            formatterFn: wTable?.formatterFn,
          },
        },
        endpoint: { ...w.endpoint, ...newEndpoint },
        staleTime: widgetJson.staleTime ?? w.staleTime,
        refetchInterval: widgetJson.refetchInterval ?? w.refetchInterval,
        dataUpdateDisplay: widgetJson.dataUpdateDisplay ?? w.dataUpdateDisplay,
        refreshQuery: Date.now(),
        showTitle: widgetJson.showTitle !== false,
        exportable: widgetJson.exportable !== false,
        disableRetrievalForCopilot: widgetJson.disableRetrievalForCopilot,
      } as WidgetT;

      if (updatedWidget.raw !== widgetJson.raw) {
        updatedWidget.raw = widgetJson.raw;
      }

      if (isSharedSource) updatedWidget.isSharedWidget = true;

      const initialParams = createWidgetInitParams(updatedWidget, w?.data?.mainTicker);
      updatedWidget.storage = { ...updatedWidget.storage, params: initialParams };

      if (updatedWidget.type === "file_viewer" && widgetJson.fileEndpoint) {
        updatedWidget.fileEndpoint = widgetJson.fileEndpoint;
      }

      if (updatedWidget?.storage?.chartModel && chartView?.chartType) {
        updatedWidget.storage.chartModel.chartType = chartView.chartType;
      }

      if (chartView?.chartType) {
        updatedWidget.storage.chartView = chartView;
      }

      if (updatedWidget.type === "live_grid") {
        if (widgetJson.wsEndpoint)
          updatedWidget.wsEndpoint = createURLString(widgetJson.wsEndpoint, source.url);

        if (widgetJson.data?.wsRowIdColumn || widgetJson.data?.wsRowIdColumns) {
          const { wsRowIdColumns, wsRowIdColumn } = widgetJson.data;
          const value = wsRowIdColumns || wsRowIdColumn;
          updatedWidget.data.wsRowIdColumns =
            typeof value === "string" ? [value] : value;
        }
      }

      if (isSSRMType(updatedWidget.type)) {
        updatedWidget.data.dataKey = "rowData";
      }

      if (updatedWidget.type === "ssrm_advanced" || updatedWidget.type === "omni") {
        for (const key of ["schemaName"]) {
          if (widgetJson[key]) {
            updatedWidget[key] = widgetJson[key];
          }
        }
      }

      const advancedSynced = syncEnableAdvancedFromDefinition(
        updatedWidget,
        wTable?.enableAdvanced,
      );

      onUpdatedWidget(dashId, advancedSynced ?? updatedWidget, w.innerTab);
    }
  }

  if (activeDashboardId && saveState) dispatchSaveState();
}

export function deleteSourceWidgets(source: Source) {
  const { getWidgetsByAttributes, updateWidget } = useAppStore.getState();

  if (!source) return;

  const selectedWidgets = getWidgetsByAttributes({
    sourceId: source.id,
    sourceName: source.name,
    ...(source.isSharedSource && { isSharedWidget: true }),
  });

  for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
    for (const widget of widgets) {
      updateWidget(dashId, {
        ...widget,
        endpoint: { url: "", method: "GET" },
      });
    }
  }
}

export function updateWidgetsSourceId(
  sourceId: string,
  prevSourceId: string,
  locationHref: URL,
) {
  const { getWidgetsByAttributes, updateWidget } = useAppStore.getState();

  const selectedWidgets = getWidgetsByAttributes({ sourceId: prevSourceId });

  for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
    for (const widget of widgets) {
      if (locationHref && widget.endpoint) {
        widget.endpoint = patchSnowflakeEndpoint(widget.endpoint, locationHref);
      }
      updateWidget(dashId, { ...widget, sourceId });
    }
  }
}

export function patchSnowflakeEndpoint<T extends string | WidgetT["endpoint"]>(
  endpoint: T,
  locationHref: URL,
): T {
  if (!(locationHref && inSnowflakeNativeApp && !import.meta.env.DEV)) return endpoint;

  try {
    const updateUrl = (value: string) => {
      if (!value?.includes("snowflakecomputing")) return value;

      const url = new URL(value);
      if (url.origin !== locationHref.origin) {
        locationHref.pathname = url.pathname;
        return locationHref.toString();
      }
      return value;
    };

    if (typeof endpoint === "string") {
      endpoint = updateUrl(endpoint) as T;
    } else if (typeof endpoint === "object" && endpoint.url) {
      endpoint.url = updateUrl(endpoint.url);
    }
  } catch (error) {
    console.error("Error patching Snowflake endpoint:", error);
  }
  return endpoint;
}

export function patchSnowflakeWidgetsEndpoint<T extends WidgetType | WidgetT>(
  widgets: T[],
  locationHref: URL,
): T[] {
  if (!(locationHref && inSnowflakeNativeApp && !import.meta.env.DEV)) return widgets;

  for (const widget of widgets) {
    widget.endpoint = patchSnowflakeEndpoint(widget.endpoint, locationHref);
  }

  return widgets;
}

/**
 * Patches widgets and user apps to reference the correct Snowflake API Source for an entity,
 * and removes any duplicate non-entity Snowflake API Sources.
 *
 * This function addresses legacy deployments where multiple Snowflake API Sources may exist for users
 * within the same entity. It updates all widgets and user apps that reference non-entity sources to use
 * the entity-level source, and deletes the obsolete sources.
 *
 * Workflow:
 * 1. Identifies the entity-level Snowflake API Source and collects IDs of other sources.
 * 2. Finds all widget metadata referencing non-entity sources and updates their `sourceId` to the entity source.
 * 3. Updates widgets in user apps to reference the entity source instead of non-entity sources.
 * 4. Deletes the obsolete non-entity Snowflake API Sources.
 *
 * Errors during patching or deletion are logged to the console.
 *
 * @param apiSources - Array of API sources associated with the user, including entity and non-entity sources.
 * @param metadataWidgets - Array of widget metadata responses to check for references to non-entity sources.
 * @returns A promise that resolves to an array containing only the entity-level API source after patching.
 */
export async function patchSnowflakeSourceId(
  apiSources: Source[],
  metadataWidgets: WidgetMetadataResponse[],
  locationHref: URL,
) {
  const { entitySource, otherSourceIds } = apiSources.reduce(
    (acc, source) => {
      if (source.isEntityBackend && !acc.entitySource) acc.entitySource = source;
      else if (source.name === "Snowflake") acc.otherSourceIds.push(source.id!);
      return acc;
    },
    { entitySource: null as Source | null, otherSourceIds: [] as string[] },
  );

  if (!entitySource || otherSourceIds.length === 0) return apiSources;

  const widgetMetadata = metadataWidgets.filter(
    (w) => w.widgetConfig?.sourceId && otherSourceIds.includes(w.widgetConfig.sourceId),
  );

  for (const item of widgetMetadata) {
    const widgetConfig = {
      ...item.widgetConfig,
      sourceId: entitySource.id,
    };
    if (widgetConfig.endpoint) {
      widgetConfig.endpoint = patchSnowflakeEndpoint(
        widgetConfig.endpoint,
        locationHref,
      );
    }
    await patchWidgetMetadata({ widgetConfig }, item.widgetId).catch((err) => {
      console.error(
        `Failed to update widget metadata for widget ${item.widgetId}: ${err.message}`,
      );
    });
  }

  const { userApps, editUserApp } = useUserAppsStore.getState();

  for (const sourceId of otherSourceIds) {
    updateWidgetsSourceId(entitySource.id!, sourceId, locationHref);
    for (const [appId, app] of Object.entries(userApps)) {
      let hasWidget = false;
      for (const widget of app.content.widgets) {
        if (widget.sourceId === sourceId) {
          widget.sourceId = entitySource.id!;
          if (widget.endpoint) {
            widget.endpoint = patchSnowflakeEndpoint(widget.endpoint, locationHref);
          }
          hasWidget = true;
        }
      }
      if (!hasWidget) continue;

      const widgets = cloneDeep(app.content.widgets);
      await editUserApp(appId, { widgets }).catch((err) => {
        console.error(
          `Failed to update user app ${app.content.name} (${appId}): ${err.message}`,
        );
      });
    }

    await deleteApiSource(sourceId).catch((err) => {
      console.error(`Failed to delete source ${sourceId}: ${err.message}`);
    });
  }

  const { getWidgetsByAttributes, updateWidget } = useAppStore.getState();

  const selectedWidgets = getWidgetsByAttributes({ sourceName: "Snowflake" });

  for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
    for (const widget of widgets) {
      if (locationHref && widget.endpoint?.url?.includes("snowflakecomputing")) {
        const endpoint = patchSnowflakeEndpoint(widget.endpoint, locationHref);
        if (endpoint?.url !== widget.endpoint?.url) updateWidget(dashId, { ...widget });
      }
    }
  }

  return [entitySource];
}
