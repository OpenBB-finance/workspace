import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSnapshot = vi.fn(() => ({ generated_at: 123 }));
const mockGetQueryFetchParams = vi.fn();
const mockReadWidget = vi.fn();
const mockCreateWidget = vi.fn();
const mockUpdateWidget = vi.fn();
const mockDeleteWidget = vi.fn();
const mockCreateDashboard = vi.fn();
const mockReadDashboard = vi.fn();
const mockUpdateDashboard = vi.fn();
const mockUpdateDashboardLayout = vi.fn();
const mockGetWidgetData = vi.fn();
const mockGetParamOptions = vi.fn();
const mockAssignTasksToAgents = vi.fn();
const mockAddGenerativeWidget = vi.fn();
const mockManageNavigationBar = vi.fn();
const mockExecuteAgentTool = vi.fn();
const mockGetSkillBySlug = vi.fn();
const mockUseAppStoreGetState = vi.fn();
const mockGetAppWidget = vi.fn();
const mockGetApiSourceById = vi.fn();
const mockNavigate = vi.fn();
const mockBackendConnectorState = vi.fn();
const mockUseSharedTemplates = vi.fn();
const mockGetAllUserApps = vi.fn();
const mockGetAllSharedUserApps = vi.fn();
const mockCreateCustomTemplateTab = vi.fn();
const mockAddTab = vi.fn();

const backendApiSource = {
  id: "backend-1",
  uuid: "backend-1",
  name: "My Custom Backend",
  url: "https://backend.example.com",
  templates: [
    {
      name: "Backend App",
      templateId: "backend-app",
      description: "Backend-defined app",
      tabs: {},
      prompts: [],
    },
  ],
};

const sharedBackendSource = {
  id: "shared-backend-1",
  uuid: "shared-backend-1",
  name: "Org Shared Backend",
  url: "https://shared.example.com",
  isSharedSource: true,
};

const sharedTemplate = {
  name: "Shared Org App",
  templateId: "shared-org-app",
  description: "Shared with the org",
  tabs: {},
  prompts: [],
  source: sharedBackendSource,
  createdBy: "teammate@example.com",
};

const savedApp = {
  uuid: "saved-app-1",
  name: "My Saved App",
  description: "Saved from dashboard",
  widgets: [{ widgetId: "price_history", name: "Price History" }],
  groups: [],
  gridLayout: {},
  storedFileUUIDs: [],
  prompts: ["What moved today?"],
  isShared: false,
  creator: true,
  createdBy: "me@example.com",
};

const sharedSavedApp = {
  uuid: "shared-saved-app-1",
  name: "Teammate Saved App",
  description: "Shared with me",
  widgets: [],
  groups: [],
  gridLayout: {},
  storedFileUUIDs: [],
  prompts: [],
  isShared: true,
  creator: false,
  createdBy: "teammate@example.com",
};

const backendNameToWidget: Record<string, any[]> = {
  "OpenBB Workspace": [
    {
      widgetId: "price_history",
      sourceName: "OpenBB Workspace",
      name: "Price History",
      description: "Historical prices",
      category: "Equity",
      subCategory: "Prices",
      params: [{ paramName: "symbol", type: "text" }],
      gridData: { w: 20, h: 10, minW: 12, minH: 4 },
    },
  ],
  "OpenBB Sandbox": [
    {
      widgetId: "company_filings",
      name: "Company Filings",
      description: "SEC filings",
      category: "Equity",
      subCategory: "Fundamental",
    },
    {
      widgetId: "pyth_price_feeds",
      sourceName: "OpenBB Workspace",
      name: "Live Watchlist",
      params: [
        {
          paramName: "symbols",
          type: "endpoint",
          optionsEndpoint: "https://sdk.openbb.dev/udf/pyth-symbols",
          multiSelect: true,
        },
      ],
    },
    {
      widgetId: "watchlist",
      sourceName: "OpenBB Workspace",
      name: "Watchlist",
    },
  ],
};
const mockBackendNameToWidgetMap = new Map(
  Object.entries(backendNameToWidget).map(([backendName, widgets]) => [
    backendName,
    new Map(widgets.map((widget) => [widget.widgetId, widget])),
  ]),
);

const mockUseGetWidgetsStoreGetState = vi.fn(() => ({
  backendNameToWidgetMap: {},
  getAppWidget: mockGetAppWidget,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => mockNavigate),
  useParams: vi.fn(() => ({ id: "current-dashboard-id" })),
}));

vi.mock("~/components/AI/hooks/useWorkspaceBridgeSnapshot", () => ({
  useWorkspaceBridgeSnapshot: () => mockGetSnapshot,
}));

vi.mock("~/components/AI/hooks/useActiveWorkspaceDashboardId", () => ({
  useActiveWorkspaceDashboardId: () => "current-dashboard-id",
}));

vi.mock("~/components/AI/hooks/useAiFetchRequestInit", () => ({
  useAiFetchRequestInit: () => [mockGetQueryFetchParams],
}));

vi.mock("~/api/workspace.api", async (importOriginal) => ({
  // Keep the real pure helpers (computeWidgetParamUpdates, getWidgetDefinitionOrThrow,
  // ...) so dry-run paths run the same rules as the mutation paths; only the
  // store-mutating entry points are mocked.
  ...(await importOriginal<typeof import("~/api/workspace.api")>()),
  readWidget: (...args: unknown[]) => mockReadWidget(...args),
  createWidget: (...args: unknown[]) => mockCreateWidget(...args),
  updateWidget: (...args: unknown[]) => mockUpdateWidget(...args),
  deleteWidget: (...args: unknown[]) => mockDeleteWidget(...args),
  createDashboard: (...args: unknown[]) => mockCreateDashboard(...args),
  readDashboard: (...args: unknown[]) => mockReadDashboard(...args),
  updateDashboard: (...args: unknown[]) => mockUpdateDashboard(...args),
  updateDashboardLayout: (...args: unknown[]) => mockUpdateDashboardLayout(...args),
}));

