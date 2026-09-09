import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";

// --- Mocks ---

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "dashboard-123" }),
  useSearchParams: () => [new URLSearchParams()],
}));

const mockGetLastInnerTab = vi.fn().mockReturnValue("");
const mockGetSideBarItem = vi.fn();

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      getSideBarItem: mockGetSideBarItem,
      items: new Proxy({} as Record<string, unknown>, {
        get: (_target, key: string) => mockGetSideBarItem(key),
      }),
    }),
  },
  useShallowAppStore: (selector: (state: any) => any) =>
    selector({
      getLastInnerTab: mockGetLastInnerTab,
      getSideBarItem: mockGetSideBarItem,
    }),
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: any) => any) =>
    selector({ lastVisitedPage: "/app" }),
  useAuthStore: () => ({ getState: () => ({}) }),
}));

const mockGetDashboardWidgetData = vi.fn().mockReturnValue(null);
const mockGetDashboardWidgetsData = vi.fn().mockReturnValue({});
const mockGetWidgetRuntimeState = vi.fn().mockReturnValue(undefined);
const mockGetWidgetsInCurrentDashboard = vi.fn().mockReturnValue([]);
const mockSetCopilotWidgets = vi.fn();

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: (state: any) => any) =>
    selector({
      selectedWidgetIDs: [],
      getDashboardWidgetData: mockGetDashboardWidgetData,
      getDashboardWidgetsData: mockGetDashboardWidgetsData,
      getWidgetRuntimeState: mockGetWidgetRuntimeState,
      widgetSubsetData: null,
      widgetsLastUpdated: 0,
      getWidgetsInCurrentDashboard: mockGetWidgetsInCurrentDashboard,
      setCopilotWidgets: mockSetCopilotWidgets,
      copilotWidgets: { selectedWidgets: [] },
    }),
}));

const copilotTestState = vi.hoisted(() => ({
  features: {
    "widget-dashboard-select": true,
    "widget-dashboard-search": false,
    "file-upload": false,
  } as Record<string, boolean>,
  messages: undefined as any[] | undefined,
  files: [] as any[],
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: (state: any) => any) =>
    selector({
      selectedCopilot: {
        id: "copilot-1",
        features: copilotTestState.features,
      },
      getCurrentChat: () => ({ messages: copilotTestState.messages }),
      getCurrentChatArtifacts: vi.fn(),
      orchestrationModeEnabled: false,
      agentOrchestrationMap: {},
      externalCopilotHolders: [],
      actionHistory: [],
    }),
}));

vi.mock("~/components/AI/hooks/useWidgetsInCurrentDashboard", () => ({
  useWidgetsInCurrentDashboard: () => vi.fn(),
  useSyncWidgetsInCurrentDashboard: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useShallowAppWidgetsStore: (selector: (state: any) => any) =>
    selector({
      lastUpdated: 0,
      getAppWidget: vi.fn().mockReturnValue(null),
      getAllAppWidgets: vi.fn().mockReturnValue([]),
    }),
}));

vi.mock("~/components/AI/hooks/useStreaming", () => ({
  useShallowStreamingStore: (selector: (state: any) => any) =>
    selector({ files: copilotTestState.files }),
}));

vi.mock("~/components/AI/hooks/useTextSuggestions", () => ({
  useTextSuggestions: vi.fn(),
}));

vi.mock("~/components/Widgets/Helpers/useCopilotDataWidget", () => ({
  createCopilotDataWidget: vi.fn().mockReturnValue({
    metadata: {},
    title: "Mock",
  }),
}));

const { mockGetWidgetInfo, mockCreateParamDefs, mockCurrentDateModifier } = vi.hoisted(
  () => ({
    mockGetWidgetInfo: vi.fn().mockReturnValue(null),
    mockCreateParamDefs: vi.fn().mockReturnValue([]),
    mockCurrentDateModifier: vi.fn().mockImplementation((v: unknown) => v),
  }),
);

vi.mock("~/lib/utils", () => ({
  createParamDefs: mockCreateParamDefs,
  currentDateModifier: mockCurrentDateModifier,
  getJsonWidget: vi.fn(),
  getWidgetDataSource: vi.fn().mockReturnValue("unknown"),
  getWidgetInfo: mockGetWidgetInfo,
}));

// Import after mocks
import {
  createCopilotWidget,
  useGetCopilotWidgets,
} from "~/components/AI/hooks/useGetCopilotWidgets";

