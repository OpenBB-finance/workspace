import { useEffect, useMemo } from "react";
import type { Layout } from "react-grid-layout";
import { useParams, useSearchParams } from "react-router-dom";

import EmptyDashboardCTA from "~/components/General/EmptyDashboardCTA";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import GridLayout from "~/components/GridLayout";
import { WidgetWrapper } from "~/components/Widget";
import { TabProvider } from "~/lib/contexts/TabContext";
import { useMobile } from "~/lib/providers/MobileProvider";
import { type GridData, useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useThemeStore } from "~/lib/state/theme";
import { resolveInnerTabParams } from "~/lib/utils";

import AuthedAppNotFound from "./AuthedAppNotFound";

function useTabWidgets() {
  const { id } = useParams();

  const tabId = useMemo(() => id, [id]);

  const gridLayout = useShallowAppStore(
    (state) => state?.items?.[tabId]?.data?.gridLayout,
  );

  const sharedGridLayout = useShallowSharedAppStore(
    (state) => state?.sharedItems?.[tabId]?.data?.gridLayout,
  );

  const isShared = !!sharedGridLayout;

  const layoutMemo = useMemo(
    () => (isShared ? sharedGridLayout : gridLayout),
    [gridLayout, sharedGridLayout],
  );

  const layoutLength = Object.values(layoutMemo || {})
    .filter((v) => v?.length > 0)
    ?.reduce((acc, curr) => acc + curr.length, 0);

  useEffect(() => {
    return () => {
      // just in case pending export is still true
      useThemeStore.getState().setPendingExport(false);
    };
  }, [tabId]);

  useEffect(() => {
    if (layoutLength > 0) {
      useAppStore.getState().updateTabParams(tabId);
    }
  }, [layoutLength]);

  return { gridLayout: layoutMemo, isShared };
}

export default function TabPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));

  const currentTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const { gridLayout, isShared } = useTabWidgets();

  const isMobile = useMobile((state) => state.isMobile);

  const hasLayout = !!gridLayout?.[currentTab];

  useEffect(() => {
    if (hasLayout) return;

    const nextParams = resolveInnerTabParams({
      gridLayout,
      currentTab,
      lastInnerTab,
      searchParams,
    });
    // `null` means the URL already matches — navigating anyway would push a
    // duplicate history entry on every pass and trip the browser's navigation throttle.
    if (nextParams) setSearchParams(nextParams, { replace: true });
  }, [hasLayout, gridLayout, currentTab, lastInnerTab, searchParams, setSearchParams]);

  const currentGrid = useMemo(
    () => (gridLayout?.[currentTab] || []) as Layout[],
    [gridLayout?.[currentTab]],
  );

  // Current tab widgets (visible in grid)
  const gridItemsMemo = useMemo(() => {
    const uniqueGrid = currentGrid.reduce((acc, layout) => {
      if (!acc.has(layout.i)) acc.set(layout.i, layout);

      return acc;
    }, new Map<string, GridData>());

    return Array.from(uniqueGrid.values()).map((l) => {
      return (
        <div
          key={l.i}
          data-widget-id={l.i}
          data-grid={{
            ...l,
            y: Number.isFinite(l.y) ? l.y : 0,
            w: isMobile ? 40 : l.w,
            h: isMobile ? l.mobileH || l.h : l.h,
          }}
          className={l.i === "empty-dashboard-cta" ? "" : "!dark:bg-none !bg-none"}
        >
          <WidgetWrapper uuid={l.i} activeDashboardId={id} />
        </div>
      );
    });
  }, [currentGrid, isMobile]);

  const emptyDashMemo = useMemo(() => {
    return isShared ? (
      <div className="mx-4 my-3 h-[calc(100vh-1.6rem)] rounded bg-white p-5 dark:bg-[#151518]">
        <SearchResultsNotFound
          icon={true}
          firstMessage="Empty shared dashboard"
          secondMessage="This dashboard is empty. Only the creator can add widgets."
        />
      </div>
    ) : (
      <EmptyDashboardCTA />
    );
  }, [isShared]);

  const hasGrid = currentGrid?.length > 0;

  const gridLayoutRootMemo = useMemo(
    () =>
      hasGrid ? (
        <GridLayout
          extraClassName="lg:mx-3 pb-56"
          saveTab={true}
          saveToLocalStorage={false}
        >
          {gridItemsMemo}
        </GridLayout>
      ) : (
        emptyDashMemo
      ),
    [hasGrid, emptyDashMemo, gridItemsMemo],
  );

  const noLayout = gridLayout === undefined;
  return useMemo(
    () =>
      noLayout ? (
        <AuthedAppNotFound />
      ) : (
        <TabProvider
          currentTab={currentTab}
          tabId={id}
          layouts={currentGrid}
          isShared={isShared}
        >
          {gridLayoutRootMemo}
        </TabProvider>
      ),
    [currentTab, currentGrid, gridLayoutRootMemo, id, isShared, noLayout],
  );
}
