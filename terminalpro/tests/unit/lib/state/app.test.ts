import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Item, type Items, useAppStore } from "~/lib/state/app";

const sharedAppMocks = vi.hoisted(() => {
  const state = {
    sharedDashboard: undefined as Item | undefined,
    updateSharedDashboard: vi.fn(),
    getDashboardById: vi.fn((dashboardId: string) => {
      if (state.sharedDashboard?.index === dashboardId) {
        return state.sharedDashboard;
      }

      return undefined;
    }),
  };

  return state;
});

// Mock all external dependencies
vi.mock("~/api/dashboard.api", () => ({
  postDashboards: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/lib/widget_bundles.json", () => ({
  default: {
    openbb: {
      name: "OpenBB",
      enabled_by_default: true,
      widgets: ["widget1", "widget2", "equity_profile"],
    },
  },
}));

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: {
    getState: () => ({
      logout: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/charting", () => ({
  useChartingStore: {
    getState: () => ({
      removeWidgetData: vi.fn(),
      removeTabWidgetsData: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/copilotData", () => ({
  useCopilotDataStore: {
    getState: () => ({
      removeWidgetData: vi.fn(),
      removeTabWidgetsData: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useFeatureFlagsStore: {
    getState: () => ({
      featureFlags: {
        data_bundle_info: {
          except_widgets: [],
        },
      },
    }),
  },
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useSharedAppStore: {
    getState: () => ({
      sharedItems: {},
      getDashboardById: sharedAppMocks.getDashboardById,
      updateSharedDashboard: sharedAppMocks.updateSharedDashboard,
    }),
  },
}));

vi.mock("~/lib/state/sidebar", () => ({
  useSidebarStore: {
    getState: () => ({
      activeItem: null,
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: () => ({
      defaultTicker: {
        symbol: "AAPL",
        id: "AAPL",
        name: "Apple Inc",
        category: "equity",
      },
    }),
  },
}));

vi.mock("~/lib/state/tickers", () => ({
  tickersStore: {
    getState: () => ({
      getOrQueryTickers: vi.fn().mockResolvedValue({}),
    }),
  },
}));

vi.mock("~/lib/onPremFeatureFlags", () => ({
  getAllowedDataVendors: () => [],
  getAllowedDBTypes: () => [],
  getEnabledIdentityProviders: () => [],
  getShowDemoRequestButton: () => false,
  isOnPremDeployment: () => false,
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock triggerCustomEvent since it depends on DOM
vi.mock("~/lib/utils/utils", async () => {
  const actual = await vi.importActual("~/lib/utils/utils");
  return {
    ...actual,
    triggerCustomEvent: vi.fn(),
    dispatchSaveState: vi.fn(),
    dispatchUpdateWidget: vi.fn(),
  };
});

// Helper to create test items structure
const createTestItems = (): Items => {
  const rootId = "root-id";
  const tabId = "tab-1";
  const folderId = "folder-1";

  return {
    [rootId]: {
      index: rootId,
      name: "root",
      isFolder: true,
      isRoot: true,
      children: [tabId, folderId],
      data: { name: "root" },
    },
    [tabId]: {
      index: tabId,
      parentId: rootId,
      isFolder: false,
      data: {
        name: "Test Tab",
        templateId: "custom",
        widgets: [
          {
            id: "widget-1",
            // @ts-expect-error - ignored for now
            widgetId: "equity_profile",
            name: "Equity Profile",
            innerTab: "overview",
            groupId: null,
            // @ts-expect-error - ignored for now
            data: { mainTicker: { symbol: "AAPL", id: "AAPL" } },
          },
        ],
        gridLayout: {
          overview: [{ i: "widget-1", x: 0, y: 0, w: 4, h: 4 }],
        },
        currentTab: "overview",
        groups: [],
        numberOfChanges: 0,
        lastUpdated: Date.now(),
      },
    },
    [folderId]: {
      index: folderId,
      parentId: rootId,
      isFolder: true,
      children: [],
      data: { name: "Test Folder" },
    },
  };
};

describe("useAppStore", () => {
  beforeEach(() => {
    sharedAppMocks.sharedDashboard = undefined;
    // Reset store to initial state
    const items = createTestItems();
    useAppStore.setState({
      items,
      itemsStoredInCloud: { ...items },
      sideBarItems: {},
      rootItem: null,
      hasItems: true,
      unSavedChanges: false,
      deletedItems: [],
      currentTabParams: {},
      currentEndpointParams: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getTabById", () => {
    it("should return a tab by id", () => {
      const tab = useAppStore.getState().getTabById("tab-1");

      expect(tab).toBeDefined();
      expect(tab?.data?.name).toBe("Test Tab");
    });

    it("should return undefined for non-existent tab", () => {
      const tab = useAppStore.getState().getTabById("non-existent");

      expect(tab).toBeUndefined();
    });

    it("should return undefined when items is null", () => {
      useAppStore.setState({ items: null as any });

      const tab = useAppStore.getState().getTabById("tab-1");

      expect(tab).toBeUndefined();
    });
  });

  describe("getFolderById", () => {
    it("should return a folder by id", () => {
      const folder = useAppStore.getState().getFolderById("folder-1");

      expect(folder).toBeDefined();
      expect(folder?.data?.name).toBe("Test Folder");
    });

    it("should return undefined for a tab id (not a folder)", () => {
      const folder = useAppStore.getState().getFolderById("tab-1");

      expect(folder).toBeUndefined();
    });
  });

  describe("getAllTabs", () => {
    it("should return all tabs (excluding folders and root)", () => {
      const tabs = useAppStore.getState().getAllTabs();

      expect(tabs).toHaveLength(1);
      expect(tabs[0].data?.name).toBe("Test Tab");
    });

    it("should return empty array when no tabs exist", () => {
      useAppStore.setState({
        items: {
          "root-id": {
            index: "root-id",
            name: "root",
            isFolder: true,
            isRoot: true,
            children: [],
            data: { name: "root" },
          },
        },
      });

      const tabs = useAppStore.getState().getAllTabs();

      expect(tabs).toHaveLength(0);
    });
  });

  describe("getRootTabs", () => {
    it("should return all tabs including nested in folders", () => {
      const items = createTestItems();
      // Add a tab inside the folder
      const nestedTabId = "nested-tab";
      items["nested-tab"] = {
        index: nestedTabId,
        parentId: "folder-1",
        isFolder: false,
        data: {
          name: "Nested Tab",
          templateId: "custom",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      };
      items["folder-1"].children = [nestedTabId];

      useAppStore.setState({ items });

      const tabs = useAppStore.getState().getRootTabs();

      expect(tabs).toHaveLength(2);
    });
  });

  describe("getTabWidgetById", () => {
    it("should return a widget by tab id and widget id", () => {
      const widget = useAppStore.getState().getTabWidgetById("tab-1", "widget-1");

      expect(widget).toBeDefined();
      expect(widget?.widgetId).toBe("equity_profile");
    });

    it("should return undefined for non-existent widget", () => {
      const widget = useAppStore.getState().getTabWidgetById("tab-1", "non-existent");

      expect(widget).toBeUndefined();
    });
  });

  describe("getWidgetById", () => {
    it("should find a widget across all tabs", () => {
      const widget = useAppStore.getState().getWidgetById("widget-1");

      expect(widget).toBeDefined();
      expect(widget?.name).toBe("Equity Profile");
    });

    it("should return undefined for non-existent widget", () => {
      const widget = useAppStore.getState().getWidgetById("non-existent");

      expect(widget).toBeUndefined();
    });
  });

  describe("getWidgetsByAttribute", () => {
    it("should find widgets by attribute", () => {
      const widgets = useAppStore
        .getState()
        .getWidgetsByAttribute("widgetId", "equity_profile");

      expect(widgets["tab-1"]).toBeDefined();
      expect(widgets["tab-1"]).toHaveLength(1);
    });

    it("should return empty object when no items", () => {
      useAppStore.setState({ items: null as any });

      const widgets = useAppStore
        .getState()
        .getWidgetsByAttribute("widgetId", "equity_profile");

      expect(widgets).toEqual({});
    });
  });

  describe("updateItemName", () => {
    it("should update item name", () => {
      useAppStore.getState().updateItemName("tab-1", "Renamed Tab");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.name).toBe("Renamed Tab");
    });

    it("should update lastUpdated timestamp", () => {
      const before = Date.now();
      useAppStore.getState().updateItemName("tab-1", "Renamed Tab");
      const after = Date.now();

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(tab?.data?.lastUpdated).toBeLessThanOrEqual(after);
    });
  });

  describe("setTabLocked", () => {
    it("should lock a tab", () => {
      useAppStore.getState().setTabLocked("tab-1", true);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.locked).toBe(true);
    });

    it("should unlock a tab", () => {
      // First lock
      useAppStore.getState().setTabLocked("tab-1", true);
      // Then unlock
      useAppStore.getState().setTabLocked("tab-1", false);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.locked).toBe(false);
    });
  });

  describe("isDashboardShared", () => {
    it("should return false for unshared dashboard", () => {
      const isShared = useAppStore.getState().isDashboardShared("tab-1");

      expect(isShared).toBeFalsy();
    });

    it("should return true for shared dashboard", () => {
      const items = useAppStore.getState().items;
      items["tab-1"].isShared = true;
      useAppStore.setState({ items });

      const isShared = useAppStore.getState().isDashboardShared("tab-1");

      expect(isShared).toBe(true);
    });
  });

  describe("setDashboardShared", () => {
    it("should set dashboard as shared", () => {
      useAppStore.getState().setDashboardShared("tab-1", true);

      const items = useAppStore.getState().items;
      expect(items["tab-1"].isShared).toBe(true);
    });

    it("should set dashboard as not shared", () => {
      useAppStore.getState().setDashboardShared("tab-1", true);
      useAppStore.getState().setDashboardShared("tab-1", false);

      const items = useAppStore.getState().items;
      expect(items["tab-1"].isShared).toBe(false);
    });

    it("should not modify non-existent item", () => {
      const itemsBefore = { ...useAppStore.getState().items };
      useAppStore.getState().setDashboardShared("non-existent", true);
      const itemsAfter = useAppStore.getState().items;

      expect(itemsBefore).toEqual(itemsAfter);
    });
  });

  describe("getLatestDashboard", () => {
    it("should return the most recently updated dashboard", () => {
      const items = createTestItems();
      const newerTabId = "newer-tab";

      items[newerTabId] = {
        index: newerTabId,
        parentId: "root-id",
        isFolder: false,
        data: {
          name: "Newer Tab",
          widgets: [{ id: "w1" }],
          lastUpdated: Date.now() + 1000,
        },
      } as Item;
      items["root-id"].children?.push(newerTabId);

      useAppStore.setState({ items });

      const latestId = useAppStore.getState().getLatestDashboard();

      expect(latestId).toBe(newerTabId);
    });
  });

  describe("updateTabData", () => {
    it("should update tab data with partial data", () => {
      useAppStore.getState().updateTabData("tab-1", { name: "Updated Name" });

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.name).toBe("Updated Name");
      expect(tab?.data?.templateId).toBe("custom"); // Should preserve other fields
    });

    it("should do nothing for non-existent tab", () => {
      const itemsBefore = JSON.stringify(useAppStore.getState().items);
      useAppStore.getState().updateTabData("non-existent", { name: "Test" });
      const itemsAfter = JSON.stringify(useAppStore.getState().items);

      expect(itemsBefore).toBe(itemsAfter);
    });
  });

  describe("createFolder", () => {
    it("should create a folder at root level", () => {
      const newFolder: Item = {
        index: "new-folder",
        isFolder: true,
        children: [],
        data: { name: "New Folder" },
      };

      useAppStore.getState().createFolder(newFolder);

      const folder = useAppStore.getState().items["new-folder"];
      expect(folder).toBeDefined();
      expect(folder.data?.name).toBe("New Folder");
      expect(folder.parentId).toBe("root-id");
    });

    it("should create a folder inside another folder", () => {
      const newFolder: Item = {
        index: "nested-folder",
        isFolder: true,
        children: [],
        data: { name: "Nested Folder" },
      };

      useAppStore.getState().createFolder(newFolder, "folder-1");

      const folder = useAppStore.getState().items["nested-folder"];
      expect(folder).toBeDefined();
      expect(folder.parentId).toBe("folder-1");
    });

    it("should add folder to parent's children", () => {
      const newFolder: Item = {
        index: "new-folder-2",
        isFolder: true,
        children: [],
        data: { name: "New Folder 2" },
      };

      useAppStore.getState().createFolder(newFolder);

      const root = useAppStore.getState().items["root-id"];
      expect(root.children).toContain("new-folder-2");
    });
  });

  describe("deleteFolder", () => {
    it("should delete a folder", () => {
      useAppStore.getState().deleteFolder("folder-1");

      const folder = useAppStore.getState().items["folder-1"];
      expect(folder).toBeUndefined();
    });

    it("should add deleted folder to deletedItems", () => {
      useAppStore.getState().deleteFolder("folder-1");

      const deletedItems = useAppStore.getState().deletedItems;
      expect(deletedItems).toContain("folder-1");
    });

    it("should not delete non-existent folder", () => {
      const deletedBefore = useAppStore.getState().deletedItems.length;
      useAppStore.getState().deleteFolder("non-existent");
      const deletedAfter = useAppStore.getState().deletedItems.length;

      expect(deletedAfter).toBe(deletedBefore);
    });
  });

  describe("updateOnlyItems", () => {
    it("should update items without affecting cloud state", () => {
      const newItems = createTestItems();
      newItems["tab-1"].data!.name = "Modified Tab";

      useAppStore.getState().updateOnlyItems(newItems);

      expect(useAppStore.getState().items["tab-1"].data?.name).toBe("Modified Tab");
    });

    it("should not update when items is null/undefined", () => {
      const itemsBefore = useAppStore.getState().items;
      useAppStore.getState().updateOnlyItems(null as any);

      expect(useAppStore.getState().items).toBe(itemsBefore);
    });
  });

  describe("checkForChanges", () => {
    it("should return false when no changes exist", () => {
      const items = createTestItems();
      useAppStore.setState({
        items,
        itemsStoredInCloud: JSON.parse(JSON.stringify(items)),
      });

      const hasChanges = useAppStore.getState().checkForChanges();

      expect(hasChanges).toBe(false);
    });

    it("should return true when changes exist", () => {
      const items = createTestItems();
      const cloudItems = JSON.parse(JSON.stringify(items));

      // Modify local items
      items["tab-1"].data!.name = "Modified Name";

      useAppStore.setState({
        items,
        itemsStoredInCloud: cloudItems,
      });

      const hasChanges = useAppStore.getState().checkForChanges();

      expect(hasChanges).toBe(true);
    });
  });

  describe("getWidgetGridData", () => {
    it("should return grid data for a widget", () => {
      const gridData = useAppStore.getState().getWidgetGridData("tab-1", "widget-1");

      expect(gridData).toBeDefined();
      expect(gridData?.i).toBe("widget-1");
      expect(gridData?.x).toBe(0);
      expect(gridData?.y).toBe(0);
    });

    it("should return undefined for non-existent widget", () => {
      const gridData = useAppStore
        .getState()
        .getWidgetGridData("tab-1", "non-existent");

      expect(gridData).toBeUndefined();
    });
  });

  describe("getWidgetsFromGroup", () => {
    it("should return widgets from a specific group", () => {
      const items = createTestItems();
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      const widgets = useAppStore.getState().getWidgetsFromGroup("group-1", "tab-1");

      expect(widgets).toHaveLength(1);
    });

    it("should return empty array when no widgets in group", () => {
      const widgets = useAppStore
        .getState()
        .getWidgetsFromGroup("non-existent-group", "tab-1");

      expect(widgets).toHaveLength(0);
    });
  });

  describe("addGroup", () => {
    it("should add a group to a tab", () => {
      const group = {
        id: "new-group",
        type: "ticker" as const,
        name: "Test Group",
        color: "#ff0000",
        value: { symbol: "AAPL", id: "AAPL" },
      };

      // @ts-expect-error - ignored for now
      useAppStore.getState().addGroup("tab-1", group);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups).toHaveLength(1);
      expect(tab?.data?.groups?.[0].name).toBe("Test Group");
    });

    it("should generate id if not provided", () => {
      const group = {
        type: "ticker" as const,
        name: "Test Group",
        color: "#ff0000",
        value: { symbol: "AAPL", id: "AAPL" },
      } as any;

      useAppStore.getState().addGroup("tab-1", group);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups?.[0].id).toBeDefined();
      expect(tab?.data?.groups?.[0].id.length).toBeGreaterThan(0);
    });
  });

  describe("deleteGroup", () => {
    it("should delete a group from a tab", () => {
      // First add a group
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      useAppStore.setState({ items });

      useAppStore.getState().deleteGroup("tab-1", "group-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups).toHaveLength(0);
    });

    it("should remove group references from widgets", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      useAppStore.getState().deleteGroup("tab-1", "group-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.widgets?.[0].groupId).toBeNull();
    });
  });

  describe("getWidgetGroup", () => {
    it("should return the group for a widget", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      const group = useAppStore.getState().getWidgetGroup("tab-1", "widget-1");

      expect(group).toBeDefined();
      expect(group?.name).toBe("Group 1");
    });

    it("should return undefined when widget has no group", () => {
      const group = useAppStore.getState().getWidgetGroup("tab-1", "widget-1");

      expect(group).toBeUndefined();
    });
  });

  describe("getAllTabActiveGroups", () => {
    it("should return groups that have associated widgets", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Active Group",
          color: "#ff0000",
          value: null,
        },
        // @ts-expect-error - ignored for now
        {
          id: "group-2",
          type: "ticker",
          name: "Inactive Group",
          color: "#00ff00",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      const activeGroups = useAppStore.getState().getAllTabActiveGroups("tab-1");

      expect(activeGroups).toHaveLength(1);
      expect(activeGroups[0].name).toBe("Active Group");
    });
  });

  describe("getLastInnerTab", () => {
    it("should return the current tab for a dashboard", () => {
      const lastTab = useAppStore.getState().getLastInnerTab("tab-1");

      expect(lastTab).toBe("overview");
    });

    it("should return undefined for non-existent tab", () => {
      const lastTab = useAppStore.getState().getLastInnerTab("non-existent");

      expect(lastTab).toBeUndefined();
    });
  });

  describe("updateTabWidgetsLayout", () => {
    it("should update widgets layout for a tab", () => {
      const newLayout = [{ i: "widget-1", x: 2, y: 2, w: 6, h: 6 }];

      useAppStore.getState().updateTabWidgetsLayout("tab-1", newLayout, "overview");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.gridLayout?.overview?.[0].x).toBe(2);
      expect(tab?.data?.gridLayout?.overview?.[0].w).toBe(6);
    });
  });

  describe("getAllFoldersFlat", () => {
    it("should return all folders in a flat list", () => {
      // Set up sidebar items
      const items = createTestItems();
      const sideBarItems = Object.entries(items).reduce((acc, [key, item]) => {
        acc[key] = {
          ...item,
          data: {
            name: item.data?.name,
            type: item.data?.templateId ? "custom" : undefined,
          },
        };
        return acc;
      }, {} as any);

      useAppStore.setState({
        items,
        sideBarItems,
        rootItem: sideBarItems["root-id"],
      });

      const folders = useAppStore.getState().getAllFoldersFlat();

      expect(folders).toHaveLength(1);
      expect(folders[0].data?.name).toBe("Test Folder");
    });
  });

  describe("updateItemsStoredInCloud", () => {
    it("should update cloud-stored items", () => {
      const newItems = createTestItems();
      newItems["tab-1"].data!.name = "Cloud Updated";

      useAppStore.getState().updateItemsStoredInCloud(newItems);

      expect(useAppStore.getState().itemsStoredInCloud?.["tab-1"]?.data?.name).toBe(
        "Cloud Updated",
      );
    });
  });

  describe("removeWidget", () => {
    it("should remove a widget from a tab", () => {
      useAppStore.getState().removeWidget("tab-1", "widget-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.widgets).toHaveLength(0);
    });

    it("should update grid layout when removing widget", () => {
      useAppStore.getState().removeWidget("tab-1", "widget-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      const widgetInGrid = tab?.data?.gridLayout?.overview?.find(
        (g) => g.i === "widget-1",
      );
      expect(widgetInGrid).toBeUndefined();
    });

    it("should increment numberOfChanges", () => {
      const changesBefore =
        useAppStore.getState().items["tab-1"].data?.numberOfChanges ?? 0;

      useAppStore.getState().removeWidget("tab-1", "widget-1");

      const changesAfter = useAppStore.getState().items["tab-1"].data?.numberOfChanges;
      expect(changesAfter).toBe(changesBefore + 1);
    });

    it("should remove orphaned group when last widget in group is removed", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      useAppStore.getState().removeWidget("tab-1", "widget-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups).toHaveLength(0);
    });
  });

  describe("updateWidget", () => {
    it("should update a widget in a tab", () => {
      const updatedWidget = {
        id: "widget-1",
        widgetId: "equity_profile",
        name: "Updated Widget Name",
        innerTab: "overview",
        groupId: null,
        data: { mainTicker: { symbol: "MSFT", id: "MSFT" } },
      };

      useAppStore.getState().updateWidget("tab-1", updatedWidget as any);

      const widget = useAppStore.getState().getTabWidgetById("tab-1", "widget-1");
      expect(widget?.name).toBe("Updated Widget Name");
      expect(widget?.data?.mainTicker?.symbol).toBe("MSFT");
    });

    it("should not fail for non-existent tab", () => {
      const updatedWidget = {
        id: "widget-1",
        widgetId: "equity_profile",
        name: "Updated",
      };

      expect(() => {
        useAppStore.getState().updateWidget("non-existent", updatedWidget as any);
      }).not.toThrow();
    });

    it("should not publish cellOnClick endpoint widget saves back to the shared group", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        {
          id: "selection-group",
          name: "Group 1",
          type: "endpointParam",
          color: "#000000",
          groupById: "selection-options",
          value: "All",
        } as any,
      ];
      items["tab-1"].data!.widgets = [
        {
          id: "volume-widget",
          widgetId: "volume_by_category",
          external: true,
          name: "Volume by Category",
          paramGroups: { "selection-options": "selection-group" },
          storage: { params: { selection: "All" } },
          params: [
            {
              type: "endpoint",
              paramName: "selection",
              groupById: "selection-options",
              value: "All",
              show: true,
            },
          ],
          data: {
            table: {
              columnsDefs: [
                {
                  field: "label",
                  renderFn: "cellOnClick",
                  renderFnParams: {
                    actionType: "groupBy",
                    groupBy: { paramName: "selection", valueField: "selection" },
                  },
                },
              ],
            },
          },
        } as any,
      ];
      useAppStore.setState({ items });

      useAppStore.getState().updateWidget("tab-1", {
        ...items["tab-1"].data!.widgets![0],
        storage: { params: { selection: "Sports" } },
      } as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups?.[0].value).toBe("All");
    });

    it("should not overwrite cellOnClick endpoint groups with undefined widget values", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        {
          id: "selection-group",
          name: "Group 1",
          type: "endpointParam",
          color: "#000000",
          groupById: "selection-options",
          value: "Sports",
        } as any,
      ];
      items["tab-1"].data!.widgets = [
        {
          id: "volume-widget",
          widgetId: "volume_by_category",
          external: true,
          name: "Volume by Category",
          paramGroups: { "selection-options": "selection-group" },
          storage: { params: { selection: "Sports" } },
          params: [
            {
              type: "endpoint",
              paramName: "selection",
              groupById: "selection-options",
              value: "All",
              show: true,
            },
          ],
          data: {
            table: {
              columnsDefs: [
                {
                  field: "label",
                  renderFn: "cellOnClick",
                  renderFnParams: {
                    actionType: "groupBy",
                    groupBy: { paramName: "selection", valueField: "selection" },
                  },
                },
              ],
            },
          },
        } as any,
      ];
      useAppStore.setState({ items });

      useAppStore.getState().updateWidget("tab-1", {
        ...items["tab-1"].data!.widgets![0],
        storage: { params: { selection: undefined } },
      } as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups?.[0].value).toBe("Sports");
    });

    it("should not revert cellOnClick endpoint groups from stale widget values", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        {
          id: "selection-group",
          name: "Group 1",
          type: "endpointParam",
          color: "#000000",
          groupById: "selection-options",
          value: "Sports",
        } as any,
      ];
      items["tab-1"].data!.widgets = [
        {
          id: "volume-widget",
          widgetId: "volume_by_category",
          external: true,
          name: "Volume by Category",
          paramGroups: { "selection-options": "selection-group" },
          storage: { params: { selection: "All" } },
          params: [
            {
              type: "endpoint",
              paramName: "selection",
              groupById: "selection-options",
              value: "All",
              show: true,
            },
          ],
          data: {
            table: {
              columnsDefs: [
                {
                  field: "label",
                  renderFn: "cellOnClick",
                  renderFnParams: {
                    actionType: "groupBy",
                    groupBy: { paramName: "selection", valueField: "selection" },
                  },
                },
              ],
            },
          },
        } as any,
      ];
      useAppStore.setState({ items });

      useAppStore.getState().updateWidget("tab-1", {
        ...items["tab-1"].data!.widgets![0],
        storage: { params: { selection: "All" } },
      } as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups?.[0].value).toBe("Sports");
    });
  });

  describe("duplicateWidgetById", () => {
    it("should duplicate a widget", () => {
      useAppStore.getState().duplicateWidgetById("tab-1", "widget-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.widgets).toHaveLength(2);
    });

    it("should give duplicated widget a new id", () => {
      useAppStore.getState().duplicateWidgetById("tab-1", "widget-1");

      const tab = useAppStore.getState().getTabById("tab-1");
      const widgetIds = tab?.data?.widgets?.map((w) => w.id);
      const uniqueIds = new Set(widgetIds);
      expect(uniqueIds.size).toBe(2);
    });
  });

  describe("setWidgetGroupId", () => {
    it("should assign a group to a widget", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      useAppStore.setState({ items });

      const group = {
        id: "group-1",
        type: "ticker" as const,
        name: "Group 1",
        color: "#ff0000",
        value: null,
      };
      // @ts-expect-error - ignored for now
      useAppStore.getState().setWidgetGroupId("tab-1", "widget-1", group, false);

      const widget = useAppStore.getState().getTabWidgetById("tab-1", "widget-1");
      expect(widget?.groupId).toBe("group-1");
    });

    it("should remove group from widget when remove is true", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      const group = {
        id: "group-1",
        type: "ticker" as const,
        name: "Group 1",
        color: "#ff0000",
        value: null,
      };
      // @ts-expect-error - ignored for now
      useAppStore.getState().setWidgetGroupId("tab-1", "widget-1", group, true);

      const widget = useAppStore.getState().getTabWidgetById("tab-1", "widget-1");
      expect(widget?.groupId).toBeNull();
    });
  });

  describe("getWidgetGroups", () => {
    it("should return all groups for a widget", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Group 1",
          color: "#ff0000",
          value: null,
        },
        // @ts-expect-error - ignored for now
        {
          id: "group-2",
          type: "param",
          name: "Group 2",
          color: "#00ff00",
          value: "test",
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      items["tab-1"].data!.widgets![0].paramGroups = { someParam: "group-2" };
      useAppStore.setState({ items });

      const groups = useAppStore.getState().getWidgetGroups("tab-1", "widget-1");

      expect(groups).toHaveLength(2);
    });

    it("should return empty array when widget has no groups", () => {
      const groups = useAppStore.getState().getWidgetGroups("tab-1", "widget-1");

      expect(groups).toHaveLength(0);
    });
  });

  describe("getMoveToTabs", () => {
    it("should return tabs available to move to", () => {
      const items = createTestItems();
      // Add another tab
      items["tab-2"] = {
        index: "tab-2",
        parentId: "root-id",
        isFolder: false,
        data: {
          name: "Tab 2",
          widgets: [],
          gridLayout: { overview: [] },
          groups: [],
        },
      };
      items["root-id"].children?.push("tab-2");
      useAppStore.setState({ items });

      const moveTabs = useAppStore.getState().getMoveToTabs("tab-1");

      // Should include tab-2 and folder-1, but not tab-1 (current tab)
      expect(moveTabs.length).toBeGreaterThan(0);
    });
  });

  describe("updateGroup", () => {
    it("should update an existing group", () => {
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Original Name",
          color: "#ff0000",
          value: null,
        },
      ];
      useAppStore.setState({ items });

      const updatedGroup = {
        id: "group-1",
        type: "ticker" as const,
        name: "Updated Name",
        color: "#00ff00",
        value: null,
      };
      // @ts-expect-error - ignored for now
      useAppStore.getState().updateGroup("tab-1", "group-1", updatedGroup);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.groups?.[0].name).toBe("Updated Name");
      expect(tab?.data?.groups?.[0].color).toBe("#00ff00");
    });

    it("should update a group on a shared dashboard", () => {
      const sharedDashboard = createTestItems()["tab-1"];
      sharedDashboard.index = "shared-tab";
      sharedDashboard.data!.groups = [
        {
          id: "group-1",
          type: "endpointParam",
          groupById: "selection-options",
          name: "Group 1",
          color: "#ff0000",
          value: "All",
        },
      ];
      sharedAppMocks.sharedDashboard = sharedDashboard;

      const updatedGroup = {
        ...sharedDashboard.data!.groups[0],
        value: "Crypto",
      };
      useAppStore
        .getState()
        // @ts-expect-error
        .updateGroup("shared-tab", "group-1", updatedGroup, false);

      expect(sharedAppMocks.updateSharedDashboard).toHaveBeenCalledWith(
        "shared-tab",
        expect.objectContaining({
          data: expect.objectContaining({
            groups: [
              expect.objectContaining({
                id: "group-1",
                value: "Crypto",
              }),
            ],
          }),
        }),
      );
    });
  });

  describe("getSideBarItem", () => {
    it("should return sidebar item by id", () => {
      const items = createTestItems();
      const sideBarItems = Object.entries(items).reduce((acc, [key, item]) => {
        acc[key] = {
          ...item,
          data: {
            name: item.data?.name,
            type: item.data?.templateId ? "custom" : undefined,
          },
        };
        return acc;
      }, {} as any);

      useAppStore.setState({ sideBarItems });

      const sideBarItem = useAppStore.getState().getSideBarItem("tab-1");

      expect(sideBarItem).toBeDefined();
      expect(sideBarItem?.data?.name).toBe("Test Tab");
    });
  });

  describe("moveTabToFolder", () => {
    it("should move a tab to an existing folder", () => {
      useAppStore.getState().moveTabToFolder("folder-1", "tab-1", "");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.parentId).toBe("folder-1");

      const folder = useAppStore.getState().items["folder-1"];
      expect(folder.children).toContain("tab-1");
    });

    it("should move tab to root when folderId is 'root'", () => {
      // First move to folder
      useAppStore.getState().moveTabToFolder("folder-1", "tab-1", "");

      // Then move to root
      useAppStore.getState().moveTabToFolder("root", "tab-1", "");

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.parentId).toBe("root-id");
    });
  });

  describe("moveFolderToFolder", () => {
    it("should move folder to root", () => {
      // Add nested folder first
      const items = createTestItems();
      items["nested-folder"] = {
        index: "nested-folder",
        parentId: "folder-1",
        isFolder: true,
        children: [],
        data: { name: "Nested Folder" },
      };
      items["folder-1"].children = ["nested-folder"];
      useAppStore.setState({ items });

      useAppStore.getState().moveFolderToFolder("nested-folder", "root", "");

      const folder = useAppStore.getState().items["nested-folder"];
      expect(folder.parentId).toBe("root-id");
    });
  });

  describe("addTab", () => {
    it("should add a new tab to root", () => {
      const newTab = {
        index: "new-tab-id",
        data: {
          name: "New Dashboard",
          templateId: "custom",
          widgets: [],
          gridLayout: { overview: [] },
          groups: [],
        },
      };

      // @ts-expect-error - ignored for now
      useAppStore.getState().addTab(newTab);

      const tab = useAppStore.getState().getTabById("new-tab-id");
      expect(tab).toBeDefined();
      expect(tab?.data?.name).toBe("New Dashboard");
    });

    it("should add tab to root's children", () => {
      const newTab = {
        index: "new-tab-id",
        data: {
          name: "New Dashboard",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      };

      useAppStore.getState().addTab(newTab);

      const root = useAppStore.getState().items["root-id"];
      expect(root.children).toContain("new-tab-id");
    });

    it("should add tab inside a folder when parentId is specified", () => {
      const newTab = {
        index: "new-tab-in-folder",
        parentId: "folder-1",
        data: {
          name: "Tab in Folder",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      };

      useAppStore.getState().addTab(newTab);

      const tab = useAppStore.getState().getTabById("new-tab-in-folder");
      expect(tab?.parentId).toBe("folder-1");

      const folder = useAppStore.getState().items["folder-1"];
      expect(folder.children).toContain("new-tab-in-folder");
    });

    it("should set lastUpdated and numberOfChanges", () => {
      const before = Date.now();
      const newTab = {
        index: "new-tab-timestamp",
        data: {
          name: "Timestamped Tab",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      };

      useAppStore.getState().addTab(newTab);

      const tab = useAppStore.getState().getTabById("new-tab-timestamp");
      expect(tab?.data?.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(tab?.data?.numberOfChanges).toBe(0);
    });

    it("should generate UUID if index not provided", () => {
      const newTab = {
        data: {
          name: "Auto ID Tab",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      } as any;

      useAppStore.getState().addTab(newTab);

      const allTabs = useAppStore.getState().getAllTabs();
      const addedTab = allTabs.find((t) => t.data?.name === "Auto ID Tab");
      expect(addedTab?.index).toBeDefined();
      expect(addedTab?.index?.length).toBeGreaterThan(0);
    });

    it("should process widgets with grid layout", () => {
      const newTab = {
        index: "tab-with-widgets",
        data: {
          name: "Tab with Widgets",
          widgets: [
            {
              id: "w1",
              widgetId: "equity_profile",
              name: "Test Widget",
              innerTab: "overview",
            },
          ],
          gridLayout: {
            overview: [{ i: "w1", x: 0, y: 0, w: 4, h: 4 }],
          },
          groups: [],
        },
      };

      useAppStore.getState().addTab(newTab as any);

      const tab = useAppStore.getState().getTabById("tab-with-widgets");
      expect(tab?.data?.widgets).toHaveLength(1);
      expect(tab?.data?.gridLayout?.overview).toHaveLength(1);
    });

    it("should update existing tab if index already exists", () => {
      // tab-1 already exists from createTestItems
      const updatedTab = {
        index: "tab-1",
        data: {
          name: "Updated Tab Name",
          widgets: [],
          gridLayout: {},
          groups: [],
        },
      };

      useAppStore.getState().addTab(updatedTab as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.name).toBe("Updated Tab Name");
    });
  });

  describe("removeTab", () => {
    it("should remove a tab", () => {
      const mockNavigate = vi.fn();

      useAppStore.getState().removeTab("tab-1", mockNavigate);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab).toBeUndefined();
    });

    it("should add removed tab to deletedItems", () => {
      const mockNavigate = vi.fn();

      useAppStore.getState().removeTab("tab-1", mockNavigate);

      const deletedItems = useAppStore.getState().deletedItems;
      expect(deletedItems).toContain("tab-1");
    });

    it("should remove tab from parent's children", () => {
      const mockNavigate = vi.fn();

      useAppStore.getState().removeTab("tab-1", mockNavigate);

      const root = useAppStore.getState().items["root-id"];
      expect(root.children).not.toContain("tab-1");
    });

    it("should not fail for non-existent tab", () => {
      const mockNavigate = vi.fn();

      expect(() => {
        useAppStore.getState().removeTab("non-existent", mockNavigate);
      }).not.toThrow();
    });
  });

  describe("duplicateTab", () => {
    it("should duplicate a tab", () => {
      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      expect(newTabId).toBeDefined();
      const newTab = useAppStore.getState().getTabById(newTabId!);
      expect(newTab).toBeDefined();
    });

    it("should append (copy) to name", () => {
      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const newTab = useAppStore.getState().getTabById(newTabId!);
      expect(newTab?.data?.name).toBe("Test Tab (copy)");
    });

    it("should duplicate widgets with new IDs", () => {
      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const originalTab = useAppStore.getState().getTabById("tab-1");
      const newTab = useAppStore.getState().getTabById(newTabId!);

      expect(newTab?.data?.widgets).toHaveLength(
        originalTab?.data?.widgets?.length || 0,
      );

      // Widget IDs should be different
      const originalWidgetIds = originalTab?.data?.widgets?.map((w) => w.id) || [];
      const newWidgetIds = newTab?.data?.widgets?.map((w) => w.id) || [];

      for (const newId of newWidgetIds) {
        expect(originalWidgetIds).not.toContain(newId);
      }
    });

    it("should add duplicated tab to root's children", () => {
      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const root = useAppStore.getState().items["root-id"];
      expect(root.children).toContain(newTabId);
    });

    it("should duplicate groups with new IDs", () => {
      // Setup tab with a group
      const items = createTestItems();
      items["tab-1"].data!.groups = [
        // @ts-expect-error - ignored for now
        {
          id: "group-1",
          type: "ticker",
          name: "Test Group",
          color: "#ff0000",
          value: null,
        },
      ];
      items["tab-1"].data!.widgets![0].groupId = "group-1";
      useAppStore.setState({ items });

      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const newTab = useAppStore.getState().getTabById(newTabId!);
      expect(newTab?.data?.groups).toHaveLength(1);
      expect(newTab?.data?.groups?.[0].id).not.toBe("group-1");
    });

    it("should not duplicate isShared property", () => {
      const items = createTestItems();
      items["tab-1"].isShared = true;
      useAppStore.setState({ items });

      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const newTab = useAppStore.getState().items[newTabId!];
      expect(newTab.isShared).toBeUndefined();
    });

    it("should set parentId to root", () => {
      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const newTab = useAppStore.getState().getTabById(newTabId!);
      expect(newTab?.parentId).toBe("root-id");
    });

    it("should return undefined for non-existent tab", () => {
      const result = useAppStore.getState().duplicateTab("non-existent");

      expect(result).toBeUndefined();
    });

    it("should reset numberOfChanges to 0", () => {
      const items = createTestItems();
      items["tab-1"].data!.numberOfChanges = 10;
      useAppStore.setState({ items });

      const newTabId = useAppStore.getState().duplicateTab("tab-1");

      const newTab = useAppStore.getState().getTabById(newTabId!);
      expect(newTab?.data?.numberOfChanges).toBe(0);
    });
  });

  describe("addWidget", () => {
    it("should add a widget to a tab", async () => {
      const widget = {
        widgetId: "equity_profile",
        name: "New Widget",
        innerTab: "overview",
      };

      const widgetId = await useAppStore.getState().addWidget("tab-1", widget as any);

      expect(widgetId).toBeDefined();
      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.widgets?.length).toBe(2); // Original + new
    });

    it("should generate widget ID if not provided", async () => {
      const widget = {
        widgetId: "equity_profile",
        name: "Auto ID Widget",
      };

      const widgetId = await useAppStore.getState().addWidget("tab-1", widget as any);

      expect(widgetId).toBeDefined();
      expect(widgetId?.length).toBeGreaterThan(0);
    });

    it("should update grid layout when adding widget", async () => {
      const widget = {
        widgetId: "equity_profile",
        name: "Grid Widget",
        innerTab: "overview",
      };

      const widgetId = await useAppStore.getState().addWidget("tab-1", widget as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      const gridItem = tab?.data?.gridLayout?.overview?.find((g) => g.i === widgetId);
      expect(gridItem).toBeDefined();
    });

    it("should increment numberOfChanges", async () => {
      const changesBefore =
        useAppStore.getState().items["tab-1"].data?.numberOfChanges ?? 0;

      await useAppStore.getState().addWidget("tab-1", {
        widgetId: "equity_profile",
        name: "Test",
      } as any);

      const changesAfter = useAppStore.getState().items["tab-1"].data?.numberOfChanges;
      expect(changesAfter).toBe(changesBefore + 1);
    });

    it("should return undefined for non-existent tab", async () => {
      const result = await useAppStore.getState().addWidget("non-existent", {
        widgetId: "test",
      } as any);

      expect(result).toBeUndefined();
    });
  });

  describe("addWidgets", () => {
    it("should add multiple widgets at once", async () => {
      const widgets = [
        { widgetId: "equity_profile", name: "Widget 1" },
        { widgetId: "equity_profile", name: "Widget 2" },
      ];

      await useAppStore.getState().addWidgets("tab-1", widgets as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      expect(tab?.data?.widgets?.length).toBe(3); // 1 original + 2 new
    });

    it("should return ID of last added widget", async () => {
      const widgets = [
        { widgetId: "equity_profile", name: "Widget 1" },
        { widgetId: "equity_profile", name: "Widget 2" },
      ];

      const lastId = await useAppStore.getState().addWidgets("tab-1", widgets as any);

      const tab = useAppStore.getState().getTabById("tab-1");
      const lastWidget = tab?.data?.widgets?.find((w) => w.id === lastId);
      expect(lastWidget?.name).toBe("Widget 2");
    });
  });

  describe("createTabInsideFolder", () => {
    it("should create a tab inside a folder", () => {
      const tab = {
        index: "folder-tab",
        data: {
          name: "Folder Tab",
        },
      } as any;

      useAppStore.getState().createTabInsideFolder("folder-1", tab);

      const createdTab = useAppStore.getState().getTabById("folder-tab");
      expect(createdTab).toBeDefined();
      expect(createdTab?.parentId).toBe("folder-1");
    });

    it("should not create tab if folder doesn't exist", () => {
      const tab = {
        index: "orphan-tab",
        data: { name: "Orphan" },
      } as any;

      useAppStore.getState().createTabInsideFolder("non-existent-folder", tab);

      const createdTab = useAppStore.getState().getTabById("orphan-tab");
      expect(createdTab).toBeUndefined();
    });
  });
});
