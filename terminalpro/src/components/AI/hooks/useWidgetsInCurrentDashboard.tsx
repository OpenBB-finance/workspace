import { useCallback, useEffect } from "react";
import { useActiveWorkspaceDashboardId } from "~/components/AI/hooks/useActiveWorkspaceDashboardId";
import type { WidgetT } from "~/components/types";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSharedAppStore, useSharedAppStore } from "~/lib/state/sharedApp";

export function useWidgetsInCurrentDashboard() {
  // This hook is an abstraction to get either private or shared widgets in a dashboard

  const getPrivateWidgetById = useShallowAppStore((state) => state.getWidgetById);
  const getSharedWidgetById = useShallowSharedAppStore((state) => state.getWidgetById);

  const getDashboardWidgetByUuid = useCallback(
    (uuid: string): WidgetT | null => {
      const privateWidget = getPrivateWidgetById(uuid);
      if (privateWidget) return privateWidget;
      const sharedWidget = getSharedWidgetById(uuid);
      if (sharedWidget) return sharedWidget;
      return null;
    },
    [getPrivateWidgetById, getSharedWidgetById],
  );

  return getDashboardWidgetByUuid;
}

export function useSyncWidgetsInCurrentDashboard() {
  const currentDashboardId = useActiveWorkspaceDashboardId();

  const setWidgetsInCurrentDashboard = useShallowCopilotDataStore(
    (s) => s.setWidgetsInCurrentDashboard,
  );

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state) => state.getTabById(currentDashboardId)?.data?.widgets ?? [],
      (current, prev) => {
        if (current.length > 0 || prev.length > 0) {
          setWidgetsInCurrentDashboard(current);
        }
      },
      { fireImmediately: true },
    );

    const unsubscribeShared = useSharedAppStore.subscribe(
      (state) => state.getDashboardById(currentDashboardId)?.data?.widgets ?? [],
      (current, prev) => {
        if (current.length > 0 || prev.length > 0) {
          setWidgetsInCurrentDashboard(current);
        }
      },
      { fireImmediately: true },
    );

    return () => {
      unsubscribe();
      unsubscribeShared();
    };
  }, [currentDashboardId]);
}
