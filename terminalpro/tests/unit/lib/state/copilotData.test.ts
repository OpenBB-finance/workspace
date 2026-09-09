/**
 * Tests for copilotData Zustand store
 *
 * Tests the copilot data state management including:
 * - Widget data management (dashboard widgets, selected widgets)
 * - Signature tracking for widgets
 * - Mention tracking for @mentions
 * - Pre-selected widget tracking
 * - Widget subset data management
 * - Runtime state for widgets
 * - Toggle states (extra widgets, generative UI)
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import { type DashboardWidgetData, useCopilotDataStore } from "~/lib/state/copilotData";

// Mock external dependencies
vi.mock("~/components/AI/hooks/utils", () => ({
  compareSignatures: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
  createSignatureMap: vi.fn((widgets, data) => {
    const map: Record<string, any> = {};
    if (widgets) {
      for (const widget of widgets) {
        map[widget.id] = { widgetId: widget.widgetId, data: data?.[widget.id] };
      }
    }
    return map;
  }),
}));

vi.mock("lodash.debounce", () => ({
  default: (fn: any) => {
    const debounced = (...args: any[]) => fn(...args);
    debounced.cancel = vi.fn();
    return debounced;
  },
}));

const createMockWidget = (overrides: Partial<WidgetT> = {}): WidgetT =>
  ({
    id: "widget-1",
    widgetId: "chart",
    name: "Chart Widget",
    innerTab: "overview",
    groupId: null,
    data: {
      mainTicker: { symbol: "AAPL", id: "AAPL", category: "equity", type: "stock" },
    },
    ...overrides,
  }) as WidgetT;

const createMockDashboardWidgetData = (
  overrides: Partial<DashboardWidgetData> = {},
): DashboardWidgetData => ({
  title: "Test Widget",
  description: "A test widget",
  endpointUrl: "/api/test",
  metadata: { key: "value" },
  data: { content: "test data" },
  ...overrides,
});

describe("useCopilotDataStore", () => {
  beforeEach(() => {
    act(() => {
      useCopilotDataStore.setState({
        copilotWidgets: {
          selectedWidgets: [],
          dashboardWidgets: [],
          allDashboardWidgets: [],
          temporaryWidgets: [],
          allWidgets: [],
        },
        copilotWidgetsLastUpdated: 0,
        signaturesMap: {},
        widgetsLastUpdated: 0,
        widgetsInCurrentDashboard: [],
        dashboardWidgetsData: {},
        widgetSubsetData: [],
        selectedWidgetIDs: [],
        mentionTrackedWidgetUuids: new Set<string>(),
        preSelectedWidgetUuids: new Set<string>(),
        widgetRuntimeState: new Map<string, any>(),
        extraWidgetsEnabled: false,
        generativeUiEnabled: false,
      });
    });
  });

  describe("initial state", () => {
    it("should have correct default values", () => {
      const state = useCopilotDataStore.getState();

      expect(state.copilotWidgets).toEqual({
        selectedWidgets: [],
        dashboardWidgets: [],
        allDashboardWidgets: [],
        temporaryWidgets: [],
        allWidgets: [],
      });
      expect(state.copilotWidgetsLastUpdated).toBe(0);
      expect(state.signaturesMap).toEqual({});
      expect(state.widgetsLastUpdated).toBe(0);
      expect(state.widgetsInCurrentDashboard).toEqual([]);
      expect(state.dashboardWidgetsData).toEqual({});
      expect(state.widgetSubsetData).toEqual([]);
      expect(state.selectedWidgetIDs).toEqual([]);
      expect(state.mentionTrackedWidgetUuids.size).toBe(0);
      expect(state.preSelectedWidgetUuids.size).toBe(0);
      expect(state.widgetRuntimeState.size).toBe(0);
      expect(state.extraWidgetsEnabled).toBe(false);
      expect(state.generativeUiEnabled).toBe(false);
    });
  });

  describe("setCopilotWidgets", () => {
    it("should update copilot widgets partially", () => {
      const selectedWidgets = [{ uuid: "1", name: "Widget 1" }] as any;

      act(() => {
        useCopilotDataStore.getState().setCopilotWidgets({ selectedWidgets });
      });

      const state = useCopilotDataStore.getState();
      expect(state.copilotWidgets.selectedWidgets).toEqual(selectedWidgets);
      expect(state.copilotWidgets.dashboardWidgets).toEqual([]);
    });

    it("should update copilotWidgetsLastUpdated timestamp", () => {
      const before = Date.now();

      act(() => {
        useCopilotDataStore.getState().setCopilotWidgets({ selectedWidgets: [] });
      });

      const state = useCopilotDataStore.getState();
      expect(state.copilotWidgetsLastUpdated).toBeGreaterThanOrEqual(before);
    });

    it("should merge with existing copilot widgets", () => {
      act(() => {
        useCopilotDataStore.getState().setCopilotWidgets({
          selectedWidgets: [{ uuid: "1" }] as any,
        });
      });

      act(() => {
        useCopilotDataStore.getState().setCopilotWidgets({
          dashboardWidgets: [{ uuid: "2" }] as any,
        });
      });

      const state = useCopilotDataStore.getState();
      expect(state.copilotWidgets.selectedWidgets).toHaveLength(1);
      expect(state.copilotWidgets.dashboardWidgets).toHaveLength(1);
    });
  });

  describe("getCopilotWidgets", () => {
    it("should return all copilot widgets when no target agent", () => {
      const widgets = {
        selectedWidgets: [{ uuid: "1" }] as any,
        dashboardWidgets: [{ uuid: "2" }] as any,
        allDashboardWidgets: [],
        temporaryWidgets: [],
        allWidgets: [],
      };

      act(() => {
        useCopilotDataStore.setState({ copilotWidgets: widgets });
      });

      const result = useCopilotDataStore.getState().getCopilotWidgets();
      expect(result).toEqual(widgets);
    });

    it("should filter widgets based on agent features", () => {
      const widgets = {
        selectedWidgets: [{ uuid: "1" }] as any,
        dashboardWidgets: [{ uuid: "2" }] as any,
        allDashboardWidgets: [{ uuid: "3" }] as any,
        temporaryWidgets: [{ uuid: "4" }] as any,
        allWidgets: [{ uuid: "5" }] as any,
      };

      act(() => {
        useCopilotDataStore.setState({ copilotWidgets: widgets });
      });

      const agent = {
        features: {
          "widget-dashboard-select": false,
          "file-upload": true,
          "widget-global-search": true,
        },
      } as any;

      const result = useCopilotDataStore.getState().getCopilotWidgets(agent);

      expect(result.selectedWidgets).toEqual([]);
      expect(result.dashboardWidgets).toEqual([]);
      expect(result.allDashboardWidgets).toEqual([]);
      expect(result.temporaryWidgets).toHaveLength(1);
      expect(result.allWidgets).toHaveLength(1);
    });

    it("should clear workspaceState.current_dashboard_info when widget-dashboard-select is disabled", () => {
      const widgets = {
        selectedWidgets: [],
        dashboardWidgets: [],
        allDashboardWidgets: [],
        temporaryWidgets: [],
        allWidgets: [],
        workspaceState: {
          current_dashboard_info: { id: "dashboard-1" },
        },
      };

      act(() => {
        useCopilotDataStore.setState({ copilotWidgets: widgets as any });
      });

      const agent = {
        features: { "widget-dashboard-select": false },
      } as any;

      const result = useCopilotDataStore.getState().getCopilotWidgets(agent);
      expect(result.workspaceState?.current_dashboard_info).toBeNull();
    });
  });

  describe("setWidgetsInCurrentDashboard", () => {
    it("should set widgets in current dashboard", () => {
      const widgets = [createMockWidget(), createMockWidget({ id: "widget-2" })];

      act(() => {
        useCopilotDataStore
          .getState()
          .setWidgetsInCurrentDashboard(widgets as WidgetT[]);
      });

      const state = useCopilotDataStore.getState();
      expect(state.widgetsInCurrentDashboard).toHaveLength(2);
    });

    it("should trigger signature map update", async () => {
      const widgets = [createMockWidget()];

      act(() => {
        useCopilotDataStore
          .getState()
          .setWidgetsInCurrentDashboard(widgets as WidgetT[]);
      });

      await vi.waitFor(() => {
        expect(useCopilotDataStore.getState().widgetsLastUpdated).toBeGreaterThan(0);
      });
    });
  });

  describe("getWidgetsInCurrentDashboard", () => {
    it("should return all widgets when no uuid provided", () => {
      const widgets = [createMockWidget(), createMockWidget({ id: "widget-2" })];

      act(() => {
        useCopilotDataStore.setState({
          widgetsInCurrentDashboard: widgets as WidgetT[],
        });
      });

      const result = useCopilotDataStore.getState().getWidgetsInCurrentDashboard();
      expect(result).toHaveLength(2);
    });

    it("should return specific widget when uuid provided", () => {
      const widget1 = createMockWidget({ id: "widget-1", name: "Widget 1" });
      const widget2 = createMockWidget({ id: "widget-2", name: "Widget 2" });

      act(() => {
        useCopilotDataStore.setState({
          widgetsInCurrentDashboard: [widget1, widget2] as WidgetT[],
        });
      });

      const result = useCopilotDataStore
        .getState()
        .getWidgetsInCurrentDashboard("widget-2");
      expect((result as WidgetT).name).toBe("Widget 2");
    });

    it("should return undefined for non-existent widget", () => {
      act(() => {
        useCopilotDataStore.setState({
          widgetsInCurrentDashboard: [createMockWidget()] as WidgetT[],
        });
      });

      const result = useCopilotDataStore
        .getState()
        .getWidgetsInCurrentDashboard("non-existent");
      expect(result).toBeUndefined();
    });
  });

  describe("Dashboard Widget Data", () => {
    describe("addDataOnDashboardWidget", () => {
      it("should add data for a widget", () => {
        const data = createMockDashboardWidgetData();

        act(() => {
          useCopilotDataStore.getState().addDataOnDashboardWidget("widget-1", data);
        });

        const state = useCopilotDataStore.getState();
        expect(state.dashboardWidgetsData["widget-1"]).toEqual(data);
      });

      it("should update existing widget data", () => {
        const initialData = createMockDashboardWidgetData({ title: "Initial" });
        const updatedData = createMockDashboardWidgetData({ title: "Updated" });

        act(() => {
          useCopilotDataStore
            .getState()
            .addDataOnDashboardWidget("widget-1", initialData);
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .addDataOnDashboardWidget("widget-1", updatedData);
        });

        expect(
          useCopilotDataStore.getState().dashboardWidgetsData["widget-1"].title,
        ).toBe("Updated");
      });

      it("should trigger widgetsLastUpdated update", async () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .addDataOnDashboardWidget("widget-1", createMockDashboardWidgetData());
        });

        await vi.waitFor(() => {
          expect(useCopilotDataStore.getState().widgetsLastUpdated).toBeGreaterThan(0);
        });
      });

      it("should not promote executed params without pending params", () => {
        act(() => {
          useCopilotDataStore.getState().addDataOnDashboardWidget("widget-1", {
            ...createMockDashboardWidgetData(),
            captureExecutedParams: true,
            metadata: { params: { query: "SELECT 1" } },
          });
        });

        expect(
          useCopilotDataStore.getState().getWidgetRuntimeState("widget-1")
            ?.copilotExecutedParams,
        ).toBeUndefined();
      });

      it("should promote pending params to executed params when captureExecutedParams is true", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .beginWidgetCopilotExecution("widget-1", { query: "SELECT A" });
        });

        act(() => {
          useCopilotDataStore.getState().addDataOnDashboardWidget("widget-1", {
            ...createMockDashboardWidgetData(),
            captureExecutedParams: true,
            metadata: { params: { query: "SELECT B" } },
          });
        });

        const runtimeState = useCopilotDataStore
          .getState()
          .getWidgetRuntimeState("widget-1");
        expect(runtimeState?.copilotExecutedParams).toEqual({ query: "SELECT A" });
        expect(runtimeState?.copilotPendingParams).toBeUndefined();
      });
    });

    describe("getDashboardWidgetData", () => {
      it("should return data for existing widget", () => {
        const data = createMockDashboardWidgetData();

        act(() => {
          useCopilotDataStore.setState({ dashboardWidgetsData: { "widget-1": data } });
        });

        const result = useCopilotDataStore
          .getState()
          .getDashboardWidgetData("widget-1");
        expect(result).toEqual(data);
      });

      it("should return undefined for non-existent widget", () => {
        const result = useCopilotDataStore
          .getState()
          .getDashboardWidgetData("non-existent");
        expect(result).toBeUndefined();
      });

      it("should return undefined when no uuid provided", () => {
        const result = useCopilotDataStore.getState().getDashboardWidgetData();
        expect(result).toBeUndefined();
      });
    });

    describe("getDashboardWidgetsData", () => {
      it("should return all dashboard widgets data", () => {
        const data = {
          "widget-1": createMockDashboardWidgetData({ title: "Widget 1" }),
          "widget-2": createMockDashboardWidgetData({ title: "Widget 2" }),
        };

        act(() => {
          useCopilotDataStore.setState({ dashboardWidgetsData: data });
        });

        const result = useCopilotDataStore.getState().getDashboardWidgetsData();
        expect(result).toEqual(data);
      });
    });

    describe("removeDataFromDashboardWidget", () => {
      it("should remove data for a widget", () => {
        act(() => {
          useCopilotDataStore.setState({
            dashboardWidgetsData: {
              "widget-1": createMockDashboardWidgetData(),
              "widget-2": createMockDashboardWidgetData(),
            },
          });
        });

        act(() => {
          useCopilotDataStore.getState().removeDataFromDashboardWidget("widget-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.dashboardWidgetsData["widget-1"]).toBeUndefined();
        expect(state.dashboardWidgetsData["widget-2"]).toBeDefined();
      });

      it("should not remove widget with data when checkData is true", () => {
        act(() => {
          useCopilotDataStore.setState({
            dashboardWidgetsData: {
              "widget-1": createMockDashboardWidgetData({ data: { content: "test" } }),
            },
          });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .removeDataFromDashboardWidget("widget-1", true);
        });

        expect(
          useCopilotDataStore.getState().dashboardWidgetsData["widget-1"],
        ).toBeDefined();
      });

      it("should remove widget without data when checkData is true", () => {
        act(() => {
          useCopilotDataStore.setState({
            dashboardWidgetsData: {
              "widget-1": createMockDashboardWidgetData({ data: undefined }),
            },
          });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .removeDataFromDashboardWidget("widget-1", true);
        });

        expect(
          useCopilotDataStore.getState().dashboardWidgetsData["widget-1"],
        ).toBeUndefined();
      });

      it("should not throw when removing non-existent widget", () => {
        expect(() => {
          act(() => {
            useCopilotDataStore
              .getState()
              .removeDataFromDashboardWidget("non-existent");
          });
        }).not.toThrow();
      });
    });
  });

  describe("Selected Widgets", () => {
    describe("isWidgetSelected", () => {
      it("should return true for selected widget", () => {
        act(() => {
          useCopilotDataStore.setState({ selectedWidgetIDs: ["widget-1", "widget-2"] });
        });

        expect(useCopilotDataStore.getState().isWidgetSelected("widget-1")).toBe(true);
      });

      it("should return false for non-selected widget", () => {
        act(() => {
          useCopilotDataStore.setState({ selectedWidgetIDs: ["widget-1"] });
        });

        expect(useCopilotDataStore.getState().isWidgetSelected("widget-2")).toBe(false);
      });
    });

    describe("toggleSelectedWidget", () => {
      it("should add widget to selected when not selected", async () => {
        vi.useFakeTimers();

        act(() => {
          useCopilotDataStore.getState().toggleSelectedWidget("widget-1");
        });

        await act(async () => {
          vi.advanceTimersByTime(150);
        });

        expect(useCopilotDataStore.getState().selectedWidgetIDs).toContain("widget-1");

        vi.useRealTimers();
      });

      it("should remove widget from selected when already selected", async () => {
        vi.useFakeTimers();

        act(() => {
          useCopilotDataStore.setState({ selectedWidgetIDs: ["widget-1"] });
        });

        act(() => {
          useCopilotDataStore.getState().toggleSelectedWidget("widget-1");
        });

        await act(async () => {
          vi.advanceTimersByTime(150);
        });

        expect(useCopilotDataStore.getState().selectedWidgetIDs).not.toContain(
          "widget-1",
        );

        vi.useRealTimers();
      });
    });

    describe("removeWidgetSelected", () => {
      it("should remove widget from selected", () => {
        act(() => {
          useCopilotDataStore.setState({ selectedWidgetIDs: ["widget-1", "widget-2"] });
        });

        act(() => {
          useCopilotDataStore.getState().removeWidgetSelected("widget-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.selectedWidgetIDs).not.toContain("widget-1");
        expect(state.selectedWidgetIDs).toContain("widget-2");
      });
    });

    describe("clearSelectedWidgets", () => {
      it("should clear all selected widgets", () => {
        act(() => {
          useCopilotDataStore.setState({ selectedWidgetIDs: ["widget-1", "widget-2"] });
        });

        act(() => {
          useCopilotDataStore.getState().clearSelectedWidgets();
        });

        expect(useCopilotDataStore.getState().selectedWidgetIDs).toEqual([]);
      });
    });

    describe("getSelectedWidgetsData", () => {
      it("should return data for selected widgets only", () => {
        act(() => {
          useCopilotDataStore.setState({
            selectedWidgetIDs: ["widget-1"],
            dashboardWidgetsData: {
              "widget-1": createMockDashboardWidgetData({ title: "Selected" }),
              "widget-2": createMockDashboardWidgetData({ title: "Not Selected" }),
            },
          });
        });

        const result = useCopilotDataStore.getState().getSelectedWidgetsData();
        expect(Object.keys(result)).toHaveLength(1);
        expect(result["widget-1"].title).toBe("Selected");
      });
    });
  });

  describe("Widget Subset Data", () => {
    describe("addWidgetSubsetData", () => {
      it("should add subset data for a widget", () => {
        act(() => {
          useCopilotDataStore.setState({
            dashboardWidgetsData: {
              "widget-1": createMockDashboardWidgetData({
                title: "Test Widget",
                description: "Description",
                metadata: { key: "value" },
              }),
            },
          });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .addWidgetSubsetData("widget-1", "subset content");
        });

        const state = useCopilotDataStore.getState();
        expect(state.widgetSubsetData).toHaveLength(1);
        expect(state.widgetSubsetData[0].uuid).toBe("widget-1");
        expect(state.widgetSubsetData[0].data?.content).toBe("subset content");
      });
    });

    describe("removeWidgetSubsetData", () => {
      it("should remove subset data by content", () => {
        act(() => {
          useCopilotDataStore.setState({
            widgetSubsetData: [
              {
                uuid: "widget-1",
                name: "Widget",
                description: "Desc",
                metadata: {},
                data: { content: "content-1" },
              },
              {
                uuid: "widget-2",
                name: "Widget 2",
                description: "Desc 2",
                metadata: {},
                data: { content: "content-2" },
              },
            ],
          });
        });

        act(() => {
          useCopilotDataStore.getState().removeWidgetSubsetData("content-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.widgetSubsetData).toHaveLength(1);
        expect(state.widgetSubsetData[0].uuid).toBe("widget-2");
      });
    });

    describe("clearWidgetSubsetData", () => {
      it("should clear all subset data", () => {
        act(() => {
          useCopilotDataStore.setState({
            widgetSubsetData: [
              {
                uuid: "1",
                name: "W1",
                description: "D1",
                metadata: {},
                data: { content: "c1" },
              },
              {
                uuid: "2",
                name: "W2",
                description: "D2",
                metadata: {},
                data: { content: "c2" },
              },
            ],
          });
        });

        act(() => {
          useCopilotDataStore.getState().clearWidgetSubsetData();
        });

        expect(useCopilotDataStore.getState().widgetSubsetData).toEqual([]);
      });
    });
  });

  describe("Mention Tracking", () => {
    describe("setMentionTrackedWidgets", () => {
      it("should set mention-tracked widgets", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .setMentionTrackedWidgets(["widget-1", "widget-2"]);
        });

        const state = useCopilotDataStore.getState();
        expect(state.mentionTrackedWidgetUuids.has("widget-1")).toBe(true);
        expect(state.mentionTrackedWidgetUuids.has("widget-2")).toBe(true);
      });
    });

    describe("addMentionTrackedWidget", () => {
      it("should add widget to mention tracking", () => {
        act(() => {
          useCopilotDataStore.getState().addMentionTrackedWidget("widget-1");
        });

        expect(
          useCopilotDataStore.getState().mentionTrackedWidgetUuids.has("widget-1"),
        ).toBe(true);
      });

      it("should not duplicate widgets", () => {
        act(() => {
          useCopilotDataStore.getState().addMentionTrackedWidget("widget-1");
          useCopilotDataStore.getState().addMentionTrackedWidget("widget-1");
        });

        expect(useCopilotDataStore.getState().mentionTrackedWidgetUuids.size).toBe(1);
      });
    });

    describe("removeMentionTrackedWidget", () => {
      it("should remove widget from mention tracking", () => {
        act(() => {
          useCopilotDataStore.setState({
            mentionTrackedWidgetUuids: new Set(["widget-1", "widget-2"]),
          });
        });

        act(() => {
          useCopilotDataStore.getState().removeMentionTrackedWidget("widget-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.mentionTrackedWidgetUuids.has("widget-1")).toBe(false);
        expect(state.mentionTrackedWidgetUuids.has("widget-2")).toBe(true);
      });
    });

    describe("clearMentionTrackedWidgets", () => {
      it("should clear all mention-tracked widgets", () => {
        act(() => {
          useCopilotDataStore.setState({
            mentionTrackedWidgetUuids: new Set(["widget-1", "widget-2"]),
          });
        });

        act(() => {
          useCopilotDataStore.getState().clearMentionTrackedWidgets();
        });

        expect(useCopilotDataStore.getState().mentionTrackedWidgetUuids.size).toBe(0);
      });
    });

    describe("isMentionTrackedWidget", () => {
      it("should return true for tracked widget", () => {
        act(() => {
          useCopilotDataStore.setState({
            mentionTrackedWidgetUuids: new Set(["widget-1"]),
          });
        });

        expect(useCopilotDataStore.getState().isMentionTrackedWidget("widget-1")).toBe(
          true,
        );
      });

      it("should return false for non-tracked widget", () => {
        expect(useCopilotDataStore.getState().isMentionTrackedWidget("widget-1")).toBe(
          false,
        );
      });
    });
  });

  describe("Pre-Selected Widgets", () => {
    describe("addPreSelectedWidget", () => {
      it("should add widget to pre-selected", () => {
        act(() => {
          useCopilotDataStore.getState().addPreSelectedWidget("widget-1");
        });

        expect(
          useCopilotDataStore.getState().preSelectedWidgetUuids.has("widget-1"),
        ).toBe(true);
      });
    });

    describe("removePreSelectedWidget", () => {
      it("should remove widget from pre-selected", () => {
        act(() => {
          useCopilotDataStore.setState({
            preSelectedWidgetUuids: new Set(["widget-1", "widget-2"]),
          });
        });

        act(() => {
          useCopilotDataStore.getState().removePreSelectedWidget("widget-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.preSelectedWidgetUuids.has("widget-1")).toBe(false);
        expect(state.preSelectedWidgetUuids.has("widget-2")).toBe(true);
      });
    });

    describe("isPreSelectedWidget", () => {
      it("should return true for pre-selected widget", () => {
        act(() => {
          useCopilotDataStore.setState({
            preSelectedWidgetUuids: new Set(["widget-1"]),
          });
        });

        expect(useCopilotDataStore.getState().isPreSelectedWidget("widget-1")).toBe(
          true,
        );
      });

      it("should return false for non-pre-selected widget", () => {
        expect(useCopilotDataStore.getState().isPreSelectedWidget("widget-1")).toBe(
          false,
        );
      });
    });
  });

  describe("Widget Runtime State", () => {
    describe("setWidgetRuntimeState", () => {
      it("should set runtime state for a widget", () => {
        const runtimeState = { fileOptions: ["option1", "option2"] };

        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetRuntimeState("widget-1", runtimeState);
        });

        expect(
          useCopilotDataStore.getState().widgetRuntimeState.get("widget-1"),
        ).toEqual(runtimeState);
      });

      it("should update existing runtime state", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetRuntimeState("widget-1", { old: "state" });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetRuntimeState("widget-1", { new: "state" });
        });

        expect(
          useCopilotDataStore.getState().widgetRuntimeState.get("widget-1"),
        ).toEqual({
          new: "state",
        });
      });
    });

    describe("getWidgetRuntimeState", () => {
      it("should return runtime state for a widget", () => {
        const runtimeState = { key: "value" };

        act(() => {
          useCopilotDataStore.setState({
            widgetRuntimeState: new Map([["widget-1", runtimeState]]),
          });
        });

        expect(
          useCopilotDataStore.getState().getWidgetRuntimeState("widget-1"),
        ).toEqual(runtimeState);
      });

      it("should return undefined for non-existent widget", () => {
        expect(
          useCopilotDataStore.getState().getWidgetRuntimeState("non-existent"),
        ).toBeUndefined();
      });
    });

    describe("clearWidgetRuntimeState", () => {
      it("should clear runtime state for a widget", () => {
        act(() => {
          useCopilotDataStore.setState({
            widgetRuntimeState: new Map([
              ["widget-1", { state: 1 }],
              ["widget-2", { state: 2 }],
            ]),
          });
        });

        act(() => {
          useCopilotDataStore.getState().clearWidgetRuntimeState("widget-1");
        });

        const state = useCopilotDataStore.getState();
        expect(state.widgetRuntimeState.has("widget-1")).toBe(false);
        expect(state.widgetRuntimeState.has("widget-2")).toBe(true);
      });
    });

    describe("beginWidgetCopilotExecution", () => {
      it("should store pending params for a widget", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .beginWidgetCopilotExecution("widget-1", { query: "SELECT 1" });
        });

        const runtimeState = useCopilotDataStore
          .getState()
          .getWidgetRuntimeState("widget-1");
        expect(runtimeState?.copilotPendingParams).toEqual({ query: "SELECT 1" });
      });

      it("should overwrite previous pending params", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .beginWidgetCopilotExecution("widget-1", { query: "SELECT 1" });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .beginWidgetCopilotExecution("widget-1", { query: "SELECT 2" });
        });

        const runtimeState = useCopilotDataStore
          .getState()
          .getWidgetRuntimeState("widget-1");
        expect(runtimeState?.copilotPendingParams).toEqual({ query: "SELECT 2" });
      });
    });

    describe("setWidgetCopilotDraftParams", () => {
      it("should set draft params for a widget", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { query: "SELECT draft" });
        });

        const runtimeState = useCopilotDataStore
          .getState()
          .getWidgetRuntimeState("widget-1");
        expect(runtimeState?.copilotDraftParams).toEqual({ query: "SELECT draft" });
      });

      it("should merge with existing draft params", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { query: "SELECT 1" });
        });

        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { ticker: "AAPL" });
        });

        const runtimeState = useCopilotDataStore
          .getState()
          .getWidgetRuntimeState("widget-1");
        expect(runtimeState?.copilotDraftParams).toEqual({
          query: "SELECT 1",
          ticker: "AAPL",
        });
      });

      it("should update widgetsLastUpdated timestamp", () => {
        const before = useCopilotDataStore.getState().widgetsLastUpdated;

        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { query: "test" });
        });

        expect(useCopilotDataStore.getState().widgetsLastUpdated).toBeGreaterThan(
          before,
        );
      });

      it("should not update state if params are equal", () => {
        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { query: "same" });
        });

        const stateBefore = useCopilotDataStore.getState();

        act(() => {
          useCopilotDataStore
            .getState()
            .setWidgetCopilotDraftParams("widget-1", { query: "same" });
        });

        // widgetsLastUpdated should be equal since no actual change occurred
        expect(useCopilotDataStore.getState().widgetsLastUpdated).toBe(
          stateBefore.widgetsLastUpdated,
        );
      });
    });
  });

  describe("Toggle States", () => {
    describe("toggleExtraWidgetsEnabled", () => {
      it("should toggle extra widgets enabled state", () => {
        expect(useCopilotDataStore.getState().extraWidgetsEnabled).toBe(false);

        act(() => {
          useCopilotDataStore.getState().toggleExtraWidgetsEnabled();
        });

        expect(useCopilotDataStore.getState().extraWidgetsEnabled).toBe(true);

        act(() => {
          useCopilotDataStore.getState().toggleExtraWidgetsEnabled();
        });

        expect(useCopilotDataStore.getState().extraWidgetsEnabled).toBe(false);
      });

      it("should return the new state", () => {
        const result = useCopilotDataStore.getState().toggleExtraWidgetsEnabled();
        expect(result).toBe(true);
      });
    });

    describe("toggleGenerativeUiEnabled", () => {
      it("should toggle generative UI enabled state", () => {
        expect(useCopilotDataStore.getState().generativeUiEnabled).toBe(false);

        act(() => {
          useCopilotDataStore.getState().toggleGenerativeUiEnabled();
        });

        expect(useCopilotDataStore.getState().generativeUiEnabled).toBe(true);

        act(() => {
          useCopilotDataStore.getState().toggleGenerativeUiEnabled();
        });

        expect(useCopilotDataStore.getState().generativeUiEnabled).toBe(false);
      });

      it("should return the new state", () => {
        const result = useCopilotDataStore.getState().toggleGenerativeUiEnabled();
        expect(result).toBe(true);
      });
    });
  });

  describe("Signature Tracking", () => {
    describe("updateSignaturesMap", () => {
      it("should update signatures map", async () => {
        const widget = createMockWidget();
        const widgetData = createMockDashboardWidgetData();

        act(() => {
          useCopilotDataStore.setState({
            widgetsInCurrentDashboard: [widget] as WidgetT[],
            dashboardWidgetsData: { "widget-1": widgetData },
          });
        });

        await act(async () => {
          await useCopilotDataStore.getState().updateSignaturesMap();
        });

        expect(useCopilotDataStore.getState().signaturesMap["widget-1"]).toBeDefined();
      });
    });

    describe("checkWidgetSignature", () => {
      it("should return false when uuid is falsy", () => {
        expect(
          useCopilotDataStore
            .getState()
            .checkWidgetSignature("", { origin: "test", widgetId: "chart", args: {} }),
        ).toBe(false);
      });

      it("should return false when signature is falsy", () => {
        expect(
          useCopilotDataStore.getState().checkWidgetSignature("widget-1", null as any),
        ).toBe(false);
      });

      it("should compare signatures correctly", () => {
        const signature = { origin: "test", widgetId: "chart", args: {} };

        act(() => {
          useCopilotDataStore.setState({
            signaturesMap: { "widget-1": signature },
          });
        });

        expect(
          useCopilotDataStore.getState().checkWidgetSignature("widget-1", signature),
        ).toBe(true);
      });
    });

    describe("getWidgetFromSignature", () => {
      it("should find widget by signature", () => {
        const widget = createMockWidget({ id: "widget-1", widgetId: "chart" });
        const signature = { origin: "test", widgetId: "chart", args: {} };

        act(() => {
          useCopilotDataStore.setState({
            widgetsInCurrentDashboard: [widget] as WidgetT[],
            signaturesMap: { "widget-1": signature },
          });
        });

        const result = useCopilotDataStore.getState().getWidgetFromSignature(signature);
        expect(result?.id).toBe("widget-1");
      });

      it("should return undefined when no matching widget", () => {
        const result = useCopilotDataStore
          .getState()
          .getWidgetFromSignature({ origin: "test", widgetId: "unknown", args: {} });
        expect(result).toBeUndefined();
      });
    });
  });

  describe("clearState", () => {
    it("should reset most state to defaults", () => {
      act(() => {
        useCopilotDataStore.setState({
          selectedWidgetIDs: ["widget-1"],
          dashboardWidgetsData: { "widget-1": createMockDashboardWidgetData() },
          widgetSubsetData: [
            {
              uuid: "1",
              name: "W",
              description: "D",
              metadata: {},
              data: { content: "c" },
            },
          ],
          extraWidgetsEnabled: true,
          generativeUiEnabled: true,
          mentionTrackedWidgetUuids: new Set(["widget-1"]),
        });
      });

      act(() => {
        useCopilotDataStore.getState().clearState();
      });

      const state = useCopilotDataStore.getState();
      expect(state.selectedWidgetIDs).toEqual([]);
      expect(state.dashboardWidgetsData).toEqual({});
      expect(state.widgetSubsetData).toEqual([]);
      expect(state.mentionTrackedWidgetUuids.has("widget-1")).toBe(true);
    });

    it("should preserve mentionTrackedWidgetUuids", () => {
      act(() => {
        useCopilotDataStore.setState({
          mentionTrackedWidgetUuids: new Set(["widget-1", "widget-2"]),
        });
      });

      act(() => {
        useCopilotDataStore.getState().clearState();
      });

      const state = useCopilotDataStore.getState();
      expect(state.mentionTrackedWidgetUuids.has("widget-1")).toBe(true);
      expect(state.mentionTrackedWidgetUuids.has("widget-2")).toBe(true);
    });
  });

  describe("removeWidgetData", () => {
    it("should remove all data related to a widget", () => {
      act(() => {
        useCopilotDataStore.setState({
          dashboardWidgetsData: {
            "widget-1": createMockDashboardWidgetData(),
            "widget-2": createMockDashboardWidgetData(),
          },
          selectedWidgetIDs: ["widget-1", "widget-2"],
          mentionTrackedWidgetUuids: new Set(["widget-1", "widget-2"]),
          preSelectedWidgetUuids: new Set(["widget-1", "widget-2"]),
          widgetRuntimeState: new Map([
            ["widget-1", { state: 1 }],
            ["widget-2", { state: 2 }],
          ]),
        });
      });

      act(() => {
        useCopilotDataStore.getState().removeWidgetData("widget-1");
      });

      const state = useCopilotDataStore.getState();
      expect(state.dashboardWidgetsData["widget-1"]).toBeUndefined();
      expect(state.dashboardWidgetsData["widget-2"]).toBeDefined();
      expect(state.selectedWidgetIDs).not.toContain("widget-1");
      expect(state.selectedWidgetIDs).toContain("widget-2");
      expect(state.mentionTrackedWidgetUuids.has("widget-1")).toBe(false);
      expect(state.mentionTrackedWidgetUuids.has("widget-2")).toBe(true);
      expect(state.preSelectedWidgetUuids.has("widget-1")).toBe(false);
      expect(state.preSelectedWidgetUuids.has("widget-2")).toBe(true);
      expect(state.widgetRuntimeState.has("widget-1")).toBe(false);
      expect(state.widgetRuntimeState.has("widget-2")).toBe(true);
    });
  });

  describe("removeTabWidgetsData", () => {
    it("should remove data for multiple widgets", () => {
      act(() => {
        useCopilotDataStore.setState({
          dashboardWidgetsData: {
            "widget-1": createMockDashboardWidgetData(),
            "widget-2": createMockDashboardWidgetData(),
            "widget-3": createMockDashboardWidgetData(),
          },
          selectedWidgetIDs: ["widget-1", "widget-2", "widget-3"],
        });
      });

      act(() => {
        useCopilotDataStore.getState().removeTabWidgetsData(["widget-1", "widget-2"]);
      });

      const state = useCopilotDataStore.getState();
      expect(state.dashboardWidgetsData["widget-1"]).toBeUndefined();
      expect(state.dashboardWidgetsData["widget-2"]).toBeUndefined();
      expect(state.dashboardWidgetsData["widget-3"]).toBeDefined();
      expect(state.selectedWidgetIDs).toEqual(["widget-3"]);
    });

    it("should handle empty array", () => {
      const stateBefore = useCopilotDataStore.getState();

      act(() => {
        useCopilotDataStore.getState().removeTabWidgetsData([]);
      });

      const stateAfter = useCopilotDataStore.getState();
      expect(stateAfter.dashboardWidgetsData).toEqual(stateBefore.dashboardWidgetsData);
    });
  });
});
