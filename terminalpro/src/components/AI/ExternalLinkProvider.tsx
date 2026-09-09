import { type ReactNode, useCallback, useMemo, useState } from "react";
import { buildIframeWidget } from "~/components/Widgets/custom/buildIframeWidget";
import { useShallowAppStore } from "~/lib/state/app";
import { ExternalLinkDialog } from "../ExternalLinkDialog";
import { ExternalLinkContext } from "./ExternalLinkContext";
import { useActiveWorkspaceDashboardId } from "./hooks/useActiveWorkspaceDashboardId";

export function ExternalLinkProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState({ open: false, url: "" });
  const activeDashboardId = useActiveWorkspaceDashboardId();
  const addWidget = useShallowAppStore((s) => s.addWidget);

  const openExternalLink = useCallback((url: string) => {
    setDialog({ open: true, url });
  }, []);

  const handleClose = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleOpenInIframe = useCallback(
    (url: string) => {
      addWidget(activeDashboardId, buildIframeWidget(url, "Copilot"));
    },
    [addWidget, activeDashboardId],
  );

  const handleOpenInNewTab = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const value = useMemo(() => ({ openExternalLink }), [openExternalLink]);

  return (
    <ExternalLinkContext.Provider value={value}>
      {children}
      <ExternalLinkDialog
        open={dialog.open}
        url={dialog.url}
        onClose={handleClose}
        onOpenInIframe={handleOpenInIframe}
        onOpenInNewTab={handleOpenInNewTab}
        canOpenInIframe={!!activeDashboardId}
      />
    </ExternalLinkContext.Provider>
  );
}
