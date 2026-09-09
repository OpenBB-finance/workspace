import { memo, useMemo, useRef } from "react";
import {
  CopilotContentErrorBoundary,
  CopilotDropzone,
  CopilotFooter,
  CopilotHeader,
  CopilotMessageGroupRoot,
  CopilotWelcome,
  CopilotWrapper,
  ScrollButton,
} from "~/components/AI";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useThemeStore } from "~/lib/state/theme";
import { CopilotSetLoadingOnResize } from "../DraggableCard/SetLoadingOnResize";
import { Button } from "../ds/atoms/Button";
import { cn } from "../ds/utils";
import { AddCopilotDialog } from "./AddCopilotDialog";
import { AgentConfigDialog } from "./AgentConfigDialog";
import { CopilotContext } from "./CopilotContext";
import { ExternalLinkProvider } from "./ExternalLinkProvider";

export function CopilotChat() {
  const messagesRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile((state) => state.isMobile);

  const { copilotSelected, isFullscreen: storeFullscreen } = useShallowCopilotStore(
    (s) => ({
      copilotSelected: !!s.selectedCopilot,
      isFullscreen: s.isFullscreen,
    }),
  );

  const isFullscreen = storeFullscreen || isMobile;

  const dropzoneContentMemo = useMemo(
    () => (
      <ExternalLinkProvider>
        <CopilotWelcome />
        <CopilotContentErrorBoundary>
          <CopilotSetLoadingOnResize
            className={cn(
              "flex grow flex-col gap-3.75 mb-5 pt-4",
              isFullscreen && "pt-6",
            )}
          >
            <CopilotMessageGroupRoot />
          </CopilotSetLoadingOnResize>
        </CopilotContentErrorBoundary>
      </ExternalLinkProvider>
    ),
    [isFullscreen],
  );

  const mainContentMemo = useMemo(
    () => (
      <CopilotWrapper key="copilot-wrapper">
        {isFullscreen && <CopilotHeader />}
        <div className="flex flex-col h-full overflow-hidden">
          {!isFullscreen && <CopilotHeader />}
          <AgentConfigDialog />
          <AddCopilotDialog />

          <div className="relative flex-1 overflow-hidden px-1">
            <CopilotDropzone messagesRef={messagesRef}>
              {isFullscreen ? (
                <div
                  className="mx-auto"
                  style={{ width: isMobile ? "100%" : "calc(70% - 1rem)" }}
                >
                  {dropzoneContentMemo}
                </div>
              ) : (
                dropzoneContentMemo
              )}
            </CopilotDropzone>
            <ScrollButton messagesRef={messagesRef} />
          </div>

          <div
            className={cn({
              "mt-auto": !isFullscreen,
              "mx-auto": isFullscreen,
              "mb-4": isFullscreen && !isMobile,
            })}
            style={
              isFullscreen ? { width: isMobile ? "100%" : "calc(70% - 1rem)" } : {}
            }
          >
            <div className="p-2">
              <div className="border-t border-l border-r rounded-t-sm border-general-border-primary bg-general-bg-secondary">
                <div className="px-2 py-2">
                  <CopilotContext />
                </div>
              </div>

              <CopilotFooter />
            </div>
          </div>
        </div>
      </CopilotWrapper>
    ),
    [messagesRef, isFullscreen, isMobile, dropzoneContentMemo],
  );

  return copilotSelected ? mainContentMemo : <NoCopilotSelected />;
}

function NoCopilotSelected() {
  return (
    <CopilotWrapper>
      <div className="flex flex-col items-center gap-2 justify-center h-full">
        <span>No copilot selected</span>
        <Button
          size="xs"
          onClick={() => useThemeStore.getState().setShowAddAgentsDialog(true)}
        >
          Add Copilot
        </Button>
      </div>
    </CopilotWrapper>
  );
}

export default memo(CopilotChat);
