import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { NavLink, type NavLinkRenderProps } from "react-router-dom";
import useDetectOS from "~/hooks/useDetectOS";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { ENABLE_SHARING } from "~/lib/constants";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowSidebarStore, useSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  useShallowWorkspaceBridgeStore,
  type WorkspaceBridgeStatus,
} from "~/lib/state/workspaceBridge";
import { cn } from "~/lib/utils";
import { groupVariants } from "../ds/atoms/Input";
import FeatureLock from "../General/FeatureLock";
import Sidebar from "../General/Sidebar";
import SnowflakeHide from "../General/SnowflakeHide";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { usePanelsState } from "./AppLayout/hooks/usePanelsState";
import HamburgerMenu from "./HamburgerMenu";
import { McpCompanionModal } from "./McpCompanionModal";
import PlusMenu from "./PlusMenu";
import SharedDashboardsSidebar from "./SharedDashboardsSidebar";
import { SidebarSection } from "./SidebarSection";
import TabsItems from "./TabsItems";

const RENDER_COLLAPSED_LEFT_SIDEBAR_WHEN_WIDTH_LESS_THAN = 100;

type TabLinkProps = {
  id: string;
  href: string;
  label: string;
  icon: string;
  locked?: boolean;
  lockMessage?: string;
};

const TABS_LINKS: Record<string, TabLinkProps[]> = {
  apps: [
    {
      id: "apps",
      href: "/app",
      label: "Apps",
      icon: "grid-01",
    },
  ],
  connections: [
    {
      id: "connections",
      href: "/app/connections",
      label: "Connections",
      icon: "terminal-browser",
    },
  ],
  library: [
    {
      id: "widgets",
      href: "/app/widgets",
      label: "Widgets",
      icon: "layout-top",
    },
    {
      id: "ai",
      href: "/app/ai",
      label: "AI",
      icon: "stars-02",
    },
  ],
};

const MCP_STATUS_MAP: Record<
  Exclude<WorkspaceBridgeStatus, "disabled">,
  { messageSuffix: string; color?: string }
> = {
  connected: { messageSuffix: "active", color: "text-green-500" },
  attempting: { messageSuffix: "attempting to connect" },
  reconnecting: { messageSuffix: "reconnecting" },
};

function McpStatusIndicator() {
  const status = useShallowWorkspaceBridgeStore((state) => state.status);

  return useMemo(() => {
    if (status === "disabled") return null;
    const { color = "text-yellow-500", messageSuffix } = MCP_STATUS_MAP[status];
    return (
      <Tooltip message={`Workspace MCP Companion is ${messageSuffix}`}>
        <div className="flex items-center justify-center size-6 p-1">
          <Icon
            id="mcp"
            className={cn("size-4", color, { "animate-pulse": status !== "connected" })}
          />
        </div>
      </Tooltip>
    );
  }, [status]);
}

