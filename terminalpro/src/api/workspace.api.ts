import type { Layout } from "react-grid-layout";
import {
  applyChartViewToWidget,
  type ChartViewIntent,
} from "~/components/AI/hooks/createWidgetUtils";
import { useGetWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import { getWidgetOrigin } from "~/components/AI/hooks/utils";
import type { Ticker, WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import { useAppStore } from "~/lib/state/app";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { tickersStore } from "~/lib/state/tickers";
import { triggerCustomEvent } from "~/lib/utils";
import {
  deserializeDashboardTabId,
  getDashboardInfo,
} from "~/lib/utils/workspaceDashboard";

type WidgetConfig = {
  dataArgs?: Record<string, any>;
  uiArgs?: Record<string, any>;
};

type DashboardConfig = {
  name: string;
};

type DashboardLayoutConfig = {
  tabId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

const GRID_COLUMN_COUNT = 40;

function getNumericConstraint(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return undefined;
}

function assertGridInteger(name: string, value: number, minimum: number) {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
}

function validateDashboardLayout(
  widget: WidgetT,
  existingGridData: Record<string, unknown>,
  config: DashboardLayoutConfig,
) {
  assertGridInteger("x", config.x, 0);
  assertGridInteger("y", config.y, 0);
  assertGridInteger("w", config.w, 1);
  assertGridInteger("h", config.h, 1);

  if (config.x + config.w > GRID_COLUMN_COUNT) {
    throw new Error(
      `Widget layout must fit inside the ${GRID_COLUMN_COUNT}-column grid: x + w must be <= ${GRID_COLUMN_COUNT}.`,
    );
  }

  const minW = getNumericConstraint(existingGridData.minW, widget.gridData?.minW);
  const minH = getNumericConstraint(existingGridData.minH, widget.gridData?.minH);
  const maxW = getNumericConstraint(
    existingGridData.maxW,
    widget.gridData?.maxW,
    GRID_COLUMN_COUNT,
  );
  const maxH = getNumericConstraint(existingGridData.maxH, widget.gridData?.maxH);

  if (minW !== undefined && config.w < minW) {
    throw new Error(`Widget width ${config.w} is below the minimum width ${minW}.`);
  }

  if (minH !== undefined && config.h < minH) {
    throw new Error(`Widget height ${config.h} is below the minimum height ${minH}.`);
  }

  if (maxW !== undefined && config.w > maxW) {
    throw new Error(`Widget width ${config.w} exceeds the maximum width ${maxW}.`);
  }

  if (maxH !== undefined && config.h > maxH) {
    throw new Error(`Widget height ${config.h} exceeds the maximum height ${maxH}.`);
  }
}

/**
 * Create a new dashboard in the local Workspace session.
 * @param dashboardId The dashboard identifier.
 * @param config Dashboard configuration.
 * @throws If dashboard already exists or creation fails.
 */
function createDashboard(dashboardId: string, config: DashboardConfig): string {
  const appState = useAppStore.getState();
  if (appState.items?.[dashboardId]) {
    throw new Error(`Dashboard '${dashboardId}' already exists`);
  }

  appState.addTab({
    index: dashboardId,
    data: {
      name: config.name,
      type: "custom",
      widgets: [],
      groups: [],
      gridLayout: {},
    },
  });

  if (!useAppStore.getState().items?.[dashboardId]) {
    throw new Error(`Failed to create dashboard '${dashboardId}'`);
  }

  return dashboardId;
}

/**
 * Update light metadata for a dashboard.
 * @param dashboardId The dashboard identifier.
 * @param config Dashboard configuration.
 * @throws If dashboard does not exist.
 */
function updateDashboard(dashboardId: string, config: Partial<DashboardConfig>): void {
  const appState = useAppStore.getState();
  const dashboard = appState.items?.[dashboardId];
  if (!dashboard?.data) {
    throw new Error(
      `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
    );
  }

  appState.updateTabData(dashboardId, config);
}

function readDashboard(dashboardId: string, currentTab?: string | null) {
  const dashboard = getDashboardInfo(dashboardId, currentTab);
  if (!dashboard) {
    throw new Error(
      `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
    );
  }

  return dashboard;
}

function getDashboardWidgetOrThrow(dashboardId: string, widgetUuid: string): WidgetT {
  const appState = useAppStore.getState();
  const dashboard = appState.items?.[dashboardId];
  if (!dashboard?.data) {
    throw new Error(
      `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
    );
  }

  const widget = appState.getTabWidgetById(dashboardId, widgetUuid);
  if (!widget) {
    throw new Error(
      `Widget with UUID '${widgetUuid}' not found in dashboard '${dashboardId}'`,
    );
  }

  return widget;
}

function updateDashboardLayout(
  dashboardId: string,
  widgetUuid: string,
  config: DashboardLayoutConfig,
): void {
  const appState = useAppStore.getState();
  const dashboard = appState.items?.[dashboardId];
  if (!dashboard?.data) {
    throw new Error(
      `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
    );
  }

  const widget = getDashboardWidgetOrThrow(dashboardId, widgetUuid);

  const dashboardInfo = readDashboard(dashboardId);
  const targetTabId =
    config.tabId !== undefined
      ? deserializeDashboardTabId(config.tabId)
      : widget.innerTab || "";
  const serializedTargetTabId = config.tabId !== undefined ? config.tabId : undefined;
  if (
    serializedTargetTabId !== undefined &&
    !dashboardInfo.tabs.some((tab) => tab.tab_id === serializedTargetTabId)
  ) {
    throw new Error(
      `Tab '${serializedTargetTabId}' was not found on dashboard '${dashboardId}'`,
    );
  }

  const existingGridData = appState.getWidgetGridData(dashboardId, widgetUuid);
  if (!existingGridData) {
    throw new Error(
      `Widget with UUID '${widgetUuid}' has no grid layout on dashboard '${dashboardId}'`,
    );
  }

  validateDashboardLayout(widget, existingGridData as Record<string, unknown>, config);

  const nextGridData = {
    ...existingGridData,
    i: widgetUuid,
    x: config.x,
    y: config.y,
    w: config.w,
    h: config.h,
    ...(config.minW !== undefined ? { minW: config.minW } : {}),
    ...(config.minH !== undefined ? { minH: config.minH } : {}),
    ...(config.maxW !== undefined ? { maxW: config.maxW } : {}),
    ...(config.maxH !== undefined ? { maxH: config.maxH } : {}),
  };
  const { gridLayout } = dashboard.data as { gridLayout?: Record<string, Layout[]> };
  const sourceTabId = widget.innerTab || "";
  const targetLayout = [...(gridLayout?.[targetTabId] || [])].filter(
    (entry) => entry.i !== widgetUuid,
  );
  targetLayout.push(nextGridData);

  if (sourceTabId !== targetTabId) {
    const sourceLayout = [...(gridLayout?.[sourceTabId] || [])];
    appState.updateTabWidgetsLayout(
      dashboardId,
      sourceLayout.filter((entry) => entry.i !== widgetUuid),
      sourceTabId,
    );
  }

  appState.updateTabWidgetsLayout(dashboardId, targetLayout, targetTabId);
  appState.updateWidget(dashboardId, { ...widget, innerTab: targetTabId });
}

/**
 * Create a new widget instance on a dashboard.
 * @param dashboardId The dashboard identifier.
 * @param backendName The backend name.
 * @param widgetId The widget identifier.
 * @param config Widget configuration data.
 * @returns Promise resolving to the new widget's unique ID.
 * @throws If dashboard does not exist or creation fails.
 */
async function createWidget(
  dashboardId: string,
  backendName: string,
  widgetId: string,
  config: WidgetConfig,
): Promise<string> {
  const widgetDefinition = getWidgetDefinitionOrThrow(backendName, widgetId);
  const widget = updateWidgetState(widgetDefinition, config);
  // Clear the definition id so addWidget generates a fresh UUID
  // (definition ids like "income" are not valid UUIDs)
  const { id: _defId, ...rest } = widget;
  const id = await useAppStore.getState().addWidget(dashboardId, rest as WidgetT);
  if (!id) throw new Error("Failed to create widget");
  return id;
}

/**
 * Read a widget instance by ID.
 * @param dashboardId The dashboard identifier (uuid).
 * @param widgetUuid The widget instance identifier (uuid).
 * @returns Promise resolving to widget data.
 * @throws If dashboard or widget not found.
 */
function readWidget(
  dashboardId: string,
  widgetUuid: string,
): Record<string, any> | null {
  const widget = getDashboardWidgetOrThrow(dashboardId, widgetUuid);

  const origin = getWidgetOrigin(widget as WidgetT);
  // Applied data_args are persisted onto storage.params by updateWidgetState (the
  // create/update path); the params[] array only carries schema defaults. Prefer
  // the stored value so read_widget reflects what was actually applied.
  const storedParams = (widget.storage?.params ?? {}) as Record<string, any>;
  const resolveParamValue = (param: any) =>
    storedParams[param.paramName] ?? param.value;

  const dataArgs: Record<string, any> = {};
  if (Array.isArray(widget.params)) {
    for (const param of widget.params) {
      const value = resolveParamValue(param);
      if (param.paramName && value !== undefined && value !== null) {
        dataArgs[param.paramName] = value;
      }
    }
  }

  const result: Record<string, any> = {
    origin,
    widget_id: widget.widgetId,
    name: widget.name,
    description: widget.description,
    inner_tab: widget.innerTab,
    data_args: dataArgs,
    params: Array.isArray(widget.params)
      ? widget.params.map((p: any) => ({
          param_name: p.paramName,
          label: p.label ?? p.paramName,
          type: p.type,
          value: resolveParamValue(p) ?? null,
          description: p.description,
        }))
      : [],
  };

  // Include rendered data from copilot store if available. Generative notes
  // never populate that store — their (sanitized) body lives in storage.html,
  // so fall back to it or read_widget returns a note with no content.
  const widgetData = useCopilotDataStore.getState().getDashboardWidgetData(widgetUuid);
  if (widgetData?.data) {
    result.data = widgetData.data;
  } else if (typeof widget.storage?.html === "string") {
    result.data = widget.storage.html;
  }

  return result;
}

/**
 * Update an existing widget instance.
 * @param dashboardId The dashboard identifier.
 * @param widgetUuid The widget instance identifier (uuid).
 * @param config Updated widget configuration.
 * @returns Promise resolving to void.
 * @throws If dashboard or widget not found, or update fails.
 */
async function updateWidget(
  dashboardId: string,
  widgetUuid: string,
  config: WidgetConfig,
): Promise<void> {
  const widget = getDashboardWidgetOrThrow(dashboardId, widgetUuid);

  const tickerParam = widget.params?.find((p) => p.type === "ticker");
  let mainTicker: Ticker | undefined;
  if (tickerParam) {
    const tickerValue = config.dataArgs?.[tickerParam.paramName];
    if (tickerValue && tickerValue !== "null") {
      const symbol = String(tickerValue);
      const tickersObj = await tickersStore.getState().getOrQueryTickers(symbol);
      const tickers = Object.values(tickersObj);
      // Fix A: SDK widgets fetch by data.mainTicker.symbol (storage.params.symbol
      // is filtered out of the request and the query key), so mainTicker MUST
      // reflect the new symbol or the widget never refetches. When the lookup
      // returns nothing (e.g. a transient /symbols failure), fall back to a
      // minimal ticker from the raw value instead of leaving mainTicker stale.
      mainTicker =
        tickers?.length > 0
          ? tickers[0]
          : {
              ...(widget.data?.mainTicker ?? {}),
              id: symbol.replace(/[\^$]/g, ""),
              symbol,
              category: widget.data?.mainTicker?.category ?? "equity",
              type: widget.data?.mainTicker?.type ?? "stock",
            };
    }
  }

  const applyUpdate = (w: WidgetT) => {
    const updatedWidget = updateWidgetState(w, config);
    if (mainTicker) {
      updatedWidget.data = {
        ...updatedWidget.data,
        mainTicker,
      };
    }
    return updatedWidget;
  };

  const isNote = widget.type === "note" || widget.widgetId === "rich_note";

  // Fix B: persist the update directly to the store so widgets on inactive tabs
  // (not mounted, so no `updateWidget-` listener) still pick up the new ticker/
  // params. The DOM event alone silently misses them yet reports success.
  const persistedWidget = applyUpdate(widget);
  useAppStore.getState().updateWidget(dashboardId, persistedWidget);

  // Notify a mounted widget so it updates its live provider state and refetches
  // immediately (mounted widgets are the source of truth for their live query).
  const updateFn = (w: WidgetT) => {
    const updatedWidget = applyUpdate(w);
    triggerCustomEvent(
      `updateQueryParams-${widgetUuid}`,
      updatedWidget.storage?.params || {},
    );
    return updatedWidget;
  };
  triggerCustomEvent(`updateWidget-${widgetUuid}`, isNote ? persistedWidget : updateFn);

  if (import.meta.env.DEV) {
    console.debug("[AI updateWidget]", {
      widgetUuid,
      widgetId: widget.widgetId,
      isNote,
      newSymbol: mainTicker?.symbol,
      params: persistedWidget.storage?.params,
    });
  }
}

/**
 * Delete a widget instance from a dashboard.
 * @param dashboardId The dashboard identifier.
 * @param widgetUuid The widget instance identifier (uuid).
 * @returns Promise resolving to void.
 * @throws If dashboard or widget not found.
 */
async function deleteWidget(dashboardId: string, widgetUuid: string): Promise<void> {
  const appState = useAppStore.getState();
  getDashboardWidgetOrThrow(dashboardId, widgetUuid);
  appState.removeWidget(dashboardId, widgetUuid);

  if (useAppStore.getState().getTabWidgetById(dashboardId, widgetUuid)) {
    throw new Error(
      `Failed to delete widget with UUID '${widgetUuid}' from dashboard '${dashboardId}'`,
    );
  }
}

export {
  computeWidgetParamUpdates,
  computeWidgetUiUpdates,
  createDashboard,
  createWidget,
  deleteWidget,
  getWidgetDefinitionOrThrow,
  readDashboard,
  readWidget,
  updateDashboard,
  updateDashboardLayout,
  updateWidget,
};

// Only allow known grid layout keys with numeric values to prevent arbitrary data leaking onto gridData
const GRID_DATA_KEYS = new Set(["w", "h", "x", "y", "minW", "minH", "maxW", "maxH"]);

/**
 * Resolve a widget definition from the widget library, throwing the same
 * recovery-hint error createWidget surfaces when the origin/widget_id pair is
 * unknown. Shared by the real create path and the dry-run path.
 */
function getWidgetDefinitionOrThrow(backendName: string, widgetId: string): WidgetT {
  const widgetDefinition = useGetWidgetsStore
    .getState()
    .getAppWidget(widgetId as WidgetId, backendName);
  if (!widgetDefinition)
    throw new Error(
      `Widget '${widgetId}' not found in '${backendName}'. Call list_available_widgets to get valid origin/widget_id pairs.`,
    );
  return widgetDefinition;
}

/**
 * Pure param-merge rule shared by the real mutation path (updateWidgetState)
 * and the dry-run path: copy dataArgs values for declared params, skipping
 * unset sentinels (undefined/null/"null") — falsy values like false, 0, and ""
 * are valid param values and must be applied. dataArgs keys the widget does
 * not declare are collected as droppedKeys.
 */
function computeWidgetParamUpdates(
  paramsDef: WidgetT["params"] | null | undefined,
  dataArgs: Record<string, unknown> | null | undefined,
): { params: Record<string, unknown>; droppedKeys: string[] } {
  const params: Record<string, unknown> = {};
  const defs = Array.isArray(paramsDef) ? paramsDef : [];
  const args = dataArgs ?? {};

  const declared = new Set<string>();
  for (const paramDef of defs) {
    const paramName = paramDef.paramName;
    if (typeof paramName === "string" && paramName.length > 0) {
      declared.add(paramName);
    }
    const paramValue = args[paramName];
    // Only drop unset values; falsy values like false, 0, and "" are valid
    // param values and must be applied.
    if (paramValue !== undefined && paramValue !== null && paramValue !== "null") {
      params[paramName] = paramValue;
    }
  }

  const droppedKeys = Object.keys(args).filter((key) => !declared.has(key));
  return { params, droppedKeys };
}

/**
 * Pure ui_args rule shared by updateWidgetState and the dry-run path: name,
 * description, and source belong on the widget itself; every other key is
 * written to widget storage. Unset sentinels (undefined/null/"null") are
 * skipped.
 */
function computeWidgetUiUpdates(uiArgs: Record<string, unknown> | null | undefined): {
  name?: string;
  description?: string;
  source?: string | string[];
  storage: Record<string, unknown>;
} {
  const updates: {
    name?: string;
    description?: string;
    source?: string | string[];
    storage: Record<string, unknown>;
  } = { storage: {} };

  for (const [key, value] of Object.entries(uiArgs ?? {})) {
    if (value !== undefined && value !== null && value !== "null") {
      if (key === "name") {
        updates.name = value as string;
      } else if (key === "description") {
        updates.description = value as string;
      } else if (key === "source") {
        updates.source = value as string | string[];
      } else {
        updates.storage[key] = value;
      }
    }
  }

  return updates;
}

function updateWidgetState(widget: WidgetT, config: WidgetConfig): WidgetT {
  const { params: newParams } = computeWidgetParamUpdates(
    widget.params,
    config.dataArgs,
  );

  // Handle UI args for storage properties (like html content for rich_note)
  const uiUpdates = computeWidgetUiUpdates(config.uiArgs);
  const newStorage = uiUpdates.storage;
  const widgetName = uiUpdates.name ?? widget.name;
  const widgetDescription = uiUpdates.description ?? widget.description;
  const widgetSource = uiUpdates.source ?? widget.source;

  // Extract widget-level overrides from storage — they belong on the widget, not in storage
  const {
    gridData: gridDataOverride,
    innerTab: innerTabOverride,
    chartView: chartViewOverride,
    ...restStorage
  } = newStorage;
  const validGridData =
    gridDataOverride &&
    typeof gridDataOverride === "object" &&
    !Array.isArray(gridDataOverride);

  const sanitizedGridData = validGridData
    ? Object.fromEntries(
        Object.entries(gridDataOverride as Record<string, unknown>).filter(
          ([k, v]) =>
            GRID_DATA_KEYS.has(k) && typeof v === "number" && Number.isFinite(v),
        ),
      )
    : null;

  let updatedWidget = {
    ...widget,
    storage: {
      ...widget.storage,
      ...restStorage,
      params: {
        ...(widget.storage?.params ?? {}),
        ...newParams,
      },
    },
    ...(sanitizedGridData && Object.keys(sanitizedGridData).length > 0
      ? { gridData: { ...widget.gridData, ...sanitizedGridData } }
      : {}),
    ...(typeof innerTabOverride === "string" ? { innerTab: innerTabOverride } : {}),
    name: widgetName,
    description: widgetDescription,
    source: widgetSource,
  };

  if (
    chartViewOverride &&
    typeof chartViewOverride === "object" &&
    !Array.isArray(chartViewOverride)
  ) {
    updatedWidget = applyChartViewToWidget(
      updatedWidget,
      chartViewOverride as ChartViewIntent,
    );
  }

  return updatedWidget;
}