// Helper to create mock widgets
function createWidget(overrides: Partial<WidgetT> & { id: string }): WidgetT {
  return {
    name: "Test Widget",
    description: "",
    widgetId: "chart",
    type: "chart",
    params: [],
    storage: {},
    data: {},
    ...overrides,
  } as WidgetT;
}

describe("useGetCopilotWidgets - nav bar tab mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
      category: "Test",
      subCategory: "Test",
    });
    mockGetSideBarItem.mockImplementation(() => ({
      data: {
        name: "Test Dashboard",
        widgets: mockGetWidgetsInCurrentDashboard(),
        currentTab: mockGetLastInnerTab(),
        gridLayout: {},
      },
    }));
  });

  it("should use display names from navigation_bar tabs instead of slugs", () => {
    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [
            { id: "overview", name: "Overview" },
            { id: "detailed-charts", name: "Detailed Charts" },
          ],
        },
      }),
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "AAPL Chart",
        innerTab: "overview",
      }),
      createWidget({
        id: "w-2",
        widgetId: "chart",
        name: "MSFT Chart",
        innerTab: "detailed-charts",
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "AAPL Chart" },
      "w-2": { metadata: {}, title: "MSFT Chart" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    expect(dashboardInfo).not.toBeNull();
    const tabNames = dashboardInfo.tabs.map((t: { tab_name: string }) => t.tab_name);
    expect(tabNames).toContain("Overview");
    expect(tabNames).toContain("Detailed Charts");
    expect(
      dashboardInfo.tabs.find((t: { tab_id: string }) => t.tab_id === "overview"),
    ).toBeDefined();
    expect(
      dashboardInfo.tabs.find(
        (t: { tab_id: string }) => t.tab_id === "detailed-charts",
      ),
    ).toBeDefined();
  });

  it("should seed empty tabs from navigation_bar so AI can see them", () => {
    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [
            { id: "overview", name: "Overview" },
            { id: "empty-tab", name: "Empty Tab" },
          ],
        },
      }),
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "AAPL Chart",
        innerTab: "overview",
      }),
      // No widgets assigned to "empty-tab"
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "AAPL Chart" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    expect(dashboardInfo).not.toBeNull();
    const emptyTab = dashboardInfo.tabs.find(
      (t: { tab_name: string }) => t.tab_name === "Empty Tab",
    );
    expect(emptyTab).toBeDefined();
    expect(emptyTab.widgets).toEqual([]);
  });

  it("should use slug as fallback for tabs not in navigation_bar", () => {
    // Dashboard with a nav bar that doesn't list all tabs (edge case)
    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [{ id: "overview", name: "Overview" }],
        },
      }),
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "Orphan Widget",
        innerTab: "unknown-tab",
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "Orphan Widget" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    const unknownTab = dashboardInfo.tabs.find(
      (t: { tab_id: string }) => t.tab_id === "unknown-tab",
    );
    expect(unknownTab).toBeDefined();
    expect(unknownTab.widgets).toHaveLength(1);
  });

  it("should resolve current_tab_name to display name", () => {
    mockGetLastInnerTab.mockReturnValue("detailed-charts");

    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [
            { id: "overview", name: "Overview" },
            { id: "detailed-charts", name: "Detailed Charts" },
          ],
        },
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({});

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    expect(dashboardInfo.current_tab_id).toBe("detailed-charts");
    expect(dashboardInfo.current_tab_name).toBe("Detailed Charts");
  });

  it("should handle missing storage.tabs gracefully", () => {
    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {},
      }),
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "Widget",
        innerTab: "some-tab",
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "Widget" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    // Should still work without nav bar tabs, falling back to slug
    expect(dashboardInfo).not.toBeNull();
    const tab = dashboardInfo.tabs.find(
      (t: { tab_id: string }) => t.tab_id === "some-tab",
    );
    expect(tab).toBeDefined();
  });

  it("should handle dashboard with no navigation_bar widget", () => {
    const widgets = [
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "Widget A",
      }),
      createWidget({
        id: "w-2",
        widgetId: "chart",
        name: "Widget B",
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "Widget A" },
      "w-2": { metadata: {}, title: "Widget B" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    expect(dashboardInfo).not.toBeNull();
    // All widgets should be under __no_tab__
    const noTab = dashboardInfo.tabs.find(
      (t: { tab_id: string }) => t.tab_id === "__no_tab__",
    );
    expect(noTab).toBeDefined();
    expect(noTab.widgets).toHaveLength(2);
  });

  it("should exclude navigation_bar widget from tab widget lists", () => {
    const widgets = [
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [{ id: "overview", name: "Overview" }],
        },
        innerTab: "overview",
      }),
      createWidget({
        id: "w-1",
        widgetId: "chart",
        name: "Chart",
        innerTab: "overview",
      }),
    ];

    mockGetWidgetsInCurrentDashboard.mockReturnValue(widgets);
    mockGetDashboardWidgetsData.mockReturnValue({
      "w-1": { metadata: {}, title: "Chart" },
    });

    renderHook(() => useGetCopilotWidgets());

    const setCopilotCall = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const dashboardInfo = setCopilotCall?.workspaceState?.current_dashboard_info;

    const overviewTab = dashboardInfo.tabs.find(
      (t: { tab_id: string }) => t.tab_id === "overview",
    );
    // Only the chart widget, not the nav bar itself
    expect(overviewTab.widgets).toHaveLength(1);
    expect(overviewTab.widgets[0].name).toBe("Chart");
  });
});

