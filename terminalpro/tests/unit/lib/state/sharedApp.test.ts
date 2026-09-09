/**
 * Tests for sharedApp Zustand store
 *
 * Tests the shared app state management including:
 * - Shared items storage
 * - Dashboard retrieval by ID
 * - Widget retrieval within shared dashboards
 * - Updating shared items with both shared and entity-shared data
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { Item, Widget } from "~/lib/state/app";
import {
  type SharedItem,
  type SharedItems,
  useSharedAppStore,
} from "~/lib/state/sharedApp";

const createMockWidget = (overrides: Partial<Widget> = {}): Widget => ({
  id: "widget-1",
  // @ts-expect-error - ignored for now
  widgetId: "equity_profile",
  name: "Equity Profile",
  innerTab: "overview",
  groupId: null,
  // @ts-expect-error - ignored for now
  data: { mainTicker: { symbol: "AAPL", id: "AAPL" } },
  ...overrides,
});

const createMockItem = (overrides: Partial<Item> = {}): Item => ({
  index: "dashboard-1",
  isFolder: false,
  data: {
    name: "Test Dashboard",
    templateId: "custom",
    widgets: [createMockWidget()],
    gridLayout: {
      overview: [{ i: "widget-1", x: 0, y: 0, w: 4, h: 4 }],
    },
    currentTab: "overview",
    groups: [],
    numberOfChanges: 0,
    lastUpdated: Date.now(),
  },
  ...overrides,
});

const createMockSharedItem = (overrides: Partial<SharedItem> = {}): SharedItem => ({
  creator: true,
  content: createMockItem(),
  created_date: new Date(),
  updated_date: new Date(),
  created_by: "user@example.com",
  is_shared: true,
  ...overrides,
});

describe("useSharedAppStore", () => {
  beforeEach(() => {
    act(() => {
      useSharedAppStore.setState({
        sharedItems: null,
      });
    });
  });

  describe("initial state", () => {
    it("should have null sharedItems initially", () => {
      const state = useSharedAppStore.getState();
      expect(state.sharedItems).toBeNull();
    });
  });

  describe("getDashboardById", () => {
    it("should return dashboard when it exists", () => {
      const item = createMockItem({ index: "dashboard-1" });

      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "dashboard-1": {
              ...item,
              created_by: "user@example.com",
            },
          },
        });
      });

      const result = useSharedAppStore.getState().getDashboardById("dashboard-1");
      expect(result).toBeDefined();
      expect(result?.index).toBe("dashboard-1");
    });

    it("should return undefined when dashboard does not exist", () => {
      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "dashboard-1": {
              ...createMockItem(),
              created_by: "user@example.com",
            },
          },
        });
      });

      const result = useSharedAppStore.getState().getDashboardById("non-existent");
      expect(result).toBeUndefined();
    });

    it("should return undefined when sharedItems is null", () => {
      const result = useSharedAppStore.getState().getDashboardById("dashboard-1");
      expect(result).toBeUndefined();
    });
  });

  describe("getWidgetById", () => {
    it("should return widget when dashboard and widget exist", () => {
      const widget = createMockWidget({ id: "widget-1", name: "Test Widget" });
      const item = createMockItem({
        index: "dashboard-1",
        data: {
          ...createMockItem().data,
          widgets: [widget],
        },
      });

      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "dashboard-1": {
              ...item,
              created_by: "user@example.com",
            },
          },
        });
      });

      const result = useSharedAppStore.getState().getWidgetById("widget-1");
      expect(result).toBeDefined();
      expect(result?.name).toBe("Test Widget");
    });

    it("should return undefined when widget does not exist in dashboard", () => {
      const item = createMockItem({
        index: "dashboard-1",
        data: {
          ...createMockItem().data,
          widgets: [createMockWidget({ id: "widget-1" })],
        },
      });

      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "dashboard-1": {
              ...item,
              created_by: "user@example.com",
            },
          },
        });
      });

      const result = useSharedAppStore.getState().getWidgetById("widget-2");
      expect(result).toBeUndefined();
    });
  });

  describe("updateOnlySharedItems", () => {
    it("should update shared items from shared category", () => {
      const sharedItem = createMockSharedItem({
        content: createMockItem({ index: "shared-dashboard-1" }),
        created_by: "user1@example.com",
        created_date: new Date("2024-01-01"),
        updated_date: new Date("2024-01-02"),
      });

      const sharedItems: SharedItems = {
        shared: {
          "shared-dashboard-1": sharedItem,
        },
        entityShared: {},
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      expect(state.sharedItems?.["shared-dashboard-1"]).toBeDefined();
      expect(state.sharedItems?.["shared-dashboard-1"]?.created_by).toBe(
        "user1@example.com",
      );
    });

    it("should update shared items from entityShared category", () => {
      const entitySharedItem = createMockSharedItem({
        content: createMockItem({ index: "entity-dashboard-1" }),
        created_by: "user2@example.com",
      });

      const sharedItems: SharedItems = {
        shared: {},
        entityShared: {
          "entity-dashboard-1": entitySharedItem,
        },
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      expect(state.sharedItems?.["entity-dashboard-1"]).toBeDefined();
      // @ts-expect-error - ignored for now
      expect(state.sharedItems?.["entity-dashboard-1"]?.isEntityShared).toBe(true);
    });

    it("should set isEntityShared to false for shared items", () => {
      const sharedItem = createMockSharedItem({
        content: createMockItem({ index: "shared-1" }),
      });

      const sharedItems: SharedItems = {
        shared: { "shared-1": sharedItem },
        entityShared: {},
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      // @ts-expect-error - ignored for now
      expect(state.sharedItems?.["shared-1"]?.isEntityShared).toBe(false);
    });

    it("should set isEntityShared to true for entityShared items", () => {
      const entityItem = createMockSharedItem({
        content: createMockItem({ index: "entity-1" }),
      });

      const sharedItems: SharedItems = {
        shared: {},
        entityShared: { "entity-1": entityItem },
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      // @ts-expect-error - ignored for now
      expect(state.sharedItems?.["entity-1"]?.isEntityShared).toBe(true);
    });

    it("should not update when sharedItems is null/undefined", () => {
      act(() => {
        useSharedAppStore.setState({
          sharedItems: { existing: createMockItem() as any },
        });
      });

      const stateBefore = useSharedAppStore.getState().sharedItems;

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(null as any);
      });

      expect(useSharedAppStore.getState().sharedItems).toEqual(stateBefore);
    });

    it("should merge shared and entityShared items", () => {
      const sharedItem = createMockSharedItem({
        content: createMockItem({ index: "shared-1" }),
        created_by: "user1@example.com",
      });

      const entityItem = createMockSharedItem({
        content: createMockItem({ index: "entity-1" }),
        created_by: "user2@example.com",
      });

      const sharedItems: SharedItems = {
        shared: { "shared-1": sharedItem },
        entityShared: { "entity-1": entityItem },
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      expect(Object.keys(state.sharedItems || {})).toHaveLength(2);
      expect(state.sharedItems?.["shared-1"]).toBeDefined();
      expect(state.sharedItems?.["entity-1"]).toBeDefined();
    });

    it("should preserve created_date and updated_date", () => {
      const createdDate = new Date("2024-01-01");
      const updatedDate = new Date("2024-02-01");

      const sharedItem = createMockSharedItem({
        content: createMockItem({ index: "dashboard-1" }),
        created_date: createdDate,
        updated_date: updatedDate,
      });

      const sharedItems: SharedItems = {
        shared: { "dashboard-1": sharedItem },
        entityShared: {},
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      expect(state.sharedItems?.["dashboard-1"]?.created_date).toEqual(createdDate);
      expect(state.sharedItems?.["dashboard-1"]?.updated_date).toEqual(updatedDate);
    });

    it("should handle empty shared categories", () => {
      const sharedItems: SharedItems = {
        shared: {},
        entityShared: {},
      };

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems(sharedItems);
      });

      const state = useSharedAppStore.getState();
      expect(state.sharedItems).toEqual({});
    });

    it("should replace existing items on update", () => {
      const initialItem = createMockSharedItem({
        content: createMockItem({
          index: "dashboard-1",
          data: { ...createMockItem().data, name: "Initial Name" },
        }),
      });

      const updatedItem = createMockSharedItem({
        content: createMockItem({
          index: "dashboard-1",
          data: { ...createMockItem().data, name: "Updated Name" },
        }),
      });

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems({
          shared: { "dashboard-1": initialItem },
          entityShared: {},
        });
      });

      act(() => {
        useSharedAppStore.getState().updateOnlySharedItems({
          shared: { "dashboard-1": updatedItem },
          entityShared: {},
        });
      });

      const state = useSharedAppStore.getState();
      expect(state.sharedItems?.["dashboard-1"]?.data?.name).toBe("Updated Name");
    });
  });

  describe("multiple widgets in dashboard", () => {
    it("should find correct widget among multiple", () => {
      const widget1 = createMockWidget({ id: "widget-1", name: "Widget 1" });
      const widget2 = createMockWidget({ id: "widget-2", name: "Widget 2" });
      const widget3 = createMockWidget({ id: "widget-3", name: "Widget 3" });

      const item = createMockItem({
        index: "dashboard-1",
        data: {
          ...createMockItem().data,
          widgets: [widget1, widget2, widget3],
        },
      });

      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "dashboard-1": {
              ...item,
              created_by: "user@example.com",
            },
          },
        });
      });

      const result1 = useSharedAppStore.getState().getWidgetById("widget-1");
      const result2 = useSharedAppStore.getState().getWidgetById("widget-2");
      const result3 = useSharedAppStore.getState().getWidgetById("widget-3");

      expect(result1?.name).toBe("Widget 1");
      expect(result2?.name).toBe("Widget 2");
      expect(result3?.name).toBe("Widget 3");
    });
  });

  describe("complex dashboard structures", () => {
    it("should handle dashboard with nested data", () => {
      const widget = createMockWidget({
        id: "complex-widget",
        data: {
          // @ts-expect-error - ignored for now
          mainTicker: { symbol: "AAPL", id: "AAPL" },
          params: { startDate: "2024-01-01", endDate: "2024-12-31" },
          nested: {
            level1: {
              level2: {
                value: "deep nested",
              },
            },
          },
        },
      });

      const item = createMockItem({
        index: "complex-dashboard",
        data: {
          ...createMockItem().data,
          widgets: [widget],
          groups: [
            // @ts-expect-error - ignored for now
            {
              id: "group-1",
              type: "ticker" as const,
              name: "Group 1",
              color: "#ff0000",
              value: null,
            },
          ],
        },
      });

      act(() => {
        useSharedAppStore.setState({
          sharedItems: {
            "complex-dashboard": {
              ...item,
              created_by: "user@example.com",
            },
          },
        });
      });

      const dashboard = useSharedAppStore
        .getState()
        .getDashboardById("complex-dashboard");
      expect(dashboard?.data?.groups).toHaveLength(1);

      const foundWidget = useSharedAppStore.getState().getWidgetById("complex-widget");
      // @ts-expect-error - ignored for now
      expect(foundWidget?.data?.nested?.level1?.level2?.value).toBe("deep nested");
    });
  });
});
