import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useActiveWorkspaceDashboardId } from "~/components/AI/hooks/useActiveWorkspaceDashboardId";
import type { WorkspaceStateT } from "~/components/AI/hooks/useAiFetchRequestInit";
import { ALL_AI_FEATURES } from "~/lib/constants";
import { useAppStore } from "~/lib/state/app";
import { useAuthStore } from "~/lib/state/auth";
import { useCopilotStore } from "~/lib/state/copilot";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { useSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import type { DashboardInfoT } from "~/lib/utils/workspaceDashboard";
import {
  getDashboardInfo,
  serializeDashboardTabId,
} from "~/lib/utils/workspaceDashboard";

function toFeatureKeys(features: unknown): Record<string, boolean> {
  if (!features || typeof features !== "object") return {};

  try {
    return Object.fromEntries(
      Object.entries(features).map(([key, value]) => [
        key,
        typeof value === "boolean" ? value : typeof value === "object",
      ]),
    );
  } catch {
    return {};
  }
}

function getPageContext(
  lastVisitedPage: string | undefined,
  currentDashboardId: string,
) {
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
}

function getDashboardTabCount(item: Record<string, any>) {
  const widgets = Array.isArray(item.data?.widgets) ? item.data.widgets : [];
  const gridLayout = item.data?.gridLayout || {};
  const navBarWidget = widgets.find(
    (widget: Record<string, unknown>) => widget.widgetId === "navigation_bar",
  );
  const navBarTabs = Array.isArray(navBarWidget?.storage?.tabs)
    ? (navBarWidget.storage.tabs as { id: string; name: string }[])
    : [];
  const tabIds = new Set<string>();

  for (const tab of navBarTabs) {
    tabIds.add(serializeDashboardTabId(tab.id));
  }

  for (const widget of widgets) {
    tabIds.add(serializeDashboardTabId(widget.innerTab));
  }

  for (const tabId of Object.keys(gridLayout)) {
    tabIds.add(serializeDashboardTabId(tabId));
  }

  if (tabIds.size === 0) {
    tabIds.add(serializeDashboardTabId(item.data?.currentTab));
  }

  return tabIds.size;
}

export function useWorkspaceBridgeSnapshot() {
  const currentDashboardId = useActiveWorkspaceDashboardId();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "";

  return useCallback(() => {
    const appState = useAppStore.getState();
    const authState = useAuthStore.getState();
    const copilotState = useCopilotStore.getState();
    const copilotDataState = useCopilotDataStore.getState();
    const mcpToolsState = useMcpToolsStore.getState();
    const skillsLibraryState = useSkillsLibraryStore.getState();

    const innerTab = currentTab || appState.getLastInnerTab(currentDashboardId) || "";
    const pageContext = getPageContext(authState.lastVisitedPage, currentDashboardId);

    const workspaceAgents = copilotState.orchestrationModeEnabled
      ? copilotState.externalCopilotHolders
          .filter((holder) => holder.enabled !== false)
          .flatMap((holder) =>
            (holder.copilots || []).map((agent) => {
              if (copilotState.agentOrchestrationMap[holder.uuid]?.includes(agent.id)) {
                return {
                  holder_url: holder.url,
                  id: agent.id,
                  name: agent.name,
                  description: agent.description,
                  features: toFeatureKeys(agent.features),
                };
              }

              if (copilotState.selectedCopilot?.id === agent.id) {
                return {
                  holder_url: "local",
                  id: agent.id,
                  name: agent.name,
                  description: agent.description,
                  features: toFeatureKeys(agent.features),
                };
              }

              return null;
            }),
          )
          .filter(Boolean)
      : undefined;

    const currentDashboardInfo: DashboardInfoT =
      pageContext === "dashboard"
        ? getDashboardInfo(currentDashboardId, innerTab)
        : null;
    const dashboards = Object.values(appState.items || {})
      .filter((item) => !item?.isFolder && item?.data?.widgets)
      .map((item) => ({
        dashboard_id: item.index,
        name: item.data?.name,
        is_active: item.index === currentDashboardId,
        widget_count: item.data?.widgets?.length || 0,
        tab_count: getDashboardTabCount(item),
      }))
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }

        return (a.name || a.dashboard_id).localeCompare(b.name || b.dashboard_id);
      });

    const workspaceState = {
      agents: workspaceAgents as WorkspaceStateT["agents"],
      current_dashboard_uuid: currentDashboardId || undefined,
      current_dashboard_info: currentDashboardInfo,
      current_page_context: pageContext,
    } as WorkspaceStateT;

    const features = copilotState.selectedCopilot?.features || {};
    const customFeatureStates = copilotState.customFeatureStates || {};
    const enabledOptions = new Set<string>();

    if (features["widget-global-search"] && copilotDataState.extraWidgetsEnabled)
      enabledOptions.add("widget-global-search");
    if (features["agent-orchestration"] && copilotState.orchestrationModeEnabled)
      enabledOptions.add("agent-orchestration");
    if (features["generative-ui"] && copilotDataState.generativeUiEnabled)
      enabledOptions.add("generative-ui");
    if (features["mcp-tools"] && mcpToolsState.getEnabledToolCount() > 0)
      enabledOptions.add("mcp-tools");

    for (const [key, val] of Object.entries(features)) {
      if (ALL_AI_FEATURES.has(key)) continue;
      if (val && typeof val === "object") {
        const featureType = (val as { type?: string }).type || "toggle";
        const stateVal = customFeatureStates[key];
        if (featureType === "text" || featureType === "select") {
          if (typeof stateVal === "string" && stateVal) enabledOptions.add(key);
        } else if (stateVal) {
          enabledOptions.add(key);
        }
      } else if (val === true) {
        enabledOptions.add(key);
      }
    }

    return {
      generated_at: Date.now(),
      workspace_state: workspaceState,
      workspace_options: Array.from(enabledOptions),
      dashboards,
      dashboard_composition: currentDashboardInfo,
      skills: skillsLibraryState.getSkillsCatalog(),
    };
  }, [currentDashboardId, currentTab]);
}
