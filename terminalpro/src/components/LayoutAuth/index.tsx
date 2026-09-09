import { type UseQueryOptions, useQueries } from "@tanstack/react-query";
import { usePostHog } from "posthog-js/react";
import {
  memo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  Outlet,
  UNSAFE_useScrollRestoration,
  useLocation,
  useParams,
} from "react-router-dom";
import useAuthKeyPresses from "~/hooks/useAuthKeyPresses";
import { usePrivateRoute } from "~/hooks/usePrivateRoute";
import { TickersProvider } from "~/lib/contexts/CachedTickers";
import { MobileProvider, useMobile } from "~/lib/providers/MobileProvider";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  cleanupWalkthroughPosthogProperties,
  useShallowWalkthroughStore,
} from "~/lib/state/walkthrough";
import { isTabPath } from "~/lib/utils/utils";
import { FileProvider } from "../DataConnectors/FileProvider";
import { DataConnectorProvider } from "../DataConnectors/Providers/DataConnectorProvider";
import { ResizablePanelGroup } from "../ui/Resizable";
import { MobileCenterPanel } from "./AppLayout/CenterPanel";
import { CombinedCenterRightPanel } from "./AppLayout/CombinedCenterRightPanel";
import { LeftSidePanel, MobileLeftSidePanel } from "./AppLayout/LeftSidePanel";
import { MobileRightSidePanel } from "./AppLayout/RightSidePanel";
import BottomTabBar from "./Mobile/BottomTabBar";
import NoItems from "./NoItems";
import OuterComponents from "./OuterComponents";
import useSyncChats from "./useSyncChats";
import useSyncItems from "./useSyncItems";

export function App({ children }: { children?: ReactNode }) {
  return useMemo(
    () => (
      <DataConnectorProvider>
        <MobileProvider>
          <FileProvider>
            <LayoutAuth>{children}</LayoutAuth>
          </FileProvider>
        </MobileProvider>
      </DataConnectorProvider>
    ),
    [children],
  );
}

function useQueuedRefresh() {
  const { id: activeDashboardId } = useParams();
  const { queuedRefreshIds, refreshApiSourceById } = useShallowBackendConnectorStore(
    (state) => ({
      queuedRefreshIds: state.queuedRefreshIds,
      refreshApiSourceById: state.refreshApiSourceById,
    }),
  );

  useQueries({
    queries: queuedRefreshIds.map(
      (sourceId) =>
        ({
          queryKey: ["refreshBackend", sourceId],
          queryFn: async () => refreshApiSourceById(sourceId, activeDashboardId),
          staleTime: 1000 * 20,
          gcTime: 1000 * 60,
          enabled: !!sourceId,
        }) as UseQueryOptions<{ success: boolean }>,
    ),
  });
}

function useLogUser() {
  usePrivateRoute(false);
  useAuthKeyPresses();
  UNSAFE_useScrollRestoration();
  useSyncChats();
  const posthog = usePostHog();

  const { user, identified, setIdentified } = useShallowAuthStore((s) => ({
    user: s.user,
    identified: s.identified,
    setIdentified: s.setIdentified,
  }));

  useEffect(() => {
    if (user && posthog && !identified) {
      posthog.identify(user.uuid, {
        name: user.username,
        email: user.email,
        userAgent: window?.navigator?.userAgent,
        dimensionX: window?.screen?.width,
        dimensionY: window?.screen?.height,
      });
      if (setIdentified) setIdentified(true);
    }
  }, [user]);
}

