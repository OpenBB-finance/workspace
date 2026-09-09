import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { apiClient } from "~/api/api";
import { getApiSources } from "~/api/auth.api";
import { saveDashboards } from "~/api/dashboard.api";
import { useCreateRef } from "~/hooks/useRefHooks";
import { useShallowAppStore } from "~/lib/state/app";
import { useAuthStore, useShallowAuthStore } from "~/lib/state/auth";
import {
  useBackendConnectorStore,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import { useShallowTradingViewStore } from "~/lib/state/charting";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { useSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import { useShallowTableChartThemesStore } from "~/lib/state/tableChartThemes";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowUserAppsStore } from "~/lib/state/userApps";
import { dispatchSaveState } from "~/lib/utils";
import type { DashSyncT } from "~/types/auth.type";
import { useGetAppWidgets } from "../AI/hooks/useGetAppWidgets";

export default function useSyncItems() {
  const { pathname } = useLocation();
  useGetAppWidgets(); // Initialize the app widgets store

  const { user, checkNewBundles } = useShallowAuthStore((state) => ({
    user: state.user,
    checkNewBundles: state.checkNewBundles,
  }));
  const updateThemeSettings = useShallowTableChartThemesStore(
    (state) => state.updateThemeSettings,
  );
  const updateUserApps = useShallowUserAppsStore((state) => state.updateUserApps);

  const { updateRemoteItems, checkForChanges } = useShallowAppStore((state) => ({
    updateRemoteItems: state.updateRemoteItems,
    checkForChanges: state.checkForChanges,
  }));
  const updateChats = useShallowCopilotStore((state) => state.updateChats);
  const { updateApiSources, updateBackendConnector } = useShallowBackendConnectorStore(
    (state) => ({
      updateApiSources: state.updateApiSources,
      updateBackendConnector: state.updateBackendConnector,
    }),
  );
  const updateTVState = useShallowTradingViewStore((state) => state.updateTVState);
  const updateOnlySharedItems = useSharedAppStore(
    (state) => state.updateOnlySharedItems,
  );
  const setFeatureFlagsAndUsage = useShallowFeatureFlagsStore(
    (state) => state.setFeatureFlagsAndUsage,
  );
  const updateThemeState = useShallowThemeStore((state) => state.updateThemeState);
  const updateMCPServers = useShallowMcpToolsStore((state) => state.updateServers);
  const updateUserSkills = useShallowSkillsLibraryStore((state) => state.updateSkills);

  const items = useShallowAppStore((state) => state.items);
  const itemsRef = useCreateRef(items);

  const { refetch: refetchApiSources } = useQuery({
    queryKey: ["apiSources"],
    queryFn: async () => getApiSources().then(updateApiSources),
    enabled: false, // Only fetch when needed
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { mutateAsync: getDashboards } = useMutation<DashSyncT>({
    mutationFn: async () => {
      const { data } = await apiClient
        .get("/pro/dash/validate-and-sync")
        .catch((error) => {
          if (error?.response?.status === 401) {
            // If the user is unauthorized, log them out
            useAuthStore.getState().logout();
          }
          throw error;
        });
      return data;
    },

    onSuccess: (dashboardsData) => {
      queueMicrotask(async () => {
        const data = dashboardsData;
        setFeatureFlagsAndUsage(
          {
            ...data.feature_entitlements,
            is_trial: data.is_trial_entity,
            can_submit_marketplace: data.can_submit_marketplace ?? false,
          },
          data.usage,
        );

        updateChats(data.copilot_chats, { questionsHistory: data.questions_history });
        updateRemoteItems(data.owned);
        updateOnlySharedItems({
          shared: data.shared,
          entityShared: data.entity_shared,
        });

        if (data.entity_theme_settings) updateThemeSettings(data.entity_theme_settings);

        updateTVState(data.trading_view);
        checkNewBundles(data.feature_entitlements.tier === "pro");
        updateThemeState(data.pro_display_settings || {});
        updateBackendConnector({
          storedFiles: data.file_widgets || [],
          singleWidgets: data.single_widgets || [],
          widgetMetadata: data.widget_metadata || [],
        });
        updateMCPServers(data.mcp_servers);
        updateUserApps(data.user_apps || {}, true);
        updateUserSkills(data.user_skills || []);
        if (pathname === "/app") return;

        refetchApiSources();
      });
    },

    onError: (error) => {
      console.error("Failed to refetch dashboards:", error);
      useBackendConnectorStore.setState({ isLoadingBackends: false });
    },
  });

  const handleBeforeUnload = useCallback(
    (_e: BeforeUnloadEvent) => {
      const hasDiff = checkForChanges();
      if (hasDiff) saveDashboards();
    },
    [checkForChanges],
  );

  useEffect(() => {
    // Check if the user is logged in and items are null
    if (user && !itemsRef?.current) {
      getDashboards();
    }
  }, [user, items, itemsRef]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);

    const debouncedSaveInt = setInterval(() => saveDashboards(), 1000 * 60 * 1); // Save every minute
    const clearInt = setInterval(() => dispatchSaveState(), 1000 * 30); // Save every 30 seconds

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Cleanup function: cancel the debounced call and immediately save changes
      clearInterval(debouncedSaveInt);
      clearInterval(clearInt);
      dispatchSaveState(); // Ensure all local widget changes are pushed to the store

      // Clear the selected widgets
      useCopilotDataStore.getState().clearState();

      saveDashboards(); // Save immediately when the component unmounts or before re-running the effect

      // Makes sure the user is logged in and items aren't null before refetching
      if (user && !itemsRef?.current) {
        getDashboards();
      }
    };
  }, [pathname, itemsRef]);
}
