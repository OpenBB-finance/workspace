import { forwardRef, type ReactNode, useMemo } from "react";
import { ResizablePanel, ResizablePanelGroup } from "~/components/ui/Resizable";
import { CenterPanel } from "./CenterPanel";
import { RightSidePanel } from "./RightSidePanel";

export const CombinedCenterRightPanel = forwardRef<
  HTMLDivElement,
  { children?: ReactNode }
>(({ children }, _ref) => {
  return useMemo(
    () => (
      <ResizablePanel
        defaultSize={70}
        minSize={25}
        id="combined-center-right-panel"
        className="overflow-hidden"
      >
        <ResizablePanelGroup
          direction="horizontal"
          id="center-right-group"
          autoSaveId="persistence-2"
        >
          <CenterPanel>{children}</CenterPanel>
          <RightSidePanel />
        </ResizablePanelGroup>
      </ResizablePanel>
    ),
    [children],
  );
});
