import isEqual from "lodash.isequal";
import { v4 as uuidv4 } from "uuid";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { deleteUserApp, postUserApp } from "~/api/auth.api";
import { patchSnowflakeWidgetsEndpoint } from "~/components/DataConnectors/common/helpers";
import { createIndexedDBStorage } from "~/lib/utils/indexDB";
import { duplicateTabItem } from "../utils";
import type { Item, TabData, Widget } from "./app";

export interface UserAppData {
  uuid?: string;
  name: string;
  description: string;
  img?: string;
  img_dark?: string;
  img_light?: string;
  selected_agent?: string;
  prompts: string[];
  widgets: Widget[];
  groups: TabData["groups"];
  gridLayout: TabData["gridLayout"];
  storedFileUUIDs: string[];
}

export interface SharedUser {
  name: string;
  email: string;
}

export interface UserAppReturn {
  content: UserAppData;
  createdDate?: string;
  updatedDate?: string;
  creator: boolean;
  createdBy: string;
  isShared: boolean;
  sharedWith?: SharedUser[];
}

export interface UserGeneratedApp
  extends UserAppData,
    Partial<Omit<UserAppReturn, "content">> {}

export type UserAppsSync = {
  owned?: Record<string, UserAppReturn>;
  shared?: Record<string, UserAppReturn>;
};

export interface UserAppsState {
  skipSyncUserApps: boolean;
  userApps: { [id: string]: UserAppReturn };
  sharedUserApps: { [id: string]: UserAppReturn };
  updateUserApps: (userApps: UserAppsSync, fromValidateAndSync?: boolean) => void;
  addUserApp: (
    dashboardData: Item,
    name: string,
    description: string,
    imageUrl?: string,
    prompts?: string[],
  ) => Promise<string>;
  editUserApp: (id: string, updates: Partial<UserAppData>) => Promise<void>;
  removeUserApp: (id: string) => Promise<void>;
  getUserApp: (id: string) => UserGeneratedApp | undefined;
  getAllUserApps: () => UserGeneratedApp[];
  getAllSharedUserApps: () => UserGeneratedApp[];
  setAppShared: (id: string, isShared: boolean) => void;
}

export const useUserAppsStore = createWithEqualityFn<UserAppsState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        skipSyncUserApps: false,
        userApps: {},
        sharedUserApps: {},
        updateUserApps: (userApps, fromValidateAndSync = false) => {
          set({
            skipSyncUserApps: fromValidateAndSync,
            userApps: userApps.owned || {},
            sharedUserApps: userApps.shared || {},
          });

          if (fromValidateAndSync)
            setTimeout(() => set({ skipSyncUserApps: false }), 1000);
        },
        addUserApp: async (
          dashboard: Item,
          name: string,
          description: string,
          imageUrl?: string,
          prompts?: string[],
        ) => {
          if (!dashboard.data) {
            throw new Error("Dashboard data is required");
          }

          const uuid = uuidv4();
          const dashboardData = duplicateTabItem(dashboard);

          const userApp: UserGeneratedApp = {
            name: name.trim(),
            description: description.trim(),
            prompts: prompts || [],
            widgets: dashboardData.data.widgets,
            groups: dashboardData.data.groups,
            gridLayout: dashboardData.data.gridLayout || {},
            storedFileUUIDs: dashboardData.data.storedFileUUIDs || [],
            ...(imageUrl && { img: imageUrl }),
          };

          const userApps = await postUserApp(uuid, userApp);

          get().updateUserApps(userApps);

          return uuid;
        },

        editUserApp: async (uuid: string, updates: Partial<UserAppData>) => {
          const existingApp = get().userApps[uuid];
          if (!existingApp?.content) return;

          const updatedApp = { ...existingApp.content, ...updates };

          const userApps = await postUserApp(uuid, updatedApp);

          get().updateUserApps(userApps);
        },

        removeUserApp: async (id: string) => {
          const userApps = await deleteUserApp(id);

          get().updateUserApps(userApps);
        },

        getUserApp: (uuid: string) => {
          const app = get().userApps[uuid];
          if (!app?.content) return undefined;
          const { content, ...rest } = app;

          return { uuid, ...content, ...rest };
        },

        getAllUserApps: () => {
          const locationHref =
            typeof window !== "undefined" ? new URL(window.location.href) : undefined;
          return Object.entries(get().userApps).map(([uuid, app]) => {
            const { content, ...rest } = app;

            if (content.widgets) {
              content.widgets = patchSnowflakeWidgetsEndpoint(
                content.widgets,
                locationHref,
              );
            }

            return { uuid, ...content, ...rest };
          });
        },
        getAllSharedUserApps: () => {
          const locationHref =
            typeof window !== "undefined" ? new URL(window.location.href) : undefined;
          return Object.entries(get().sharedUserApps).map(([uuid, app]) => {
            const { content, ...rest } = app;
            if (content.widgets) {
              content.widgets = patchSnowflakeWidgetsEndpoint(
                content.widgets,
                locationHref,
              );
            }

            return { uuid, ...content, ...rest, isShared: true };
          });
        },
        setAppShared: (id: string, isShared: boolean) => {
          const app = get().userApps[id];
          if (!app) return;

          const updatedApp = { ...app, isShared };

          set((state) => ({
            userApps: {
              ...state.userApps,
              [id]: updatedApp,
            },
          }));
        },
      }),
      {
        name: "user-apps-storage",
        storage: createIndexedDBStorage(),
        partialize: (state) => ({
          userApps: state.userApps,
          sharedUserApps: state.sharedUserApps,
        }),
      },
    ),
  ),
  shallow,
);

export function useShallowUserAppsStore<T>(selector: (state: UserAppsState) => T): T {
  return useUserAppsStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