function AuthSidebar({ isMobile }: { isMobile?: boolean }) {
  const { changeSearch, setInitialSelectedSearchTab } = useShallowThemeStore(
    (state) => ({
      changeSearch: state.changeSearch,
      setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
    }),
  );

  const isMacOS = useDetectOS()?.isMacOS;
  const hamburgerMemo = useMemo(
    () => <HamburgerMenu isMobile={isMobile} key="auth-sidebar-hamburger-menu" />,
    [isMobile],
  );

  const headerMemo = useMemo(() => {
    return (
      <div
        key="auth-sidebar-header"
        className="@max-[100px]:flex-col flex items-center justify-center dark:text-light-500 text-light-600"
      >
        <McpStatusIndicator />
        {hamburgerMemo}
        <McpCompanionModal />
      </div>
    );
  }, [hamburgerMemo]);

  const searchMemo = useMemo(() => {
    return (
      <>
        <button
          key="auth-sidebar-search-button"
          onClick={() => {
            setInitialSelectedSearchTab("widgets");
            changeSearch(true);
          }}
          className={cn(
            groupVariants(),
            "@max-[100px]:hidden whitespace-nowrap flex w-full! h-8 items-center rounded border py-1! px-2! gap-2.5",
          )}
        >
          <Icon id="magnifying-glass-icon" className="h-4 min-w-4" />
          <span className="text-xs truncate">
            {isMacOS ? "Search (⌘+K)" : "Search (Ctrl+K)"}
          </span>
        </button>

        <div
          className="@min-[100px]:hidden items-center justify-center flex flex-col gap-0.5"
          key="auth-sidebar-search"
        >
          <button
            onClick={() => {
              setInitialSelectedSearchTab("widgets");
              changeSearch(true);
            }}
            className="obb-navigation-item mx-auto rounded border border-[#DCDCDC]
            bg-white hover:bg-light-50 dark:border-[#303038]
            dark:bg-[#212126] dark:hover:bg-[#202025]"
          >
            <Icon
              id="magnifying-glass-icon"
              className="h-4 min-w-4 text-light-800 group-hover:text-light-800
              dark:text-light-100 dark:group-hover:text-white"
            />
          </button>
        </div>
      </>
    );
  }, [isMacOS]);

  const sidebarItemsMemo = useMemo(() => <SidebarItems key="auth-sidebar-items" />, []);
  const navLinksMemo = useMemo(() => <LinksNav key="auth-sidebar-links" />, []);

  return useMemo(
    () => (
      <Sidebar header={headerMemo} search={searchMemo} key="auth-sidebar">
        {navLinksMemo}
        {sidebarItemsMemo}
      </Sidebar>
    ),
    [headerMemo, searchMemo, navLinksMemo, sidebarItemsMemo],
  );
}

function TabLink(props: TabLinkProps) {
  const collapsed = useShallowSidebarStore((state) => !state.effectiveExpanded);

  const { id, href, label, icon, locked, lockMessage } = props;

  const classNameCb = useCallback(
    (props: NavLinkRenderProps) =>
      cn("obb-navigation-item @max-[100px]:h-8 @max-[100px]:w-8! ", {
        "obb-navigation-item-active text-light-800 dark:text-light-100": props.isActive,
      }),
    [],
  );

  const childrenCb = useCallback(
    (props: NavLinkRenderProps) => (
      <>
        <Icon
          id={icon as Parameters<typeof Icon>[0]["id"]}
          className={cn("h-4 min-w-4  stroke-1.5", {
            "text-brand-main dark:text-brand-lighter": props.isActive,
            "text-light-500 dark:text-light-400": !props.isActive,
          })}
        />
        <span className="max-w-[100px] truncate @max-[100px]:hidden">{label}</span>
      </>
    ),
    [icon, label],
  );

  const linkContent = useMemo(
    () => (
      <Tooltip
        id={`links-${id}-tooltip`}
        key={`links-${id}-tooltip`}
        message={label}
        position="right"
      >
        <span className="relative">
          <NavLink
            key={`auth-sidebar-${id}`}
            to={href}
            id={id}
            end={true}
            className={classNameCb}
            children={childrenCb}
          />
        </span>
      </Tooltip>
    ),
    [id, href, label, classNameCb, childrenCb, collapsed],
  );

  if (locked) {
    return collapsed ? (
      <Tooltip id={`links-${id}-lock-tooltip`} message={lockMessage} position="right">
        <span className="opacity-50">
          <span className="pointer-events-none">
            <NavLink
              key={`auth-sidebar-${id}`}
              to={href}
              id={id}
              end={true}
              className={classNameCb}
              children={childrenCb}
            />
          </span>
        </span>
      </Tooltip>
    ) : (
      <FeatureLock isLocked={true} message={lockMessage} className="max-w-[220px]">
        {linkContent}
      </FeatureLock>
    );
  }

  return linkContent;
}

function LinksNav() {
  const linksMemo = useMemo(
    () => (
      <div key="auth-links" className="mt-4">
        <div className="flex flex-col gap-0.5">
          {TABS_LINKS.apps.map((link) => (
            <TabLink key={`auth-link-${link.id}`} {...link} />
          ))}

          <SnowflakeHide>
            {TABS_LINKS.connections.map((link) => (
              <TabLink key={`auth-link-${link.id}`} {...link} />
            ))}
          </SnowflakeHide>
        </div>

        <SidebarSection className="mt-4" id="library" title="Library">
          <div className="flex flex-col gap-0.5 mt-2">
            {TABS_LINKS.library.map((link) => (
              <TabLink key={`auth-link-${link.id}`} {...link} />
            ))}
          </div>
        </SidebarSection>
      </div>
    ),
    [],
  );

  return (
    <div
      key="auth-links-container"
      className="@max-[100px]:items-center flex flex-col gap-0.5"
    >
      {linksMemo}
    </div>
  );
}
type ResizeObserverState = {
  myDashboards: number | null;
  sharedDashboards: number | null;
};

function useResizeObserver(
  sidebarRef: MutableRefObject<HTMLDivElement | null>,
  tabsRef: MutableRefObject<HTMLDivElement | null>,
) {
  const isMobile = useMobile((state) => state.isMobile);
  const sidebarExpanded = usePanelsState("left");
  const { setEffectiveExpanded, expandedMyDashboards, expandedShared } =
    useShallowSidebarStore((state) => ({
      setEffectiveExpanded: state.setEffectiveExpanded,
      expandedMyDashboards: state.expandedMyDashboards,
      expandedShared: state.expandedShared,
    }));

  const [maxHeights, dispatch] = useStateReducer<ResizeObserverState>({
    myDashboards: null,
    sharedDashboards: null,
  });

  useEffect(() => {
    if (!(sidebarRef.current || expandedMyDashboards)) return;
    const scrollY = useSidebarStore.getState().scrollY;
    tabsRef.current?.scrollTo({ top: scrollY, behavior: "auto" });
  }, [tabsRef.current, sidebarRef, expandedMyDashboards]);

  useEffect(() => {
    if (isMobile) return;
    if (!sidebarRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      calculateHeights(sidebarRef, dispatch);
      for (const entry of entries) {
        const { width } = entry.contentRect;
        const shouldRenderCollapsed =
          !isMobile &&
          sidebarExpanded &&
          Math.floor(width) < RENDER_COLLAPSED_LEFT_SIDEBAR_WHEN_WIDTH_LESS_THAN;

        setEffectiveExpanded(
          isMobile || shouldRenderCollapsed ? false : sidebarExpanded,
        );
      }
    });

    resizeObserver.observe(sidebarRef.current);

    const timeoutId = setTimeout(() => {
      calculateHeights(sidebarRef, dispatch);
    }, 100);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
    };
  }, [sidebarRef, sidebarExpanded, expandedMyDashboards, expandedShared]);

  return maxHeights;
}