describe("useGetCopilotWidgets - temporary file widgets", () => {
  const uploadedFile = (name: string, uuid: string) => ({
    name,
    description: `${name} description`,
    status: "uploaded" as const,
    stored_file_uuid: uuid,
    url: `https://files.test/${uuid}.pdf`,
  });

  const humanMessage = (files: ReturnType<typeof uploadedFile>[]) => ({
    role: "human",
    content: "summarize this",
    copilotId: "copilot-1",
    timestamp: 1,
    files,
  });

  const renderTemporaryWidgets = () => {
    renderHook(() => useGetCopilotWidgets());
    const lastCall = mockSetCopilotWidgets.mock.calls.at(-1)?.[0];
    return lastCall?.temporaryWidgets ?? [];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    copilotTestState.features["file-upload"] = true;
    copilotTestState.files = [];
    copilotTestState.messages = undefined;
    mockGetWidgetsInCurrentDashboard.mockReturnValue([]);
    mockGetSideBarItem.mockReturnValue(null);
  });

  afterEach(() => {
    copilotTestState.features["file-upload"] = false;
    copilotTestState.files = [];
    copilotTestState.messages = undefined;
  });

  it("keeps files attached to earlier messages available as context", () => {
    copilotTestState.messages = [
      humanMessage([uploadedFile("dailyreport.pdf", "uuid-1")]),
    ];

    const temporaryWidgets = renderTemporaryWidgets();

    expect(temporaryWidgets).toHaveLength(1);
    expect(temporaryWidgets[0]).toMatchObject({
      origin: "OpenBB Hub",
      widget_id: "file-uuid-1",
      name: "dailyreport.pdf",
      metadata: { extension: "pdf" },
    });
  });

  it("does not duplicate a file present in both the composer and a message", () => {
    copilotTestState.files = [uploadedFile("dailyreport.pdf", "uuid-1")];
    copilotTestState.messages = [
      humanMessage([uploadedFile("dailyreport.pdf", "uuid-1")]),
    ];

    expect(renderTemporaryWidgets()).toHaveLength(1);
  });

  it("ignores files that have not finished uploading", () => {
    copilotTestState.files = [
      { name: "pending.pdf", description: "", status: "pending" as const },
    ];

    expect(renderTemporaryWidgets()).toEqual([]);
  });

  it("returns no file widgets for a chat without attachments", () => {
    copilotTestState.messages = [{ ...humanMessage([]), files: undefined }];

    expect(renderTemporaryWidgets()).toEqual([]);
  });

  it("returns no file widgets when the copilot lacks the file-upload feature", () => {
    copilotTestState.features["file-upload"] = false;
    copilotTestState.messages = [
      humanMessage([uploadedFile("dailyreport.pdf", "uuid-1")]),
    ];

    expect(renderTemporaryWidgets()).toEqual([]);
  });
});

