import { useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { isTruthyRecord } from "~/components/General/Table/utils";
import type { ParamDef, WidgetT } from "~/components/types";
import { createCopilotDataWidget } from "~/components/Widgets/Helpers/useCopilotDataWidget";
import { BLOCKED_WIDGET_IDS } from "~/lib/constants";
import { getIframeWidget } from "~/lib/iframeWidgetRegistry";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type Source,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import { type CopilotWidget, useShallowCopilotStore } from "~/lib/state/copilot";
import {
  type CopilotWidgetRuntimeState,
  useShallowCopilotDataStore,
} from "~/lib/state/copilotData";
import {
  createParamDefs,
  currentDateModifier,
  getJsonWidget,
  getWidgetDataSource,
  getWidgetInfo,
} from "~/lib/utils";
import { type DashboardInfoT, getDashboardInfo } from "~/lib/utils/workspaceDashboard";
import type { WorkspaceStateT } from "./useAiFetchRequestInit";
import { useShallowAppWidgetsStore } from "./useGetAppWidgets";
import { useShallowStreamingStore } from "./useStreaming";
import { useTextSuggestions } from "./useTextSuggestions";
import {
  useSyncWidgetsInCurrentDashboard,
  useWidgetsInCurrentDashboard,
} from "./useWidgetsInCurrentDashboard";
import { getWidgetOrigin } from "./utils";

const toFeatureKeys = (features: any): Record<string, boolean> => {
  if (!features || typeof features !== "object") return {};
  try {
    return Object.fromEntries(
      Object.entries(features).map(([k, v]) => [
        k,
        typeof v === "boolean" ? v : typeof v === "object",
      ]),
    );
  } catch {
    return {};
  }
};

export function useGetCopilotWidgets() {
  const { id: currentDashboardId = "" } = useParams();
  const [searchParams] = useSearchParams();

  const lastInnerTab = useShallowAppStore(
    (state) => state.getLastInnerTab(currentDashboardId) || "",
  );

  const getApiSourceById = useShallowBackendConnectorStore(
    (state) => state.getApiSourceById,
  );

  const getSideBarItem = useShallowAppStore((state) => state.getSideBarItem);

  const lastVisitedPage = useShallowAuthStore((state) => state.lastVisitedPage);

  const files = useShallowStreamingStore((state) => state.files);

  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  // Determine current page context
  const pageContext = useMemo(() => {
    if (currentDashboardId) return "dashboard";
    const pathName = lastVisitedPage?.replace(/(\/app\/).*?|(\/)/, "");
    switch (pathName) {
      case "app":
      case "prompts":
      case "widgets":
        return `${pathName}_library`;
      case "templates":
      case "settings":
        return pathName;
      default:
        return "other";
    }
  }, [lastVisitedPage, currentDashboardId]);

  // widgets are the selected widgets when adding to copilot
  // getDashboardWidgetData contain all the widgets with data filled in a dashboard
  const {
    selectedWidgetIDs: selectedWidgetUUIDs,
    getDashboardWidgetData,
    getDashboardWidgetsData,
    getWidgetRuntimeState,
    getWidgetsInCurrentDashboard,
    widgetsLastUpdated,
    widgetSubsetData,
    setCopilotWidgets,
    currentSelectedWidgets,
  } = useShallowCopilotDataStore((state) => ({
    selectedWidgetIDs: state.selectedWidgetIDs,
    getDashboardWidgetData: state.getDashboardWidgetData,
    getDashboardWidgetsData: state.getDashboardWidgetsData,
    getWidgetRuntimeState: state.getWidgetRuntimeState,
    widgetSubsetData: state.widgetSubsetData,
    widgetsLastUpdated: state.widgetsLastUpdated,
    getWidgetsInCurrentDashboard: state.getWidgetsInCurrentDashboard,
    setCopilotWidgets: state.setCopilotWidgets,
    currentSelectedWidgets: state.copilotWidgets?.selectedWidgets || [],
  }));

  const {
    selectedCopilot,
    agentOrchestrationMap,
    orchestrationModeEnabled,
    externalCopilotHolders,
    actionHistory,
    chatMessages,
  } = useShallowCopilotStore((s) => ({
    selectedCopilot: s.selectedCopilot,
    chatMessages: s.getCurrentChat()?.messages,
    getCurrentChat: s.getCurrentChat,
    getCurrentChatArtifacts: s.getCurrentChatArtifacts,
    orchestrationModeEnabled: s.orchestrationModeEnabled,
    agentOrchestrationMap: s.agentOrchestrationMap,
    externalCopilotHolders: s.externalCopilotHolders,
    actionHistory: s.actionHistory,
  }));

  const getDashboardWidgetByUuid = useWidgetsInCurrentDashboard();

  const { getAppWidget, lastUpdated, getAllAppWidgets } = useShallowAppWidgetsStore(
    (s) => ({
      lastUpdated: s.lastUpdated,
      getAppWidget: s.getAppWidget,
      getAllAppWidgets: s.getAllAppWidgets,
    }),
  );

  const selectedWidgets = useMemo((): CopilotWidget[] => {
    if (!selectedCopilot?.features?.["widget-dashboard-select"]) return [];

    const persistentWidgets = selectedWidgetUUIDs
      .map((uuid) => {
        const dashboardWidgetData = getDashboardWidgetData(uuid);
        if (!dashboardWidgetData) return null;

        // Check if this is a tab widget (pseudo-widget)
        if (dashboardWidgetData?.metadata?.widgetId?.startsWith?.("tab_")) {
          // For tab widgets, we need to populate the tabWidgets metadata properly
          const metadata = dashboardWidgetData.metadata || {};
          const widgetIds = (metadata.widgetIds || []) as string[];

          // Get the actual dashboard widgets for this tab
          // Convert dashboard widgets to CopilotWidget format
          const tabWidgets = widgetIds
            .map((widgetId: string) => {
              const widget = getDashboardWidgetByUuid(widgetId);
              if (!widget || widget?.widgetId === "navigation_bar") return null;
              return createCopilotWidget(
                widget.id,
                widget,
                dashboardWidgetData.metadata ?? {},
                getWidgetRuntimeState(widget.id),
              );
            })
            .filter(Boolean);

          // TODO: This should use the createCopilotWidget function
          return {
            origin: "OpenBB Workspace",
            widget_id: dashboardWidgetData.metadata.widgetId,
            uuid: uuid,
            name:
              dashboardWidgetData.title || dashboardWidgetData.metadata.name || "Tab",
            description:
              dashboardWidgetData.description || "Tab containing multiple widgets",
            params: [],
            metadata: {
              ...dashboardWidgetData.metadata,
              tabWidgets: tabWidgets,
            },
          };
        }

        // For regular widgets, use the existing logic
        const widget = getDashboardWidgetByUuid(uuid);
        if (!widget) return null;
        // Skip navigation_bar widgets as they shouldn't be available for @ mentions
        if (widget?.widgetId === "navigation_bar") return null;
        // Skip widgets without proper identification
        if (!(widget?.widgetId || widget?.id)) return null;
        return createCopilotWidget(
          uuid,
          widget,
          dashboardWidgetData.metadata ?? {},
          getWidgetRuntimeState(uuid),
        );
      })
      .filter(Boolean) as CopilotWidget[];

    // Find temporary text mention tabs that aren't in selectedWidgetIDs
    const temporaryTabs = currentSelectedWidgets.filter(
      (widget) =>
        widget?.widget_id?.startsWith("tab_") &&
        !selectedWidgetUUIDs.includes(widget.uuid),
    );

    // Merge persistent widgets with temporary tabs
    return [...persistentWidgets, ...temporaryTabs];
  }, [
    selectedCopilot,
    selectedWidgetUUIDs,
    widgetsLastUpdated,
    getWidgetsInCurrentDashboard,
    getDashboardWidgetData,
    getDashboardWidgetByUuid,
    getWidgetRuntimeState,
    currentSelectedWidgets,
  ]);

  const workspaceAgents = useMemo(() => {
    if (!orchestrationModeEnabled) return [] as NonNullable<WorkspaceStateT["agents"]>;
    return externalCopilotHolders
      .flatMap((holder) => {
        if (holder.enabled === false) return [];
        return (holder.copilots || []).map((agent) => {
          const data = {
            holder_url: selectedCopilot?.id === agent.id ? "local" : holder.url,
            id: agent.id,
            name: agent.name,
            description: agent.description,
            // Convert record of booleans/objects into a list of feature keys
            features: toFeatureKeys(agent.features),
          };
          if (
            selectedCopilot?.id === agent.id ||
            agentOrchestrationMap[holder.uuid]?.includes(agent.id)
          )
            return data;
        });
      })
      .filter(Boolean) as NonNullable<WorkspaceStateT["agents"]>; // Filter out any undefined values
  }, [
    externalCopilotHolders,
    agentOrchestrationMap,
    selectedCopilot?.id,
    orchestrationModeEnabled,
  ]);

  const state = useMemo(() => {
    const defaultOutput = {
      dashboardWidgets: [] as CopilotWidget[],
      allDashboardWidgets: [] as CopilotWidget[],
      workspaceState: {
        action_history: actionHistory,
        agents: workspaceAgents,
        current_dashboard_uuid: pageContext === "dashboard" ? currentDashboardId : null,
        current_dashboard_info: null,
        current_page_context: pageContext,
      } as WorkspaceStateT,
    };

    if (!selectedCopilot?.features?.["widget-dashboard-select"]) return defaultOutput;

    const dashboardWidgetsData = getDashboardWidgetsData() || {};
    const allWidgetsInDashboard = getWidgetsInCurrentDashboard() as WidgetT[];

    if (!allWidgetsInDashboard) return defaultOutput;

    const result = allWidgetsInDashboard.reduce((acc, w) => {
      const uuid = w.id;
      if (!uuid) return acc;

      let widgetData = dashboardWidgetsData[uuid];

      let schema: Source["schemas"][string] | undefined;
      if (w?.sourceId && w?.schemaName) {
        const apiSource = getApiSourceById(w.sourceId);
        schema = apiSource?.schemas?.[w?.schemaName];
      }

      // If widget is not in the copilot data, create a basic entry.
      //
      // Deliberately NOT skipped for the current tab. The `|| w.innerTab ===
      // innerTab` short-circuit that used to live here assumed a visible widget
      // always has data by now, so synthesizing one would be wasted work. That
      // holds in steady state and fails during load: until a current-tab widget
      // populates `dashboardWidgetsData`, it has no entry, and the
      // `if (!widgetData) return acc;` below then drops it from the payload
      // entirely — while the SAME widget on a background tab survives, because
      // it got a placeholder. The agent's `workspace_state` is built separately
      // and still advertises the dropped widget's uuid, so the model asks for a
      // widget the payload cannot resolve.
      if (!widgetData) {
        widgetData = createCopilotDataWidget({
          widget: w,
          widgetSource: getWidgetDataSource(w),
        });
      }

      if (schema) {
        widgetData = {
          ...widgetData,
          metadata: { ...widgetData?.metadata, schema },
        };
      }

      if (
        w?.disableRetrievalForCopilot ||
        !(w?.widgetId || w?.id) ||
        (BLOCKED_WIDGET_IDS.has(w.widgetId) && !w.external) ||
        w?.widgetId === "navigation_bar"
      )
        return acc;

      // Get widget data if available, otherwise use empty metadata
      if (!widgetData) return acc;

      // Built-in widgets will have the most updated widget params schema
      // Stored widgets will have the schema from when they were created
      const builtInWidget = w?.widgetId ? getAppWidget(w?.widgetId) : null;
      const finalWidget = { ...w, ...(builtInWidget?.params ?? {}) } as WidgetT;
      const copilotWidget = createCopilotWidget(
        uuid,
        finalWidget,
        widgetData?.metadata ?? {},
        getWidgetRuntimeState(uuid),
      );

      if (!copilotWidget) return acc;

      // Expand iframe sub-widgets: if the parent has a bridge with a manifest,
      // create synthetic CopilotWidgets for each sub-widget instead of the parent.
      const bridge = getIframeWidget(uuid);
      if (bridge && bridge.manifest.length > 0) {
        for (const entry of bridge.manifest) {
          const compositeId = `${uuid}::iframe::${entry.widgetId}`;
          const subWidget: CopilotWidget = {
            origin: "OpenBB Workspace",
            widget_id: compositeId,
            uuid: compositeId,
            name: entry.name,
            description: entry.description ?? "",
            params: [],
            metadata: {
              dataType: entry.dataType,
              parentIframeUuid: uuid,
            },
          };
          acc.allDashboardWidgets.push(subWidget);
          if (!w.innerTab || w.innerTab === innerTab) {
            acc.dashboardWidgets.push(subWidget);
          }
        }
        return acc;
      }

      acc.allDashboardWidgets.push(copilotWidget);
      if (!w.innerTab || w.innerTab === innerTab) {
        acc.dashboardWidgets.push(copilotWidget);
      }

      return acc;
    }, defaultOutput);

    let currentDashboardInfo = null as DashboardInfoT;
    const currentDashboard = getSideBarItem(currentDashboardId);
    if (pageContext === "dashboard" && currentDashboard?.data) {
      currentDashboardInfo = getDashboardInfo(currentDashboardId, innerTab);
    }

    result.workspaceState.current_dashboard_info = currentDashboardInfo;

    return result;
  }, [
    innerTab,
    getDashboardWidgetsData,
    getWidgetsInCurrentDashboard,
    widgetsLastUpdated,
    getDashboardWidgetByUuid,
    selectedCopilot,
    widgetSubsetData,
    getAppWidget,
    lastUpdated,
    currentDashboardId,
    getSideBarItem,
    pageContext,
    actionHistory,
    workspaceAgents,
    getApiSourceById,
    getWidgetRuntimeState,
  ]);

  const temporaryWidgets = useMemo((): CopilotWidget[] => {
    if (!selectedCopilot?.features?.["file-upload"]) return [];

    // Files still in the composer, plus files already sent with a message in this chat,
    // so an attachment stays available for the rest of the conversation.
    const messageFiles =
      chatMessages?.flatMap((message) =>
        message.role === "human" ? (message.files ?? []) : [],
      ) ?? [];

    const seen = new Set<string>();
    const widgets: CopilotWidget[] = [];

    for (const file of [...files, ...messageFiles]) {
      const uuid = file.stored_file_uuid;
      if (file.status !== "uploaded" || !uuid || seen.has(uuid)) continue;
      seen.add(uuid);

      widgets.push({
        origin: "OpenBB Hub",
        widget_id: `file-${uuid}`,
        name: file.name,
        description: file.description,
        params: [],
        metadata: { extension: file.url?.split(".")?.pop() },
      } as CopilotWidget);
    }

    return widgets;
  }, [files, chatMessages, selectedCopilot]);

  const allWidgets = useMemo((): CopilotWidget[] => {
    if (!selectedCopilot?.features?.["widget-dashboard-search"]) return [];
    return getAllAppWidgets()
      .filter((w) => !w.disableRetrievalForCopilot)
      .map((w) => {
        const metadata = w.metadata || {};
        if (w?.sourceId && w?.schemaName) {
          const apiSource = getApiSourceById(w.sourceId);
          metadata.schema = apiSource?.schemas?.[w?.schemaName];
        }

        return createCopilotWidget(undefined, w, metadata);
      })
      .filter(Boolean) as CopilotWidget[];
  }, [getAllAppWidgets, getApiSourceById, lastUpdated, selectedCopilot]);

  useTextSuggestions(selectedWidgets, state.dashboardWidgets);

  useEffect(() => {
    setCopilotWidgets({
      selectedWidgets,
      temporaryWidgets,
      allWidgets,
      ...state,
    });
  }, [selectedWidgets, state, temporaryWidgets, allWidgets]);

  useSyncWidgetsInCurrentDashboard();
}

const getOptionsParams = (
  optionsParams: Record<string, string>,
  widgetParams: ParamDef[],
): Record<string, string>[] => {
  return Object.entries(optionsParams)
    .map(([key, value]) => {
      if (value?.toString()?.startsWith("$")) {
        const queryKey = value.slice(1);
        const param = widgetParams.find((p) => p.paramName === queryKey);
        if (param) {
          return {
            name: key,
            type: param.type ?? "text",
            description: param.description ?? "",
            inherit_value_from: queryKey,
          };
        }
      }
    })
    .filter(Boolean) as Record<string, string>[];
};

export function createCopilotWidget(
  uuid: string | undefined,
  widget: WidgetT,
  metadata?: Record<string, any>,
  runtimeState?: CopilotWidgetRuntimeState,
): CopilotWidget | null {
  try {
    // Early validation - ensure widget has basic required properties
    if (!widget) throw new Error("Widget is null or undefined");
    if (!(widget.widgetId || widget.id || uuid)) {
      throw new Error(
        `Widget missing identification: widgetId=${widget.widgetId}, id=${widget.id}, uuid=${uuid}`,
      );
    }

    const origin = getWidgetOrigin(widget);
    if (!origin) throw new Error(`Widget origin not found: ${widget}`);
    // For some reason the widgetId doesn't contain a uuid for widgets from the workspace
    // such as rich notes
    const widgetId = origin === "OpenBB Workspace" && uuid ? uuid : widget.widgetId;
    if (!widgetId)
      throw new Error(
        `Widget id not found: id -> ${widget.id}, widgetId -> ${widget.widgetId}, uuid -> ${uuid}`,
      );
    const widgetName = widget.name;
    if (!widgetName) throw new Error(`Widget name not found: ${widget}`);
    const defaultParams = createParamDefs(getJsonWidget(widget) as WidgetT);
    const {
      params: currentParams = undefined,
      options: currentOptions = undefined,
      columns = undefined,
      param_sync: _omit = undefined,
      ...widgetMetadata
    } = metadata ?? {};

    const { copilotDraftParams, copilotExecutedParams } = runtimeState || {};
    const runtimeDraftParams = isTruthyRecord(copilotDraftParams) && copilotDraftParams;
    const runtimeExecutedParams =
      isTruthyRecord(copilotExecutedParams) && copilotExecutedParams;

    const widgetInfo = getWidgetInfo(widget);
    const source = Array.isArray(widgetInfo.source)
      ? widgetInfo.source[0]
      : widgetInfo.source;

    const params = defaultParams
      // Temporarily remove form params from copilot
      .filter((param: ParamDef) => param.type !== "form")
      .map((param: ParamDef) => {
        const defaultValue = param.value;
        const currentParamValue =
          runtimeDraftParams?.[param.paramName] ?? currentParams?.[param.paramName];
        const executedParamValue = runtimeExecutedParams?.[param.paramName];
        const currentOptionsValue = currentOptions?.[param.paramName];
        const output = {
          name: param.paramName,
          type: param.type ?? "text",
          description: param.description ?? "",
          default_value:
            defaultValue && param.type === "date"
              ? currentDateModifier(defaultValue as string)
              : defaultValue,
          current_value:
            currentParamValue && param.type === "date"
              ? currentDateModifier(currentParamValue as string)
              : currentParamValue,
          executed_value:
            executedParamValue && param.type === "date"
              ? currentDateModifier(executedParamValue as string)
              : executedParamValue,
          options: (currentOptionsValue ?? param.options ?? []).map(
            (option: { label: string; value: string }) =>
              typeof option.value === "string"
                ? option.value
                : JSON.stringify(option.value),
          ),
          get_options:
            param.type === "endpoint" ? Boolean(param.optionsEndpoint) : undefined,
          options_params:
            param.type === "endpoint" && param.optionsParams
              ? getOptionsParams(param.optionsParams, defaultParams)
              : undefined,
          multi_select: param.multiSelect,
          split_param_on_citation: param.roles?.includes("fileSelector") ?? undefined,
        } as CopilotWidget["params"][0];

        if (param.type === "text" && param.language) output.language = param.language;

        return output;
      });
    return {
      origin: origin,
      widget_id: widgetId,
      uuid: uuid,
      name: widgetName,
      description: widget.description ?? "",
      source: source,
      category: widgetInfo.category,
      sub_category: widgetInfo.subCategory,
      columns: columns,
      params: params ?? [],
      metadata: widgetMetadata ?? {},
    };
  } catch (error) {
    if (import.meta.env.DEV) console.error("Error creating copilot widget", error);
    return null;
  }
}