const calculateHeights = (
  sidebarRef?: MutableRefObject<HTMLDivElement | null>,
  dispatch?: StateDispatch<ResizeObserverState>,
) => {
  const container = sidebarRef.current;
  if (!container) return;

  const availableHeight = container.clientHeight;
  const myDashboardsSection = container.querySelector('[data-section="my-dashboards"]');
  const sharedDashboardsSection = container.querySelector(
    '[data-section="shared-dashboards"]',
  );
  const dividers = container.querySelectorAll(".obb-divider");

  let totalDividerHeight = 0;
  dividers.forEach((divider) => {
    totalDividerHeight += (divider as HTMLElement).offsetHeight;
  });

  const myDashboardsHeader = myDashboardsSection?.querySelector(
    "[data-section-header]",
  );
  const sharedDashboardsHeader = sharedDashboardsSection?.querySelector(
    "[data-section-header]",
  );

  const myDashboardsHeaderHeight = myDashboardsHeader
    ? (myDashboardsHeader as HTMLElement).offsetHeight
    : 0;
  const sharedDashboardsHeaderHeight = sharedDashboardsHeader
    ? (sharedDashboardsHeader as HTMLElement).offsetHeight
    : 0;

  const myDashboardsContent = myDashboardsSection?.querySelector(
    "[data-content]",
  ) as HTMLElement;
  const sharedDashboardsContent = sharedDashboardsSection?.querySelector(
    "[data-content]",
  ) as HTMLElement;

  const contentAreaHeight =
    availableHeight -
    totalDividerHeight -
    myDashboardsHeaderHeight -
    sharedDashboardsHeaderHeight;

  if (contentAreaHeight > 0) {
    const sharedContentNaturalHeight = sharedDashboardsContent?.scrollHeight || 0;

    const MIN_HEIGHT = 48;
    const SHARED_MAX_PROPORTION = 0.45;
    const SPACING_BUFFER = 32;

    let sharedMaxHeight: number | null = null;
    let myDashboardsMaxHeight: number | null = null;

    if (sharedContentNaturalHeight > 0) {
      const sharedContentWithBuffer = sharedContentNaturalHeight + SPACING_BUFFER;
      const maxAllowedForShared = Math.floor(contentAreaHeight * SHARED_MAX_PROPORTION);

      if (sharedContentWithBuffer <= maxAllowedForShared) {
        sharedMaxHeight = null;
        myDashboardsMaxHeight = Math.max(
          MIN_HEIGHT,
          contentAreaHeight - sharedContentWithBuffer,
        );
      } else {
        sharedMaxHeight = maxAllowedForShared;
        myDashboardsMaxHeight = Math.max(
          MIN_HEIGHT,
          contentAreaHeight - maxAllowedForShared,
        );
      }
    } else {
      myDashboardsMaxHeight = Math.max(MIN_HEIGHT, contentAreaHeight - SPACING_BUFFER);
    }

    dispatch((prev) => {
      //  only update if values have changed to prevent re-renders
      if (
        prev.myDashboards !== myDashboardsMaxHeight ||
        prev.sharedDashboards !== sharedMaxHeight
      ) {
        return {
          myDashboards: myDashboardsMaxHeight,
          sharedDashboards: sharedMaxHeight,
        };
      }
      return prev;
    });
  }
};

