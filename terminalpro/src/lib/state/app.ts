import cloneDeep from "lodash/cloneDeep";
import debounce from "lodash/debounce";
import isEqual from "lodash.isequal";
import posthog from "posthog-js";
import type { Layout } from "react-grid-layout";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { postDashboards } from "~/api/dashboard.api";
import type {
  GridDataT as GridData,
  GridLayoutT as GridLayout,
  GroupT as Group,
  GroupTypeT,
  ParamDef,
  TickerT as Ticker,
  WidgetT as Widget,
  WidgetJsonT,
} from "~/components/types";
import WIDGET_BUNDLES from "~/lib/widget_bundles.json";
import type { DashSync } from "~/types/auth.type";
import { getAllowedDataVendors } from "../onPremFeatureFlags";
import {
  addDuplicateWidgetToItem,
  addToWidgetParamGroups,
  checkIfWidgetsHaveMainTickerAndAreTheSame,
  deleteItemFn,
  diffItemsWithRemote,
  duplicateTabItem,
  getCellOnClickParams,
  getEndpointParamGroupByIds,
  getEndpointParamName,
  getEndpointParams,
  getInnerTabsGridLayout,
  getStoredFileUUIDs,
  getValidItems,
  getWidgetData,
  getWidgetGroupValue,
  removeDuplicateNavBarWidgets,
  unlinkItemFn,
  updateDependentEndpointParamGroups,
  updateWidgetGridLayout,
  updateWidgetGroupValue,
  updateWidgetInItem,
} from "../utils/app";
import { NotificationId, showNotificationWithRememberMe } from "../utils/toast";
import {
  dispatchSaveState,
  dispatchUpdateWidget,
  ensureArray,
  extractUUIDFromURL,
  scoreArrays,
  triggerCustomEvent,
} from "../utils/utils";
import { groupParamOverride } from "../utils/widget";
import { createParamDefs } from "../utils/widgetParams";
import { useAuthStore } from "./auth";
import { useBackendConnectorStore } from "./backendConnector";
import { useChartingStore } from "./charting";
import { useCopilotDataStore } from "./copilotData";
import { useFeatureFlagsStore } from "./featureFlags";
import { useSharedAppStore } from "./sharedApp";
import { useSidebarStore } from "./sidebar";
import { useThemeStore } from "./theme";
import { tickersStore } from "./tickers";

const allowedVendorsFF = getAllowedDataVendors();

export type Selector<S, T> = (state: S) => T;

export type KeySelector<S, K extends keyof S> = K extends keyof S ? K : never;

export type Items = {
  [key: string]: Item;
};

export type MoveToTabs = Omit<Item, "children" | "widgets"> & {
  children?: MoveToTabs[];
};

export type Item = {
  index?: string;
  name?: "root" | string;
  children?: string[];
  isFolder?: boolean;
  isShared?: boolean;
  isRoot?: boolean;
  parentId?: string;
  data?: TabData;
  created_date?: string;
  updated_date?: string;
  created_by?: string;
};

export type TabData = {
  name: string;
  type?: "custom" | "template";
  templateId?:
    | "charting"
    | "news"
    | "equity"
    | "equityAnalyst"
    | "calendar"
    | "etf"
    | "comparison"
    | "countryEconomics"
    | "onboarding"
    | "earnings"
    | "custom"
    | `custom-${string}`;
  gridLayout?: GridLayout;
  widgets?: Widget[];
  locked?: boolean;
  lastUpdated?: number;
  numberOfChanges?: number;
  groups?: Group[];
  currentTab?: string;
  storedFileUUIDs?: string[];
};

export type SideBarItem = Omit<Item, "data"> & {
  data: Pick<TabData, "templateId" | "name" | "type"> & { hasChanges?: boolean };
};

export type SideBarItems = {
  [key: string]: SideBarItem;
};

type ItemT = Omit<Item, "data"> & {
  data?: Omit<TabData, "widgets"> & { widgets?: (Widget | WidgetJsonT)[] };
};

type WidgetTypes = Widget | WidgetJsonT;

export type InnerTab = { id: string; name: string; newId?: string };
export type InnerTabsT = { [tabId: string]: InnerTab };
export type TabParamT = { total: number; options: string[] };
export type TabParams = { [key: string]: TabParamT };
export type TabEndpointParams = { [key: string]: number };

export type AppState = {
  unSavedChanges: boolean;
  checkForChanges: () => boolean;
  getWidgetsFromGroup: (groupId: string, tabId?: string) => Widget[];
  getRootTabs: () => Item[];
  getMoveToTabs: (currentTab: string) => MoveToTabs[];
  isDashboardShared: (id: string) => boolean;
  setDashboardShared: (id: string, shared: boolean) => void;
  getLatestDashboard: () => string;
  setTabLocked: (tabId: string, locked: boolean) => void;
  moveTabToFolder: (folderId: string, tabId: string, newName: string) => void;
  getAllTabs: () => Item[];
  getAllFoldersFlat: () => SideBarItem[];
  getAllTabActiveGroups: (tabId: string) => Group[];
  updateItemName: (id: string, newName: string) => void;
  deleteFolder: (id: string) => void;
  deleteGroup: (tabId: string, groupId: string) => void;
  updateGroup: (
    tabId: string,
    groupId: string,
    group: Group,
    updateDependentGroups?: boolean,
  ) => void;
  setWidgetGroupId: (
    tabId: string,
    widgetId: string,
    group: Group | null,
    remove?: boolean,
  ) => void;
  getWidgetGroup: (tabId: string, widgetId: string) => Group | undefined;
  getWidgetGroups: (tabId: string, widgetId: string) => Group[];
  addGroup: (tabId: string, group: Group) => void;
  duplicateWidgetById: (tabId: string, widgetId: string) => void;
  duplicateWidget: (tabId: string, widget: Widget) => void;
  duplicateTab: (id: string) => string | undefined;
  currentTabParams: TabParams;
  currentEndpointParams: TabEndpointParams;
  updateTabParams: (tabId: string) => void;
  items: Items;
  hasItems: boolean;
  rootItem: SideBarItem;
  sideBarItems: SideBarItems;
  itemsStoredInCloud: Items;
  getSideBarItem: (id: string) => SideBarItem | undefined;
  updateItemsStoredInCloud: (items: Items) => void;
  updateItems: (items: SideBarItems) => void;
  deletedItems: string[];
  getLastInnerTab: (tabId: string) => string | undefined;
  addTab: (
    tab: ItemT,
    ignoreGridDataComputations?: boolean,
    defaultTicker?: Ticker,
  ) => void;
  getTabById: (id: string) => Item | undefined;
  getTabWidgetById: (tabId: string, widgetId: string) => Widget | undefined;
  removeTab: (id: string, navigate?: (id: string) => void) => void;
  updateTabData: (
    id: string,
    data: Partial<
      Omit<TabData, "widgets" | "groups" | "gridLayout" | "storedFileUUIDs">
    >,
  ) => void;
  updateInnerTabs: (tabId: string, innerTabs: InnerTabsT) => void;
  addWidget: (tabId: string, widget: WidgetTypes) => Promise<string>;
  addWidgets: (tabId: string, widget: WidgetTypes[]) => Promise<string>;
  addWidgetsToTabs: (
    tabIds: string[],
    widget: WidgetTypes | WidgetTypes[],
  ) => Promise<void>;
  getWidgetById: (widgetId: string) => Widget | undefined;
  getWidgetsByAttribute: <T extends keyof Widget>(
    attribute: T,
    value: string,
  ) => { [tabId: string]: Widget[] };
  getWidgetsByAttributes: <T extends keyof Widget>(
    attributes: { [TKey in T]: Widget[TKey] },
  ) => { [tabId: string]: Widget[] };
  removeWidget: (tabId: string, widgetId: string) => void;
  updateWidget: (tabId: string, widget: Widget) => void;
  updateTabWidgetsLayout: (
    tabId: string,
    widgetsLayout: Layout[],
    currentTab?: string,
  ) => void;
  moveFolderToFolder: (folderId: string, newFolderId: string, newName: string) => void;
  getFolderById: (id: string) => Item | undefined;
  createFolder: (folder: Item, parentFolderId?: string) => void;
  createTabInsideFolder: (folderId: string, tab: Item) => void;
  updateRemoteItems: (remoteData: DashSync<"owned">) => void;
  updateOnlyItems: (items: Items) => void;
  saveDashboards: (props?: { logout?: boolean; withNotification?: boolean }) => void;
  debounceSaveDashboards: () => Promise<void>;
  getWidgetGridData: (tabId: string, widgetId: string) => GridData | undefined;
  minimizeWidget: (
    tabId: string,
    widgetId: string,
    isMinimized: boolean,
    originalH?: number,
  ) => void;
};

