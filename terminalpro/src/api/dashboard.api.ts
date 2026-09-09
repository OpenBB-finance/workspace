import axiosRetry from "axios-retry";
import { type Items, useAppStore } from "~/lib/state/app";
import { useAuthStore } from "~/lib/state/auth";
import { useFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useSharedAppStore } from "~/lib/state/sharedApp";
import { diffItemsWithRemote, dispatchSaveState, getValidItems } from "~/lib/utils";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import type { DashShared, DashSync } from "~/types/auth.type";
import { apiClient } from "./api";

axiosRetry(apiClient, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

/* Post dashboard */
export async function postDashboards(dashboardData: { [key: string]: any | "DELETE" }) {
  const { data } = await apiClient.post("/pro/dash/sync", {
    items: dashboardData,
  });
  return data;
}

/* Get dashboard */
export async function getDashboards<T extends DashSync>(): Promise<T> {
  const { data } = await apiClient.get<T>("/pro/dash/sync");
  return data;
}

export async function getOwnedDashboards<T extends DashSync<"owned">>(): Promise<T> {
  const { data } = await apiClient
    .get<T>("/pro/dash/sync/owned")
    .catch(() => ({ data: {} as T }));
  return data as T;
}

export async function getSharedDashboards<T extends DashShared>(): Promise<T> {
  const { data } = await apiClient
    .get<T>("/pro/dash/sync/shared")
    .catch(() => ({ data: {} as T }));
  return data as T;
}

export async function getSharedDashboardsAndUpdate() {
  const { featureFlags } = useFeatureFlagsStore.getState();
  const isFreeTier = featureFlags?.tier === "terminal";

  if (isFreeTier) return;

  const remoteData = await getSharedDashboards();
  useSharedAppStore.getState().updateOnlySharedItems({
    shared: remoteData.shared,
    entityShared: remoteData.entity_shared,
  });
}

/** @deprecated use not being used right now */
export async function getDashboardOwnedItemsFiltered(): Promise<Items> {
  const { data } = await apiClient
    .get<DashSync>("/pro/dash/sync")
    .catch(() => ({ data: {} as DashSync }));
  const filteredRemoteItems = {} as Items;

  if (!data.owned) {
    return filteredRemoteItems;
  }

  for (const key in data.owned) {
    if (data.owned[key].content && Object.keys(data.owned[key].content).length > 0) {
      filteredRemoteItems[key] = data.owned[key].content;
    }
  }

  // we check all isFolder items and make sure the children are valid items
  for (const key in filteredRemoteItems) {
    const item = filteredRemoteItems[key];
    if (item?.isFolder && item?.children?.length > 0) {
      filteredRemoteItems[key].children = item.children.filter((child: string) => {
        const childItem = filteredRemoteItems[child];
        return childItem?.data?.name;
      });
    }
  }

  // we check all items are valid
  return getValidItems(filteredRemoteItems);
}

type SaveDashboardsParams = {
  logout?: boolean;
  withNotification?: boolean;
  checkDiff?: boolean;
};

/**
 * Save the current state of the dashboards to the server
 * @param params - Optional parameters
 * @param params.withNotification - Show a notification when the dashboards are saved
 * @param params.checkDiff - Check if there are differences between the current state and the remote state
 * @param params.logout - Log the user out after saving the dashboards
 * @returns - Promise that resolves to true if there are differences between the current state and the remote state
 **/
export async function saveDashboards(params?: SaveDashboardsParams) {
  const { withNotification = false, checkDiff = false, logout = false } = params ?? {};

  const notifyParams = {
    id: NotificationId.SaveDashboards,
    message: "Dashboards saved",
    description: "Your dashboards have been saved",
    toastType: "success",
  } as const;

  // We dispatch save state event to ensure that the items are up to date
  dispatchSaveState();
  const { items, itemsStoredInCloud, updateItemsStoredInCloud } =
    useAppStore.getState();

  if (Object.keys(items ?? {}).length === 0) return;

  getSharedDashboardsAndUpdate().catch(
    () =>
      import.meta.env.DEV && console.log("Error when trying to get shared dashboards"),
  );

  try {
    const diff = diffItemsWithRemote(items, itemsStoredInCloud);

    if (checkDiff) return Object.keys(diff).length > 0;

    if (Object.keys(diff).length > 0) {
      // Send the differences to the server
      postDashboards(diff).then((_res) => {
        updateItemsStoredInCloud(items);
        // Update the remote items to match the current items
        if (withNotification) showNotificationWithRememberMe(notifyParams);
        if (logout) useAuthStore.getState().logout();
      });
      return;
    }
  } catch (_e) {
    if (logout) useAuthStore.getState().logout();
  }
  // If there are any differences, we need to sync them to the server

  // If there are no differences, log a message for debugging purposes
  // console.log("No dashboard changes found", logout ? " - Logging out" : "");
  if (withNotification) showNotificationWithRememberMe(notifyParams);
  if (logout) useAuthStore.getState().logout();
}

export async function getDashboardShares(dashboardUuid: string) {
  const { data } = await apiClient.get(`/pro/dash/${dashboardUuid}/shares`);
  return data;
}

export async function deleteAllDashboards() {
  const { data } = await apiClient.get("/pro/dash/sync");
  const ids = Object.keys(data.owned);
  await apiClient.post("/pro/dash/sync", {
    items: ids.reduce((acc, id) => {
      acc[id] = "DELETE";
      return acc;
    }, {}),
  });
}

export async function shareDashboard(dashboardUuid: string, emails: string) {
  // Split the emails string into an array
  const emailArray = emails.split(",");

  // Convert the email array into the required shares object format
  const shares = emailArray.reduce((acc, email) => {
    acc[email] = "view"; // Assuming "view" is the desired permission for all
    return acc;
  }, {});

  // Make the API call
  const { data } = await apiClient
    .post(`/pro/dash/${dashboardUuid}/share`, {
      shares,
    })
    .catch((e) => {
      if (e?.response?.data) {
        const { data } = e.response;
        const success = data?.success ?? false;
        return { data: { success, detail: data.detail } };
      }
      return { data: { success: false, detail: "Unable to share dashboard" } };
    });

  return data;
}

export async function deleteDashboardShare(dashboardUuid: string, emails: string[]) {
  const url = `/pro/dash/${dashboardUuid}/share`;

  const { data } = await apiClient.delete(url, {
    data: { shares: emails },
  });

  return data;
}

export async function getDashboardShareUsers(dashboardUuid: string) {
  const { data } = await apiClient.get(`/pro/dash/${dashboardUuid}/shares/users`);
  return data;
}