function SidebarItems() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const maxHeights = useResizeObserver(sidebarRef, tabsRef);

  return useMemo(
    () => (
      <div
        key="auth-sidebar-items"
        id="dashboards"
        ref={sidebarRef}
        className="flex flex-col flex-1 min-h-0"
      >
        <MyDashboards
          key="auth-sidebar-my-dashboards"
          tabsRef={tabsRef}
          maxHeight={maxHeights.myDashboards}
        />
        <SharedDashboards
          key="auth-sidebar-shared-dashboards"
          maxHeight={maxHeights.sharedDashboards}
        />
      </div>
    ),
    [sidebarRef, tabsRef, maxHeights],
  );
}

type SharedDashboardsProps = {
  maxHeight: number | null;
};

function SharedDashboards(props: SharedDashboardsProps) {
  const { maxHeight } = props;
  const hasSharedItems = useShallowSharedAppStore(
    (state) => Object.keys(state.sharedItems).length > 0,
  );
  const { expandedShared, expandedMyDashboards } = useShallowSidebarStore((state) => ({
    expandedShared: state.expandedShared,
    expandedMyDashboards: state.expandedMyDashboards,
  }));

  const sharedSectionMemo = useMemo(
    () => (
      <SidebarSection
        id="shared-tabs"
        title="Shared with me"
        disabled={!hasSharedItems}
        tooltipMessage={
          hasSharedItems ? "Toggle Shared Dashboards" : "No shared dashboards"
        }
        className={cn("flex-shrink-0", {
          "flex flex-col flex-[0_1_auto] min-h-0 overflow-hidden":
            expandedShared && hasSharedItems,
          "mt-4": !expandedMyDashboards,
          "pt-2.5": expandedMyDashboards,
        })}
        data-section="shared-dashboards"
      >
        {hasSharedItems && (
          <div
            data-content={true}
            style={
              expandedShared && maxHeight ? { maxHeight: `${maxHeight}px` } : undefined
            }
            className={cn({
              "overflow-y-auto overflow-x-hidden": expandedShared && maxHeight,
            })}
          >
            <SharedDashboardsSidebar />
          </div>
        )}
      </SidebarSection>
    ),
    [hasSharedItems, expandedShared, maxHeight, expandedMyDashboards],
  );

  return ENABLE_SHARING !== "true" ? null : sharedSectionMemo;
}

type MyDashboardsProps = {
  tabsRef: MutableRefObject<HTMLDivElement | null>;
  maxHeight: number | null;
};

const MyDashboards = memo((props: MyDashboardsProps) => {
  const { tabsRef, maxHeight } = props;
  const isMobile = useMobile((state) => state.isMobile);
  const { expandedMyDashboards, setScrollY } = useShallowSidebarStore((state) => ({
    expandedMyDashboards: state.expandedMyDashboards,
    setScrollY: state.setScrollY,
  }));

  const contentMemo = useMemo(
    () => (
      <div
        key="auth-sidebar-tabs-content"
        data-content={true}
        className={cn(
          "overflow-y-auto overflow-x-hidden",
          "[&::-webkit-scrollbar]:hidden hover:[&::-webkit-scrollbar]:block",
          {
            "min-h-[48px] @max-[100px]:min-h-[32px]": expandedMyDashboards,
          },
        )}
        style={
          expandedMyDashboards && maxHeight
            ? { maxHeight: `${maxHeight}px` }
            : undefined
        }
        ref={(el) => (tabsRef.current = el)}
        onScroll={(e) => expandedMyDashboards && setScrollY(e.currentTarget.scrollTop)}
      >
        <TabsItems key="auth-sidebar-tab-items" tabsRef={tabsRef} />
      </div>
    ),
    [expandedMyDashboards, tabsRef, maxHeight, setScrollY],
  );

  const myDashboardsSectionMemo = useMemo(
    () => (
      <SidebarSection
        id="tabs"
        key="auth-sidebar-tabs-root"
        title="My Dashboards"
        actions={<PlusMenu isMobile={isMobile} />}
        className={cn("flex-shrink-0 mt-4", {
          "flex flex-col flex-[0_1_auto] min-h-0 overflow-hidden": expandedMyDashboards,
        })}
        data-section="my-dashboards"
      >
        {contentMemo}
      </SidebarSection>
    ),
    [isMobile, contentMemo, expandedMyDashboards],
  );

  return myDashboardsSectionMemo;
});

export default memo(AuthSidebar);