const isWidgetVendorAllowed = (widget: Widget | WidgetJsonT) => {
  const realWidgetId = widget?.widgetId?.split("-")?.[0];

  // For core widgets (from openbb bundle), always allow them
  if (WIDGET_BUNDLES.openbb.widgets.includes(realWidgetId)) {
    return true;
  }

  // For external widgets, always allow them
  if (widget.external || widget.type === "custom" || !widget.source) {
    return true;
  }

  // Check if widget's source is in allowed vendors
  if (typeof widget.source === "string") {
    return allowedVendorsFF.includes(widget.source.toLowerCase());
  }

  return widget.source?.some((source) =>
    allowedVendorsFF.includes(source.toLowerCase()),
  );
};

function getLatestDashboardId(currentItems: Items) {
  const items = Object.values(currentItems || {});
  if (items.length === 0) return;

  const dashboards = items.filter((item) => !item.isFolder && item?.data?.widgets);
  const sortedDashboards = dashboards.sort((a, b) => {
    if (a.data?.lastUpdated && b.data?.lastUpdated) {
      return b.data.lastUpdated - a.data.lastUpdated;
    }
    return 0;
  });
  return sortedDashboards?.[0]?.index;
}

function getSideBarItems(items: Items): SideBarItems {
  return Object.entries(items).reduce((acc, [key, item]) => {
    const { data, ...rest } = item;
    acc[key] = rest;
    const lastUpdated = data?.lastUpdated || 0;
    if (item.updated_date && lastUpdated > Date.parse(item.updated_date)) {
      acc[key].updated_date = new Date(lastUpdated).toISOString();
    }
    acc[key].data = {
      name: item.data?.name,
      type: item.data?.type,
      templateId: item.data?.templateId,
      hasChanges: item.data?.numberOfChanges > 0,
    };
    return acc;
  }, {});
}

function getRootItem(sideBarItems: SideBarItems, state?: AppState) {
  const rootItem = sideBarItems[state?.rootItem?.index];
  if (!(rootItem || rootItem?.isRoot))
    return Object.values(sideBarItems || {}).find((i) => i.isRoot);
  return rootItem;
}

function updateSideBarItems(newItems: Items, state?: AppState) {
  const sideBarItems = getSideBarItems(newItems);
  const rootItem = getRootItem(sideBarItems, state);
  const hasItems = sideBarItems[rootItem?.index]?.children?.length > 0;

  return { sideBarItems, rootItem, hasItems };
}

