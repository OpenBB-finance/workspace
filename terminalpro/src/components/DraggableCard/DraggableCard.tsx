import {
  forwardRef,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStateReducer } from "~/hooks/useStateReducer";
import { BLOCKED_WIDGET_IDS } from "~/lib/constants";
import { useTabContext } from "~/lib/contexts/TabContext";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowPermissionsStore } from "~/lib/state/permissions";
import { isSSRMType } from "~/lib/utils";
import { useEventListener } from "~/lib/utils/utils";
import { Button } from "../ds/atoms/Button";
import { cn } from "../ds/utils";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import useFetchSharedResources from "../LayoutAuth/Search/hooks/useFetchSharedResources";
import { useWidgetContext } from "../Widget.context";
import useCopilotDataWidget from "../Widgets/Helpers/useCopilotDataWidget";
import Navbar, { type NavBarProps } from "./NavBar";
import { LoadingElement } from "./SetLoadingOnResize";

export interface DraggableCardProps extends NavBarProps {
  aiData?: any;
  lastUpdated?: number | null;
  children: ReactNode;
  extraClassName?: string;
  rootClassName?: string;
  error?: any;
  errorMessage?: string;
  widgetIdFallback?: string;
  showTitle?: boolean;
  disableRetrievalForCopilot?: boolean;
  // If the url fails to fetch, we have it so we can display
  failingUrl?: undefined | string;
  isBlocked?: boolean;
  forceAutoHideNavbar?: boolean;
}

function PermissionsMask({
  isSharedResource = false,
  isBlocked = false,
  onAccessError,
  onAccessCheck,
}: {
  isSharedResource?: boolean;
  isBlocked?: boolean;
  onAccessError?: (message: string) => void;
  onAccessCheck: (hasAccess: boolean) => void;
}) {
  const { sourceId, widgetId, external, endpoint, sourceName } =
    useWidgetContext()?.widget || {};
  const removedApp = endpoint?.url === "" && external && sourceName;

  const cleanedWidgetId = useMemo(() => {
    if (widgetId && sourceName && widgetId.startsWith(`${sourceName}-`)) {
      return widgetId.replace(`${sourceName}-`, "");
    }
    return widgetId;
  }, [widgetId, sourceName]);

  const isWidgetIdBlocked = widgetId && BLOCKED_WIDGET_IDS.has(widgetId) && !external;

  const hasAccess = useShallowPermissionsStore((state) => state.hasAccess);
  const checkAccess = useCallback(() => {
    if (sourceId && cleanedWidgetId) {
      const userHasAccess = hasAccess(sourceId, cleanedWidgetId);
      onAccessCheck(userHasAccess);
      if (userHasAccess) {
        onAccessError?.(null);
      } else {
        onAccessError?.("You don't have access to this widget");
      }
    }
  }, [sourceId, cleanedWidgetId, hasAccess, onAccessError, onAccessCheck]);

  useEffect(() => {
    // Check if widget is blocked first, regardless of shared status
    if (isBlocked || isWidgetIdBlocked) {
      onAccessCheck(false);
      onAccessError?.("This widget is deprecated and cannot be used.");
      return;
    }

    if (!isSharedResource) {
      if (removedApp) {
        onAccessCheck(false);
        onAccessError?.("Backend associated with this widget was deleted.");
        return;
      }
      return;
    }
    setTimeout(checkAccess, 500);
  }, [isSharedResource, removedApp, isBlocked, isWidgetIdBlocked]);

  if (
    removedApp ||
    isBlocked ||
    isWidgetIdBlocked ||
    (isSharedResource &&
      sourceId &&
      cleanedWidgetId &&
      !hasAccess(sourceId, cleanedWidgetId))
  ) {
    return <div className="absolute inset-0 bg-white/80 dark:bg-black/40 z-10" />;
  }

  return null;
}

