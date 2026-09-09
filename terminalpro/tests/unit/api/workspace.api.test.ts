import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeWidgetParamUpdates,
  computeWidgetUiUpdates,
  createWidget,
  deleteWidget,
  readWidget,
  updateDashboardLayout,
  updateWidget,
} from "~/api/workspace.api";
import type { WidgetT } from "~/components/types";

const mockGetAppWidget = vi.fn();
const mockAddWidget = vi.fn();
const mockGetTabWidgetById = vi.fn();
const mockGetWidgetGridData = vi.fn();
const mockUpdateTabWidgetsLayout = vi.fn();
const mockUpdateWidgetInStore = vi.fn();
const mockRemoveWidget = vi.fn();
const mockGetDashboardWidgetData = vi.fn();
const mockGetOrQueryTickers = vi.fn();
const mockTriggerCustomEvent = vi.fn();
const mockGetDashboardInfo = vi.fn();
const mockDeserializeDashboardTabId = vi.fn((...args: unknown[]) => args[0]);

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useGetWidgetsStore: {
    getState: () => ({
      getAppWidget: mockGetAppWidget,
    }),
  },
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      addWidget: mockAddWidget,
      getWidgetById: vi.fn(),
      getTabWidgetById: mockGetTabWidgetById,
      getWidgetGridData: mockGetWidgetGridData,
      updateTabWidgetsLayout: mockUpdateTabWidgetsLayout,
      updateWidget: mockUpdateWidgetInStore,
      removeWidget: mockRemoveWidget,
      items: {
        "dashboard-123": {
          data: {
            name: "Dashboard",
            widgets: [],
            groups: [],
            gridLayout: {
              "": [{ i: "widget-uuid-456", x: 0, y: 0, w: 20, h: 10 }],
              charts: [],
            },
          },
        },
      },
    }),
  },
}));

vi.mock("~/lib/state/copilotData", () => ({
  useCopilotDataStore: {
    getState: () => ({
      getDashboardWidgetData: mockGetDashboardWidgetData,
    }),
  },
}));

vi.mock("~/lib/state/tickers", () => ({
  tickersStore: {
    getState: () => ({
      getOrQueryTickers: mockGetOrQueryTickers,
    }),
  },
}));

vi.mock("~/lib/utils", () => ({
  triggerCustomEvent: (...args: unknown[]) => mockTriggerCustomEvent(...args),
}));

vi.mock("~/lib/utils/workspaceDashboard", () => ({
  getDashboardInfo: (...args: unknown[]) => mockGetDashboardInfo(...args),
  deserializeDashboardTabId: (...args: unknown[]) =>
    mockDeserializeDashboardTabId(...args),
}));

const createMockWidget = (overrides: Partial<WidgetT> = {}): WidgetT =>
  ({
    widgetId: "test-widget",
    name: "Test Widget",
    description: "A test widget",
    type: "chart",
    params: [],
    storage: {},
    data: {},
    ...overrides,
  }) as WidgetT;

const dashboardWidget = createMockWidget({
  id: "widget-uuid-456",
  widgetId: "test-widget",
  innerTab: "",
  params: [{ paramName: "symbol", type: "text" }],
});