export const useAppStore = createWithEqualityFn<AppState>()(
  subscribeWithSelector(
    //temporal(
    (set, get: () => AppState) => ({
      sideBarItems: {},
      rootItem: null,
      hasItems: false,
      unSavedChanges: false,
      checkForChanges: () => {
        dispatchSaveState();
        const { items, itemsStoredInCloud } = get();
        if (!(items && itemsStoredInCloud)) return;

        const diff = diffItemsWithRemote(items, itemsStoredInCloud);
        set({ unSavedChanges: Object.keys(diff).length > 0 });
        return Object.keys(diff).length > 0;
      },
      saveDashboards: async (props) => {
        const { logout = false, withNotification = false } = props ?? {};
        const { items, itemsStoredInCloud } = get();
        if (!(items && itemsStoredInCloud)) return;

        try {
          const diff = diffItemsWithRemote(items, itemsStoredInCloud);
          if (Object.keys(diff).length > 0) {
            // Send the differences to the server
            if (import.meta.env.DEV) console.log(items, itemsStoredInCloud, diff);
            await postDashboards(diff).then((_res) => {
              get().updateItemsStoredInCloud(items);
            });
            // Update the remote items to match the current items
            if (withNotification) toast.success("Dashboards saved");

            if (logout) useAuthStore.getState().logout();
            return;
          }
        } catch (_e) {
          if (logout) useAuthStore.getState().logout();
        }
        // If there are any differences, we need to sync them to the server

        // If there are no differences, log a message for debugging purposes
        if (import.meta.env.DEV)
          console.log("No dashboard changes found", logout ? " - Logging out" : "");
        if (withNotification) toast.success("Dashboards saved");

        if (logout) useAuthStore.getState().logout();
      },
      debounceSaveDashboards: debounce(async () => {
        dispatchSaveState();
        get().saveDashboards();
      }, 2000),
      isDashboardShared: (id: string) => {
        const { items } = get();
        const item = items?.[id];
        if (!item) {
          const sharedItems = useSharedAppStore?.getState().sharedItems;
          const sharedItem = sharedItems?.[id];
          return sharedItem?.isShared;
        }
        return item?.isShared;
      },
      setDashboardShared: (id: string, shared: boolean) => {
        const { items } = get();
        const item = items?.[id];
        if (!item) return;

        set((state: AppState) => {
          const newItems = {
            ...state.items,
            [id]: {
              ...state.items[id],
              isShared: shared,
            },
          };

          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });
      },
      getWidgetsFromGroup: (groupId: string, tabId: string) => {
        const dashboards = get().items;
        let widgetsList: Widget[] = dashboards?.[tabId]?.data?.widgets || [];

        if (!tabId) {
          widgetsList = Object.values(dashboards).flatMap(
            (item) => item?.data?.widgets || [],
          );
        }

        return widgetsList.filter(
          (w) =>
            w.groupId === groupId ||
            Object.values(w.paramGroups || {}).includes(groupId),
        );
      },
      getRootTabs: () => {
        const items = get().items;
        if (!items) return [];

        const root = Object.values(items).find((item) => item.isRoot);
        const rootChildren = root?.children || [];
        const allTabs = [];
        const getAllChildrenTabs = (children: string[]) => {
          for (const childId of children) {
            const child = items[childId];

            if (!child) continue;

            if (child.isFolder) {
              getAllChildrenTabs(child.children);
            } else {
              allTabs.push(child);
            }
          }
        };
        getAllChildrenTabs(rootChildren);
        return allTabs;
      },
      getMoveToTabs: (currentTab: string) => {
        const { items } = get();
        if (!items) return [];
        const root = Object.values(items).find((item) => item.isRoot);
        const rootChildren = root?.children || [];

        const recursiveGetMoveToTabs = (children: string[]): MoveToTabs[] => {
          const tabs: MoveToTabs[] = [];
          for (const childId of children) {
            const child = items[childId];

            // biome-ignore format: off
            const {data: { widgets, ...data },...rest } = child;
            if (child?.isFolder && child?.children?.length > 0) {
              const children = recursiveGetMoveToTabs(child.children);
              tabs.push({ ...rest, data: data, children });
              continue;
            }

            if (child?.index !== currentTab && child?.data) {
              tabs.push({ ...rest, data: data, children: [] });
            }
          }
          return tabs;
        };

        const moveToTabs = recursiveGetMoveToTabs(rootChildren);

        moveToTabs.sort((a, b) => (a.isFolder ? -1 : 1) - (b.isFolder ? -1 : 1));

        const gridLayout = getInnerTabsGridLayout(items[currentTab]?.data?.gridLayout);

        if (Object.keys(gridLayout).length > 1) {
          moveToTabs.unshift(items[currentTab] as MoveToTabs);
        }

        return moveToTabs;
      },
      updateOnlyItems: (items: Items) => {
        if (!items) return;

        set((state: AppState) => ({
          items: cloneDeep(items),
          ...updateSideBarItems(items, state),
        }));
      },
      updateRemoteItems: (remoteData) => {
        set((_state: AppState) => {
          if (!remoteData || Object.keys(remoteData).length === 0) {
            const rootId = uuidv4();
            const items = {
              [rootId]: {
                index: rootId,
                name: "root",
                isFolder: true,
                isRoot: true,
                children: [],
                data: { name: "root" },
              },
            };
            const sideBarItems = getSideBarItems(items);
            return {
              items,
              itemsStoredInCloud: cloneDeep(items),
              rootItem: sideBarItems[rootId],
              hasItems: false,
            };
          }

          const filteredRemoteItems = {} as Items;

          for (const key in remoteData) {
            const { content, is_shared, created_date, updated_date, created_by } =
              remoteData[key];
            if (content && Object.keys(content).length > 0) {
              filteredRemoteItems[key] = content;
              filteredRemoteItems[key].isShared = is_shared;
              filteredRemoteItems[key].created_date = created_date as unknown as string;
              filteredRemoteItems[key].updated_date = updated_date as unknown as string;
              filteredRemoteItems[key].created_by = created_by;
            }
          }

          if (import.meta.env.DEV) {
            console.log("remoteData", remoteData);
            console.log("filteredRemoteItems", filteredRemoteItems);
          }

          // we check all isFolder items and make sure the children are valid items
          for (const key in filteredRemoteItems) {
            const item = filteredRemoteItems[key];
            if (item?.isFolder && item?.children?.length > 0) {
              filteredRemoteItems[key].children = item.children.filter(
                (child: string) => {
                  const childItem = filteredRemoteItems[child];
                  return childItem?.data?.name;
                },
              );
            }
          }

          // we check all items are valid
          const validItems = getValidItems(filteredRemoteItems);
          if (import.meta.env.DEV) console.log("validItems", validItems);

          const clonedItems = cloneDeep(validItems);
          return {
            items: clonedItems,
            itemsStoredInCloud: cloneDeep(validItems),
            ...updateSideBarItems(clonedItems),
          };
        });
      },
      getLatestDashboard: () => getLatestDashboardId(get().items),
      createTabInsideFolder: (folderId: string, tab: Item) => {
        const { items, addTab } = get();
        if (!items?.[folderId]) return;

        addTab({
          ...tab,
          isFolder: false,
          parentId: folderId,
          data: {
            ...tab.data,
            numberOfChanges: 0,
            lastUpdated: Date.now(),
            widgets: [],
          },
        });
      },
      currentTabParams: {},
      currentEndpointParams: {},
      updateTabParams: (tabId: string) => {
        const { items } = get();
        const sharedItems = useSharedAppStore?.getState().sharedItems;
        const tab = items?.[tabId] || sharedItems?.[tabId];
        if (!tab) return;

        const { tabParamOptions, endpointParams } = (tab?.data?.widgets || []).reduce(
          (acc, w) => {
            const params = createParamDefs({ params: w.params || [] }).filter(
              (p) => p.type !== "ticker",
            );
            const sqlParams = createParamDefs({
              params: w.storage?.sqlParamDefs || [],
            });

            for (const p of sqlParams) {
              if (p.type === "endpoint") {
                const groupById = p.groupById || btoa(p.query.trim());
                if (!acc.endpointParams[groupById]) acc.endpointParams[groupById] = 0;
                acc.endpointParams[groupById] += 1;
                continue;
              }

              if (!acc.tabParamOptions[p.paramName])
                acc.tabParamOptions[p.paramName] = [];
              acc.tabParamOptions[p.paramName].push(p.options || []);
            }

            for (const param of params) {
              if (param.type === "endpoint") {
                const groupById = param.groupById;
                if (!acc.endpointParams[groupById]) acc.endpointParams[groupById] = 0;
                acc.endpointParams[groupById] += 1;
                continue;
              }
              const paramName = groupParamOverride(param.paramName, w.widgetId, true);

              if (!acc.tabParamOptions[paramName]) acc.tabParamOptions[paramName] = [];
              acc.tabParamOptions[paramName].push(param?.options || []);
            }

            return acc;
          },
          { tabParamOptions: {}, endpointParams: {}, sqlEndpointParams: {} } as {
            tabParamOptions: { [key: string]: ParamDef["options"][] };
            endpointParams: { [key: string]: number };
          },
        );

        const uniqueParams: TabParams = {};
        const uniqueEndpointParams: TabEndpointParams = endpointParams;

        for (const paramName in tabParamOptions) {
          const paramOptions = tabParamOptions[paramName];

          if (paramOptions.every((options) => options.length === 0)) {
            uniqueParams[paramName] = {
              total: paramOptions.length,
              options: [],
            };
            continue;
          }

          paramOptions.sort((a, b) => b.length - a.length);

          for (const options of paramOptions) {
            const values = options?.map((o: any) => o.value) || [];

            if (!uniqueParams[paramName]) {
              uniqueParams[paramName] = { total: 1, options: values };
              continue;
            }

            const result = scoreArrays(uniqueParams[paramName].options, values);

            if (result?.score > 0.5) {
              uniqueParams[paramName].total += 1;
              uniqueParams[paramName].options = result?.matches;
            }
          }
        }

        set({
          currentTabParams: uniqueParams,
          currentEndpointParams: uniqueEndpointParams,
        });
      },
      items: null,
      itemsStoredInCloud: null,
      updateItemsStoredInCloud: (items: Items) => {
        set((_state: AppState) => ({
          itemsStoredInCloud: cloneDeep(items),
        }));
      },
      deletedItems: [],
      setTabLocked: (tabId: string, locked: boolean) => {
        set((state: AppState) => ({
          items: {
            ...state.items,
            [tabId]: {
              ...state.items[tabId],
              data: {
                ...state.items[tabId].data,
                locked,
              },
            },
          },
        }));
      },
      getWidgetById(widgetId: string) {
        const { items } = get();
        for (const key in items) {
          if (Object.prototype.hasOwnProperty.call(items, key)) {
            const item = items[key];
            if (item?.data?.widgets) {
              const widget = item?.data?.widgets?.find((w) => w.id === widgetId);
              if (widget) {
                return widget;
              }
            }
          }
        }
        return undefined;
      },
      getWidgetsByAttribute: <T extends keyof Widget>(attribute: T, value: string) => {
        const { items } = get();
        if (!items) return {};

        const widgets = {};
        for (const key in items) {
          if (Object.prototype.hasOwnProperty.call(items, key)) {
            const item = items[key];
            if (item?.data?.widgets?.length > 0) {
              const selections = item?.data?.widgets?.filter(
                (w) => w[attribute] === value,
              );
              widgets[item.index] = selections || [];
            }
          }
        }
        return cloneDeep({ ...widgets });
      },
      getWidgetsByAttributes: (attributes) => {
        const { items } = get();
        if (!items) return {};

        const widgets = {};
        for (const key in items) {
          if (Object.prototype.hasOwnProperty.call(items, key)) {
            const item = items[key];
            if (item?.data?.widgets?.length > 0) {
              const selections = item?.data?.widgets?.filter((w) =>
                Object.entries(attributes).every(([key, value]) => w[key] === value),
              );
              if (selections?.length > 0) widgets[item.index] = selections;
            }
          }
        }
        return cloneDeep({ ...widgets });
      },
      getSideBarItem: (id: string) => {
        const { sideBarItems } = get();
        return sideBarItems?.[id];
      },
      updateItems: (sideBarItems: SideBarItems) => {
        const { items } = get();
        if (!items) return;

        const itemsToUpdate = Object.entries(sideBarItems).reduce(
          (acc, [key, item]) => {
            const currentItem = items[key];
            if (!currentItem) return acc;

            acc[key] = {
              ...currentItem,
              parentId: item.parentId,
              children: item.children,
            };
            return acc;
          },
          {},
        );

        set((state: AppState) => ({
          rootItem: getRootItem(sideBarItems, state),
          items: itemsToUpdate,
          sideBarItems,
        }));
      },
      getAllFoldersFlat: () => {
        const { rootItem, sideBarItems } = get();
        if (!(rootItem && sideBarItems)) return [];

        return rootItem.children.reduce((acc: SideBarItem[], childId: string) => {
          const child = sideBarItems[childId];
          if (!child) return acc;

          if (child.isFolder) {
            acc.push(child);
            if (child.children?.length > 0) {
              const subFolders = child.children
                .map((c) => sideBarItems[c])
                .filter((c) => c?.isFolder);
              acc.push(...subFolders);
            }
          }
          return acc;
        }, []);
      },
      createFolder: (folder: Item, parentFolderId?: string) => {
        const { items } = get();
        if (!items) return;

        const rootFolder = Object.values(items).find((item) => item.isRoot);

        const parentFolder = items?.[parentFolderId] || rootFolder;

        if (!(parentFolder?.isRoot || parentFolder?.isFolder)) return;

        const parentId = parentFolder?.index;

        set((state: AppState) => {
          const newItems = {
            ...state.items,
            [parentId]: {
              ...state.items[parentId],
              children: [...state.items[parentId].children, folder.index],
            },
            [folder.index]: {
              index: folder.index,
              parentId: parentId,
              isFolder: true,
              children: [],
              data: {
                name: folder.data.name,
              },
            },
          };

          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });

        triggerCustomEvent("scrollToTabItem", { tabId: folder.index });
        get().debounceSaveDashboards();

        if (posthog) posthog.capture("created_a_folder", { name: folder.data.name });
      },
      deleteFolder: (id: string) => {
        const { items } = get();
        if (!items?.[id]) return;

        const { newItems, deletedItems } = deleteItemFn(items, id);

        set((state: AppState) => ({
          items: newItems,
          deletedItems: [...state.deletedItems, ...deletedItems],
          ...updateSideBarItems(newItems, state),
        }));
        get().debounceSaveDashboards();
      },
      moveFolderToFolder: (folderId: string, newFolderId: string, newName: string) => {
        const { items } = get();
        if (!items?.[folderId]) return;

        const rootFolder = Object.values(items).find((item) => item.isRoot);
        const rootId = rootFolder?.index;

        const newItems = unlinkItemFn(items, folderId);
        const folderToMove = newItems[folderId];
        let newFolder = newItems[newFolderId];

        if (newFolderId === "root") {
          newFolder = Object.values(items).find((item) => item.isRoot);
          newFolderId = newFolder?.index;
        }

        if (!newFolder) {
          const newId = uuidv4();
          newItems[newId] = {
            index: newId,
            isFolder: true,
            children: [folderId],
            parentId: rootId,
            data: {
              name: newName,
            },
          };

          if (!rootFolder) return;

          newItems[rootId].children = [...newItems[rootId].children, newId];
          newItems[folderId] = {
            ...folderToMove,
            parentId: newId,
          };

          return set((state: AppState) => ({
            items: newItems,
            ...updateSideBarItems(newItems, state),
          }));
        }

        newItems[folderId] = {
          ...folderToMove,
          parentId: newFolderId,
        };

        newItems[newFolderId] = {
          ...newFolder,
          children: [...newFolder.children, folderId],
        };

        set((state: AppState) => ({
          items: newItems,
          ...updateSideBarItems(newItems, state),
        }));

        triggerCustomEvent("scrollToTabItem", { tabId: folderId });
        get().debounceSaveDashboards();
      },
      moveTabToFolder: (folderId: string, tabId: string, newName: string) => {
        const { items } = get();
        if (!items?.[tabId]) return;

        const newItems = unlinkItemFn(items, tabId);
        let folder = folderId ? newItems[folderId] : null;
        const rootFolder = Object.values(items).find((item) => item.isRoot);
        const rootId = rootFolder?.index;

        if (folderId === "root") {
          folder = Object.values(items).find((item) => item.isRoot);
          folderId = folder?.index;
        }

        if (!folder) {
          const newId = uuidv4();
          newItems[newId] = {
            index: newId,
            isFolder: true,
            children: [tabId],
            parentId: rootId,
            data: {
              name: newName,
            },
          };

          if (!rootFolder) return;
          newItems[rootId].children = [...newItems[rootId].children, newId];
          newItems[tabId].parentId = newId;

          return set((state: AppState) => ({
            items: newItems,
            ...updateSideBarItems(newItems, state),
          }));
        }

        newItems[tabId].parentId = folderId;
        newItems[folderId].children = [...folder.children, tabId];

        set((state: AppState) => ({
          items: newItems,
          ...updateSideBarItems(newItems, state),
        }));

        triggerCustomEvent("scrollToTabItem", { tabId: tabId });
        get().debounceSaveDashboards();
      },
      duplicateWidgetById: (tabId: string, widgetId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;
        const widget = tab.data.widgets.find((w) => w.id === widgetId);

        if (!widget) return;

        set((state: AppState) => {
          const newTab = addDuplicateWidgetToItem(tab, widget);

          const newItems = {
            ...state.items,
            [tabId]: newTab,
          };

          try {
            if (posthog) {
              posthog.capture("duplicated_a_widget", {
                widget_name: widget.widgetId,
                backend_name: widget.sourceName,
              });
            }
          } catch (error) {
            console.log(error);
          }

          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });

        get().debounceSaveDashboards();
      },
      duplicateWidget: (tabId: string, widget: Widget) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;

        if (!widget) return;

        set((state: AppState) => {
          const newTab = addDuplicateWidgetToItem(tab, widget);

          const newItems = {
            ...state.items,
            [tabId]: newTab,
          };

          try {
            if (posthog) {
              posthog.capture("duplicated_a_widget", {
                widget_name: widget.widgetId,
                backend_name: widget.sourceName,
              });
            }
          } catch (error) {
            console.log(error);
          }

          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });

        get().debounceSaveDashboards();
      },
      getAllTabs: () => {
        const { items } = get();
        return Object.values(items).filter((i) => !i.isFolder && i.data);
      },
      getAllTabActiveGroups: (tabId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab?.data) return [];

        const activeGroups = tab.data.widgets
          .filter((w) => w.groupId || Object.values(w.paramGroups || {}).length > 0)
          .flatMap((w) => {
            const paramGroups = Object.values(w.paramGroups || {}).filter(Boolean);
            if (w.groupId) {
              paramGroups.push(w.groupId);
            }
            return paramGroups;
          });

        const uniqueGroups = Array.from(new Set(activeGroups));

        return tab.data?.groups?.filter((g) => uniqueGroups.includes(g.id)) || [];
      },
      deleteGroup: (tabId: string, groupId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab?.data) return;

        set((state: AppState) => {
          const group = tab.data.groups.find((g) => g.id === groupId);
          tab.data.groups = tab.data.groups.filter((g) => g.id !== groupId);

          tab.data.widgets = tab.data.widgets.map((w) => {
            if (["param", "endpointParam"].includes(group?.type)) {
              w.paramGroups = Object.entries(w.paramGroups || {}).reduce(
                (acc, [key, value]) => {
                  if (value !== groupId) {
                    acc[key] = value;
                  }
                  return acc;
                },
                {} as Record<string, string | null>,
              );
            }

            if (w.groupId === groupId) {
              w.groupId = null;
            }
            return w;
          });

          return {
            items: {
              ...state.items,
              [tabId]: tab,
            },
          };
        });
      },
      updateItemName: (id: string, newName: string) => {
        set((state: AppState) => {
          const newItems = {
            ...state.items,
            [id]: {
              ...state.items[id],
              data: {
                ...state.items[id].data,
                numberOfChanges: state.items[id].data.numberOfChanges ?? 0 + 1,
                lastUpdated: Date.now(),
                name: newName,
              },
            },
          };

          return {
            items: newItems,
            sideBarItems: getSideBarItems(newItems),
          };
        });
      },
      updateGroup: (
        tabId: string,
        groupId: string,
        group: Group,
        updateDependentGroups = true,
      ) => {
        const { items } = get();
        const { getDashboardById, updateSharedDashboard } =
          useSharedAppStore.getState();
        const sharedTab = getDashboardById(tabId);
        const tab = items?.[tabId] || sharedTab;
        if (!tab?.data) return;

        const newTab = {
          ...tab,
          data: {
            ...tab.data,
            groups: tab.data.groups.map((g) => (g.id === groupId ? group : g)),
          },
        };

        if (sharedTab) {
          updateSharedDashboard(tabId, newTab);
        } else {
          set((state: AppState) => ({
            items: {
              ...state.items,
              [tabId]: newTab,
            },
          }));
        }

        if (updateDependentGroups && group.type === "endpointParam") {
          void updateDependentEndpointParamGroups(newTab, group, get().updateGroup);
        }
      },
      setWidgetGroupId: (
        tabId: string,
        widgetId: string,
        group: Group | null,
        remove?: boolean,
      ) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab?.data) return;

        set((state: AppState) => {
          tab.data.widgets = tab.data.widgets.map((w) => {
            if (w.id === widgetId) {
              if (group?.type === "param" || group?.type === "endpointParam") {
                if (remove) {
                  w.paramGroups = Object.entries(w.paramGroups || {}).reduce(
                    (acc, [key, value]) => {
                      if (value !== group.id) {
                        acc[key] = value;
                      }
                      return acc;
                    },
                    {} as Record<string, string | null>,
                  );
                } else {
                  w.paramGroups = addToWidgetParamGroups(w?.paramGroups, group);
                }

                return updateWidgetGroupValue(w, group);
              }

              w.groupId = group && !remove ? group.id : null;
              return updateWidgetGroupValue(w, group);
            }

            return w;
          });

          return {
            items: {
              ...state.items,
              [tabId]: tab,
            },
          };
        });
      },
      getWidgetGroup: (tabId: string, widgetId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab?.data) return undefined;

        const widget = tab.data.widgets.find((w) => w.id === widgetId);
        if (!widget) return undefined;

        return tab.data.groups.find((g) => g.id === widget.groupId);
      },
      getWidgetGroups: (tabId: string, widgetId: string) => {
        const { items } = get();
        const { getDashboardById, getWidgetGroups } = useSharedAppStore.getState();
        if (getDashboardById(tabId)) return getWidgetGroups(tabId, widgetId);

        const tab = items?.[tabId];
        if (!tab?.data) return [];

        const widget = tab.data.widgets.find((w) => w.id === widgetId);
        if (!widget) return [];

        return tab.data.groups.filter(
          (g) =>
            Object.values(widget.paramGroups || {}).includes(g.id) ||
            g.id === widget.groupId,
        );
      },
      addGroup: (tabId: string, group: Group) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;

        const newTab = {
          ...tab,
          data: {
            ...tab.data,
            groups: [
              ...(tab.data.groups || []),
              {
                ...group,
                id: group.id ? group.id : uuidv4(),
              },
            ],
          },
        };

        set((state: AppState) => ({
          items: {
            ...state.items,
            [tabId]: newTab,
          },
        }));

        if (posthog) {
          posthog.capture("added_a_group", {
            group: group,
            tab_id: tabId,
          });
        }
      },
      getTabById: (id: string) => {
        const { items } = get();
        if (!items?.[id]) return;
        return items[id];
      },
      getTabWidgetById: (tabId: string, widgetId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!Array.isArray(tab?.data?.widgets)) return;
        return tab.data.widgets.find((w) => w.id === widgetId);
      },
      getFolderById: (id: string) => {
        const { items } = get();
        if (!items?.[id]?.isFolder) return;
        return items[id];
      },
      duplicateTab: (id: string) => {
        const { items } = get();
        if (!items?.[id]) return;

        const rootFolder = Object.values(items).find((item) => item.isRoot);
        const rootId = rootFolder?.index;

        if (!rootFolder) return;

        const duplicatedTab = duplicateTabItem(items[id], rootId);

        const newItems = {
          ...items,
          [rootId]: {
            ...items[rootId],
            children: [...items[rootId].children, duplicatedTab.index],
          },
          [duplicatedTab.index]: duplicatedTab,
        };

        set((state: AppState) => ({
          items: newItems,
          ...updateSideBarItems(newItems, state),
        }));

        if (posthog) posthog.capture("duplicated_a_tab", { tab_id: id });

        triggerCustomEvent("scrollToTabItem", { tabId: duplicatedTab.index });
        get().debounceSaveDashboards();

        return duplicatedTab.index;
      },
      addTab: (tab, ignoreLastWidgetGridData = false, defaultTicker = null) => {
        const { items } = get();
        if (!items) return;

        const rootFolder = Object.values(items).find((item) => item.isRoot);
        const rootId = rootFolder?.index;

        if (!rootFolder) return;

        const mainTicker = defaultTicker || useThemeStore.getState().defaultTicker;

        let gridLayout = { ...(tab?.data?.gridLayout || {}) } as GridLayout;
        const widgets = [] as Widget[];
        const groups = tab?.data?.groups || [];
        let tabWidgetsFiltered = tab?.data?.widgets || [];

        const initialLength = tabWidgetsFiltered.length;

        // we need this for on prem feature flags for allowed vendors
        tabWidgetsFiltered = tabWidgetsFiltered.filter(isWidgetVendorAllowed);
        if (initialLength !== tabWidgetsFiltered.length) {
          gridLayout = updateWidgetGridLayout({
            widget: { id: "" } as Widget,
            gridLayout,
            tabWidgets: tabWidgetsFiltered,
            removeWidget: true,
          });
        }

        const exceptWidgets =
          useFeatureFlagsStore.getState().featureFlags?.data_bundle_info
            ?.except_widgets || [];

        if (exceptWidgets?.length > 0) {
          tabWidgetsFiltered = tabWidgetsFiltered?.filter(
            (w) => !exceptWidgets.includes(w.widgetId as any),
          );

          // Removes widgets in gridlayout that are excluded
          gridLayout = updateWidgetGridLayout({
            widget: { id: "" } as Widget,
            gridLayout,
            tabWidgets: tabWidgetsFiltered,
            removeWidget: true,
          });
        }

        const widgetsInGrid = Object.entries(gridLayout).reduce(
          (acc, [key, grid]) => {
            for (const g of grid) {
              acc[g.i] = { ...g, innerTab: key };
            }
            return acc;
          },
          {} as { [key: string]: GridData & { innerTab: string } },
        );

        for (const w of tabWidgetsFiltered || []) {
          const paramGroups = groups.filter(
            (g): g is GroupTypeT<"param" | "endpointParam"> =>
              Object.values(w?.paramGroups || {}).includes(g.id),
          );
          const group = w?.groupId && groups.find((g) => g.id === w.groupId);
          const newMainTicker = group?.type === "ticker" ? group.value : mainTicker;
          const newWidget = getWidgetData({ widget: w, defaultTicker: newMainTicker });

          for (const g of paramGroups) {
            if (["param", "endpointParam"].includes(g.type)) {
              newWidget.paramGroups = addToWidgetParamGroups(newWidget?.paramGroups, g);
            }
            Object.assign(newWidget, updateWidgetGroupValue(newWidget, g));
          }

          const id = w.id ? w.id : uuidv4();
          newWidget.id = id;
          const gridData = widgetsInGrid?.[id];

          if (group?.type === "ticker" && !newWidget?.data?.mainTicker) {
            newWidget.groupId = "";
          }

          newWidget.innerTab = gridData?.innerTab ?? w.innerTab ?? "";
          newWidget.isNew = true;
          w.innerTab = newWidget.innerTab;
          widgets.push(newWidget);

          if (!gridData)
            updateWidgetGridLayout({
              widget: { ...w, id } as Widget,
              gridLayout,
              ignoreLastWidgetGridData,
            });
        }

        const parentId = tab?.parentId || rootId;

        const newTab = removeDuplicateNavBarWidgets({
          index: tab.index || uuidv4(),
          isFolder: false,
          created_date: new Date().toISOString(),
          parentId,
          data: {
            ...tab.data,
            currentTab: tab.data?.currentTab ?? Object.keys(gridLayout)?.[0] ?? "",
            numberOfChanges: 0,
            lastUpdated: Date.now(),
            groups: tab.data.groups ?? [],
            widgets: widgets,
            storedFileUUIDs: getStoredFileUUIDs(widgets),
            gridLayout,
          },
        } as Item);

        set((state: AppState) => {
          const newItems = { ...state.items };

          // Check if tab with provided index already exists
          if (newItems[newTab.index]) {
            // Update existing tab
            newItems[newTab.index] = cloneDeep({ ...newTab });
          } else {
            // Add new tab to root or parent folder's children
            newItems[parentId] = {
              ...newItems[parentId],
              children: [...newItems[parentId].children, newTab.index],
            };
            newItems[newTab.index] = cloneDeep({ ...newTab });
          }
          if (posthog) {
            posthog.capture("added_a_tab", {
              tab_id: tab.index,
              ticker: defaultTicker?.symbol,
              tab_name: tab.data.name,
              tab_template: tab.data.templateId,
            });

            if (!tab?.data?.templateId) {
              const getApiSourceById =
                useBackendConnectorStore.getState().getApiSourceById;
              for (const widget of newTab.data.widgets) {
                const source = widget.sourceId
                  ? getApiSourceById(widget.sourceId)
                  : undefined;
                posthog.capture("added_a_widget", {
                  widget_name: widget.widgetId,
                  tab_id: newTab.index,
                  backend_name: widget.sourceName,
                  external: widget.external,
                  source_id: widget.sourceId,
                  listed_app_id: source?.vendorApp?.uuid,
                  vendor_name: source?.vendorApp?.name,
                });
              }
            }
          }

          return {
            items: newItems as Items,
            hasItems: true,
            ...updateSideBarItems(newItems, state),
          };
        });

        triggerCustomEvent("scrollToTabItem", { tabId: newTab.index });
        get().debounceSaveDashboards();
      },
      removeTab: (id: string, navigate: (path: string) => void) => {
        const { items, getLastInnerTab } = get();
        const tab = items?.[id];
        if (!tab) return;

        const { newItems, deletedItems } = deleteItemFn({ ...items }, id);
        const latestDashboardId = getLatestDashboardId(newItems);
        const activeItem = useSidebarStore.getState()?.activeItem;

        queueMicrotask(() => {
          if (activeItem !== id) return;
          if (!latestDashboardId) return navigate?.("/app");

          const innerTab = getLastInnerTab(latestDashboardId);
          triggerCustomEvent("scrollToTabItem", { tabId: latestDashboardId });
          queueMicrotask(() =>
            navigate?.(`/app/${latestDashboardId}${innerTab && `?tab=${innerTab}`}`),
          );
        });

        set((state: AppState) => {
          return {
            items: newItems,
            deletedItems: [...state.deletedItems, ...deletedItems],
            ...updateSideBarItems(newItems, state),
          };
        });
      },
      updateTabData: (tabId: string, data = {}) => {
        const { items } = get();
        const tabData = items?.[tabId]?.data;
        if (!tabData) return;

        set((state: AppState) => {
          const newItems = { ...state.items };
          Object.assign(newItems[tabId].data, data);
          return { items: newItems };
        });
      },
      updateInnerTabs: (tabId: string, innerTabs: InnerTabsT) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;

        const newGridLayout = {} as GridLayout;
        const currentTab = tab.data.currentTab;
        const newCurrentTab =
          innerTabs?.[currentTab]?.newId || Object.keys(innerTabs || {})?.[0] || "";

        for (const key in tab.data?.gridLayout || {}) {
          const value = innerTabs?.[key];

          if (value?.newId) {
            newGridLayout[value.newId] = tab.data?.gridLayout[key];
          } else if (value?.id) {
            newGridLayout[key] = tab.data.gridLayout[key];
          }
        }

        const newTabs = Object.values(innerTabs).map((t) => ({
          id: t.newId || t.id,
          name: t.name,
        }));

        const hasTabs = newTabs.length > 0;

        const newWidgets = tab.data.widgets
          .filter(
            (w) =>
              innerTabs?.[w.innerTab] || (w.widgetId === "navigation_bar" && hasTabs),
          )
          .map((w) => {
            if (w.widgetId === "navigation_bar") {
              return {
                ...w,
                storage: {
                  ...w.storage,
                  tabs: newTabs,
                },
              };
            }
            if (innerTabs[w.innerTab]?.newId) {
              w.innerTab = innerTabs[w.innerTab].newId;
            }
            return w;
          });

        if (hasTabs && newTabs.every((t) => !newGridLayout[t.id])) {
          const navBarWidget = newWidgets.find((w) => w.widgetId === "navigation_bar");
          const wGridData = Object.values(tab.data?.gridLayout || {})
            .flat()
            .find((l) => l.i === navBarWidget?.id);
          if (wGridData) {
            const firstTabId = newTabs[0].id;
            newGridLayout[firstTabId] = [wGridData];
          }
        }

        // Removes widgets in gridlayout that are not in the innerTabs
        const gridLayout = updateWidgetGridLayout({
          widget: { id: "" } as Widget,
          gridLayout: newGridLayout,
          tabWidgets: newWidgets,
          removeWidget: true,
        });

        for (const tab of newTabs) {
          if (!gridLayout[tab.id]) gridLayout[tab.id] = [];
        }

        // maintains the order of the innerTabs
        const sortedGridLayout = newTabs.reduce((acc, t) => {
          const key = t.id;
          if (gridLayout[key] === undefined) return acc;

          acc[key] = gridLayout[key];
          return acc;
        }, {} as GridLayout);

        const newTab = {
          ...tab,
          data: {
            ...tab.data,
            widgets: newWidgets,
            gridLayout: sortedGridLayout,
            currentTab: newCurrentTab,
          },
        } as Item;

        set((state: AppState) => {
          return {
            items: {
              ...state.items,
              [tabId]: removeDuplicateNavBarWidgets(newTab),
            },
          };
        });
      },
      getLastInnerTab: (tabId: string) => {
        const { items } = get();
        const sharedItems = useSharedAppStore.getState().sharedItems;
        const tab = sharedItems?.[tabId] || items?.[tabId];

        return tab?.data?.currentTab;
      },
      addWidget: async (tabId, widget) => get().addWidgets(tabId, [widget]),
      addWidgets: async (tabId, widgets) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) {
          toast.error("No permission", {
            description: "You are not allowed to add widgets to this dashboard",
          });
          return;
        }
        // we need this for on prem feature flags for allowed vendors
        const widgetsToAdd = widgets.filter(isWidgetVendorAllowed);
        let currentTab = tab.data.currentTab ?? "";
        const storedFileUUIDs = new Set<string>(tab.data?.storedFileUUIDs || []);

        const symbols = widgetsToAdd
          .filter(
            (w) =>
              w.params?.find((p) => p.paramName === "symbol" && p.type === "ticker") &&
              w.storage?.params?.symbol,
          )
          .map((w) => w.storage?.params?.symbol as string);

        let tickersObj: Record<string, Ticker> | null = null;
        if (symbols.length > 0) {
          tickersObj = await tickersStore.getState().getOrQueryTickers(symbols);
        }

        const newWidgets: Widget[] = [];
        let gridLayout: GridLayout = { ...(tab.data.gridLayout || {}) };
        for (const initialWidget of widgetsToAdd) {
          initialWidget.innerTab = initialWidget?.innerTab || currentTab;
          const tabWidgets = [...tab.data.widgets, ...newWidgets];

          // This is a temporary solution to handle ticker param type
          // The method addWidget needs to be async, but it only awaits for tickersStore
          // Once we fix the ticker issue the method can be synchronous again
          let defaultTicker = useThemeStore.getState().defaultTicker;
          const symbolParam = initialWidget.params?.find(
            (p) => p.paramName === "symbol" && p.type === "ticker",
          );
          if (symbolParam) {
            const symbol: string = ensureArray(
              initialWidget.storage?.params?.symbol,
            )?.[0];
            if (tickersObj?.[symbol]) defaultTicker = tickersObj[symbol];
          }

          const finalWidget = getWidgetData({
            widget: initialWidget,
            defaultTicker: defaultTicker || useThemeStore.getState().defaultTicker,
          });

          const { someHaveMainTicker, allTheSame, mainTicker } =
            checkIfWidgetsHaveMainTickerAndAreTheSame(
              tabWidgets.length > 1 ? tabWidgets : [...tabWidgets, finalWidget],
            );

          const id = initialWidget.id ? initialWidget.id : uuidv4();
          const newWidget = {
            ...cloneDeep({ ...finalWidget }),
            innerTab: finalWidget?.innerTab ?? currentTab,
            id,
          };

          if (newWidget.widgetId === "iframe") {
            showNotificationWithRememberMe({
              id: NotificationId.WebsiteNotEmbeddable,
              message: "Iframe may not be embeddable",
              description: `Some pages may not allow iframe embedding.
              If the iframe is not loading, please try a different URL.`,
              toastType: "info",
            });
          }

          const widgetGroup =
            newWidget?.groupId &&
            tab?.data?.groups?.find((g) => g.id === newWidget?.groupId);

          const hasNavigationBar = tabWidgets.some(
            (widget) => widget.widgetId === "navigation_bar",
          );

          if (!hasNavigationBar && newWidget.widgetId === "navigation_bar") {
            currentTab = newWidget.innerTab;
            for (const w of tab.data.widgets || []) w.innerTab = newWidget.innerTab;
            for (const w of newWidgets) w.innerTab = newWidget.innerTab;

            gridLayout = {
              [newWidget.innerTab]: Object.keys(gridLayout).flatMap((key) =>
                Object.values(gridLayout[key]),
              ),
            };
          }

          if (newWidget.widgetId !== "navigation_bar") {
            currentTab = newWidget?.innerTab || tab.data.currentTab;
          }

          gridLayout = updateWidgetGridLayout({
            widget: { ...initialWidget, id } as Widget,
            gridLayout: gridLayout,
            currentTab: currentTab,
            tabWidgets,
          });

          const allSameCategory = tabWidgets.every(
            (widget) =>
              widget.data?.mainTicker?.category ===
              newWidget?.data?.mainTicker?.category,
          );

          if (!defaultTicker && someHaveMainTicker && allTheSame && allSameCategory) {
            if (newWidget.data && !newWidget.external) {
              newWidget.data.mainTicker = mainTicker;
            }
          }

          if (!defaultTicker && tabWidgets?.length > 0 && allSameCategory) {
            const allSameGroupId = tabWidgets.every(
              (widget) => widget.groupId && widget.groupId === tabWidgets[0].groupId,
            );

            if (allSameGroupId && newWidget.data) {
              const groupTicker = tab?.data?.groups
                ?.filter((g) => g.type === "ticker")
                ?.find((g) => g.id === tabWidgets[0].groupId)?.value;

              if (groupTicker) {
                newWidget.groupId = tabWidgets[0].groupId;
                newWidget.data.mainTicker = groupTicker;
              }
            }
          }

          if (newWidget?.connectionType === "file") {
            const fileUUID = extractUUIDFromURL(newWidget?.endpoint?.url);
            if (fileUUID) storedFileUUIDs.add(fileUUID);
          }

          if (
            widgetGroup?.type === "endpointParam" &&
            widgetGroup?.groupById === newWidget?.groupById
          ) {
            const paramName = getEndpointParamName(
              getEndpointParams(newWidget),
              widgetGroup?.groupById,
            );
            if (paramName) {
              newWidget.storage = {
                ...(newWidget.storage || {}),
                params: {
                  ...(newWidget.storage?.params || {}),
                  [paramName]: widgetGroup.value,
                },
              };
            }
            newWidget.paramGroups = addToWidgetParamGroups(
              newWidget?.paramGroups,
              widgetGroup,
            );
          }

          if (widgetGroup?.type === "ticker" && !newWidget?.data?.mainTicker) {
            newWidget.groupId = "";
          }

          const paramGroupIds = Object.values(newWidget?.paramGroups || {});
          const paramGroups = tab?.data?.groups.filter(
            (g): g is GroupTypeT<"param" | "endpointParam"> =>
              paramGroupIds.includes(g.id),
          );

          for (const g of paramGroups) {
            if (["param", "endpointParam"].includes(g.type)) {
              newWidget.paramGroups = addToWidgetParamGroups(newWidget?.paramGroups, g);
            }
            Object.assign(newWidget, updateWidgetGroupValue(newWidget, g));
          }

          newWidget.isNew = true;

          // Stamp a creation datetime on static artifacts (markdown notes,
          // uploaded files, AI-added artifacts) so the widget navbar can surface
          // when it was added. Only set once so re-adds keep the original time.
          const isStaticArtifact =
            newWidget.widgetId?.startsWith("rich_note") ||
            newWidget.widgetId?.startsWith("copilot_table") ||
            newWidget.widgetId?.startsWith("html") ||
            newWidget.widgetId?.startsWith("file") ||
            newWidget.widgetId === "ag_grid_file" ||
            newWidget.connectionType === "file";
          if (isStaticArtifact && !newWidget.storage?.createdAt) {
            newWidget.storage = {
              ...(newWidget.storage || {}),
              createdAt: new Date().toISOString(),
            };
          }

          newWidgets.push(newWidget);
        }

        const tabWidgets = tab?.data?.widgets || [];

        const numberOfChanges = tab?.data?.numberOfChanges ?? 0;
        const newTab = {
          ...tab,
          updated_date: new Date().toISOString(),
          data: {
            ...tab.data,
            numberOfChanges: numberOfChanges + 1,
            lastUpdated: Date.now(),
            widgets: [...tabWidgets, ...newWidgets],
            gridLayout,
            currentTab,
            storedFileUUIDs: Array.from(storedFileUUIDs),
          },
        } as Item;

        set((state: AppState) => {
          const newItems = {
            ...state.items,
            [tabId]: removeDuplicateNavBarWidgets(newTab),
          };
          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });

        if (posthog) {
          const getApiSourceById = useBackendConnectorStore.getState().getApiSourceById;
          for (const initialWidget of widgetsToAdd) {
            const newWidget = newWidgets.find(
              (w) => w.widgetId === initialWidget.widgetId,
            );
            if (!newWidget) continue;
            const source = initialWidget.sourceId
              ? getApiSourceById(initialWidget.sourceId)
              : undefined;
            posthog.capture("added_a_widget", {
              widget_name: initialWidget.widgetId,
              tab_id: tabId,
              backend_name: initialWidget.sourceName,
              external: initialWidget.external,
              widgetType: newWidget.type,
              source_id: initialWidget.sourceId,
              listed_app_id: source?.vendorApp?.uuid,
              vendor_name: source?.vendorApp?.name,
            });
          }
        }

        get().debounceSaveDashboards();

        return newWidgets[newWidgets.length - 1]?.id;
      },
      addWidgetsToTabs: async (tabIds, widget) => {
        widget = Array.isArray(widget) ? widget : [widget];

        await Promise.all(
          tabIds.map(async (tabId) => await get().addWidgets(tabId, widget)),
        );
      },
      removeWidget: (tabId: string, widgetId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;

        let gridLayout = { ...(tab.data.gridLayout ?? {}) };

        set((state: AppState) => {
          let widgets = tab.data.widgets;
          let currentTab = tab.data.currentTab;

          const widgetToRemove = widgets.find((w) => w.id === widgetId);

          const paramGroups = Object.values(widgetToRemove?.paramGroups || {});

          const widgetsInGroup = widgets.filter((w) => {
            const wParamGroups = Object.values(w?.paramGroups || {});

            return (
              w.id !== widgetId &&
              (paramGroups.some((p) => wParamGroups.includes(p)) ||
                w.groupId === widgetToRemove?.groupId)
            );
          });

          // If the widget is the only one in the group, remove the group
          if (widgetsInGroup.length === 0) {
            tab.data.groups = tab.data.groups.filter(
              (g) =>
                !(
                  g.id === widgetToRemove?.groupId ||
                  paramGroups.some((p) => p === g.id)
                ),
            );
          }

          if (widgetToRemove?.widgetId === "navigation_bar") {
            gridLayout = { overview: gridLayout[currentTab] };
            const filteredWidgets = [];

            for (const w of tab.data.widgets) {
              if (w.innerTab !== currentTab || w.id === widgetId) continue;
              filteredWidgets.push({ ...w, innerTab: "overview" });
            }

            // Remove all widgets that are not in the overview tab
            widgets = filteredWidgets;
            currentTab = "overview";
          } else {
            // Remove the specific widget
            widgets = widgets.filter((w) => w.id !== widgetId);
          }

          gridLayout = updateWidgetGridLayout({
            widget: widgetToRemove,
            gridLayout,
            removeWidget: true,
            tabWidgets: widgets,
          });

          const numberOfChanges = tab?.data?.numberOfChanges ?? 0;
          const newTab = {
            ...tab,
            updated_date: new Date().toISOString(),
            data: {
              ...tab.data,
              numberOfChanges: numberOfChanges + 1,
              lastUpdated: Date.now(),
              widgets: widgets,
              currentTab,
              gridLayout,
              storedFileUUIDs: getStoredFileUUIDs(widgets),
              //removeWidgetAndReposition(tab.data.widgets, widgetId),
            },
          };

          useCopilotDataStore.getState()?.removeWidgetData(widgetId);
          useChartingStore.getState()?.removeWidgetData(widgetId);

          return {
            items: {
              ...state.items,
              [tabId]: removeDuplicateNavBarWidgets(newTab),
            },
          };
        });

        get().debounceSaveDashboards();
      },
      updateWidget: (tabId: string, widget: Widget) => {
        const { items } = get();
        const { getDashboardById, updateSharedDashboard } =
          useSharedAppStore.getState();
        const sharedTab = getDashboardById(tabId);
        const tab = items?.[tabId] || sharedTab;
        if (!tab) return;

        const cellOnClickParams = getCellOnClickParams(widget, false);
        const endpointParams = getEndpointParamGroupByIds(widget);
        // Prevents parameter groups controlled by `cellOnClick` interactions from
        // being overwritten during widget saves. Those groups are updated through
        // updateGroup; widget storage can lag behind and must not become source of truth.
        const shouldSkip = (group: GroupTypeT<"endpointParam" | "param">) => {
          const groupById = group.groupById;
          const paramName = endpointParams?.[groupById] ?? groupById;
          return cellOnClickParams.includes(paramName);
        };

        const widgetGroup = tab.data?.groups?.find(
          (g) => widget?.groupId && g.id === widget.groupId,
        );

        const newGroupValue = getWidgetGroupValue(widget, widgetGroup);
        if (
          widgetGroup?.type === "ticker" &&
          newGroupValue?.id !== widgetGroup?.value?.id
        ) {
          widgetGroup.value = newGroupValue;
        }

        if (
          widgetGroup?.type === "endpointParam" &&
          !shouldSkip(widgetGroup) &&
          widgetGroup?.value !== newGroupValue
        ) {
          widgetGroup.value = newGroupValue;
        }

        const currentGroups = Object.values(widget.paramGroups || {});

        for (const group of (tab.data.groups || []) as Group[]) {
          if (
            group?.type === "ticker" ||
            !currentGroups.includes(group?.id) ||
            shouldSkip(group)
          )
            continue;
          const value = getWidgetGroupValue(widget, group);

          if (value !== group.value) {
            group.value = value;
          }
        }

        const newTab = updateWidgetInItem(tab, widget);
        if (sharedTab) return updateSharedDashboard(tabId, newTab);

        set((state: AppState) => {
          const newItems = { ...state.items, [tabId]: newTab };
          return {
            items: newItems,
            ...updateSideBarItems(newItems, state),
          };
        });
      },
      updateTabWidgetsLayout: (
        tabId: string,
        widgetsLayout: GridData[],
        currentTab = "",
      ) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab) return;

        const gridLayout = { ...(tab.data.gridLayout ?? {}) };

        // Preserve originalMinH if it exists
        for (const layout of widgetsLayout) {
          const currLayout = gridLayout?.[currentTab]?.find((l) => l.i === layout.i);
          if (currLayout?.originalMinH) layout.originalMinH = currLayout.originalMinH;
          if (currLayout?.mobileH && !layout.mobileH)
            layout.mobileH = currLayout.mobileH;
          if (layout.mobileH) {
            for (const key of ["w", "h", "x", "y"] as const) {
              layout[key] = currLayout?.[key] || layout[key];
            }
          }
        }

        gridLayout[currentTab] = widgetsLayout;

        set((state: AppState) => {
          const newItems = { ...state.items };
          const numberOfChanges = (tab.data?.numberOfChanges ?? 0) + 1;
          const lastUpdated = Date.now();
          Object.assign(newItems[tabId].data, {
            currentTab,
            gridLayout,
            numberOfChanges,
            lastUpdated,
          });
          return { items: newItems, ...updateSideBarItems(newItems, state) };
        });
      },
      getWidgetGridData: (tabId: string, widgetId: string) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!(tab || tab?.data?.gridLayout)) return;

        const { gridLayout, currentTab = "" } = tab.data;

        const gridData = gridLayout[currentTab]?.find((grid) => grid.i === widgetId);
        if (gridData) return gridData;

        return Object.keys(gridLayout).reduce((acc, key) => {
          if (acc) return acc;
          return gridLayout[key].find((grid) => grid.i === widgetId);
        }, null);
      },
      minimizeWidget: (
        tabId: string,
        widgetId: string,
        isMinimized: boolean,
        originalH,
      ) => {
        const { items } = get();
        const tab = items?.[tabId];
        if (!tab?.data?.gridLayout) return;

        const currentTab = tab.data.currentTab || "";

        let widgetFound = false;
        const updatedGridLayout = { ...tab.data.gridLayout };

        const currentGridLayout = updatedGridLayout[currentTab];
        if (currentGridLayout) {
          const widgetIndex = currentGridLayout.findIndex(
            (item) => item.i === widgetId,
          );

          if (widgetIndex !== -1) {
            widgetFound = true;
            // Create a new array with the updated widget to ensure state changes are detected
            updatedGridLayout[currentTab] = currentGridLayout.map((item, index) => {
              if (index === widgetIndex) {
                const updatedWidget = { ...item };
                let updatedH = originalH;
                if (isMinimized) {
                  // store the original height so when the user expands the widget, it restores to its original size
                  updatedH = updatedWidget.h;

                  updatedWidget.h = 1.4; // minimum height for collapsed widget to show full navbar
                  // avoids `minH is greater than h` error on first render
                  updatedWidget.originalMinH = updatedWidget.minH;
                  updatedWidget.minH = 1.4;
                } else if (updatedH !== undefined) {
                  // restore original height if available
                  updatedWidget.h = updatedH;
                  updatedWidget.minH = updatedWidget.originalMinH || 4;
                } else {
                  // fallback height if originalH is somehow missing
                  updatedWidget.h = 12;
                  updatedWidget.minH = updatedWidget.originalMinH || updatedWidget.minH;
                }

                dispatchUpdateWidget(widgetId, (w) => ({
                  ...w,
                  originalH: updatedH,
                  isMinimized,
                }));

                return updatedWidget;
              }
              return item;
            });
          }
        }

        if (!widgetFound) return;

        set((state: AppState) => ({
          items: {
            ...state.items,
            [tabId]: {
              ...tab,
              data: {
                ...tab.data,
                gridLayout: updatedGridLayout,
                lastUpdated: Date.now(),
                numberOfChanges: (tab.data.numberOfChanges || 0) + 1,
              },
            },
          },
        }));
      },
    }),
  ),
  shallow,
);

export function useShallowAppStore<S extends AppState, T>(selector: Selector<S, T>): T {
  return useAppStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}

export type { GridData, GridLayout, Group, Ticker, Widget };
