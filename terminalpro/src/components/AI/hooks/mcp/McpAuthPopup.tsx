import { useEffect, useRef, useState } from "react";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogTitle } from "~/components/ds/dialogs/Dialog";
import { useMcpToolsStore } from "~/lib/state/mcpTools";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";

// How often to check whether the user closed the auth popup, and how long to
// wait afterwards before treating it as a cancel (lets a success callback land).
const POPUP_POLL_MS = 500;
const CANCEL_GRACE_MS = 1000;

export default function McpAuthPopup() {
  const { mcpAuthPopup, setMcpAuthPopup } = useShallowThemeStore((s) => ({
    mcpAuthPopup: s.mcpAuthPopup,
    setMcpAuthPopup: s.setMcpAuthPopup,
  }));

  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<Window | null>(null);

  // Open the popup when a new auth request arrives, then watch for the user
  // discarding it. If they close it without finishing auth, disable the server
  // so it stops re-triggering the popup on every reload.
  useEffect(() => {
    if (!mcpAuthPopup) return;
    const { authUrl, popupFeatures, serverUrlHash, url } = mcpAuthPopup;
    const popup = window.open(authUrl, `mcp_auth_${serverUrlHash}`, popupFeatures);

    if (!popup || popup.closed || typeof popup.closed === "undefined") {
      // Popup was blocked — fall back to the manual link dialog. No handle to poll.
      setIsOpen(true);
      return;
    }

    popup.focus();
    popupRef.current = popup;

    const interval = window.setInterval(() => {
      if (!popupRef.current?.closed) return;
      window.clearInterval(interval);
      popupRef.current = null;

      // Give a pending success callback time to clear the popup before we treat
      // the closed window as a cancel.
      window.setTimeout(() => {
        const current = useThemeStore.getState().mcpAuthPopup;
        // Cleared or replaced (e.g. auth succeeded) — nothing to cancel.
        if (!current || current.url !== url) return;

        const server = useMcpToolsStore.getState().servers.find((s) => s.url === url);
        if (server) {
          useMcpToolsStore.getState().disableServerAfterAuthCancel(server.id);
        }
        setMcpAuthPopup(null);
      }, CANCEL_GRACE_MS);
    }, POPUP_POLL_MS);

    return () => window.clearInterval(interval);
  }, [mcpAuthPopup, setMcpAuthPopup]);

  useEffect(() => {
    if (!isOpen) return;
    // Close the dialog if mcpAuthPopup is cleared
    if (!mcpAuthPopup) setIsOpen(false);
  }, [mcpAuthPopup, isOpen]);

  return (
    <BaseDialog open={isOpen} onClose={() => setMcpAuthPopup(null)}>
      <DialogTitle>
        {mcpAuthPopup?.serverName || "MCP"} Authorization Popup Blocked
      </DialogTitle>
      <div className="p-4">
        <p className="mb-4">
          The authorization popup was blocked by your browser. Please click the link
          below to authorize the {mcpAuthPopup?.serverName || "MCP"} connection:
        </p>
        {mcpAuthPopup && (
          <a
            href={mcpAuthPopup.authUrl}
            className="text-brand-main hover:text-brand-darker underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Authorize MCP Connection
          </a>
        )}
      </div>
    </BaseDialog>
  );
}