const DraggableCard = forwardRef<HTMLDivElement, DraggableCardProps>(
  (props: DraggableCardProps, forwardedRef) => {
    const {
      aiData = null,
      lastUpdated,
      children,
      title,
      rootClassName = "",
      extraClassName = "",
      loading = false,
      error,
      aiEnabled = false,
      errorMessage = "No results found",
      widgetIdFallback = "",
      failingUrl,
      showTitle = true,
      disableRetrievalForCopilot = false,
      isBlocked = false,
      forceAutoHideNavbar = false,
      ...navbarProps
    } = props;

    const { widgetRef, widgetFromJSON } = useWidgetContext();
    const isShared = useTabContext()?.isShared;
    const isLoadingBackends = useShallowBackendConnectorStore(
      (state) => state.isLoadingBackends && !!widgetRef?.current?.sourceId,
    );

    const isSharedWidget = widgetRef?.current?.isSharedWidget;

    const effectiveAutoHide = forceAutoHideNavbar;
    const [navbarHovered, setNavbarHovered] = useState(false);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const mouseOverNavbarRef = useRef(false);
    const navbarWrapperRef = useRef<HTMLDivElement>(null);

    const hasOpenPopover = useCallback(
      () => !!navbarWrapperRef.current?.querySelector('[data-state="open"]'),
      [],
    );

    const scheduleHide = useCallback(() => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        if (!mouseOverNavbarRef.current && !hasOpenPopover()) {
          setNavbarHovered(false);
        }
      }, 200);
    }, [hasOpenPopover]);

    const handleNavbarHover = useCallback(
      (hovered: boolean) => {
        mouseOverNavbarRef.current = hovered;
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        if (hovered) {
          setNavbarHovered(true);
        } else if (!hasOpenPopover()) {
          scheduleHide();
        }
      },
      [hasOpenPopover, scheduleHide],
    );

    // Watch for Radix data-state changes within navbar to detect popover/dropdown close
    useEffect(() => {
      if (!effectiveAutoHide || !navbarWrapperRef.current) return;
      const observer = new MutationObserver(() => {
        if (!mouseOverNavbarRef.current && !hasOpenPopover()) {
          scheduleHide();
        }
      });
      observer.observe(navbarWrapperRef.current, {
        attributes: true,
        subtree: true,
        attributeFilter: ["data-state"],
      });
      return () => observer.disconnect();
    }, [effectiveAutoHide, hasOpenPopover, scheduleHide]);

    useEffect(() => {
      return () => {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      };
    }, []);

    useCopilotDataWidget({ aiData, title, aiEnabled, lastUpdated });

    const [state, dispatch] = useStateReducer({
      accessError: null as string | null,
      hasAccess: true,
    });

    useStaledDataOverlay();

    useFetchSharedResources(isSharedWidget);
    useOnHoveredCitation();

    const name = title || widgetFromJSON?.name || widgetRef?.current?.name;
    const isLoading = loading || isLoadingBackends;

    return (
      <div
        id={widgetRef?.current?.id}
        ref={forwardedRef}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={cn(
          "group/widget relative z-0 flex flex-col h-full w-full rounded bg-white text-xs only-sm:text-sm shadow-xs dark:bg-[#151518]",
          {
            "draggable-card": !name,
            "select-none!": !state.hasAccess,
            "border border-light-50 dark:border-dark-800 overflow-hidden":
              effectiveAutoHide,
          },
          rootClassName,
          widgetRef?.current
            ? `widget-${widgetRef?.current?.widgetId}`
            : `widget-${widgetIdFallback}`,
        )}
      >
        <PermissionsMask
          isSharedResource={isSharedWidget}
          isBlocked={isBlocked}
          onAccessError={(accessError) => dispatch({ accessError })}
          onAccessCheck={(hasAccess) => dispatch({ hasAccess })}
        />
        {effectiveAutoHide && !navbarHovered && (
          <div
            className="absolute top-0 left-0 right-0 h-1 z-20"
            onMouseEnter={() => handleNavbarHover(true)}
          />
        )}
        <div
          ref={navbarWrapperRef}
          className={cn(
            "transition-all duration-200 ease-out",
            effectiveAutoHide &&
              "absolute top-0 left-0 right-0 z-10 bg-white dark:bg-[#151518] rounded-t",
            effectiveAutoHide &&
              !navbarHovered &&
              "-translate-y-full opacity-0 pointer-events-none",
          )}
          onMouseEnter={effectiveAutoHide ? () => handleNavbarHover(true) : undefined}
          onMouseLeave={effectiveAutoHide ? () => handleNavbarHover(false) : undefined}
        >
          <Navbar
            {...navbarProps}
            aiEnabled={aiEnabled}
            title={showTitle ? name : " "}
            lastUpdated={error ? null : lastUpdated}
            loading={isLoading}
            disableRetrievalForCopilot={disableRetrievalForCopilot}
          />
        </div>
        {state.hasAccess ? (
          <LoadingElement
            loading={isLoading}
            errorMessage={
              state.accessError || (!isLoading && error ? errorMessage : null)
            }
            displayBlock={
              isShared &&
              widgetRef?.current.external &&
              !["single", "advanced-backend", "file"].includes(
                widgetRef?.current?.connectionType,
              )
            }
            failingUrl={failingUrl}
            widgetId={widgetRef?.current?.widgetId}
          >
            <div
              id={`widget-content-${widgetRef?.current?.id}`}
              className={cn(
                "relative flex-1 overflow-auto",
                effectiveAutoHide ? "" : "px-2.5 mb-2.5",
                extraClassName,
              )}
            >
              {children}
            </div>
          </LoadingElement>
        ) : (
          <SearchResultsNotFound
            icon={true}
            firstMessage={state.accessError || "You don't have access to this widget"}
            secondMessage={null}
            extraClassName="z-10"
            iconClassName="z-10"
            firstMessageExtraClassName="z-10"
          >
            <Button
              size="xs"
              variant="outlined"
              className="text-xs text-light-500 z-10"
              onClick={() => {
                const element = document.getElementById(
                  `close-widget-${widgetRef?.current?.id}`,
                );
                if (element) {
                  element.click();
                }
              }}
            >
              Remove Widget
            </Button>
          </SearchResultsNotFound>
        )}
      </div>
    );
  },
);

