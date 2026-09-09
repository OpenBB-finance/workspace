import { useMemo } from "react";
import type { Item } from "~/lib/state/app";
import type { TabInfo } from "~/lib/utils";

export interface TabsInfoResult {
  hasMultipleTabs: boolean;
  tabsInfo: TabInfo[];
}

/**
 * Extracts tab information from a dashboard item.
 * @param item - The dashboard item to extract tabs from
 * @returns TabInfo array sorted by navigation_bar stored order
 */
export function extractTabsFromItem(item: Item | null): TabInfo[] {
  const gridLayout = item?.data?.gridLayout || {};
  const validTabIds = Object.keys(gridLayout).filter(
    (k) => k && gridLayout[k]?.length > 0,
  );

  if (validTabIds.length === 0) {
    return [];
  }

  const navBarWidget = item?.data?.widgets?.find(
    (w) => w.widgetId === "navigation_bar",
  );
  const storedTabs = navBarWidget?.storage?.tabs as TabInfo[] | undefined;

  const tabsInfo: TabInfo[] = validTabIds.map((tabId) => {
    const storedTab = storedTabs?.find((t) => t.id === tabId);
    return { id: tabId, name: storedTab?.name || tabId };
  });

  if (storedTabs) {
    tabsInfo.sort((a, b) => {
      const aIndex = storedTabs.findIndex((t) => t.id === a.id);
      const bIndex = storedTabs.findIndex((t) => t.id === b.id);
      return aIndex - bIndex;
    });
  }

  return tabsInfo;
}

/**
 * Hook to extract tab information from a dashboard.
 * Returns whether the dashboard has multiple tabs and the tabs info.
 * @param dashboard - The dashboard item to analyze
 * @returns hasMultipleTabs and tabsInfo array
 */
export function useTabsInfo(dashboard: Item | null): TabsInfoResult {
  return useMemo(() => {
    const tabsInfo = extractTabsFromItem(dashboard);

    return {
      hasMultipleTabs: tabsInfo.length > 1,
      tabsInfo,
    };
  }, [dashboard?.data?.gridLayout, dashboard?.data?.widgets]);
}
