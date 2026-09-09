import { useMemo } from "react";
import { useLocation, useParams } from "react-router-dom";
import type { SideBarItems } from "~/lib/state/app";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { isTabPath } from "~/lib/utils/utils";

function isKnownDashboardId(
  dashboardId: string | null | undefined,
  sideBarItems: SideBarItems,
) {
  return Boolean(dashboardId && sideBarItems[dashboardId]?.data);
}

export function resolveActiveWorkspaceDashboardId(
  pathname: string,
  routeDashboardId: string | null | undefined,
  sidebarActiveItem: string | null | undefined,
  sideBarItems: SideBarItems,
) {
  const pathDashboardId = isTabPath(pathname)
    ? pathname.split("/app/").pop()?.split("?")[0] || ""
    : "";

  if (pathDashboardId) {
    return pathDashboardId;
  }

  if (isKnownDashboardId(routeDashboardId, sideBarItems)) {
    return routeDashboardId || "";
  }

  if (isKnownDashboardId(sidebarActiveItem, sideBarItems)) {
    return sidebarActiveItem || "";
  }

  return "";
}

export function useActiveWorkspaceDashboardId() {
  const { pathname } = useLocation();
  const { id: routeDashboardId = "" } = useParams();
  const sideBarItems = useShallowAppStore((state) => state.sideBarItems);
  const sidebarActiveItem = useShallowSidebarStore(
    (state) => state.activeItem as string | null,
  );

  return useMemo(
    () =>
      resolveActiveWorkspaceDashboardId(
        pathname,
        routeDashboardId,
        sidebarActiveItem,
        sideBarItems,
      ),
    [pathname, routeDashboardId, sideBarItems, sidebarActiveItem],
  );
}