describe("Workspace API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerCustomEvent.mockReturnValue(true);
    mockGetTabWidgetById.mockImplementation(
      (_dashboardId: string, widgetUuid: string) =>
        widgetUuid === dashboardWidget.id ? dashboardWidget : undefined,
    );
  });

  describe("createWidget", () => {
    const dashboardId = "dashboard-123";
    const backendName = "openbb";
    const widgetId = "stock-chart";
    const config = {
      dataArgs: { symbol: "AAPL" },
      uiArgs: { name: "Apple Stock" },
    };

    it("should create a widget and return its ID", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "stock-chart",
        params: [{ paramName: "symbol", type: "text" }],
      });
      const expectedWidgetId = "new-widget-uuid-123";

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue(expectedWidgetId);

      const result = await createWidget(dashboardId, backendName, widgetId, config);

      expect(mockGetAppWidget).toHaveBeenCalledWith("stock-chart", "openbb");
      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          widgetId: "stock-chart",
          name: "Apple Stock",
          storage: expect.objectContaining({
            params: { symbol: "AAPL" },
          }),
        }),
      );
      expect(result).toBe(expectedWidgetId);
    });

    it("should throw error when widget definition not found", async () => {
      mockGetAppWidget.mockReturnValue(undefined);

      await expect(
        createWidget(dashboardId, backendName, "nonexistent-widget", config),
      ).rejects.toThrow(
        "Widget 'nonexistent-widget' not found in 'openbb'. Call list_available_widgets to get valid origin/widget_id pairs.",
      );
    });

    it("should handle widget with no params", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "static-widget",
        params: [],
      });
      const expectedWidgetId = "widget-no-params";

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue(expectedWidgetId);

      const result = await createWidget(dashboardId, backendName, "static-widget", {});

      expect(result).toBe(expectedWidgetId);
      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({ params: {} }),
        }),
      );
    });

    it("should apply falsy param values (false, 0, empty string)", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "stock-chart",
        params: [
          { paramName: "raw", type: "boolean" },
          { paramName: "limit", type: "number" },
          { paramName: "query", type: "text" },
        ],
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, widgetId, {
        dataArgs: { raw: false, limit: 0, query: "" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({
            params: { raw: false, limit: 0, query: "" },
          }),
        }),
      );
    });

    it("should ignore null values in dataArgs", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "stock-chart",
        params: [
          { paramName: "symbol", type: "text" },
          { paramName: "period", type: "text" },
          { paramName: "interval", type: "text" },
          { paramName: "provider", type: "text" },
        ],
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, widgetId, {
        dataArgs: {
          symbol: "AAPL",
          period: "null",
          interval: null,
          provider: undefined,
        },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({
            params: { symbol: "AAPL" },
          }),
        }),
      );
    });

    it("should update widget name and description from uiArgs", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "stock-chart",
        name: "Original Name",
        description: "Original Description",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, widgetId, {
        uiArgs: { name: "New Name", description: "New Description" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          name: "New Name",
          description: "New Description",
        }),
      );
    });

    it("should store arbitrary uiArgs in storage", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "rich-note",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "rich-note", {
        uiArgs: { html: "<p>Note content</p>", customProp: "value" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({
            html: "<p>Note content</p>",
            customProp: "value",
          }),
        }),
      );
    });

    it("should persist chart view intent into both widget data and storage", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "sql-table",
        type: "table",
        data: {
          table: {
            showAll: true,
            enableCharts: true,
          },
        },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "sql-table", {
        uiArgs: {
          chartSettingsOpen: false,
          chartView: {
            enabled: true,
            chartType: "bar",
          },
        },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          data: expect.objectContaining({
            table: expect.objectContaining({
              enableCharts: true,
              chartView: expect.objectContaining({
                enabled: true,
                chartType: "column",
              }),
            }),
          }),
          storage: expect.objectContaining({
            chartSettingsOpen: false,
            chartView: {
              enabled: true,
              chartType: "column",
            },
          }),
        }),
      );
    });
  });

  describe("readWidget", () => {
    const dashboardId = "dashboard-123";
    const widgetUuid = "widget-uuid-456";

    it("should return widget data when found", () => {
      mockGetDashboardWidgetData.mockReturnValue({
        data: { value: 100 },
      });

      const result = readWidget(dashboardId, widgetUuid);

      expect(mockGetDashboardWidgetData).toHaveBeenCalledWith(widgetUuid);
      expect(result).toEqual(
        expect.objectContaining({
          widget_id: "test-widget",
          name: "Test Widget",
          inner_tab: "",
          data: { value: 100 },
        }),
      );
    });

    it("should throw error when widget not found", () => {
      mockGetTabWidgetById.mockReturnValue(undefined);

      expect(() => readWidget(dashboardId, widgetUuid)).toThrow(
        `Widget with UUID '${widgetUuid}' not found in dashboard '${dashboardId}'`,
      );
    });

    it("should still return widget metadata when rendered data is undefined", () => {
      mockGetDashboardWidgetData.mockReturnValue(undefined);

      const result = readWidget(dashboardId, widgetUuid);

      expect(result).toEqual(
        expect.objectContaining({
          widget_id: "test-widget",
          name: "Test Widget",
        }),
      );
      expect(result).not.toHaveProperty("data");
    });

    it("returns the stored note body as data when the copilot store has none", () => {
      // Generative notes store their (sanitized) body in storage.html and never
      // populate the copilot data store — read_widget must still echo the body.
      const noteWidget = createMockWidget({
        id: widgetUuid,
        widgetId: `rich_note-${widgetUuid}`,
        name: "XSS Probe",
        type: "custom",
        params: [],
        storage: { html: '<h1>Hi <img src="x" /></h1>' },
      });
      mockGetTabWidgetById.mockReturnValue(noteWidget);
      mockGetDashboardWidgetData.mockReturnValue(undefined);

      const result = readWidget(dashboardId, widgetUuid);

      expect(result?.data).toBe('<h1>Hi <img src="x" /></h1>');
    });

    it("prefers rendered copilot data over the stored note body", () => {
      const noteWidget = createMockWidget({
        id: widgetUuid,
        widgetId: `rich_note-${widgetUuid}`,
        type: "custom",
        storage: { html: "<p>stored</p>" },
      });
      mockGetTabWidgetById.mockReturnValue(noteWidget);
      mockGetDashboardWidgetData.mockReturnValue({ data: "<p>rendered</p>" });

      const result = readWidget(dashboardId, widgetUuid);

      expect(result?.data).toBe("<p>rendered</p>");
    });
  });

  describe("dashboard-not-found recovery hints", () => {
    it("updateDashboardLayout includes a snapshot hint when the dashboard is missing", () => {
      expect(() =>
        updateDashboardLayout("missing-dashboard", "widget-uuid-456", {
          x: 0,
          y: 0,
          w: 20,
          h: 10,
        }),
      ).toThrow(
        "Dashboard 'missing-dashboard' not found. Call get_workspace_snapshot to list dashboard_ids.",
      );
    });
  });

  describe("updateDashboardLayout", () => {
    const dashboardId = "dashboard-123";
    const widgetUuid = "widget-uuid-456";

    beforeEach(() => {
      mockGetDashboardInfo.mockReturnValue({
        id: dashboardId,
        tabs: [
          { tab_id: "__no_tab__", tab_name: "__no_tab__", widgets: [], layout: [] },
          { tab_id: "charts", tab_name: "Charts", widgets: [], layout: [] },
        ],
      });
      mockGetTabWidgetById.mockReturnValue(
        createMockWidget({
          id: widgetUuid,
          gridData: { x: 0, y: 0, w: 20, h: 10, minW: 12, minH: 4 },
        }),
      );
      mockGetWidgetGridData.mockReturnValue({
        i: widgetUuid,
        x: 0,
        y: 0,
        w: 20,
        h: 10,
        minW: 12,
        minH: 4,
      });
    });

    it("rejects widths below the widget minimum", () => {
      expect(() =>
        updateDashboardLayout(dashboardId, widgetUuid, {
          x: 0,
          y: 2,
          w: 10,
          h: 10,
        }),
      ).toThrow("Widget width 10 is below the minimum width 12.");
    });

    it("rejects placements outside the 40-column grid", () => {
      expect(() =>
        updateDashboardLayout(dashboardId, widgetUuid, {
          x: 25,
          y: 2,
          w: 20,
          h: 10,
        }),
      ).toThrow(
        "Widget layout must fit inside the 40-column grid: x + w must be <= 40.",
      );
    });

    it("updates layout when the placement is valid", () => {
      updateDashboardLayout(dashboardId, widgetUuid, {
        tabId: "charts",
        x: 0,
        y: 2,
        w: 20,
        h: 10,
      });

      expect(mockUpdateTabWidgetsLayout).toHaveBeenCalledTimes(2);
      expect(mockUpdateWidgetInStore).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          id: widgetUuid,
          innerTab: "charts",
        }),
      );
    });
  });

  describe("updateWidget", () => {
    const dashboardId = "dashboard-123";
    const widgetUuid = "widget-uuid-789";

    it("should update widget and trigger custom event", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "symbol", type: "text" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { symbol: "MSFT" },
      });

      expect(mockGetTabWidgetById).toHaveBeenCalledWith(dashboardId, widgetUuid);
      expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
        `updateWidget-${widgetUuid}`,
        expect.any(Function),
      );
    });

    it("should throw error when widget not found", async () => {
      mockGetTabWidgetById.mockReturnValue(null);

      await expect(
        updateWidget(dashboardId, widgetUuid, { dataArgs: { symbol: "AAPL" } }),
      ).rejects.toThrow(
        `Widget with UUID '${widgetUuid}' not found in dashboard '${dashboardId}'`,
      );
    });

    it("should throw error when widget is undefined", async () => {
      mockGetTabWidgetById.mockReturnValue(undefined);

      await expect(updateWidget(dashboardId, widgetUuid, {})).rejects.toThrow(
        `Widget with UUID '${widgetUuid}' not found in dashboard '${dashboardId}'`,
      );
    });

    it("should persist to the store even when no widget is listening (event returns false)", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "symbol", type: "text" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      // A non-cancelable event returns true even with no listener, so the old
      // `result === false` throw was dead; Fix B persists through the store so
      // widgets on inactive tabs still get the update.
      mockTriggerCustomEvent.mockReturnValue(false);

      await expect(
        updateWidget(dashboardId, widgetUuid, { dataArgs: { symbol: "AAPL" } }),
      ).resolves.toBeUndefined();

      expect(mockUpdateWidgetInStore).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          id: widgetUuid,
          storage: expect.objectContaining({
            params: expect.objectContaining({ symbol: "AAPL" }),
          }),
        }),
      );
    });

    it("should handle ticker parameter and query tickers", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "ticker", type: "ticker" }],
      });
      const mockTicker = { symbol: "AAPL", name: "Apple Inc." };

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({ AAPL: mockTicker });
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { ticker: "AAPL" },
      });

      expect(mockGetOrQueryTickers).toHaveBeenCalledWith("AAPL");
      expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
        `updateWidget-${widgetUuid}`,
        expect.any(Function),
      );
    });

    it("should not query tickers when ticker value is null string", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "ticker", type: "ticker" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { ticker: "null" },
      });

      expect(mockGetOrQueryTickers).not.toHaveBeenCalled();
    });

    it("should not query tickers when ticker value is empty", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "ticker", type: "ticker" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { ticker: "" },
      });

      expect(mockGetOrQueryTickers).not.toHaveBeenCalled();
    });

    it("should handle note widget type differently", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        type: "note",
        params: [],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        uiArgs: { html: "<p>Updated note</p>" },
      });

      expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
        `updateWidget-${widgetUuid}`,
        expect.objectContaining({
          type: "note",
          storage: expect.objectContaining({
            html: "<p>Updated note</p>",
          }),
        }),
      );
    });

    it("should handle rich_note widgetId differently", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        widgetId: "rich_note",
        type: "custom",
        params: [],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        uiArgs: { html: "<p>Rich note content</p>" },
      });

      expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
        `updateWidget-${widgetUuid}`,
        expect.objectContaining({
          widgetId: "rich_note",
          storage: expect.objectContaining({
            html: "<p>Rich note content</p>",
          }),
        }),
      );
    });

    it("should trigger updateQueryParams event for non-note widgets", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        type: "chart",
        params: [{ paramName: "symbol", type: "text" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { symbol: "GOOGL" },
      });

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === `updateWidget-${widgetUuid}`,
      );

      expect(updateFnCall).toBeDefined();

      if (typeof updateFnCall?.[1] === "function") {
        const updateFn = updateFnCall[1];
        updateFn(mockWidget);

        expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
          `updateQueryParams-${widgetUuid}`,
          expect.objectContaining({ symbol: "GOOGL" }),
        );
      }
    });

    it("should set mainTicker in widget data when ticker is resolved", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "symbol", type: "ticker" }],
      });
      const mockTicker = { symbol: "TSLA", name: "Tesla Inc.", id: "tsla-id" };

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({ TSLA: mockTicker });
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { symbol: "TSLA" },
      });

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === `updateWidget-${widgetUuid}`,
      );

      expect(updateFnCall).toBeDefined();

      if (typeof updateFnCall?.[1] === "function") {
        const updateFn = updateFnCall[1];
        const result = updateFn(mockWidget);

        expect(result.data).toEqual(
          expect.objectContaining({
            mainTicker: mockTicker,
          }),
        );
      }
    });

    it("should handle widget with no ticker params", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "date", type: "date" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { date: "2024-01-01" },
      });

      expect(mockGetOrQueryTickers).not.toHaveBeenCalled();
    });

    it("should preserve existing mainTicker metadata in the ticker fallback", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "symbol", type: "ticker" }],
        data: {
          mainTicker: {
            symbol: "NVDA",
            id: "NVDA",
            category: "crypto",
            type: "index",
            color: "#abc123",
          },
        },
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({});
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { symbol: "TSLA" },
      });

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === `updateWidget-${widgetUuid}`,
      );

      // Fallback overrides symbol/id but keeps other resolved fields (color, etc.)
      expect(updateFnCall?.[1]).toBeTypeOf("function");
      if (typeof updateFnCall?.[1] === "function") {
        const result = updateFnCall[1](mockWidget);
        expect(result.data.mainTicker).toEqual(
          expect.objectContaining({
            symbol: "TSLA",
            id: "TSLA",
            category: "crypto",
            type: "index",
            color: "#abc123",
          }),
        );
      }
    });

    it("should persist the updated widget (with mainTicker + params) to the store", async () => {
      const mockWidget = createMockWidget({
        id: widgetUuid,
        params: [{ paramName: "symbol", type: "ticker" }],
      });
      const mockTicker = { symbol: "TSLA", id: "TSLA", name: "Tesla Inc." };

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({ TSLA: mockTicker });
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget(dashboardId, widgetUuid, {
        dataArgs: { symbol: "TSLA" },
      });

      // Fix B: the update is written straight to the store (covers inactive-tab
      // widgets), carrying both the new mainTicker and storage params.
      expect(mockUpdateWidgetInStore).toHaveBeenCalledTimes(1);
      expect(mockUpdateWidgetInStore).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          id: widgetUuid,
          data: expect.objectContaining({ mainTicker: mockTicker }),
          storage: expect.objectContaining({
            params: expect.objectContaining({ symbol: "TSLA" }),
          }),
        }),
      );
    });
  });

  describe("deleteWidget", () => {
    const dashboardId = "dashboard-123";
    const widgetUuid = "widget-to-delete";

    it("should call removeWidget with correct parameters", async () => {
      mockGetTabWidgetById
        .mockReturnValueOnce(createMockWidget({ id: widgetUuid }))
        .mockReturnValueOnce(undefined);

      await deleteWidget(dashboardId, widgetUuid);

      expect(mockRemoveWidget).toHaveBeenCalledWith(dashboardId, widgetUuid);
      expect(mockRemoveWidget).toHaveBeenCalledTimes(1);
    });

    it("should throw when the widget does not belong to the dashboard", async () => {
      mockGetTabWidgetById.mockReturnValue(undefined);

      await expect(deleteWidget(dashboardId, widgetUuid)).rejects.toThrow(
        `Widget with UUID '${widgetUuid}' not found in dashboard '${dashboardId}'`,
      );
    });

    it("should handle multiple delete calls", async () => {
      mockGetTabWidgetById
        .mockReturnValueOnce(createMockWidget({ id: "widget-1" }))
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createMockWidget({ id: "widget-2" }))
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(createMockWidget({ id: "widget-3" }))
        .mockReturnValueOnce(undefined);

      await deleteWidget(dashboardId, "widget-1");
      await deleteWidget(dashboardId, "widget-2");
      await deleteWidget(dashboardId, "widget-3");

      expect(mockRemoveWidget).toHaveBeenCalledTimes(3);
      expect(mockRemoveWidget).toHaveBeenNthCalledWith(1, dashboardId, "widget-1");
      expect(mockRemoveWidget).toHaveBeenNthCalledWith(2, dashboardId, "widget-2");
      expect(mockRemoveWidget).toHaveBeenNthCalledWith(3, dashboardId, "widget-3");
    });
  });

  describe("updateWidgetState (internal helper via createWidget)", () => {
    const dashboardId = "dashboard-123";
    const backendName = "openbb";

    it("should preserve existing storage when updating", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        storage: {
          existingProp: "existing-value",
          params: { oldParam: "old" },
        },
        params: [{ paramName: "newParam", type: "text" }],
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "test-widget", {
        dataArgs: { newParam: "new" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({
            existingProp: "existing-value",
            params: expect.objectContaining({
              oldParam: "old",
              newParam: "new",
            }),
          }),
        }),
      );
    });

    it("should not overwrite uiArgs with null values", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        name: "Original Name",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "test-widget", {
        uiArgs: { name: null, customProp: null },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          name: "Original Name",
        }),
      );
    });

    it("should handle empty config object", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        params: [{ paramName: "symbol", type: "text" }],
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "test-widget", {});

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({ params: {} }),
        }),
      );
    });

    it("should handle widget with undefined storage", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        storage: undefined,
        params: [{ paramName: "param1", type: "text" }],
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget(dashboardId, backendName, "test-widget", {
        dataArgs: { param1: "value1" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        dashboardId,
        expect.objectContaining({
          storage: expect.objectContaining({
            params: { param1: "value1" },
          }),
        }),
      );
    });

    it("should extract gridData from uiArgs and merge onto widget.gridData", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        gridData: { x: 0, y: 0, w: 20, h: 10 },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { gridData: { w: 40, h: 12 }, customProp: "value" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        "dashboard-123",
        expect.objectContaining({
          gridData: { x: 0, y: 0, w: 40, h: 12 },
          storage: expect.objectContaining({ customProp: "value" }),
        }),
      );
      // gridData should NOT be in storage
      const widget = mockAddWidget.mock.calls[0][1];
      expect(widget.storage.gridData).toBeUndefined();
    });

    it("should not apply gridData when it is an array", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        gridData: { x: 0, y: 0, w: 20, h: 10 },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { gridData: [1, 2, 3] },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      // gridData should remain the original, not overridden
      expect(widget.gridData).toEqual({ x: 0, y: 0, w: 20, h: 10 });
      expect(widget.storage.gridData).toBeUndefined();
    });

    it("should filter out non-numeric gridData values", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        gridData: { x: 0, y: 0, w: 20, h: 10 },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { gridData: { w: "not-a-number", h: 12, x: Number.NaN } },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      // Only h: 12 should be applied (w is string, x is NaN)
      expect(widget.gridData).toEqual({ x: 0, y: 0, w: 20, h: 12 });
      expect(widget.storage.gridData).toBeUndefined();
    });

    it("should not apply gridData when it is null", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        gridData: { x: 0, y: 0, w: 20, h: 10 },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { gridData: null },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      expect(widget.gridData).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    });

    it("should extract innerTab from uiArgs and set on widget", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { innerTab: "overview", customProp: "value" },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      expect(widget.innerTab).toBe("overview");
      expect(widget.storage.innerTab).toBeUndefined();
      expect(widget.storage.customProp).toBe("value");
    });

    it("should not set innerTab when value is not a string", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { innerTab: 123 },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      expect(widget.innerTab).toBeUndefined();
      expect(widget.storage.innerTab).toBeUndefined();
    });

    it("should handle gridData and innerTab together", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        gridData: { x: 0, y: 0, w: 20, h: 10 },
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: {
          gridData: { w: 40, h: 12 },
          innerTab: "charts",
          html: "<p>content</p>",
        },
      });

      const widget = mockAddWidget.mock.calls[0][1];
      expect(widget.gridData).toEqual({ x: 0, y: 0, w: 40, h: 12 });
      expect(widget.innerTab).toBe("charts");
      expect(widget.storage.html).toBe("<p>content</p>");
      expect(widget.storage.gridData).toBeUndefined();
      expect(widget.storage.innerTab).toBeUndefined();
    });
  });

  describe("computeWidgetParamUpdates", () => {
    const paramsDef = [
      { paramName: "symbol", type: "text" },
      { paramName: "raw", type: "boolean" },
      { paramName: "limit", type: "number" },
      { paramName: "query", type: "text" },
    ] as WidgetT["params"];

    it("copies declared dataArgs values, preserving false, 0, and empty string", () => {
      const result = computeWidgetParamUpdates(paramsDef, {
        symbol: "AAPL",
        raw: false,
        limit: 0,
        query: "",
      });

      expect(result.params).toEqual({ symbol: "AAPL", raw: false, limit: 0, query: "" });
      expect(result.droppedKeys).toEqual([]);
    });

    it("skips undefined, null, and 'null' sentinel values", () => {
      const result = computeWidgetParamUpdates(paramsDef, {
        symbol: "AAPL",
        raw: undefined,
        limit: null,
        query: "null",
      });

      expect(result.params).toEqual({ symbol: "AAPL" });
      // declared-but-unset keys are sentinels, not undeclared keys
      expect(result.droppedKeys).toEqual([]);
    });

    it("collects dataArgs keys the widget does not declare as droppedKeys", () => {
      const result = computeWidgetParamUpdates(paramsDef, {
        symbol: "AAPL",
        bogus_param: "x",
        another: 1,
      });

      expect(result.params).toEqual({ symbol: "AAPL" });
      expect(result.droppedKeys).toEqual(["bogus_param", "another"]);
    });

    it("returns empty params and drops every key when the widget declares no params", () => {
      const result = computeWidgetParamUpdates(undefined, { someArg: "value" });

      expect(result.params).toEqual({});
      expect(result.droppedKeys).toEqual(["someArg"]);
    });

    it("handles missing dataArgs", () => {
      const result = computeWidgetParamUpdates(paramsDef, undefined);

      expect(result.params).toEqual({});
      expect(result.droppedKeys).toEqual([]);
    });
  });

  describe("computeWidgetUiUpdates", () => {
    it("routes name/description/source onto widget props and the rest to storage", () => {
      const result = computeWidgetUiUpdates({
        name: "New Name",
        description: "New Description",
        source: ["a", "b"],
        html: "<p>content</p>",
        customProp: "value",
      });

      expect(result.name).toBe("New Name");
      expect(result.description).toBe("New Description");
      expect(result.source).toEqual(["a", "b"]);
      expect(result.storage).toEqual({
        html: "<p>content</p>",
        customProp: "value",
      });
    });

    it("skips undefined, null, and 'null' values", () => {
      const result = computeWidgetUiUpdates({
        name: "null",
        description: null,
        source: undefined,
        customProp: null,
      });

      expect(result.name).toBeUndefined();
      expect(result.description).toBeUndefined();
      expect(result.source).toBeUndefined();
      expect(result.storage).toEqual({});
    });

    it("handles missing uiArgs", () => {
      const result = computeWidgetUiUpdates(undefined);

      expect(result).toEqual({ storage: {} });
    });
  });

  describe("edge cases", () => {
    it("should handle special characters in dashboard and widget IDs", async () => {
      const specialWidgetUuid = "widget-uuid_with.special-chars";

      mockGetTabWidgetById.mockReturnValue(createMockWidget({ id: specialWidgetUuid }));
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", specialWidgetUuid, {});

      expect(mockGetTabWidgetById).toHaveBeenCalledWith(
        "dashboard-123",
        specialWidgetUuid,
      );
    });

    it("should handle concurrent widget operations", async () => {
      const mockWidget = createMockWidget({
        params: [{ paramName: "value", type: "text" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      const updates = [
        updateWidget("dashboard-123", "widget-1", { dataArgs: { value: "a" } }),
        updateWidget("dashboard-123", "widget-2", { dataArgs: { value: "b" } }),
        updateWidget("dashboard-123", "widget-3", { dataArgs: { value: "c" } }),
      ];

      await expect(Promise.all(updates)).resolves.toBeDefined();
      expect(mockTriggerCustomEvent).toHaveBeenCalledTimes(3);
    });

    it("should fall back to a minimal ticker when getOrQueryTickers returns empty", async () => {
      const mockWidget = createMockWidget({
        params: [{ paramName: "ticker", type: "ticker" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({});
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", "widget", {
        dataArgs: { ticker: "UNKNOWN" },
      });

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === "updateWidget-widget",
      );

      // Fix A: SDK widgets fetch by data.mainTicker.symbol, so a failed lookup
      // must still update mainTicker to the requested symbol rather than leaving
      // it stale (which would silently skip the refetch).
      expect(updateFnCall?.[1]).toBeTypeOf("function");
      if (typeof updateFnCall?.[1] === "function") {
        const result = updateFnCall[1](mockWidget);
        expect(result.data?.mainTicker).toEqual(
          expect.objectContaining({
            symbol: "UNKNOWN",
            id: "UNKNOWN",
            category: "equity",
            type: "stock",
          }),
        );
      }
    });

    it("should propagate error when addWidget fails", async () => {
      const mockWidgetDef = createMockWidget({ widgetId: "test-widget" });
      const addWidgetError = new Error("Failed to add widget to dashboard");

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockRejectedValue(addWidgetError);

      await expect(
        createWidget("dashboard-123", "openbb", "test-widget", {}),
      ).rejects.toThrow("Failed to add widget to dashboard");
    });

    it("should handle getOrQueryTickers error gracefully", async () => {
      const mockWidget = createMockWidget({
        params: [{ paramName: "ticker", type: "ticker" }],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockRejectedValue(new Error("Network error"));

      await expect(
        updateWidget("dashboard-123", "widget", { dataArgs: { ticker: "AAPL" } }),
      ).rejects.toThrow("Network error");
    });

    it("should handle multiple ticker type params (uses first one)", async () => {
      const mockWidget = createMockWidget({
        params: [
          { paramName: "primaryTicker", type: "ticker" },
          { paramName: "secondaryTicker", type: "ticker" },
        ],
      });
      const mockTicker = { symbol: "AAPL", name: "Apple Inc." };

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockGetOrQueryTickers.mockResolvedValue({ AAPL: mockTicker });
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", "widget", {
        dataArgs: { primaryTicker: "AAPL", secondaryTicker: "MSFT" },
      });

      expect(mockGetOrQueryTickers).toHaveBeenCalledWith("AAPL");
      expect(mockGetOrQueryTickers).toHaveBeenCalledTimes(1);
    });

    it("should handle widget with undefined params array", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "no-params-widget",
        params: undefined,
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "no-params-widget", {
        dataArgs: { someArg: "value" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        "dashboard-123",
        expect.objectContaining({
          storage: expect.objectContaining({ params: {} }),
        }),
      );
    });

    it("should handle uiArgs with undefined values", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        name: "Original",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { name: undefined, description: undefined, customProp: undefined },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        "dashboard-123",
        expect.objectContaining({
          name: "Original",
        }),
      );
    });

    it("should handle uiArgs with 'null' string values", async () => {
      const mockWidgetDef = createMockWidget({
        widgetId: "test-widget",
        name: "Original",
        description: "Original Description",
      });

      mockGetAppWidget.mockReturnValue(mockWidgetDef);
      mockAddWidget.mockResolvedValue("widget-id");

      await createWidget("dashboard-123", "openbb", "test-widget", {
        uiArgs: { name: "null", description: "null" },
      });

      expect(mockAddWidget).toHaveBeenCalledWith(
        "dashboard-123",
        expect.objectContaining({
          name: "Original",
          description: "Original Description",
        }),
      );
    });

    it("should handle removeWidget throwing an error", async () => {
      mockGetTabWidgetById.mockReturnValue(createMockWidget({ id: "widget-123" }));
      mockRemoveWidget.mockImplementation(() => {
        throw new Error("Remove failed");
      });

      await expect(deleteWidget("dashboard-123", "widget-123")).rejects.toThrow(
        "Remove failed",
      );
    });

    it("should persist empty string param values instead of dropping them", async () => {
      const mockWidget = createMockWidget({
        params: [{ paramName: "value", type: "text" }],
        storage: { existingProp: "" },
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", "widget", {
        dataArgs: { value: "" },
      });

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === "updateWidget-widget",
      );

      expect(updateFnCall?.[1]).toBeTypeOf("function");
      if (typeof updateFnCall?.[1] === "function") {
        const result = updateFnCall[1](mockWidget);
        expect(result.storage.params.value).toBe("");
      }
    });

    it("should persist false and 0 param values on update", async () => {
      const mockWidget = createMockWidget({
        params: [
          { paramName: "raw", type: "boolean" },
          { paramName: "limit", type: "number" },
        ],
      });

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", "widget", {
        dataArgs: { raw: false, limit: 0 },
      });

      expect(mockUpdateWidgetInStore).toHaveBeenCalledWith(
        "dashboard-123",
        expect.objectContaining({
          storage: expect.objectContaining({
            params: expect.objectContaining({ raw: false, limit: 0 }),
          }),
        }),
      );
    });

    it("should fallback to empty object when storage.params is undefined", async () => {
      const mockWidget = createMockWidget({
        type: "chart",
        params: [],
        storage: undefined,
      }) as WidgetT;

      mockGetTabWidgetById.mockReturnValue(mockWidget);
      mockTriggerCustomEvent.mockReturnValue(true);

      await updateWidget("dashboard-123", "widget", {});

      const updateFnCall = mockTriggerCustomEvent.mock.calls.find(
        (call) => call[0] === "updateWidget-widget",
      );

      expect(updateFnCall).toBeDefined();

      if (typeof updateFnCall?.[1] === "function") {
        const updateFn = updateFnCall[1];
        updateFn(mockWidget);

        const updateQueryParamsCall = mockTriggerCustomEvent.mock.calls.find(
          (call) => call[0] === "updateQueryParams-widget",
        );
        expect(updateQueryParamsCall).toBeDefined();
        expect(updateQueryParamsCall?.[1]).toEqual({});
      }
    });
  });
});
