import { Fragment, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { CopilotChatErrorBoundary } from "~/components/AI";
import CopilotChat from "~/components/AI/CopilotChat";
import { useCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import { useStreamingStore } from "~/components/AI/hooks/useStreaming";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import { EdgeHoverZone } from "~/components/ui/EdgeHoverZone";
import { ResizableHandle, ResizablePanel } from "~/components/ui/Resizable";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { CopilotProvider } from "~/lib/contexts/CopilotChatContext";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useCopilotStore, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { type PanelsState, useLayoutPanelsState } from "./hooks/usePanelsState";

function setIsDragging(isDragging = false) {
  useStreamingStore.getState().dispatch?.({ isDragging });
}

export const RightSidePanel = forwardRef((_, _ref) => {
  const [panelsState, setPanelsState] = useLayoutPanelsState();

  // Get setting for expand button visibility on collapsed panels
  const collapsedPanelExpandOnHover = useShallowThemeStore(
    (state) => state.collapsedPanelExpandOnHover,
  );

  // Track edge hover state for enhanced hover detection
  const [isEdgeHovered, setIsEdgeHovered] = useState(false);
  const {
    isFullscreen,
    toggleFullscreen,
    setIsFullscreen,
    isIntentionallyCollapsed,
    setIsIntentionallyCollapsed,
    lastPanelState,
    setLastPanelState,
  } = useShallowCopilotStore((state) => ({
    isFullscreen: state.isFullscreen,
    toggleFullscreen: state.toggleFullscreen,
    setIsFullscreen: state.setIsFullscreen,
    isIntentionallyCollapsed: state.isIntentionallyCollapsed,
    setIsIntentionallyCollapsed: state.setIsIntentionallyCollapsed,
    lastPanelState: state.lastPanelState,
    setLastPanelState: state.setLastPanelState,
  }));

  const copilotAvailable = useCopilotAvailable();

  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const isProgrammaticResize = useRef(null);
  const previousSize = useRef(42); // Store the size before entering fullscreen (must be >= minSize)
  const isFirstRender = useIsFirstRender();

  const toggleCopilot = useCallbackRef((e = null) => {
    if (rightPanelRef.current.isExpanded() && !e) {
      setLastPanelState(isFullscreen ? "fullscreen" : "open");

      setIsIntentionallyCollapsed(true);
      rightPanelRef.current.collapse();
    } else {
      setIsDragging(true);
      setTimeout(setIsDragging);
      expandCopilot();
    }
  });

  const expandCopilot = useCallbackRef(() => {
    if (rightPanelRef.current.isCollapsed()) {
      setIsIntentionallyCollapsed(false);
      const currentSize = rightPanelRef.current?.getSize();

      rightPanelRef.current.expand();
      if (lastPanelState === "fullscreen" && !isFullscreen) {
        toggleFullscreen();

        requestAnimationFrame(() => {
          window.dispatchEvent(new Event("resize"));
        });
      }
      if (currentSize === 0) {
        isProgrammaticResize.current = true;
        rightPanelRef.current?.resize(isFullscreen ? 100 : previousSize.current);

        setTimeout(() => {
          isProgrammaticResize.current = false;
        }, 150);
      }
    }
  });

  useEffect(() => {
    const ctrl = new AbortController();
    const options = { signal: ctrl.signal };

    window.addEventListener("expandCopilotIfHidden", expandCopilot, options);

    window.addEventListener(
      "collapseCopilot",
      () => {
        const isFullscreen = useCopilotStore.getState().isFullscreen;
        setLastPanelState(isFullscreen ? "fullscreen" : "open");

        setIsIntentionallyCollapsed(true);
        setIsFullscreen(false);

        rightPanelRef.current?.collapse();
      },
      options,
    );

    return () => ctrl.abort();
  }, [expandCopilot, rightPanelRef]);

  useEffect(() => {
    if (isFirstRender) return;
    if (isIntentionallyCollapsed) {
      rightPanelRef.current?.collapse();
      setIsIntentionallyCollapsed(false);
      return;
    }

    const currentSize = rightPanelRef.current?.getSize();
    if (isFullscreen) {
      // Save current size if valid (>= minSize and < 90), otherwise keep existing value
      if (currentSize && currentSize >= 32 && currentSize < 90) {
        previousSize.current = currentSize;
      }
      if (rightPanelRef.current?.isCollapsed()) rightPanelRef.current?.expand();
    }

    if (
      (isFullscreen && currentSize && currentSize < 99) ||
      !isIntentionallyCollapsed
    ) {
      // Don't resize if panel is collapsed (prevents re-expanding after close)
      if (rightPanelRef.current?.isCollapsed()) return;

      isProgrammaticResize.current = true;
      rightPanelRef.current?.resize(isFullscreen ? 100 : previousSize.current);

      setTimeout(() => {
        isProgrammaticResize.current = false;
      }, 150);
    }
  }, [isFullscreen, isIntentionallyCollapsed]);

  const onResize = useCallbackRef((size: number, prevSize: number | undefined) => {
    const { isButtonTriggered: btnTriggered, isFullscreen: storeFullscreen } =
      useCopilotStore.getState();

    if (
      isProgrammaticResize.current !== null &&
      !(isProgrammaticResize.current || btnTriggered) &&
      size > 0 &&
      prevSize !== undefined
    ) {
      const isEffectivelyMaximized = size >= 98 && prevSize < 90;
      const isEffectivelyNotMaximized = size < 90 && prevSize > 90;

      if (
        (!storeFullscreen && isEffectivelyMaximized) ||
        (storeFullscreen && isEffectivelyNotMaximized)
      ) {
        toggleFullscreen();
      }
    }

    const updateState = { right: size > 30 } as PanelsState;
    if (size >= 5) updateState.collapsedRight = false;
    setPanelsState((prev) => ({ ...prev, ...updateState }));
  });

  const onCollapse = useCallbackRef(() => {
    setPanelsState((prev) => ({ ...prev, right: false, collapsedRight: true }));
  });

  const toggleButtonMemo = useMemo(
    () => (
      <>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Jose Hacked it
         *  aria-hidden should not be set to true on focusable
         *  elements because this can lead to confusing behavior for screen reader users.
         *  We understand and agree to be bad
         */}
        <button
          id="expand-copilot-btn"
          onClick={expandCopilot}
          className="sr-only"
          aria-hidden="true"
        >
          Expand Copilot
        </button>
        {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: Jose Hacked it
         *  aria-hidden should not be set to true on focusable
         *  elements because this can lead to confusing behavior for screen reader users.
         *  We understand and agree to be bad
         */}
        <button
          id="toggle-copilot-btn"
          onClick={() => toggleCopilot()}
          className="sr-only"
          aria-hidden="true"
        >
          Toggle Copilot
        </button>
      </>
    ),
    [toggleCopilot, expandCopilot],
  );

  const copilotChatMemo = useMemo(
    () => (
      <CopilotProvider>
        <CopilotChatErrorBoundary>
          <CopilotChat />
          {toggleButtonMemo}
        </CopilotChatErrorBoundary>
      </CopilotProvider>
    ),
    [toggleButtonMemo],
  );

  return useMemo(() => {
    if (!copilotAvailable) return null;
    return (
      <Fragment key="right-panel-fragment">
        {/* Enhanced edge hover zone for expanding collapsed copilot */}
        {panelsState.collapsedRight && collapsedPanelExpandOnHover && (
          <EdgeHoverZone side="right" onHoverChange={setIsEdgeHovered} />
        )}
        <ResizableHandle
          type="right"
          withHandle={true}
          onClick={toggleCopilot}
          onDragging={setIsDragging}
          edgeHovered={isEdgeHovered}
        />
        <ResizablePanel
          ref={rightPanelRef}
          onCollapse={onCollapse}
          onResize={onResize}
          defaultSize={42}
          collapsible={true}
          collapsedSize={0}
          minSize={32}
          id="right-panel"
          className="overflow-y-auto"
          maxSize={100}
        >
          {copilotChatMemo}
        </ResizablePanel>
      </Fragment>
    );
  }, [
    toggleButtonMemo,
    rightPanelRef,
    copilotChatMemo,
    expandCopilot,
    onCollapse,
    onResize,
    toggleCopilot,
    panelsState.collapsedRight,
    collapsedPanelExpandOnHover,
    isEdgeHovered,
    copilotAvailable,
  ]);
});

export const MobileRightSidePanel = forwardRef((_, _ref) => {
  const { mobileCopilotDrawer, setMobileCopilotDrawer } = useMobile((s) => ({
    mobileCopilotDrawer: s.mobileCopilotDrawer,
    setMobileCopilotDrawer: s.setMobileCopilotDrawer,
  }));

  const copilotAvailable = useCopilotAvailable();

  const copilotChatMemo = useMemo(
    () => (
      <CopilotProvider>
        <CopilotChatErrorBoundary>
          <CopilotChat />
        </CopilotChatErrorBoundary>
      </CopilotProvider>
    ),
    [],
  );

  /**
   * Hidden DOM-trigger for opening the mobile copilot drawer from non-React
   * call sites that cannot import the Zustand store directly:
   *   - `src/lib/utils/createTemplates.ts`
   *   - `src/lib/state/copilotData.ts`
   *   - `src/components/General/Table/AgGridUtils.tsx`
   *
   * Those callers fire `document.getElementById("expand-copilot-mobile-btn")?.click()`.
   * Must be rendered regardless of `mobileCopilotDrawer` state so the trigger
   * works while the drawer is closed.
   */
  const expandButtonMemo = useMemo(
    () => (
      <button
        id="expand-copilot-mobile-btn"
        type="button"
        hidden={true}
        onClick={() => setMobileCopilotDrawer(true)}
      >
        Expand Copilot
      </button>
    ),
    [setMobileCopilotDrawer],
  );

  useEffect(() => {
    const ctrl = new AbortController();
    const options = { signal: ctrl.signal };

    window.addEventListener(
      "expandCopilotIfHidden",
      () => setMobileCopilotDrawer(true),
      options,
    );
    window.addEventListener(
      "collapseCopilot",
      () => setMobileCopilotDrawer(false),
      options,
    );

    return () => ctrl.abort();
  }, []);

  return useMemo(() => {
    if (!copilotAvailable) return null;
    return (
      <>
        {expandButtonMemo}
        {mobileCopilotDrawer && (
          <div
            className="fixed inset-0 z-50
            bg-general-bg-primary flex flex-col pb-[env(safe-area-inset-bottom)]"
            style={{ height: "var(--mobile-viewport-height, 100dvh)" }}
          >
            {copilotChatMemo}
          </div>
        )}
      </>
    );
  }, [copilotChatMemo, mobileCopilotDrawer, expandButtonMemo, copilotAvailable]);
});
