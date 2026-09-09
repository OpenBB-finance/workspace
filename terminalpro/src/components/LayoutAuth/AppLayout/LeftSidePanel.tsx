import { Fragment, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useWindowSize } from "usehooks-ts";
import { useStreamingStore } from "~/components/AI/hooks/useStreaming";
import { EdgeHoverZone } from "~/components/ui/EdgeHoverZone";
import { ResizableHandle, ResizablePanel } from "~/components/ui/Resizable";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "../../ui/Drawer";
import AuthSidebar from "../AuthSidebar";
import { useLayoutPanelsState } from "./hooks/usePanelsState";

const MIN_SIZE_LEFT_SIDEBAR_IN_PIXELS = 76;

export const LeftSidePanel = forwardRef((_, _ref) => {
  const screenSize = useWindowSize();
  const { width, setWidth } = useShallowSidebarStore((s) => ({
    width: s.width,
    setWidth: s.setWidth,
  }));

  // Get setting for expand button visibility on collapsed panels
  const collapsedPanelExpandOnHover = useShallowThemeStore(
    (state) => state.collapsedPanelExpandOnHover,
  );

  // Track edge hover state for enhanced hover detection
  const [isEdgeHovered, setIsEdgeHovered] = useState(false);

  // https://github.com/bvaughn/react-resizable-panels/issues/46#issuecomment-2405635715
  const minSizePercentage = Number.parseFloat(
    ((MIN_SIZE_LEFT_SIDEBAR_IN_PIXELS / screenSize.width) * 100).toFixed(4),
  );
  const minSizePercentageMemo = useMemo(() => minSizePercentage, [minSizePercentage]);
  const [expanded, dispatch] = useLayoutPanelsState();

  const leftPanelRef = useRef<ImperativePanelHandle>(null);

  const toggleLeftSidebar = useCallbackRef((e = null) => {
    if (leftPanelRef.current.isExpanded() && !e) {
      leftPanelRef.current.collapse();
    } else {
      leftPanelRef.current.expand();
    }
  });

  const authBarPanelMemo = useMemo(
    () => (
      <Fragment key="auth-bar-panel">
        <AuthSidebar key="auth-sidebar" />
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Jose Hacked it
         *  aria-hidden should not be set to true on focusable
         *  elements because this can lead to confusing behavior for screen reader users.
         *  We understand and agree to be bad
         */}
        <button
          key="toggle-left-sidebar-btn"
          id="toggle-left-sidebar-btn"
          onClick={() => toggleLeftSidebar()}
          className="sr-only"
          aria-hidden="true"
        >
          Toggle Left Sidebar
        </button>
      </Fragment>
    ),
    [toggleLeftSidebar],
  );

  const onResize = useCallbackRef((size: number, _prevSize: number | undefined) => {
    setWidth(size);
    const updateState = {
      left: size > minSizePercentageMemo,
    } as typeof expanded;
    if (size >= minSizePercentageMemo) updateState.collapsedLeft = false;
    dispatch((prev) => ({ ...prev, ...updateState }));
  });

  const onCollapse = useCallbackRef(() => {
    dispatch((prev) => ({ ...prev, left: false, collapsedLeft: true }));
  });

  const onDragging = useCallbackRef((isDragging: boolean) => {
    useStreamingStore.getState().dispatch({ isDragging });
  });

  return useMemo(
    () => (
      <Fragment key="left-panel-fragment">
        <ResizablePanel
          ref={leftPanelRef}
          collapsible={true}
          defaultSize={width}
          collapsedSize={0}
          maxSize={20}
          id="left-panel"
          onCollapse={onCollapse}
          onResize={onResize}
          minSize={minSizePercentageMemo}
          className={cn(
            "relative max-h-screen",
            // hiding because of new UI from rita/meg - expanded.left && "pr-[0.08rem]",
          )}
        >
          {authBarPanelMemo}
        </ResizablePanel>
        <ResizableHandle
          onDragging={onDragging}
          type="left"
          withHandle={true}
          onClick={toggleLeftSidebar}
          edgeHovered={isEdgeHovered}
        />
        {/* Enhanced edge hover zone for expanding collapsed sidebar */}
        {expanded.collapsedLeft && collapsedPanelExpandOnHover && (
          <EdgeHoverZone side="left" onHoverChange={setIsEdgeHovered} />
        )}
      </Fragment>
    ),
    [
      leftPanelRef,
      authBarPanelMemo,
      onCollapse,
      onResize,
      toggleLeftSidebar,
      onDragging,
      minSizePercentageMemo,
      width,
      expanded.collapsedLeft,
      collapsedPanelExpandOnHover,
      isEdgeHovered,
    ],
  );
});

export const MobileLeftSidePanel = forwardRef((_, _ref) => {
  const { mobileNavigationDrawer, setMobileNavigationDrawer } = useMobile((s) => ({
    mobileNavigationDrawer: s.mobileNavigationDrawer,
    setMobileNavigationDrawer: s.setMobileNavigationDrawer,
  }));

  const setEffectiveExpanded = useShallowSidebarStore(
    (state) => state.setEffectiveExpanded,
  );

  const dispatch = useLayoutPanelsState()[1];

  useEffect(() => {
    if (mobileNavigationDrawer) {
      dispatch((prev) => ({ ...prev, left: true }));
      setEffectiveExpanded(true);
    }
  }, [mobileNavigationDrawer, dispatch]);

  return useMemo(
    () => (
      <Drawer
        direction="left"
        open={mobileNavigationDrawer}
        onOpenChange={(val) => setMobileNavigationDrawer(val)}
      >
        <DrawerContent className="top-0 mt-2 h-[calc(100%-1rem)] left-2 overflow-hidden rounded-md mr-32">
          <DrawerTitle className="sr-only">Menu</DrawerTitle>
          <DrawerDescription className="sr-only">
            Open the menu to access your workspaces, settings, and more.
          </DrawerDescription>
          <AuthSidebar isMobile={true} />
        </DrawerContent>
      </Drawer>
    ),
    [mobileNavigationDrawer, setMobileNavigationDrawer],
  );
});
