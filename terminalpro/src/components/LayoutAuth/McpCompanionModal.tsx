import { usePostHog } from "posthog-js/react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { getWorkspaceMcpEndpoint } from "~/api/workspaceBridge.api";
import {
  type ConnectionStatus,
  ConnectionStatusDot,
} from "~/components/ds/atoms/ConnectionStatusDot";
import { Input } from "~/components/ds/atoms/Input";
import { Switch } from "~/components/ds/atoms/Switch";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { Notice } from "~/components/ds/molecules/Notice";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import { useShallowWorkspaceBridgeStore } from "~/lib/state/workspaceBridge";
import { McpActiveTokens } from "./McpActiveTokens";

export const McpCompanionModal = memo(() => {
  const { status, lastError, isModalOpen, setModalOpen, connect, disconnect } =
    useShallowWorkspaceBridgeStore((state) => ({
      status: state.status,
      lastError: state.lastError,
      isModalOpen: state.isModalOpen,
      setModalOpen: state.setModalOpen,
      connect: state.connect,
      disconnect: state.disconnect,
    }));

  const posthog = usePostHog();
  const previousStatusRef = useRef(status);
  const endpoint = getWorkspaceMcpEndpoint();

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    // Only celebrate user-initiated connects (attempting -> connected).
    // Automatic reconnects recover silently — a flaky bridge would otherwise
    // spam a success toast on every recovery.
    if (status === "connected" && previousStatus === "attempting") {
      posthog?.capture("connected_mcp_companion", { hosted: true });
      toast.success("Workspace MCP companion connected", {
        description: "Your agent can now access this session via MCP.",
      });
    }
    previousStatusRef.current = status;
  }, [posthog, status]);

  const view = useMemo(() => {
    const isConnected = status === "connected";
    const isConnecting = status === "attempting" || status === "reconnecting";
    const isDropped = status === "disabled" && lastError !== null;

    // Map the bridge status to the shared connection-dot vocabulary. coloredLabel
    // tints the dot + label one color so it reads like the marketplace app cards.
    let dotStatus: ConnectionStatus = "disconnected";
    let statusLabel = "Not connected";
    if (isConnected) {
      dotStatus = "connected";
      statusLabel = "Connected";
    } else if (status === "attempting") {
      dotStatus = "connecting";
      statusLabel = "Connecting…";
    } else if (status === "reconnecting") {
      dotStatus = "connecting";
      statusLabel = "Reconnecting…";
    } else if (isDropped) {
      dotStatus = "error";
    }

    return { isConnected, isConnecting, isDropped, dotStatus, statusLabel };
  }, [status, lastError]);

  const handleToggle = useCallback(
    (next: boolean) => {
      if (next) connect();
      else disconnect();
    },
    [connect, disconnect],
  );

  const handleClose = useCallback(() => {
    // Closing mid-attempt cancels the in-flight bootstrap; an established
    // connection is left running.
    if (status === "attempting" || status === "reconnecting") {
      disconnect();
    }
    setModalOpen(false);
  }, [disconnect, setModalOpen, status]);

  return (
    <BaseDialog
      open={isModalOpen}
      onClose={handleClose}
      className="max-w-[440px] sm:max-w-[440px]"
    >
      <DialogHeader>
        <DialogTitle>Workspace MCP Companion</DialogTitle>
        <DialogDescription>
          Connect this Workspace session so an external MCP agent can reach it. Toggle
          the connection on, then create a token for your agent.{" "}
          <a
            href="https://docs.openbb.co/agents/workspace-mcp-overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-link-color hover:underline"
          >
            Learn how to get started
          </a>
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 py-2">
        <SettingsMenu
          title="Endpoint"
          rightElement={
            <div className="flex items-center gap-2.5">
              <ConnectionStatusDot
                status={view.dotStatus}
                label={view.statusLabel}
                coloredLabel={true}
              />
              <Switch
                checked={view.isConnected || view.isConnecting}
                onCheckedChange={handleToggle}
              />
            </div>
          }
        >
          <Input
            size="sm"
            readOnly
            copiable
            value={endpoint}
            inputClassName="font-mono"
          />

          {view.isDropped && (
            <Notice variant="warning" title="Bridge disconnected">
              {lastError}
            </Notice>
          )}
        </SettingsMenu>

        <McpActiveTokens isConnected={view.isConnected} endpoint={endpoint} />
      </div>
    </BaseDialog>
  );
});
McpCompanionModal.displayName = "McpCompanionModal";
