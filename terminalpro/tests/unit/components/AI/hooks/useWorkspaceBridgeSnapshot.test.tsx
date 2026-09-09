import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseAppStoreGetState = vi.fn();
const mockUseAuthStoreGetState = vi.fn();
const mockUseCopilotStoreGetState = vi.fn();
const mockUseCopilotDataStoreGetState = vi.fn();
const mockUseMcpToolsStoreGetState = vi.fn();
const mockUseSkillsLibraryStoreGetState = vi.fn();
const mockGetDashboardInfo = vi.fn();

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("~/components/AI/hooks/useActiveWorkspaceDashboardId", () => ({
  useActiveWorkspaceDashboardId: () => "dashboard-1",
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => mockUseAppStoreGetState(),
  },
}));

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: {
    getState: () => mockUseAuthStoreGetState(),
  },
}));

vi.mock("~/lib/state/copilot", () => ({
  useCopilotStore: {
    getState: () => mockUseCopilotStoreGetState(),
  },
}));

vi.mock("~/lib/state/copilotData", () => ({
  useCopilotDataStore: {
    getState: () => mockUseCopilotDataStoreGetState(),
  },
}));

vi.mock("~/lib/state/mcpTools", () => ({
  useMcpToolsStore: {
    getState: () => mockUseMcpToolsStoreGetState(),
  },
}));

vi.mock("~/lib/state/skillsLibrary", () => ({
  useSkillsLibraryStore: {
    getState: () => mockUseSkillsLibraryStoreGetState(),
  },
}));

vi.mock("~/lib/utils/workspaceDashboard", () => ({
  getDashboardInfo: (...args: unknown[]) => mockGetDashboardInfo(...args),
  serializeDashboardTabId: (tabId: string | null | undefined) =>
    tabId?.trim() ? tabId : "__no_tab__",
}));

import { useWorkspaceBridgeSnapshot } from "~/components/AI/hooks/useWorkspaceBridgeSnapshot";

describe("useWorkspaceBridgeSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppStoreGetState.mockReturnValue({
      getLastInnerTab: () => "",
      items: {
        "dashboard-1": {
          index: "dashboard-1",
          isFolder: false,
          data: {
            name: "Active Dashboard",
            currentTab: "",
            widgets: [
              { id: "widget-1", widgetId: "market_snapshot", innerTab: "" },
              {
                id: "widget-2",
                widgetId: "navigation_bar",
                innerTab: "",
                storage: { tabs: [{ id: "macro", name: "Macro" }] },
              },
            ],
            gridLayout: {
              "": [{ i: "widget-1", x: 0, y: 2, w: 40, h: 10 }],
              macro: [],
            },
          },
        },
        "dashboard-2": {
          index: "dashboard-2",
          isFolder: false,
          data: {
            name: "Second Dashboard",
            currentTab: "",
            widgets: [],
            gridLayout: {},
          },
        },
      },
    });
    mockUseAuthStoreGetState.mockReturnValue({
      lastVisitedPage: "/app/dashboard/dashboard-1",
    });
    mockUseCopilotStoreGetState.mockReturnValue({
      orchestrationModeEnabled: false,
      externalCopilotHolders: [],
      selectedCopilot: null,
      agentOrchestrationMap: {},
      customFeatureStates: {},
    });
    mockUseCopilotDataStoreGetState.mockReturnValue({
      extraWidgetsEnabled: false,
      generativeUiEnabled: false,
    });
    mockUseMcpToolsStoreGetState.mockReturnValue({
      getEnabledToolCount: () => 0,
    });
    mockUseSkillsLibraryStoreGetState.mockReturnValue({
      getSkillsCatalog: () => [{ slug: "macro-research", name: "Macro Research" }],
    });
    mockGetDashboardInfo.mockReturnValue({
      id: "dashboard-1",
      name: "Active Dashboard",
      current_tab_id: "__no_tab__",
      current_tab_name: "__no_tab__",
      tabs: [],
      groups: [],
    });
  });

  it("returns a compact snapshot with dashboard summaries and skills", () => {
    const { result } = renderHook(() => useWorkspaceBridgeSnapshot());

    const snapshot = result.current();

    expect(snapshot).toMatchObject({
      workspace_state: {
        current_dashboard_uuid: "dashboard-1",
        current_page_context: "dashboard",
      },
      dashboards: [
        {
          dashboard_id: "dashboard-1",
          is_active: true,
          widget_count: 2,
          tab_count: 2,
        },
        {
          dashboard_id: "dashboard-2",
          is_active: false,
          widget_count: 0,
          tab_count: 1,
        },
      ],
      dashboard_composition: {
        id: "dashboard-1",
      },
      skills: [{ slug: "macro-research", name: "Macro Research" }],
    });
    expect(snapshot).not.toHaveProperty("widgets");
    expect(snapshot).not.toHaveProperty("context");
    expect(snapshot).not.toHaveProperty("artifacts");
    expect(snapshot).not.toHaveProperty("files");
    expect(snapshot).not.toHaveProperty("tools");
  });

  // Regression: workspace-mcp's WorkspaceSnapshot.workspace_options is list[str].
  // Sending {} fails Pydantic validation and the sidecar returns
  // "Browser returned an invalid workspace snapshot payload."
  it("emits workspace_options as a string[] (not an object)", () => {
    const { result } = renderHook(() => useWorkspaceBridgeSnapshot());

    const snapshot = result.current();

    expect(Array.isArray(snapshot.workspace_options)).toBe(true);
    expect(snapshot.workspace_options).toEqual([]);
  });

  it("includes enabled feature flags as workspace_options", () => {
    mockUseCopilotStoreGetState.mockReturnValue({
      orchestrationModeEnabled: true,
      externalCopilotHolders: [],
      selectedCopilot: {
        id: "copilot-1",
        features: {
          "agent-orchestration": true,
          "mcp-tools": true,
          "generative-ui": true,
          "widget-global-search": true,
        },
      },
      agentOrchestrationMap: {},
      customFeatureStates: {},
    });
    mockUseCopilotDataStoreGetState.mockReturnValue({
      extraWidgetsEnabled: true,
      generativeUiEnabled: true,
    });
    mockUseMcpToolsStoreGetState.mockReturnValue({
      getEnabledToolCount: () => 3,
    });

    const { result } = renderHook(() => useWorkspaceBridgeSnapshot());
    const snapshot = result.current();

    expect(snapshot.workspace_options).toEqual(
      expect.arrayContaining([
        "agent-orchestration",
        "mcp-tools",
        "generative-ui",
        "widget-global-search",
      ]),
    );
  });

  it("omits mcp-tools when no tools are enabled even if the feature is on", () => {
    mockUseCopilotStoreGetState.mockReturnValue({
      orchestrationModeEnabled: false,
      externalCopilotHolders: [],
      selectedCopilot: {
        id: "copilot-1",
        features: { "mcp-tools": true },
      },
      agentOrchestrationMap: {},
      customFeatureStates: {},
    });
    mockUseMcpToolsStoreGetState.mockReturnValue({
      getEnabledToolCount: () => 0,
    });

    const { result } = renderHook(() => useWorkspaceBridgeSnapshot());
    const snapshot = result.current();

    expect(snapshot.workspace_options).not.toContain("mcp-tools");
  });
});
