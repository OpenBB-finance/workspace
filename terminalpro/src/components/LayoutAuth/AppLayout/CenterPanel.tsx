import { forwardRef, type ReactNode, useEffect, useMemo, useRef } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { CopilotSetLoadingOnResize } from "~/components/DraggableCard/SetLoadingOnResize";
import GroupContext from "~/components/General/GroupContext";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "~/components/ui/Drawer";
import { ResizablePanel } from "~/components/ui/Resizable";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import BottomRightButtons from "../BottomRightButtons";
import SearchDialog from "../Search/SearchDialog";
import { usePanelsState } from "./hooks/usePanelsState";

export const CenterPanel = forwardRef<HTMLDivElement, { children?: ReactNode }>(
  ({ children }, _ref) => {
    const childrenMemo = useMemo(() => children, [children]);
    const collapsedRight = usePanelsState("collapsedRight");
    const isFullscreen = useShallowCopilotStore((state) => state.isFullscreen);
    const centerPanelRef = useRef<ImperativePanelHandle>(null);

    // React to fullscreen changes
    useEffect(() => {
      if (isFullscreen) {
        // When entering fullscreen, collapse center panel
        if (centerPanelRef.current && !centerPanelRef.current.isCollapsed()) {
          centerPanelRef.current.collapse();
        }
      } else if (centerPanelRef.current?.isCollapsed()) {
        // When exiting fullscreen, expand center panel
        centerPanelRef.current.expand();
      }
    }, [isFullscreen]);

    return useMemo(
      () => (
        <ResizablePanel
          ref={centerPanelRef}
          minSize={25}
          defaultSize={62}
          id="middle-panel"
          collapsible={true}
          collapsedSize={0}
          className={cn("relative overflow-y-auto h-screen", {
            "workarea-scroll": collapsedRight,
          })}
        >
          {!isFullscreen && <BottomRightButtons />}
          <CopilotSetLoadingOnResize
            id="workarea"
            as="main"
            rootComponent={GroupContext}
            className={cn(
              "h-screen w-full overflow-x-hidden overflow-y-auto dark:bg-black bg-light-100",
              { "sr-only": isFullscreen },
            )}
          >
            {childrenMemo}
          </CopilotSetLoadingOnResize>
        </ResizablePanel>
      ),
      [childrenMemo, collapsedRight, isFullscreen],
    );
  },
);

export const MobileCenterPanel = forwardRef<HTMLDivElement, { children?: ReactNode }>(
  ({ children }, _ref) => {
    const childrenMemo = useMemo(() => children, [children]);
    const { search, changeSearch } = useShallowThemeStore((state) => ({
      search: state.search,
      changeSearch: state.changeSearch,
    }));

    return useMemo(
      () => (
        <>
          <main id="workarea" className="h-full w-screen overflow-x-hidden">
            {childrenMemo}
          </main>
          <Drawer
            direction="bottom"
            open={search}
            onOpenChange={(val) => changeSearch(val)}
          >
            <DrawerContent
              className="mx-2 mt-0 mb-2 w-[calc(100%-1rem)] overflow-hidden rounded-md p-2
                h-[calc(var(--mobile-viewport-height,100dvh)_-_4.5rem)]
                max-h-[calc(var(--mobile-viewport-height,100dvh)_-_4.5rem)]"
            >
              <DrawerTitle className="sr-only">Search</DrawerTitle>
              <DrawerDescription className="sr-only">
                Search for widgets, securities, templates.
              </DrawerDescription>
              <SearchDialog isMobile={true} />
            </DrawerContent>
          </Drawer>
        </>
      ),
      [childrenMemo, search, changeSearch],
    );
  },
);