describe("createCopilotWidget - runtime state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should include executed_value in params when runtime state has copilotExecutedParams", () => {
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
    });

    mockCreateParamDefs.mockReturnValue([
      {
        paramName: "query",
        type: "text",
        value: "default query",
      },
    ]);

    const widget = createWidget({
      id: "test-widget",
      widgetId: "chart",
      params: [{ paramName: "query", type: "text", value: "default query" }],
    });

    const metadata = {
      params: { query: "current query" },
    };

    const runtimeState = {
      copilotDraftParams: { query: "draft query" },
      copilotExecutedParams: { query: "executed query" },
    };

    const result = createCopilotWidget("test-widget", widget, metadata, runtimeState);

    expect(result).not.toBeNull();
    const queryParam = result?.params?.find(
      (p: { name: string }) => p.name === "query",
    );
    expect(queryParam?.current_value).toBe("draft query");
    expect(queryParam?.executed_value).toBe("executed query");
  });

  it("should use metadata params when runtime state is undefined", () => {
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
    });

    mockCreateParamDefs.mockReturnValue([
      {
        paramName: "ticker",
        type: "text",
        value: "AAPL",
      },
    ]);

    const widget = createWidget({
      id: "test-widget",
      widgetId: "chart",
      params: [{ paramName: "ticker", type: "text", value: "AAPL" }],
    });

    const metadata = {
      params: { ticker: "MSFT" },
    };

    const result = createCopilotWidget("test-widget", widget, metadata, undefined);

    expect(result).not.toBeNull();
    const tickerParam = result?.params?.find(
      (p: { name: string }) => p.name === "ticker",
    );
    expect(tickerParam?.current_value).toBe("MSFT");
    expect(tickerParam?.executed_value).toBeUndefined();
  });

  it("should handle empty runtime state gracefully", () => {
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
    });

    mockCreateParamDefs.mockReturnValue([
      {
        paramName: "query",
        type: "text",
        value: "default",
      },
    ]);

    const widget = createWidget({
      id: "test-widget",
      widgetId: "chart",
      params: [{ paramName: "query", type: "text", value: "default" }],
    });

    const result = createCopilotWidget("test-widget", widget, {}, {});

    expect(result).not.toBeNull();
    const queryParam = result?.params?.find(
      (p: { name: string }) => p.name === "query",
    );
    expect(queryParam?.executed_value).toBeUndefined();
  });
});

/**
 * The agent payload and `workspace_state` are built from the same dashboard but
 * by two independent paths: widgets go through the reduce in `useGetCopilotWidgets`,
 * while `current_dashboard_info` is built from `getDashboardInfo(currentDashboardId)`.
 *
 * When the two disagree, the agent's system prompt advertises `[uuid: ...]` tags
 * for widgets that `get_widget_data` cannot resolve, and the model — which the
 * prompt explicitly instructs to copy those uuids — issues an unresolvable fetch.
 * Observed live 2026-08-19: widget payload of 0/1/1/1/9/9 across six consecutive
 * requests on one unchanged dashboard, with "I couldn't find the requested
 * widgets." on the thin ones.
 */
describe("useGetCopilotWidgets - agent payload vs. advertised dashboard state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
      category: "Test",
      subCategory: "Test",
    });
    mockGetSideBarItem.mockImplementation(() => ({
      data: {
        name: "Kalshi Prediction Markets",
        widgets: mockGetWidgetsInCurrentDashboard(),
        currentTab: mockGetLastInnerTab(),
        gridLayout: {},
      },
    }));
  });

  /** Three widgets on the current "event" tab, one on a background "market" tab. */
  function setupDashboard(cachedData: Record<string, unknown>) {
    mockGetLastInnerTab.mockReturnValue("event");
    mockGetWidgetsInCurrentDashboard.mockReturnValue([
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [
            { id: "event", name: "Event" },
            { id: "market", name: "Market" },
          ],
        },
      }),
      createWidget({
        id: "w-metrics",
        name: "Selected Event Metrics",
        innerTab: "event",
      }),
      createWidget({ id: "w-price", name: "Event Price History", innerTab: "event" }),
      createWidget({ id: "w-tape", name: "Trade Tape", innerTab: "market" }),
    ]);
    mockGetDashboardWidgetsData.mockReturnValue(cachedData);
    renderHook(() => useGetCopilotWidgets());
    const call = mockSetCopilotWidgets.mock.calls[0]?.[0];
    return {
      sentToAgent: (call?.allDashboardWidgets ?? []).map(
        (w: { uuid: string }) => w.uuid,
      ),
      advertisedInPrompt: (
        call?.workspaceState?.current_dashboard_info?.tabs ?? []
      ).flatMap((t: { widgets: { widget_uuid: string }[] }) =>
        t.widgets.map((w) => w.widget_uuid),
      ),
    };
  }

  // The inversion: an off-tab widget with no cached data gets a synthesized
  // entry and survives; the SAME widget on the visible tab does not, and is
  // dropped by the `if (!widgetData) return acc;` guard.
  it("does not drop a current-tab widget just because its data has not cached yet", () => {
    const { sentToAgent } = setupDashboard({
      // Only the metrics widget has rendered data so far — the usual state for
      // the first request after a tab switch or page load.
      "w-metrics": { metadata: {}, title: "Selected Event Metrics", innerTab: "event" },
    });

    expect(sentToAgent).toContain("w-tape"); // off-tab, no data — kept
    expect(sentToAgent).toContain("w-price"); // on-tab, no data — dropped today
  });

  it("never advertises a widget uuid the agent cannot fetch", () => {
    const { sentToAgent, advertisedInPrompt } = setupDashboard({
      "w-metrics": { metadata: {}, title: "Selected Event Metrics", innerTab: "event" },
    });

    const unfetchable = advertisedInPrompt.filter(
      (uuid: string) => !sentToAgent.includes(uuid),
    );
    expect(unfetchable).toEqual([]);
  });

  it("sends every widget once the whole dashboard has cached data", () => {
    const { sentToAgent, advertisedInPrompt } = setupDashboard({
      "w-metrics": { metadata: {}, title: "Selected Event Metrics", innerTab: "event" },
      "w-price": { metadata: {}, title: "Event Price History", innerTab: "event" },
      "w-tape": { metadata: {}, title: "Trade Tape", innerTab: "market" },
    });

    expect(sentToAgent).toHaveLength(3);
    expect(advertisedInPrompt.every((u: string) => sentToAgent.includes(u))).toBe(true);
  });
});

