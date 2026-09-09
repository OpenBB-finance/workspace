import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "~/components/ds/atoms/Button";
import Icon from "~/components/Icon";
import { type ListedAppMcpServer, mcpServerUsesTokenAuth } from "~/types/listedApps";
import { McpTokenModal } from "./McpTokenModal";
import { useMcpServerConnection } from "./useMcpServerConnection";

interface McpAppPopoverProps {
  /** Marketplace app id; mutually-exclusive with sourceId */
  vendorAppUuid?: string;
  /** Custom backend source id; mutually-exclusive with vendorAppUuid */
  sourceId?: string;
  /** Display name. Falls back to the MCP server name when omitted. */
  vendorName?: string;
  mcpServer: ListedAppMcpServer;
  isSubscribed: boolean;
  /**
   * When the parent owns the token entry point (e.g. the app details modal
   * surfaces it beside the API key action), suppress this popover's own
   * add/edit-token buttons and modal so the flow isn't duplicated.
   */
  tokenActionExternal?: boolean;
}

export const McpAppPopover = memo((props: McpAppPopoverProps) => {
  const { vendorAppUuid, sourceId, vendorName, mcpServer, isSubscribed } = props;
  const tokenActionExternal = props.tokenActionExternal ?? false;
  const navigate = useNavigate();
  const displayName = vendorName || mcpServer.name;
  const isTokenAuth = mcpServerUsesTokenAuth(mcpServer);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);

  const {
    existingServer,
    connectionError,
    toolCount,
    currentToken,
    isConnected,
    isFailed,
    connect: handleAdd,
    saveToken: handleTokenSave,
  } = useMcpServerConnection(mcpServer, { vendorAppUuid, sourceId, vendorName });

  const openTokenModal = useCallback(() => setTokenModalOpen(true), []);

  const handleManage = useCallback(() => {
    const search = new URLSearchParams({ tab: "mcp-servers" });
    if (existingServer?.id) search.set("serverId", existingServer.id);
    navigate(`/app/ai?${search.toString()}`);
  }, [navigate, existingServer?.id]);

  const { title, description, action } = useMemo(() => {
    if (isTokenAuth) {
      const tokenLabel = currentToken ? "Edit token" : "Add token";
      // When the parent owns the token entry point, this popover is status-only.
      const tokenButton = tokenActionExternal ? null : (
        <Button variant="ghost" size="xs" onClick={openTokenModal}>
          {tokenLabel}
        </Button>
      );

      if (!existingServer) {
        if (!isSubscribed) {
          return {
            title: `${displayName} MCP server`,
            description:
              mcpServer.description || `Connect ${displayName} to add MCP access.`,
            action: (
              <Button variant="secondary" size="xs" disabled={true}>
                Connect app first
              </Button>
            ),
          };
        }
        return {
          title: `${displayName} MCP server`,
          description:
            mcpServer.description || `Add ${mcpServer.name} to enable tools.`,
          action: tokenActionExternal ? null : (
            <Button variant="primary" size="xs" onClick={openTokenModal}>
              Add MCP Server
            </Button>
          ),
        };
      }

      if (isFailed) {
        return {
          title: `${displayName} MCP server`,
          description:
            connectionError ||
            `Couldn't connect to ${mcpServer.name}. Check that your token is valid and not expired.`,
          action: tokenActionExternal ? null : (
            <Button variant="primary" size="xs" onClick={openTokenModal}>
              Edit token
            </Button>
          ),
        };
      }

      if (isConnected) {
        return {
          title: `${displayName} MCP added`,
          description:
            mcpServer.description ||
            `OpenBB Copilot has access to ${toolCount} ${displayName} tool${toolCount === 1 ? "" : "s"}.`,
          action: (
            <div className="flex items-center gap-1.5">
              {tokenButton}
              <Button variant="secondary" size="xs" onClick={handleManage}>
                Manage MCP Server
              </Button>
            </div>
          ),
        };
      }

      return {
        title: `${displayName} MCP server`,
        description: mcpServer.description || `Connect to ${mcpServer.name}.`,
        action: (
          <div className="flex items-center gap-1.5">
            {tokenButton}
            <Button variant="secondary" size="xs" onClick={handleManage}>
              Manage MCP Server
            </Button>
          </div>
        ),
      };
    }

    if (existingServer && isConnected) {
      return {
        title: `${displayName} MCP added`,
        description:
          mcpServer.description ||
          `OpenBB Copilot has access to ${toolCount} ${displayName} tool${toolCount === 1 ? "" : "s"}.`,
        action: (
          <Button variant="secondary" size="xs" onClick={handleManage}>
            Manage MCP Server
          </Button>
        ),
      };
    }

    if (existingServer) {
      return {
        title: `${displayName} MCP server`,
        description: mcpServer.description || `Connect to ${mcpServer.name}.`,
        action: (
          <Button variant="secondary" size="xs" onClick={handleManage}>
            Manage MCP Server
          </Button>
        ),
      };
    }

    if (!isSubscribed) {
      return {
        title: `${displayName} MCP server`,
        description:
          mcpServer.description || `Connect ${displayName} to add MCP access.`,
        action: (
          <Button variant="secondary" size="xs" disabled={true}>
            Connect app first
          </Button>
        ),
      };
    }

    return {
      title: `${displayName} MCP server`,
      description: mcpServer.description || `Add ${mcpServer.name} to enable tools.`,
      action: (
        <Button variant="primary" size="xs" onClick={handleAdd}>
          Add MCP Server
        </Button>
      ),
    };
  }, [
    isTokenAuth,
    currentToken,
    connectionError,
    existingServer,
    isConnected,
    isFailed,
    isSubscribed,
    tokenActionExternal,
    displayName,
    mcpServer.description,
    mcpServer.name,
    toolCount,
    handleAdd,
    handleManage,
    openTokenModal,
  ]);

  return (
    <div
      className="flex flex-col gap-2 min-w-[240px] max-w-[300px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5">
        <Icon id="mcp" className="w-3.5 h-3.5 text-ds-text-body" />
        <p className="text-xs font-semibold text-ds-text-heading">{title}</p>
      </div>
      <p className="text-xs text-ds-text-body leading-[18px]">{description}</p>
      {action && <div className="flex justify-end">{action}</div>}
      {isTokenAuth && !tokenActionExternal && (
        <McpTokenModal
          isOpen={tokenModalOpen}
          onClose={() => setTokenModalOpen(false)}
          serverName={mcpServer.name}
          vendorName={vendorName}
          currentToken={currentToken}
          onSave={handleTokenSave}
          error={isFailed ? connectionError : undefined}
        />
      )}
    </div>
  );
});

McpAppPopover.displayName = "McpAppPopover";
