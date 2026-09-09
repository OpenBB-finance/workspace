import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useCallback, useMemo } from "react";
import {
  ADMIN_MARKETPLACE_APPS_KEY,
  ADMIN_MARKETPLACE_WHITELIST_KEY,
  type AdminAppTransition,
  type AdminAppUpdate,
  addWhitelist,
  deleteWhitelist,
  getAppSubscriptions,
  listAdminApps,
  listWhitelist,
  rejectAdminApp,
  transitionAdminApp,
  updateAdminApp,
  validateMarketplaceAdmin,
} from "~/api/adminMarketplace.api";
import { getConfig } from "~/lib/runtimeConfig";
import { apiErrorMessage } from "~/lib/utils/apiError";
import { showNotification } from "~/lib/utils/toast";

/**
 * React Query layer over the admin marketplace service. Reads use a single
 * apps query (client-side tab filtering); every mutation targets one invalidate
 * prefix + toasts the backend `detail` on failure. No optimistic updates, per
 * repo convention.
 */

export function useAdminMarketplaceApps() {
  return useQuery({
    queryKey: ADMIN_MARKETPLACE_APPS_KEY,
    queryFn: listAdminApps,
    staleTime: 30_000,
  });
}

/** Per-app subscription counts. Only mounted inside the review dialog. */
export function useAppSubscriptions(id: string) {
  return useQuery({
    queryKey: [...ADMIN_MARKETPLACE_APPS_KEY, id, "subscriptions"],
    queryFn: () => getAppSubscriptions(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

function toastError(fallback: string) {
  return (error: unknown) =>
    showNotification({
      message: fallback,
      description: apiErrorMessage(error, fallback),
      toastType: "error",
    });
}

function useInvalidateApps() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ADMIN_MARKETPLACE_APPS_KEY }),
    [queryClient],
  );
}

const TRANSITION_LABEL: Record<AdminAppTransition, string> = {
  publish: "App published",
  disable: "App disabled",
  enable: "App enabled",
  remove: "App removed",
  verify: "App re-verified",
};

export function useTransitionApp() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: AdminAppTransition }) =>
      transitionAdminApp(id, action),
    onSuccess: (_data, { action }) => {
      invalidate();
      showNotification({ message: TRANSITION_LABEL[action], toastType: "success" });
    },
    onError: toastError("Couldn't update the app"),
  });
}

export function useRejectApp() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectAdminApp(id, reason),
    onSuccess: () => {
      invalidate();
      showNotification({ message: "Submission rejected", toastType: "success" });
    },
    onError: toastError("Couldn't reject the submission"),
  });
}

export function useUpdateAdminApp() {
  const invalidate = useInvalidateApps();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminAppUpdate }) =>
      updateAdminApp(id, payload),
    onSuccess: () => {
      invalidate();
      showNotification({ message: "App updated", toastType: "success" });
    },
    onError: toastError("Couldn't update the app"),
  });
}

export function useWhitelist() {
  return useQuery({
    queryKey: ADMIN_MARKETPLACE_WHITELIST_KEY,
    queryFn: listWhitelist,
    staleTime: 30_000,
  });
}

function useInvalidateWhitelist() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: ADMIN_MARKETPLACE_WHITELIST_KEY }),
    [queryClient],
  );
}

export function useAddWhitelist() {
  const invalidate = useInvalidateWhitelist();
  return useMutation({
    mutationFn: addWhitelist,
    onSuccess: () => {
      invalidate();
      showNotification({ message: "Developer whitelisted", toastType: "success" });
    },
    onError: (error: AxiosError) => {
      const message =
        error.response?.status === 404
          ? "No user with that email — ask the developer to create an OpenBB account first"
          : apiErrorMessage(error, "Couldn't add the developer");
      showNotification({
        message: "Couldn't add the developer",
        description: message,
        toastType: "error",
      });
    },
  });
}

export function useDeleteWhitelist() {
  const invalidate = useInvalidateWhitelist();
  return useMutation({
    mutationFn: deleteWhitelist,
    onSuccess: () => {
      invalidate();
      showNotification({ message: "Developer removed", toastType: "success" });
    },
    onError: toastError("Couldn't remove the developer"),
  });
}

/**
 * Superuser probe gating the admin marketplace page + sidebar link. Mirrors
 * `useHasAdminAccess` (LayoutAdmin) but hits the marketplace-specific validate
 * endpoint (superuser, not org-admin). Only runs when the marketplace feature
 * is enabled; 401/403 → not an admin.
 */
export function useIsMarketplaceAdmin() {
  const enabled = getConfig().ui.showMarketplace;
  const { data, isLoading } = useQuery<{ success: boolean }, AxiosError>({
    queryKey: ["admin", "marketplace", "validate"],
    queryFn: validateMarketplaceAdmin,
    enabled,
    staleTime: 1000 * 60 * 5,
    retry: false,
    notifyOnChangeProps: ["data", "isLoading"],
  });

  return useMemo(
    () => ({
      // A 401/403 resolves as an error, so `data` is absent — no extra check needed.
      isMarketplaceAdmin: enabled && !!data?.success,
      isLoading: enabled ? isLoading : false,
    }),
    [enabled, data, isLoading],
  );
}
