/**
 * Tests for charting Zustand store
 *
 * Tests the charting state management including:
 * - Symbol management per widget
 * - Security metrics tracking
 * - Widget data cleanup
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChartingStore, useTradingViewStore } from "~/lib/state/charting";

// Mock the tradingview store methods that charting store calls
vi.mock("~/lib/state/charting", async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

describe("useChartingStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useChartingStore.setState({
        widgetStates: {
          charting_page: {
            symbol: "AAPL",
            prevSymbol: "",
          },
        },
        widgetSecurities: { charting_page: { AAPL: { metrics: [] } } },
      });
    });

    // Also reset tradingview store
    act(() => {
      useTradingViewStore.setState({
        chartLayouts: {},
      });
    });
  });

  describe("initial state", () => {
    it("should have default charting_page widget state", () => {
      const state = useChartingStore.getState();

      expect(state.widgetStates.charting_page).toEqual({
        symbol: "AAPL",
        prevSymbol: "",
      });
    });

    it("should have default charting_page securities", () => {
      const state = useChartingStore.getState();

      expect(state.widgetSecurities.charting_page).toEqual({
        AAPL: { metrics: [] },
      });
    });
  });

  describe("getSymbol", () => {
    it("should return symbol for existing widget", () => {
      expect(useChartingStore.getState().getSymbol("charting_page")).toBe("AAPL");
    });

    it("should return AAPL for non-existent widget", () => {
      expect(useChartingStore.getState().getSymbol("unknown-widget")).toBe("AAPL");
    });

    it("should return updated symbol after change", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "MSFT");
      });

      expect(useChartingStore.getState().getSymbol("charting_page")).toBe("MSFT");
    });
  });

  describe("changeSymbol", () => {
    it("should change symbol for widget", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "GOOGL");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates.charting_page.symbol).toBe("GOOGL");
      expect(state.widgetStates.charting_page.prevSymbol).toBe("AAPL");
    });

    it("should not change if symbol is the same", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "AAPL");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates.charting_page.symbol).toBe("AAPL");
      expect(state.widgetStates.charting_page.prevSymbol).toBe("");
    });

    it("should create new widget state if widget does not exist", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("new-widget", "TSLA");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["new-widget"].symbol).toBe("TSLA");
      expect(state.widgetStates["new-widget"].prevSymbol).toBe("AAPL");
    });

    it("should track previous symbol correctly through multiple changes", () => {
      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "MSFT");
      });

      expect(useChartingStore.getState().widgetStates.charting_page.prevSymbol).toBe(
        "AAPL",
      );

      act(() => {
        useChartingStore.getState().changeSymbol("charting_page", "GOOGL");
      });

      expect(useChartingStore.getState().widgetStates.charting_page.prevSymbol).toBe(
        "MSFT",
      );
    });
  });

  describe("getSecurityMetrics", () => {
    it("should return empty array for widget with no metrics", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "AAPL"),
      ).toEqual([]);
    });

    it("should return empty array for non-existent widget", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("unknown-widget", "AAPL"),
      ).toEqual([]);
    });

    it("should return empty array for non-existent symbol", () => {
      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "UNKNOWN"),
      ).toEqual([]);
    });

    it("should return metrics after update", () => {
      const metrics = ["price", "volume"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics);
      });

      expect(
        useChartingStore.getState().getSecurityMetrics("charting_page", "AAPL"),
      ).toEqual(metrics);
    });
  });

  describe("updateSecurityMetrics", () => {
    it("should update metrics for existing widget and symbol", () => {
      const metrics = ["price", "volume", "marketCap"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics);
      });

      expect(
        useChartingStore.getState().widgetSecurities.charting_page.AAPL.metrics,
      ).toEqual(metrics);
    });

    it("should create widget securities if widget does not exist", () => {
      const metrics = ["price"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("new-widget", "MSFT", metrics);
      });

      expect(
        useChartingStore.getState().widgetSecurities["new-widget"].MSFT.metrics,
      ).toEqual(metrics);
    });

    it("should add new symbol to existing widget", () => {
      const metrics = ["volume"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "MSFT", metrics);
      });

      const state = useChartingStore.getState();
      expect(state.widgetSecurities.charting_page.MSFT.metrics).toEqual(metrics);
      expect(state.widgetSecurities.charting_page.AAPL.metrics).toEqual([]);
    });

    it("should replace existing metrics", () => {
      const metrics1 = ["price"] as any;
      const metrics2 = ["volume", "marketCap"] as any;

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics1);
      });

      act(() => {
        useChartingStore
          .getState()
          .updateSecurityMetrics("charting_page", "AAPL", metrics2);
      });

      expect(
        useChartingStore.getState().widgetSecurities.charting_page.AAPL.metrics,
      ).toEqual(metrics2);
    });
  });

  describe("removeWidgetData", () => {
    it("should remove widget state and securities", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-to-remove": { symbol: "MSFT", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-to-remove": { MSFT: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore.getState().removeWidgetData("widget-to-remove");
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-to-remove"]).toBeUndefined();
      expect(state.widgetSecurities["widget-to-remove"]).toBeUndefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });

    it("should not throw when removing non-existent widget", () => {
      expect(() => {
        act(() => {
          useChartingStore.getState().removeWidgetData("non-existent");
        });
      }).not.toThrow();
    });
  });

  describe("removeTabWidgetsData", () => {
    it("should remove multiple widgets at once", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-1": { symbol: "MSFT", prevSymbol: "" },
            "widget-2": { symbol: "GOOGL", prevSymbol: "" },
            "widget-3": { symbol: "TSLA", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-1": { MSFT: { metrics: [] } },
            "widget-2": { GOOGL: { metrics: [] } },
            "widget-3": { TSLA: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore
          .getState()
          .removeTabWidgetsData(["widget-1", "widget-2"]);
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-1"]).toBeUndefined();
      expect(state.widgetStates["widget-2"]).toBeUndefined();
      expect(state.widgetStates["widget-3"]).toBeDefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });

    it("should not modify state when empty array is passed", () => {
      const stateBefore = useChartingStore.getState();

      act(() => {
        useChartingStore.getState().removeTabWidgetsData([]);
      });

      const stateAfter = useChartingStore.getState();
      expect(stateAfter.widgetStates).toEqual(stateBefore.widgetStates);
    });

    it("should handle mixed existent and non-existent widgets", () => {
      act(() => {
        useChartingStore.setState({
          widgetStates: {
            charting_page: { symbol: "AAPL", prevSymbol: "" },
            "widget-1": { symbol: "MSFT", prevSymbol: "" },
          },
          widgetSecurities: {
            charting_page: { AAPL: { metrics: [] } },
            "widget-1": { MSFT: { metrics: [] } },
          },
        });
      });

      act(() => {
        useChartingStore
          .getState()
          .removeTabWidgetsData(["widget-1", "non-existent"]);
      });

      const state = useChartingStore.getState();
      expect(state.widgetStates["widget-1"]).toBeUndefined();
      expect(state.widgetStates.charting_page).toBeDefined();
    });
  });
});

describe("useTradingViewStore", () => {
  beforeEach(() => {
    act(() => {
      useTradingViewStore.setState({
        charts: [
          {
            name: "Main",
            content: "{}",
            symbol: "AAPL",
            resolution: "1D" as any,
            id: "test-chart-id" as any,
            // @ts-expect-error - ignored for now
            timestamp: 1697126934,
          },
        ],
        studyTemplates: [],
        drawingTemplates: [],
        chartTemplates: [],
        chartLayouts: {},
        initialSettings: { "StyleWidget.quicks": "[2,1]" },
      });
    });
  });

  describe("charts", () => {
    it("should get all charts", async () => {
      const charts = await useTradingViewStore.getState().getAllCharts();

      expect(charts).toHaveLength(1);
      expect(charts[0].name).toBe("Main");
      expect(charts[0].symbol).toBe("AAPL");
    });

    it("should save a new chart", async () => {
      const newChart = {
        name: "New Chart",
        content: '{"test": true}',
        symbol: "MSFT",
        resolution: "1H" as any,
        id: undefined as any,
        timestamp: 0,
      };

      const savedId = await useTradingViewStore.getState().saveChart(newChart);

      expect(savedId).toBeDefined();

      const charts = await useTradingViewStore.getState().getAllCharts();
      expect(charts).toHaveLength(2);
    });

    it("should update existing chart", async () => {
      const updatedChart = {
        name: "Updated Main",
        content: '{"updated": true}',
        symbol: "GOOGL",
        resolution: "1D" as any,
        id: "test-chart-id" as any,
        timestamp: 0,
      };

      await useTradingViewStore.getState().saveChart(updatedChart);

      const charts = await useTradingViewStore.getState().getAllCharts();
      expect(charts).toHaveLength(1);
      expect(charts[0].name).toBe("Updated Main");
      expect(charts[0].symbol).toBe("GOOGL");
    });

    it("should remove a chart", async () => {
      await useTradingViewStore.getState().removeChart("test-chart-id");

      const charts = await useTradingViewStore.getState().getAllCharts();
      expect(charts).toHaveLength(0);
    });

    it("should get chart content", async () => {
      const content = await useTradingViewStore
        .getState()
        .getChartContent("test-chart-id");

      expect(content).toBe("{}");
    });

    it("should return empty string for non-existent chart", async () => {
      const content = await useTradingViewStore
        .getState()
        .getChartContent("non-existent");

      expect(content).toBe("");
    });
  });

  describe("study templates", () => {
    it("should save study template", async () => {
      const template = { name: "My Template", content: '{"study": true}' };

      await useTradingViewStore.getState().saveStudyTemplate(template);

      const templates = await useTradingViewStore.getState().getAllStudyTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("My Template");
    });

    it("should remove study template", async () => {
      const template = { name: "To Remove", content: "{}" };
      await useTradingViewStore.getState().saveStudyTemplate(template);

      await useTradingViewStore.getState().removeStudyTemplate({ name: "To Remove" });

      const templates = await useTradingViewStore.getState().getAllStudyTemplates();
      expect(templates).toHaveLength(0);
    });

    it("should get study template content", async () => {
      const template = { name: "Content Test", content: '{"content": "test"}' };
      await useTradingViewStore.getState().saveStudyTemplate(template);

      const content = await useTradingViewStore
        .getState()
        .getStudyTemplateContent({ name: "Content Test" });

      expect(content).toBe('{"content": "test"}');
    });
  });

  describe("drawing templates", () => {
    it("should save drawing template", async () => {
      await useTradingViewStore
        .getState()
        .saveDrawingTemplate("line", "My Line", '{"line": true}');

      const templates = await useTradingViewStore.getState().getDrawingTemplates("line");
      expect(templates).toContain("My Line");
    });

    it("should load drawing template", async () => {
      await useTradingViewStore
        .getState()
        .saveDrawingTemplate("arrow", "My Arrow", '{"arrow": true}');

      const content = await useTradingViewStore
        .getState()
        .loadDrawingTemplate("arrow", "My Arrow");

      expect(content).toBe('{"arrow": true}');
    });

    it("should remove drawing template", async () => {
      await useTradingViewStore
        .getState()
        .saveDrawingTemplate("rect", "My Rect", "{}");

      await useTradingViewStore.getState().removeDrawingTemplate("rect", "My Rect");

      const content = await useTradingViewStore
        .getState()
        .loadDrawingTemplate("rect", "My Rect");

      expect(content).toBe("");
    });
  });

  describe("chart templates", () => {
    it("should save chart template", async () => {
      await useTradingViewStore
        .getState()
        .saveChartTemplate("Dark Theme", { test: true } as any);

      const templates = await useTradingViewStore.getState().getAllChartTemplates();
      expect(templates).toContain("Dark Theme");
    });

    it("should get chart template content", async () => {
      await useTradingViewStore
        .getState()
        .saveChartTemplate("Light Theme", { theme: "light" } as any);

      const template = await useTradingViewStore
        .getState()
        .getChartTemplateContent("Light Theme");

      expect(template.content).toEqual({ theme: "light" });
    });

    it("should remove chart template", async () => {
      await useTradingViewStore
        .getState()
        .saveChartTemplate("To Delete", {} as any);

      await useTradingViewStore.getState().removeChartTemplate("To Delete");

      const templates = await useTradingViewStore.getState().getAllChartTemplates();
      expect(templates).not.toContain("To Delete");
    });
  });

  describe("widget layouts", () => {
    it("should save widget layout", () => {
      const result = useTradingViewStore.getState().saveWidgetLayout(
        "widget-1",
        { data: "test" },
        { uid: "layout-1" } as any,
      );

      expect(result.saved_data).toEqual({ data: "test" });
      expect(result.meta_info.uid).toBe("layout-1");
    });

    it("should get widget layout", () => {
      useTradingViewStore.getState().saveWidgetLayout(
        "widget-2",
        { saved: true },
        { uid: "layout-2" } as any,
      );

      const layout = useTradingViewStore.getState().getWidgetLayout("widget-2");

      expect(layout.saved_data).toEqual({ saved: true });
    });

    it("should return empty layout for non-existent widget", () => {
      const layout = useTradingViewStore.getState().getWidgetLayout("non-existent");

      expect(layout.meta_info).toEqual({});
      expect(layout.saved_data).toEqual({});
    });

    it("should remove widget layout", () => {
      useTradingViewStore.getState().saveWidgetLayout(
        "widget-3",
        { data: "to-remove" },
        { uid: "layout-3" } as any,
      );

      useTradingViewStore.getState().removeWidgetLayout("widget-3");

      const layout = useTradingViewStore.getState().getWidgetLayout("widget-3");
      expect(layout.saved_data).toEqual({});
    });

    it("should not throw when removing non-existent layout", () => {
      expect(() => {
        useTradingViewStore.getState().removeWidgetLayout("non-existent");
      }).not.toThrow();
    });
  });

  describe("settings", () => {
    it("should set value", () => {
      useTradingViewStore.getState().setValue("theme", "dark");

      const state = useTradingViewStore.getState();
      expect(state.initialSettings.theme).toBe("dark");
    });

    it("should remove value", () => {
      useTradingViewStore.getState().setValue("toRemove", "value");
      useTradingViewStore.getState().removeValue("toRemove");

      const state = useTradingViewStore.getState();
      expect(state.initialSettings.toRemove).toBeUndefined();
    });

    it("should check if sidebar is hidden", () => {
      expect(useTradingViewStore.getState().getIsSidebarHidden()).toBe(false);

      useTradingViewStore.getState().setValue("ChartDrawingToolbarWidget.visible", "false");

      expect(useTradingViewStore.getState().getIsSidebarHidden()).toBe(true);
    });
  });

  describe("TV state", () => {
    it("should get full TV state", () => {
      const state = useTradingViewStore.getState().getTVState();

      expect(state).toHaveProperty("charts_state");
      expect(state).toHaveProperty("settings");
      expect(state.charts_state).toHaveProperty("charts");
      expect(state.charts_state).toHaveProperty("studyTemplates");
      expect(state.charts_state).toHaveProperty("drawingTemplates");
      expect(state.charts_state).toHaveProperty("chartTemplates");
      expect(state.charts_state).toHaveProperty("chartLayouts");
    });

    it("should update TV state", () => {
      const newState = {
        charts_state: {
          charts: [],
          studyTemplates: [],
          drawingTemplates: [],
          chartTemplates: [],
          chartLayouts: {},
        },
        settings: { newSetting: "value" },
      };

      useTradingViewStore.getState().updateTVState(newState);

      const state = useTradingViewStore.getState();
      expect(state.initialSettings.newSetting).toBe("value");
    });

    it("should not update when empty state is passed", () => {
      const beforeState = useTradingViewStore.getState().getTVState();

      useTradingViewStore.getState().updateTVState({});

      const afterState = useTradingViewStore.getState().getTVState();
      expect(afterState.settings).toEqual(beforeState.settings);
    });
  });

  describe("removeTabWidgetsData", () => {
    it("should remove multiple widget layouts", () => {
      useTradingViewStore.getState().saveWidgetLayout(
        "tab-widget-1",
        { data: "1" },
        {} as any,
      );
      useTradingViewStore.getState().saveWidgetLayout(
        "tab-widget-2",
        { data: "2" },
        {} as any,
      );
      useTradingViewStore.getState().saveWidgetLayout(
        "tab-widget-3",
        { data: "3" },
        {} as any,
      );

      useTradingViewStore
        .getState()
        .removeTabWidgetsData(["tab-widget-1", "tab-widget-2"]);

      const state = useTradingViewStore.getState();
      expect(state.chartLayouts["tab-widget-1"]).toBeUndefined();
      expect(state.chartLayouts["tab-widget-2"]).toBeUndefined();
      expect(state.chartLayouts["tab-widget-3"]).toBeDefined();
    });
  });
});