vi.mock("~/components/AI/hooks/useFunctionCall", () => ({
  useFunctionCall: () => ({
    getWidgetData: (...args: unknown[]) => mockGetWidgetData(...args),
    getParamOptions: (...args: unknown[]) => mockGetParamOptions(...args),
    assignTasksToAgents: (...args: unknown[]) => mockAssignTasksToAgents(...args),
    addGenerativeWidget: (...args: unknown[]) => mockAddGenerativeWidget(...args),
  }),
}));

vi.mock("~/components/AI/hooks/useManageNavigationBar", () => ({
  useManageNavigationBar:
    () =>
    (...args: unknown[]) =>
      mockManageNavigationBar(...args),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useGetWidgetsStore: {
    getState: () => mockUseGetWidgetsStoreGetState(),
  },
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useBackendConnectorStore: {
    getState: () => mockBackendConnectorState(),
  },
}));

vi.mock("~/hooks/useSharedTemplates", () => ({
  useSharedTemplates: (...args: unknown[]) => mockUseSharedTemplates(...args),
}));

vi.mock("~/lib/state/userApps", () => ({
  useUserAppsStore: {
    getState: () => ({
      getAllUserApps: mockGetAllUserApps,
      getAllSharedUserApps: mockGetAllSharedUserApps,
    }),
  },
}));

vi.mock("~/lib/utils/createTemplates", () => ({
  createCustomTemplateTab: (...args: unknown[]) => mockCreateCustomTemplateTab(...args),
}));

vi.mock("~/components/AI/hooks/mcp/useMcpExecutor", () => ({
  useMcpExecutor: () => mockExecuteAgentTool,
}));

vi.mock("~/lib/state/skillsLibrary", () => ({
  useShallowSkillsLibraryStore: (selector: (state: unknown) => unknown) =>
    selector({ getSkillBySlug: mockGetSkillBySlug }),
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => mockUseAppStoreGetState(),
  },
}));

import { useWorkspaceBridgeCommandHandler } from "~/components/AI/hooks/useWorkspaceBridgeCommandHandler";

describe("useWorkspaceBridgeCommandHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSnapshot.mockReturnValue({ generated_at: 123 });
    mockCreateWidget.mockResolvedValue("widget-created");
    mockUpdateWidget.mockResolvedValue(undefined);
    mockDeleteWidget.mockResolvedValue(undefined);
    mockCreateDashboard.mockReturnValue("dashboard-created");
    mockReadDashboard.mockReturnValue({
      id: "current-dashboard-id",
      name: "Current dashboard",
      tabs: [],
    });
    mockUpdateDashboard.mockReturnValue(undefined);
    mockUpdateDashboardLayout.mockReturnValue(undefined);
    mockGetWidgetData.mockResolvedValue([{ items: [{ content: '{"rows": 1}' }] }]);
    mockGetParamOptions.mockResolvedValue([
      { items: [{ content: '{"param": "symbol"}' }] },
    ]);
    mockAssignTasksToAgents.mockResolvedValue([
      { status: "success", message: "Task completed" },
    ]);
    mockManageNavigationBar.mockResolvedValue([
      { status: "success", message: "Added tabs: Charts" },
    ]);
    mockAddGenerativeWidget.mockResolvedValue([
      {
        status: "success",
        message: "Widget 'Bridge Chart' created successfully",
        widget_uuid: "generated-widget-1",
      },
    ]);
    mockExecuteAgentTool.mockResolvedValue([
      { items: [{ content: '{"answer": 42}' }] },
    ]);
    mockGetSkillBySlug.mockReturnValue({
      slug: "equity-research",
      description: "Equity research instructions",
      content: "# Equity research",
    });
    mockGetQueryFetchParams.mockResolvedValue({
      queryUrl: "https://example.com/query",
      init: { method: "POST" },
    });
    mockGetAppWidget.mockImplementation((widgetId: string) =>
      Array.from(mockBackendNameToWidgetMap.values())
        .flatMap((widgets) => Array.from(widgets.values()))
        .find((widget) => widget.widgetId === widgetId),
    );
    mockUseGetWidgetsStoreGetState.mockReturnValue({
      backendNameToWidgetMap: mockBackendNameToWidgetMap,
      getAppWidget: mockGetAppWidget,
    });
    mockGetApiSourceById.mockReturnValue({ schemas: {} });
    mockBackendConnectorState.mockReturnValue({
      getApiSourceById: mockGetApiSourceById,
      apiSources: [backendApiSource],
    });
    mockUseSharedTemplates.mockReturnValue({
      data: [sharedTemplate],
      refetch: vi.fn(),
    });
    mockGetAllUserApps.mockReturnValue([savedApp]);
    mockGetAllSharedUserApps.mockReturnValue([sharedSavedApp]);
    mockCreateCustomTemplateTab.mockResolvedValue("new-dashboard-1");
    const appStoreState = {
      items: {
        "dashboard-1": {
          data: {
            name: "Dashboard 1",
            widgets: [
              {
                id: "widget-instance-1",
                widgetId: "price_history",
                params: [{ paramName: "symbol", type: "text" }],
                storage: { params: { symbol: "AAPL" } },
              },
              {
                id: "widget-created",
                widgetId: "company_filings",
                innerTab: "",
                params: [{ paramName: "symbol", type: "text" }],
                storage: { params: { symbol: "MSFT" } },
              },
            ],
            gridLayout: {
              "": [
                { i: "widget-instance-1", x: 0, y: 0, w: 20, h: 10 },
                { i: "widget-created", x: 20, y: 0, w: 20, h: 10 },
              ],
            },
          },
        },
        "current-dashboard-id": {
          data: {
            name: "Current dashboard",
            widgets: [
              { id: "widget-instance-2", widgetId: "market_overview" },
              {
                id: "navbar-instance",
                widgetId: "navigation_bar",
                storage: { tabs: [{ id: "tab-news", name: "News" }] },
              },
            ],
          },
        },
      },
      getTabWidgetById: (dashboardId: string, widgetUuid: string) =>
        appStoreState.items?.[dashboardId]?.data?.widgets?.find(
          (widget: { id: string }) => widget.id === widgetUuid,
        ),
      getWidgetGridData: (dashboardId: string, widgetUuid: string) => {
        const gridLayout =
          (
            appStoreState.items as Record<
              string,
              { data?: { gridLayout?: Record<string, { i: string }[]> } }
            >
          )[dashboardId]?.data?.gridLayout ?? {};
        for (const entries of Object.values(gridLayout)) {
          const match = entries.find((entry) => entry.i === widgetUuid);
          if (match) return match;
        }
        return undefined;
      },
      addTab: mockAddTab,
    };
    mockUseAppStoreGetState.mockReturnValue(appStoreState);
  });

  it("normalizes widget-data aliases before calling the existing hook", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_data",
        data_sources: [
          {
            origin: "OpenBB Workspace",
            widget_id: "price_history",
            inputArgs: { symbol: "AAPL" },
            widgetUuid: "widget-instance-1",
          },
        ],
      } as never);
    });

    expect(mockGetWidgetData).toHaveBeenCalledWith([
      {
        origin: "OpenBB Workspace",
        id: "price_history",
        input_args: { symbol: "AAPL" },
        widget_uuid: "widget-instance-1",
        ssm_request: null,
      },
    ]);
    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_data",
    });
  });

  it("fetches widget data through the existing function-call hook", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_data",
        data_sources: [
          {
            origin: "OpenBB Workspace",
            id: "price_history",
            input_args: { symbol: "AAPL" },
            widget_uuid: null,
            ssm_request: null,
          },
        ],
      });
    });

    expect(mockGetWidgetData).toHaveBeenCalledWith([
      {
        origin: "OpenBB Workspace",
        id: "price_history",
        input_args: { symbol: "AAPL" },
        widget_uuid: null,
        ssm_request: null,
      },
    ]);
    // The bridge un-stringifies JSON content so MCP callers receive structured
    // rows rather than a JSON string inside items[].content.
    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_data",
      data: [{ items: [{ content: { rows: 1 } }] }],
    });
  });

  it("leaves non-JSON widget-data content (e.g. note markdown) as a string", async () => {
    mockGetWidgetData.mockResolvedValueOnce([{ items: [{ content: "# Heading" }] }]);
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_data",
        data_sources: [
          {
            origin: "OpenBB Workspace",
            id: "note",
            input_args: {},
            widget_uuid: null,
            ssm_request: null,
          },
        ],
      });
    });

    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_data",
      data: [{ items: [{ content: "# Heading" }] }],
    });
  });

  it("reads a widget by widget_id when widget_uuid is omitted", async () => {
    mockReadWidget.mockReturnValue({ data: { rows: [{ symbol: "AAPL" }] } });

    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "read_widget",
        dashboard_id: "dashboard-1",
        widget_id: "price_history",
      } as never);
    });

    expect(mockReadWidget).toHaveBeenCalledWith("dashboard-1", "widget-instance-1");
    expect(response).toMatchObject({
      ok: true,
      command: "read_widget",
      data: {
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
      },
    });
  });

  it("reads a widget from the requested dashboard", async () => {
    mockReadWidget.mockReturnValue({ data: { rows: [{ symbol: "AAPL" }] } });

    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "read_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
      });
    });

    expect(mockReadWidget).toHaveBeenCalledWith("dashboard-1", "widget-instance-1");
    expect(response).toMatchObject({
      ok: true,
      command: "read_widget",
      data: {
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        widget: { data: { rows: [{ symbol: "AAPL" }] } },
      },
    });
  });

  it("rejects widget_uuid values that do not belong to the requested dashboard", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "read_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-2",
      });
    });

    expect(mockReadWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "read_widget",
      error: {
        code: "command_failed",
        message:
          "read_widget could not find widget_uuid 'widget-instance-2' on dashboard 'dashboard-1'. Call get_workspace_snapshot to list widget_uuids on each dashboard.",
      },
    });
  });

  it("normalizes param-options aliases before calling the existing hook", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_params_options",
        param_options_queries: [
          {
            origin: "OpenBB Sandbox",
            widget_id: "market_overview",
            optionsEndpointInputArgs: { provider: "fmp" },
            paramName: "symbol",
          },
        ],
      } as never);
    });

    expect(mockGetParamOptions).toHaveBeenCalledWith([
      {
        origin: "OpenBB Sandbox",
        id: "market_overview",
        options_endpoint_input_args: { provider: "fmp" },
        param: "symbol",
      },
    ]);
    expect(response).toMatchObject({
      ok: true,
      command: "get_params_options",
    });
  });

  it("fetches parameter options through the existing function-call hook", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_params_options",
        param_options_queries: [
          {
            origin: "OpenBB Sandbox",
            id: "market_overview",
            options_endpoint_input_args: { provider: "fmp" },
            param: "symbol",
          },
        ],
      });
    });

    expect(mockGetParamOptions).toHaveBeenCalledWith([
      {
        origin: "OpenBB Sandbox",
        id: "market_overview",
        options_endpoint_input_args: { provider: "fmp" },
        param: "symbol",
      },
    ]);
    expect(response).toMatchObject({
      ok: true,
      command: "get_params_options",
      data: [{ items: [{ content: '{"param": "symbol"}' }] }],
    });
  });

  it("creates dashboards through the settled manage_dashboard bridge command", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_dashboard",
        operation: "create",
        dashboard_id: "dashboard-created",
        name: "Research",
      });
    });

    expect(mockCreateDashboard).toHaveBeenCalledWith("dashboard-created", {
      name: "Research",
    });
    expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard-created", {
      replace: true,
    });
    expect(response).toMatchObject({
      ok: true,
      command: "manage_dashboard",
      data: {
        dashboard_id: "dashboard-created",
        name: "Research",
        active: true,
      },
    });
  });

  it("reads dashboards through the settled manage_dashboard bridge command", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_dashboard",
        operation: "read",
      });
    });

    expect(mockReadDashboard).toHaveBeenCalledWith("current-dashboard-id");
    expect(response).toMatchObject({
      ok: true,
      command: "manage_dashboard",
      data: {
        dashboard_id: "current-dashboard-id",
        dashboard: {
          id: "current-dashboard-id",
          name: "Current dashboard",
        },
      },
    });
  });

  it("updates dashboards through the settled manage_dashboard bridge command", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_dashboard",
        operation: "update",
        dashboard_id: "dashboard-1",
        name: "Renamed dashboard",
      });
    });

    expect(mockUpdateDashboard).toHaveBeenCalledWith("dashboard-1", {
      name: "Renamed dashboard",
    });
    expect(response).toMatchObject({
      ok: true,
      command: "manage_dashboard",
      data: {
        dashboard_id: "dashboard-1",
        name: "Renamed dashboard",
      },
    });
  });

  it("resolves the active_dashboard placeholder for manage_dashboard update", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_dashboard",
        operation: "update",
        dashboard_id: "active_dashboard",
        name: "Renamed dashboard",
      });
    });

    expect(mockUpdateDashboard).toHaveBeenCalledWith("current-dashboard-id", {
      name: "Renamed dashboard",
    });
    expect(response).toMatchObject({
      ok: true,
      command: "manage_dashboard",
      data: {
        dashboard_id: "current-dashboard-id",
        name: "Renamed dashboard",
      },
    });
  });

  it("still requires a name for manage_dashboard update", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_dashboard",
        operation: "update",
        dashboard_id: "dashboard-1",
      });
    });

    expect(mockUpdateDashboard).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "manage_dashboard",
      error: {
        code: "invalid_request",
        message: "manage_dashboard operation='update' requires name.",
      },
    });
  });

  it("echoes the request and reports the settled layout for update_dashboard_layout", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_dashboard_layout",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        x: 5,
        y: 3,
        w: 10,
        h: 8,
      });
    });

    expect(mockUpdateDashboardLayout).toHaveBeenCalledWith(
      "dashboard-1",
      "widget-instance-1",
      { x: 5, y: 3, w: 10, h: 8 },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "update_dashboard_layout",
      data: {
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        x: 5,
        y: 3,
        w: 10,
        h: 8,
        settled_layout: {
          tab_id: "__no_tab__",
          layout: [
            { widget_uuid: "widget-instance-1", x: 0, y: 0, w: 20, h: 10 },
            { widget_uuid: "widget-created", x: 20, y: 0, w: 20, h: 10 },
          ],
        },
      },
    });
    expect(response?.warnings).toEqual([expect.stringContaining("compaction")]);
  });

  it("uses the MCP-facing update_widget_layout name in layout validation errors", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_dashboard_layout",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        x: Number.NaN,
        y: 0,
        w: 10,
        h: 8,
      });
    });

    expect(mockUpdateDashboardLayout).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "update_dashboard_layout",
      error: {
        code: "invalid_request",
        message: "update_widget_layout requires numeric x, y, w, and h.",
      },
    });
  });

  it("uses the MCP-facing update_widget_layout name in widget lookup errors", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_dashboard_layout",
        dashboard_id: "dashboard-1",
        widget_uuid: "missing-widget",
        x: 0,
        y: 0,
        w: 10,
        h: 8,
      });
    });

    expect(response).toMatchObject({
      ok: false,
      command: "update_dashboard_layout",
      error: {
        code: "command_failed",
        message:
          "update_widget_layout could not find widget_uuid 'missing-widget' on dashboard 'dashboard-1'. Call get_workspace_snapshot to list widget_uuids on each dashboard.",
      },
    });
  });

  it("rejects removed bridge-only dashboard command names", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_dashboard",
        name: "Legacy",
      } as never);
    });

    expect(mockCreateDashboard).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "create_dashboard",
      error: {
        code: "invalid_request",
      },
    });
  });

  it("navigates dashboards through the settled navigate_workspace bridge command", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "navigate_workspace",
        operation: "dashboard",
        dashboard_id: "dashboard-1",
        tab_id: "tab-1",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/app/dashboard-1?tab=tab-1", {
      replace: true,
    });
    expect(response).toMatchObject({
      ok: true,
      command: "navigate_workspace",
      data: {
        dashboard_id: "dashboard-1",
        name: "Dashboard 1",
        tab_id: "tab-1",
      },
    });
  });

  it("switches tabs through the settled navigate_workspace bridge command", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "navigate_workspace",
        operation: "tab",
        tab_id: "tab-news",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      "/app/current-dashboard-id?tab=tab-news",
      {
        replace: true,
      },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "navigate_workspace",
      data: {
        dashboard_id: "current-dashboard-id",
        tab_id: "tab-news",
      },
    });
  });

  it("adds a snapshot hint when navigating to a missing dashboard", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "navigate_workspace",
        operation: "dashboard",
        dashboard_id: "missing-dashboard",
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "navigate_workspace",
      error: {
        code: "command_failed",
        message:
          "Dashboard 'missing-dashboard' not found. Call get_workspace_snapshot to list dashboard_ids.",
      },
    });
  });

  it("navigates to the dashboard default view for the __no_tab__ tab id", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "navigate_workspace",
        operation: "tab",
        tab_id: "__no_tab__",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/app/current-dashboard-id", {
      replace: true,
    });
    expect(response).toMatchObject({
      ok: true,
      command: "navigate_workspace",
      data: {
        dashboard_id: "current-dashboard-id",
        tab_id: "__no_tab__",
      },
    });
  });

  it("rejects unknown tab ids and lists the valid tab_ids", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "navigate_workspace",
        operation: "tab",
        tab_id: "bogus-tab",
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "navigate_workspace",
      error: {
        code: "invalid_request",
      },
    });
    expect(response?.error?.message).toContain("bogus-tab");
    expect(response?.error?.message).toContain("tab-news");
    expect(response?.error?.message).toContain("__no_tab__");
  });

  it("omits unsupported plain-create widgets from the available catalog", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "list_available_widgets",
      } as never);
    });

    expect(response).toMatchObject({
      ok: true,
      command: "list_available_widgets",
      data: {
        widgets: expect.arrayContaining([
          expect.objectContaining({ widget_id: "price_history" }),
          expect.objectContaining({
            origin: "OpenBB Sandbox",
            backend_name: "OpenBB Sandbox",
            widget_id: "company_filings",
          }),
        ]),
      },
    });
    expect(response?.data).not.toEqual(
      expect.objectContaining({
        widgets: expect.arrayContaining([
          expect.objectContaining({ widget_id: "watchlist" }),
        ]),
      }),
    );
  });

  it("loads schemas for built-in Sandbox widgets using the listed origin", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_schema",
        origin: "OpenBB Sandbox",
        widget_id: "company_filings",
      } as never);
    });

    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_schema",
      data: {
        widget: expect.objectContaining({
          origin: "OpenBB Sandbox",
          backend_name: "OpenBB Sandbox",
          widget_id: "company_filings",
        }),
      },
    });
  });

  it("adds a catalog hint when the widget schema is not found", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_schema",
        origin: "OpenBB Workspace",
        widget_id: "missing_widget",
      } as never);
    });

    expect(response).toMatchObject({
      ok: false,
      command: "get_widget_schema",
      error: {
        code: "command_failed",
        message:
          "Widget 'missing_widget' from origin 'OpenBB Workspace' was not found. Call list_available_widgets to get valid origin/widget_id pairs.",
      },
    });
  });

  it("includes grid_data in widget schema responses", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_schema",
        origin: "OpenBB Workspace",
        widget_id: "price_history",
      } as never);
    });

    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_schema",
      data: {
        widget: expect.objectContaining({
          widget_id: "price_history",
          grid_data: { w: 20, h: 10, min_w: 12, min_h: 4 },
        }),
      },
    });
  });

  it("marks option-backed params as lookup-required in widget schema responses", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_widget_schema",
        origin: "OpenBB Workspace",
        widget_id: "pyth_price_feeds",
      } as never);
    });

    expect(response).toMatchObject({
      ok: true,
      command: "get_widget_schema",
      data: {
        widget: expect.objectContaining({
          widget_id: "pyth_price_feeds",
          params: [
            expect.objectContaining({
              param_name: "symbols",
              requires_options_lookup: true,
              options_lookup_endpoint: "https://sdk.openbb.dev/udf/pyth-symbols",
            }),
          ],
        }),
      },
    });
  });

  it("rejects unsupported plain-create widgets explicitly", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "watchlist",
      } as never);
    });

    expect(mockCreateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "create_widget",
      error: {
        code: "invalid_request",
        message:
          "create_widget does not support 'watchlist'. watchlist still injects default watchlist data instead of honoring a deterministic symbol list.",
      },
    });
  });

  it("returns effective params, placement, and drop warnings from create_widget", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "price_history",
        config: {
          data_args: { symbol: "MSFT", bogus_param: "x" },
          ui_args: { name: "Renamed", custom_thing: 1 },
        },
      });
    });

    expect(response).toMatchObject({
      ok: true,
      command: "create_widget",
      data: {
        widget_uuid: "widget-created",
        dashboard_id: "dashboard-1",
        effective_params: { symbol: "MSFT" },
        grid_data: { x: 20, y: 0, w: 20, h: 10 },
        inner_tab: null,
      },
    });
    expect(response?.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("bogus_param"),
        expect.stringContaining("custom_thing"),
      ]),
    );
    // the dropped-key warning must list the declared params for recovery
    expect(
      response?.warnings?.find((warning) => warning.includes("bogus_param")),
    ).toContain("symbol");
  });

  it("does not warn when create_widget config matches the declared contract", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "price_history",
        config: {
          data_args: { symbol: "MSFT" },
          ui_args: { name: "Renamed" },
        },
      });
    });

    expect(response).toMatchObject({ ok: true, command: "create_widget" });
    expect(response?.warnings).toBeUndefined();
  });

  it("rejects update_widget calls without data_args or ui_args", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        config: { data_args: {}, ui_args: {} },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "update_widget",
      error: {
        code: "invalid_request",
        message:
          "update_widget requires data_args and/or ui_args; call get_widget_schema to see valid params.",
      },
    });
  });

  it("returns effective params and drop warnings from update_widget", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        config: { data_args: { symbol: "TSLA", nonsense: 1 } },
      });
    });

    expect(mockUpdateWidget).toHaveBeenCalledWith("dashboard-1", "widget-instance-1", {
      dataArgs: { symbol: "TSLA", nonsense: 1 },
      uiArgs: undefined,
    });
    expect(response).toMatchObject({
      ok: true,
      command: "update_widget",
      data: {
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        effective_params: { symbol: "AAPL" },
      },
    });
    expect(response?.warnings).toEqual([expect.stringContaining("nonsense")]);
    expect(response?.warnings?.[0]).toContain("symbol");
  });

  it("redirects layout ui_args to the MCP-facing update_widget_layout tool name", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        config: { ui_args: { x: 4 } },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "update_widget",
      error: {
        code: "invalid_request",
        message:
          "update_widget only supports widget-instance config updates. Use update_widget_layout for x/y/w/h, gridData, or tab placement.",
      },
    });
  });

  it("updates a widget with the provided config", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        config: {
          data_args: { symbol: "AAPL" },
          ui_args: { name: "Updated widget" },
        },
      });
    });

    expect(mockUpdateWidget).toHaveBeenCalledWith("dashboard-1", "widget-instance-1", {
      dataArgs: { symbol: "AAPL" },
      uiArgs: { name: "Updated widget" },
    });
    expect(response).toMatchObject({
      ok: true,
      command: "update_widget",
      data: {
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
      },
    });
  });

  it("create_widget dry_run returns effective params without mutating the store", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "price_history",
        dry_run: true,
        config: { data_args: { symbol: "NVDA" } },
      });
    });

    expect(mockCreateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      command: "create_widget",
      data: {
        valid: true,
        dashboard_id: "dashboard-1",
        effective_params: { symbol: "NVDA" },
        warnings: [],
      },
    });
  });

  it("create_widget dry_run reports dropped undeclared keys as warnings", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "price_history",
        dry_run: true,
        config: { data_args: { symbol: "NVDA", bogus_param: "x" } },
      });
    });

    expect(mockCreateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      command: "create_widget",
      data: {
        valid: true,
        effective_params: { symbol: "NVDA" },
      },
    });
    const data = response?.data as { warnings: string[] };
    expect(data.warnings).toEqual([expect.stringContaining("bogus_param")]);
    // the dropped-key warning must list the declared params for recovery
    expect(data.warnings[0]).toContain("symbol");
  });

  it("create_widget dry_run returns a normal error for an unknown widget_id", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "nonexistent_widget",
        dry_run: true,
        config: { data_args: { symbol: "NVDA" } },
      });
    });

    expect(mockCreateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "create_widget",
      error: {
        code: "command_failed",
        message:
          "Widget 'nonexistent_widget' not found in 'OpenBB Workspace'. Call list_available_widgets to get valid origin/widget_id pairs.",
      },
    });
  });

  it("update_widget dry_run merges updates over existing storage params without writing", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        dry_run: true,
        config: { data_args: { symbol: "TSLA" } },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      command: "update_widget",
      data: {
        valid: true,
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        // existing storage.params { symbol: "AAPL" } merged with the computed
        // update — without writing.
        effective_params: { symbol: "TSLA" },
        warnings: [],
      },
    });
  });

  it("update_widget dry_run keeps existing params and warns on undeclared keys", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        dry_run: true,
        config: { data_args: { nonsense: 1 } },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: true,
      command: "update_widget",
      data: {
        valid: true,
        effective_params: { symbol: "AAPL" },
      },
    });
    const data = response?.data as { warnings: string[] };
    expect(data.warnings).toEqual([expect.stringContaining("nonsense")]);
  });

  it("update_widget dry_run still requires widget_uuid or widget_id", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        dry_run: true,
        config: { data_args: { symbol: "TSLA" } },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "update_widget",
      error: {
        code: "invalid_request",
        message: "update_widget requires widget_uuid or widget_id.",
      },
    });
  });

  it("update_widget dry_run still rejects empty config", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "update_widget",
        dashboard_id: "dashboard-1",
        widget_uuid: "widget-instance-1",
        dry_run: true,
        config: { data_args: {}, ui_args: {} },
      });
    });

    expect(mockUpdateWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "update_widget",
      error: {
        code: "invalid_request",
        message:
          "update_widget requires data_args and/or ui_args; call get_widget_schema to see valid params.",
      },
    });
  });

  it("ignores a non-string innerTab from external callers instead of failing", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "create_widget",
        dashboard_id: "dashboard-1",
        backend_name: "OpenBB Workspace",
        widget_id: "price_history",
        config: {
          ui_args: { innerTab: 42 },
        },
      });
    });

    expect(mockCreateWidget).toHaveBeenCalledWith(
      "dashboard-1",
      "OpenBB Workspace",
      "price_history",
      { dataArgs: undefined, uiArgs: { innerTab: 42 } },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "create_widget",
    });
  });

  it("deletes a widget from the current dashboard when dashboard_id is omitted", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "delete_widget",
        widget_uuid: "widget-instance-2",
      });
    });

    expect(mockDeleteWidget).toHaveBeenCalledWith(
      "current-dashboard-id",
      "widget-instance-2",
    );
    expect(response).toMatchObject({
      ok: true,
      command: "delete_widget",
      data: {
        dashboard_id: "current-dashboard-id",
        widget_uuid: "widget-instance-2",
      },
    });
  });

  it("forwards navigation-bar commands with the explicit dashboard override", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_navigation_bar",
        dashboard_id: "dashboard-2",
        operation: "add_tabs",
        tabs: [{ name: "Charts" }],
      });
    });

    expect(mockManageNavigationBar).toHaveBeenCalledWith(
      {
        operation: "add_tabs",
        tabs: [{ name: "Charts" }],
      },
      { dashboardId: "dashboard-2" },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "manage_navigation_bar",
      data: {
        dashboard_id: "dashboard-2",
        results: [{ status: "success", message: "Added tabs: Charts" }],
      },
    });
  });

  it("treats active_dashboard as the current dashboard route", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "add_generative_widget",
        dashboard_id: "active_dashboard",
        widget_type: "note",
        data: "# Test note",
        name: "Bridge Note",
      });
    });

    expect(mockAddGenerativeWidget).toHaveBeenCalledWith(
      {
        widget_type: "note",
        data: "# Test note",
        name: "Bridge Note",
      },
      { dashboardId: "current-dashboard-id" },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "add_generative_widget",
      data: {
        dashboard_id: "current-dashboard-id",
        widget_uuid: "generated-widget-1",
      },
    });
  });

  it("treats null dashboard placeholders as the current dashboard route", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "manage_navigation_bar",
        dashboard_id: "null",
        operation: "add_tabs",
        tabs: [{ name: "Intel" }],
      });
    });

    expect(mockManageNavigationBar).toHaveBeenCalledWith(
      {
        operation: "add_tabs",
        tabs: [{ name: "Intel" }],
      },
      { dashboardId: "current-dashboard-id" },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "manage_navigation_bar",
      data: {
        dashboard_id: "current-dashboard-id",
      },
    });
  });

  it("assigns tasks through the existing agent-orchestration hook", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "assign_tasks_to_agents",
        task_requests: [
          {
            id: "task-1",
            description: "Review the dashboard",
            assigned_holder_url: "https://agents.example.com",
            assigned_agent_id: "agent-1",
          },
        ],
      });
    });

    expect(mockAssignTasksToAgents).toHaveBeenCalledWith(
      [
        {
          id: "task-1",
          description: "Review the dashboard",
          assigned_holder_url: "https://agents.example.com",
          assigned_agent_id: "agent-1",
        },
      ],
      expect.any(Function),
    );
    expect(response).toMatchObject({
      ok: true,
      command: "assign_tasks_to_agents",
      data: {
        results: [{ status: "success", message: "Task completed" }],
      },
    });
  });

  it("surfaces streamed agent errors during task assignment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        'event: copilotStatusUpdate\ndata: {"eventType":"ERROR","message":"Assigned agent failed"}\n\n',
        {
          headers: { "content-type": "text/event-stream" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    mockAssignTasksToAgents.mockImplementation(async (tasks, forwardMessageToAgent) => {
      try {
        await forwardMessageToAgent(tasks[0].description, "source-agent", {
          name: "Agent 1",
        });
        return [{ status: "success", message: "Task completed" }];
      } catch (error) {
        return [
          {
            status: "error",
            message: error instanceof Error ? error.message : "Assigned agent failed",
          },
        ];
      }
    });

    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "assign_tasks_to_agents",
        task_requests: [
          {
            id: "task-2",
            description: "Run the delegated task",
            assigned_holder_url: "https://agents.example.com",
            assigned_agent_id: "agent-1",
          },
        ],
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/query", {
      method: "POST",
    });
    expect(response).toMatchObject({
      ok: false,
      command: "assign_tasks_to_agents",
      error: {
        code: "command_failed",
        message: "Assigned agent failed",
      },
    });

    vi.unstubAllGlobals();
  });

  it("returns a bridge error when generative-widget creation fails", async () => {
    mockAddGenerativeWidget.mockResolvedValue([
      { status: "error", message: "Failed to add the generative widget to the target dashboard." },
    ]);

    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "add_generative_widget",
        dashboard_id: "dashboard-3",
        widget_type: "chart",
        data: [{ date: "2024-01-01", value: 1 }],
        name: "Bridge Chart",
        description: null,
        chart_params: {
          chartType: "line",
          xKey: "date",
          yKey: ["value"],
        },
      });
    });

    expect(mockAddGenerativeWidget).toHaveBeenCalledWith(
      {
        widget_type: "chart",
        data: [{ date: "2024-01-01", value: 1 }],
        name: "Bridge Chart",
        description: null,
        chart_params: {
          chartType: "line",
          xKey: "date",
          yKey: ["value"],
        },
      },
      { dashboardId: "dashboard-3" },
    );
    expect(response).toMatchObject({
      ok: false,
      command: "add_generative_widget",
      error: {
        code: "command_failed",
        message: "Failed to add the generative widget to the target dashboard.",
      },
    });
  });

  it("rejects invalid add_generative_widget arguments before delegating", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "add_generative_widget",
        dashboard_id: "dashboard-3",
        widget_type: "chart",
        data: "invalid",
        name: "Bridge Chart",
      } as never);
    });

    expect(mockAddGenerativeWidget).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      ok: false,
      command: "add_generative_widget",
      error: {
        code: "invalid_request",
      },
    });
    expect(response?.error?.message).toContain(
      "chart_params keys must be camelCase: chartType, xKey, yKey (yKey is an array of strings).",
    );
  });

  it("executes an agent tool through the existing MCP executor", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "execute_agent_tool",
        server_id: "context7",
        tool_name: "context7_get-library-docs",
        parameters: { library: "/openbb/docs" },
      });
    });

    expect(mockExecuteAgentTool).toHaveBeenCalledWith(
      "context7",
      "context7_get-library-docs",
      { library: "/openbb/docs" },
    );
    expect(response).toMatchObject({
      ok: true,
      command: "execute_agent_tool",
      data: [{ items: [{ content: '{"answer": 42}' }] }],
    });
  });

  describe("manage_apps", () => {
    beforeEach(() => {
      mockGetApiSourceById.mockImplementation((id: string) =>
        id === "backend-1" ? backendApiSource : undefined,
      );
    });

    it("lists apps across backends, shared templates, and saved apps when backend_id is omitted", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "list",
        } as never);
      });

      expect(response).toMatchObject({ ok: true, command: "manage_apps" });
      const { apps } = response?.data as { apps: Record<string, unknown>[] };
      expect(apps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Backend App",
            type: "backend",
            backend_id: "backend-1",
            backend_name: "My Custom Backend",
            is_shared: false,
          }),
          expect.objectContaining({
            name: "Shared Org App",
            type: "shared",
            backend_id: "shared-backend-1",
            backend_name: "Org Shared Backend",
            is_shared: true,
            created_by: "teammate@example.com",
          }),
          expect.objectContaining({
            name: "My Saved App",
            type: "saved",
            template_id: "saved-app-1",
            is_shared: false,
          }),
          expect.objectContaining({
            name: "Teammate Saved App",
            type: "saved",
            template_id: "shared-saved-app-1",
            is_shared: true,
          }),
        ]),
      );
    });

    it("scopes the app list to a shared backend when backend_id is provided", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "list",
          backend_id: "shared-backend-1",
        } as never);
      });

      expect(response).toMatchObject({ ok: true, command: "manage_apps" });
      const { apps } = response?.data as { apps: Record<string, unknown>[] };
      expect(apps).toHaveLength(1);
      expect(apps[0]).toMatchObject({ name: "Shared Org App", type: "shared" });
    });

    it("reads a shared app without backend_id", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "read",
          app_name: "Shared Org App",
        } as never);
      });

      expect(response).toMatchObject({
        ok: true,
        command: "manage_apps",
        data: {
          app: expect.objectContaining({
            name: "Shared Org App",
            type: "shared",
            is_shared: true,
            tabs: {},
          }),
        },
      });
    });

    it("instantiates a shared app using its shared backend source", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "instantiate",
          template_id: "shared-org-app",
        } as never);
      });

      expect(mockCreateCustomTemplateTab).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({ name: "Shared Org App" }),
          source: expect.objectContaining({ id: "shared-backend-1" }),
        }),
      );
      expect(mockNavigate).toHaveBeenCalledWith("/app/new-dashboard-1", {
        replace: true,
      });
      expect(response).toMatchObject({
        ok: true,
        command: "manage_apps",
        data: {
          dashboard_id: "new-dashboard-1",
          app_name: "Shared Org App",
          active: true,
        },
      });
    });

    it("instantiates a saved app from its stored widgets", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "instantiate",
          template_id: "saved-app-1",
        } as never);
      });

      expect(mockAddTab).toHaveBeenCalledWith(
        expect.objectContaining({
          index: expect.any(String),
          data: expect.objectContaining({
            name: "My Saved App",
            type: "custom",
            templateId: "custom-saved-app-1",
          }),
        }),
        true,
      );
      const [createdTab] = mockAddTab.mock.calls[0];
      expect(mockNavigate).toHaveBeenCalledWith(`/app/${createdTab.index}`, {
        replace: true,
      });
      expect(response).toMatchObject({
        ok: true,
        command: "manage_apps",
        data: {
          dashboard_id: createdTab.index,
          app_name: "My Saved App",
          active: true,
        },
      });
    });

    it("errors when backend_id does not match any owned or shared backend", async () => {
      const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

      let response: Awaited<ReturnType<typeof result.current>> | undefined;
      await act(async () => {
        response = await result.current({
          command: "manage_apps",
          operation: "list",
          backend_id: "missing-backend",
        } as never);
      });

      expect(response).toMatchObject({
        ok: false,
        command: "manage_apps",
        error: {
          code: "invalid_request",
          message: "Backend 'missing-backend' not found.",
        },
      });
    });
  });

  it("loads skill content from the skills library store", async () => {
    const { result } = renderHook(() => useWorkspaceBridgeCommandHandler());

    let response: Awaited<ReturnType<typeof result.current>> | undefined;
    await act(async () => {
      response = await result.current({
        command: "get_skill_content",
        slug: "equity-research",
        reason: "Need the full instructions",
      });
    });

    expect(mockGetSkillBySlug).toHaveBeenCalledWith("equity-research");
    expect(response).toMatchObject({
      ok: true,
      command: "get_skill_content",
      data: {
        skill: {
          slug: "equity-research",
          description: "Equity research instructions",
          contentMarkdown: "# Equity research",
          source: "model_selected",
        },
      },
    });
  });
});