/**
 * `dashboardWidgets` is the CURRENT-TAB slice (it feeds text suggestions);
 * `allDashboardWidgets` is the whole dashboard and is what reaches the agent.
 *
 * Tab membership must be read from the raw widget. `widgetData` is either a real
 * entry from `dashboardWidgetsData` (carries innerTab) or a placeholder from
 * `createCopilotDataWidget` (does not), so reading it off `widgetData` makes
 * `!widgetData.innerTab` true for every placeholder and files not-yet-loaded
 * off-tab widgets under the current tab. #1551 fixed this; #1488 merged 77
 * minutes later off an older branch and carried the previous line back — this
 * test exists so the next stale branch fails loudly.
 */
describe("useGetCopilotWidgets - current-tab slice uses raw widget tab membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetWidgetInfo.mockReturnValue({
      name: "Test Widget",
      description: "Test description",
      source: "test-source",
      category: "Test",
      subCategory: "Test",
    });
    mockGetSideBarItem.mockImplementation(() => ({
      data: {
        name: "Kalshi Prediction Markets",
        widgets: mockGetWidgetsInCurrentDashboard(),
        currentTab: mockGetLastInnerTab(),
        gridLayout: {},
      },
    }));
  });

  it("keeps an unloaded off-tab widget out of the current-tab slice", () => {
    mockGetLastInnerTab.mockReturnValue("event");
    mockGetWidgetsInCurrentDashboard.mockReturnValue([
      createWidget({
        id: "nav-1",
        widgetId: "navigation_bar",
        storage: {
          tabs: [
            { id: "event", name: "Event" },
            { id: "market", name: "Market" },
          ],
        },
      }),
      createWidget({ id: "w-price", name: "Event Price History", innerTab: "event" }),
      createWidget({ id: "w-tape", name: "Trade Tape", innerTab: "market" }),
    ]);
    // Neither has loaded, so both get a placeholder — and a placeholder has no
    // innerTab of its own.
    mockGetDashboardWidgetsData.mockReturnValue({});

    renderHook(() => useGetCopilotWidgets());
    const call = mockSetCopilotWidgets.mock.calls[0]?.[0];
    const currentTabSlice = (call?.dashboardWidgets ?? []).map(
      (w: { uuid: string }) => w.uuid,
    );
    const wholeDashboard = (call?.allDashboardWidgets ?? []).map(
      (w: { uuid: string }) => w.uuid,
    );

    // Both reach the agent...
    expect(wholeDashboard).toContain("w-price");
    expect(wholeDashboard).toContain("w-tape");
    // ...but only the current tab's widget is in the current-tab slice.
    expect(currentTabSlice).toContain("w-price");
    expect(currentTabSlice).not.toContain("w-tape");
  });
});