function useLastVisitedPage() {
  const location = useLocation();
  const previousPathRef = useRef<string>("");
  const updateLastVisitedPage = useShallowAuthStore(
    (state) => state.updateLastVisitedPage,
  );
  const updateSettings = useShallowThemeStore((s) => s.debouncedUpdateSettings);
  const hasItems = useShallowAppStore((state) => state.hasItems || !!state.rootItem);
  const { isFullscreen, setIsIntentionallyCollapsed, toggleFullscreen } =
    useShallowCopilotStore((state) => ({
      isFullscreen: state.isFullscreen,
      setIsIntentionallyCollapsed: state.setIsIntentionallyCollapsed,
      toggleFullscreen: state.toggleFullscreen,
    }));

  useEffect(() => {
    if (!hasItems) return;
    const pathname = location.pathname;

    updateLastVisitedPage(pathname);
    updateSettings();

    // Auto-close copilot when navigating away from dashboard context while maximized
    const currentIsDashboardPage = isTabPath(pathname);
    const previousWasDashboardPage = isTabPath(previousPathRef.current);

    // Close if maximized and navigating between different pages, but keep open when going TO a dashboard
    if (
      isFullscreen &&
      previousPathRef.current &&
      previousPathRef.current !== pathname
    ) {
      const shouldClose = !currentIsDashboardPage;

      if (shouldClose) {
        // User navigated away from dashboard context while copilot is maximized
        setIsIntentionallyCollapsed(true);
        toggleFullscreen();
      }
    }

    // Update previous path reference for next navigation
    previousPathRef.current = pathname;
  }, [location.pathname, previousPathRef]);

  useLayoutEffect(() => {
    // Scroll to top of center panel when the route changes
    const workarea = document.getElementById("workarea");
    workarea?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
}

function useLoad() {
  useLastVisitedPage();

  const isWalkthroughActive = useShallowWalkthroughStore(
    (state) => state.currentWalkthrough !== null,
  );
  useEffect(() => {
    if (!isWalkthroughActive) cleanupWalkthroughPosthogProperties();
    const element = document.getElementById("app-layout");
    if (element) {
      element.classList.toggle("walkthrough-active", isWalkthroughActive);
    }
  }, [isWalkthroughActive]);

  useLogUser();
  useSyncItems();
  useQueuedRefresh();
}

type LayoutProps = {
  children?: ReactNode;
};

const LayoutMobile = (props: LayoutProps) => {
  const { children } = props;

  return (
    <TickersProvider>
      <div className="flex flex-col bg-surface-page h-dvh" id="app-layout">
        <div className="relative flex-1 overflow-y-auto pb-14">
          <OuterComponents />
          <MobileLeftSidePanel />
          <MobileCenterPanel>{children}</MobileCenterPanel>
          <MobileRightSidePanel />
        </div>
        <BottomTabBar />
      </div>
    </TickersProvider>
  );
};

const LayoutDesktop = memo((props: LayoutProps) => {
  const { children } = props;
  const combinedPanelMemo = useMemo(
    () => (
      <CombinedCenterRightPanel key="combined-center-right-panel">
        {children}
      </CombinedCenterRightPanel>
    ),
    [children],
  );

  return useMemo(
    () => (
      <TickersProvider key="tickers-provider">
        <div className="flex bg-surface-page" id="app-layout" key="app-layout">
          <OuterComponents key="outer-components" />
          <ResizablePanelGroup
            key="resizable-panel-group"
            direction="horizontal"
            id="group"
            autoSaveId="persistence-1"
          >
            <LeftSidePanel key="left-panel" />
            {combinedPanelMemo}
          </ResizablePanelGroup>
        </div>
      </TickersProvider>
    ),
    [combinedPanelMemo],
  );
});

const LayoutAuthRoot = (props: { children?: ReactNode }) => {
  const { children } = props;
  const isMobile = useMobile((state) => state.isMobile);
  const childrenMemo = useMemo(() => children || <Outlet />, [children]);

  useLoad();

  const hasItems = useShallowAppStore((state) => state.hasItems || !!state.rootItem);
  return useMemo(() => {
    if (!hasItems) return <NoItems />;
    if (isMobile)
      return <LayoutMobile key="layout-mobile">{childrenMemo}</LayoutMobile>;
    return <LayoutDesktop key="layout-desktop">{childrenMemo}</LayoutDesktop>;
  }, [childrenMemo, hasItems, isMobile]);
};

export const LayoutAuth = memo(LayoutAuthRoot);

export default memo(App);