function useStaledDataOverlay() {
  const widgetRef = useWidgetContext()?.widgetRef;
  const { runButton, id } = useMemo(() => {
    const widget = widgetRef?.current;
    return { runButton: widget?.runButton, id: widget?.id };
  }, [widgetRef?.current?.id, widgetRef?.current?.runButton]);

  const [addedOverlay, setAddedOverlay] = useState(false);

  useEventListener(`staleParams-${id}`, ({ staleParams }) => {
    const widgetType = widgetRef?.current?.type;
    if (!runButton || isSSRMType(widgetType) || widgetType === "omni") return;

    const element = document.getElementById(`widget-content-${id}`);

    if (!element || (addedOverlay && staleParams)) return;

    setAddedOverlay(staleParams);
    if (staleParams) {
      const overlay = document.createElement("div");
      overlay.id = `stale-overlay-${id}`;
      overlay.className = `absolute inset-y-0 inset-x-1 z-[5] pointer-events-none rounded
      bg-white/40 dark:bg-black/30 backdrop-blur-[1px]`;
      element.appendChild(overlay);
      return;
    }

    const existingOverlay = document.getElementById(`stale-overlay-${id}`);
    if (existingOverlay) element.removeChild(existingOverlay);
  });
}

function useOnHoveredCitation() {
  const widgetRef = useWidgetContext()?.widgetRef;
  const activeInnerTab = useTabContext()?.currentTab;

  const { showHighlight, isTyping } = useShallowCopilotStore((state) => {
    const { hoveredCitationWidgetId, hoveredTabId } = state;
    const onHoveredCitation = hoveredCitationWidgetId === widgetRef?.current?.id;
    const onHoveredTab = hoveredTabId === widgetRef?.current?.innerTab;
    const showHighlight =
      onHoveredCitation || (onHoveredTab && !hoveredCitationWidgetId);
    return { showHighlight, isTyping: state.isTyping };
  });

  const { isSelected, selectedWidgetIDs, activeTabSelected } =
    useShallowCopilotDataStore((state) => ({
      isSelected: state?.isWidgetSelected(widgetRef?.current?.id) ?? false,
      selectedWidgetIDs: state?.selectedWidgetIDs ?? [],
      activeTabSelected: (state?.copilotWidgets?.selectedWidgets ?? []).some(
        (w) =>
          w.widget_id?.startsWith("tab_") && w.metadata?.innerTabId === activeInnerTab,
      ),
    }));

  const showCopilotMask = useMemo(() => {
    const activeTabSelectedInContext = activeInnerTab && activeTabSelected;
    if (activeTabSelectedInContext && widgetRef?.current?.innerTab === activeInnerTab) {
      return false;
    }

    return selectedWidgetIDs?.length > 0 && isTyping && !isSelected;
  }, [
    activeInnerTab,
    activeTabSelected,
    isSelected,
    isTyping,
    selectedWidgetIDs,
    widgetRef?.current?.innerTab,
  ]);

  useEffect(() => {
    const element = widgetRef?.current
      ? document.getElementById(widgetRef.current.id)
      : null;
    if (element) {
      element.classList.toggle("outline-2", showHighlight);
      element.classList.toggle("outline-brand-main", showHighlight);
      element.classList.toggle("opacity-30", showCopilotMask);
    }
  }, [showHighlight, showCopilotMask]);
}

DraggableCard.displayName = "DraggableCard";

export default memo(DraggableCard);
