import isEqual from "lodash.isequal";
import { persist, subscribeWithSelector } from "zustand/middleware";

import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import type { Group, Item, Selector, Widget } from "./app";

export type SharedItem = {
  creator: boolean;
  content: Item;
  created_date: Date;
  updated_date: Date;
  created_by: string;
  is_shared: boolean;
};

export type SharedItems = Record<"shared" | "entityShared", Record<string, SharedItem>>;

type SharedItemesT = Record<string, Item & { created_by: string }>;

export type SharedAppState = {
  sharedItems: SharedItemesT | null;
  getDashboardById: (dashboardId: string) => Item | null;
  updateSharedDashboard: (tabId: string, tabItem: Item) => void;
  updateOnlySharedItems: (sharedItems: SharedItems) => void;
  getWidgetById: (widgetId: string) => Widget;
  getWidgetGroups: (tabId: string, widgetId: string) => Group[];
};

export const useSharedAppStore = createWithEqualityFn<SharedAppState>()(
  subscribeWithSelector(
    persist(
      (set, get: () => SharedAppState) => ({
        getDashboardById: (dashboardId: string) => {
          const { sharedItems } = get();
          if (!sharedItems?.[dashboardId]) return;
          return sharedItems[dashboardId];
        },
        getWidgetById(widgetId: string) {
          const { sharedItems } = get();
          for (const key in sharedItems) {
            if (Object.prototype.hasOwnProperty.call(sharedItems, key)) {
              const item = sharedItems[key];
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
        getWidgetGroups: (tabId: string, widgetId: string) => {
          const { sharedItems } = get();
          const tab = sharedItems?.[tabId];
          if (!tab?.data) return [];

          const widget = tab.data.widgets.find((w) => w.id === widgetId);
          if (!widget) return [];

          return tab.data.groups.filter(
            (g) =>
              Object.values(widget.paramGroups || {}).includes(g.id) ||
              g.id === widget.groupId,
          );
        },
        updateSharedDashboard: (tabId: string, data: Item) => {
          const sharedTab = get().sharedItems?.[tabId];
          const tab = sharedTab;
          if (!tab) return;

          set((state: SharedAppState) => ({
            sharedItems: {
              ...state.sharedItems,
              [tabId]: {
                ...state.sharedItems?.[tabId],
                ...data,
              },
            },
          }));
        },
        sharedItems: null,
        updateOnlySharedItems: (sharedItems: SharedItems) => {
          if (!sharedItems) {
            return;
          }
          set((_state: SharedAppState) => ({
            sharedItems: {
              ...Object.keys(sharedItems.shared).reduce((acc, key) => {
                acc[key] = {
                  ...sharedItems.shared[key].content,
                  isEntityShared: false,
                  created_date: sharedItems.shared[key].created_date,
                  updated_date: sharedItems.shared[key].updated_date,
                  created_by: sharedItems.shared[key].created_by,
                };
                return acc;
              }, {}),
              ...Object.keys(sharedItems.entityShared).reduce((acc, key) => {
                acc[key] = {
                  ...sharedItems.entityShared[key].content,
                  isEntityShared: true,
                  created_date: sharedItems.entityShared[key].created_date,
                  updated_date: sharedItems.entityShared[key].updated_date,
                  created_by: sharedItems.entityShared[key].created_by,
                };
                return acc;
              }, {}),
            },
          }));
        },
      }),
      {
        name: "shared-app-storage",
      },
    ),
  ),
  shallow,
);

export function useShallowSharedAppStore<S extends SharedAppState, T>(
  selector: Selector<S, T>,
): T {
  return useSharedAppStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
