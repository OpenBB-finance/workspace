import { useState } from "react";
import { toast } from "sonner";
import type { WorkspaceMcpTokenMetadata } from "~/api/workspaceBridge.api";
import { Button } from "~/components/ds/atoms/Button";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { McpCreateTokenDialog } from "./McpCreateTokenDialog";
import { useDeleteMcpToken, useMcpTokens } from "./useMcpTokens";

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB").format(date);
}

interface McpActiveTokensProps {
  /** Token creation is only allowed once the bridge is connected. */
  isConnected: boolean;
  /** Hosted MCP endpoint passed to the create dialog's snippets. */
  endpoint: string;
}

export function McpActiveTokens({ isConnected, endpoint }: McpActiveTokensProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: tokens = [] } = useMcpTokens();
  const deleteToken = useDeleteMcpToken();

  const handleDelete = (token: WorkspaceMcpTokenMetadata) => {
    deleteToken.mutate(token.uuid, {
      onSuccess: () =>
        toast.success("Token revoked", {
          description: `"${token.name}" can no longer access this Workspace via MCP.`,
        }),
    });
  };

  return (
    <>
      <SettingsMenu
        title="Active Tokens"
        rightElement={
          <Tooltip
            message="Connect the endpoint to create tokens."
            hide={isConnected}
            asChild={false}
          >
            <Button
              size="xs"
              variant="secondary"
              disabled={!isConnected}
              onClick={() => setCreateOpen(true)}
            >
              Create Token
            </Button>
          </Tooltip>
        }
        bodyClassName="p-0"
      >
        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <p className="body-xs-medium text-ds-text-subtitle">No tokens created</p>
            <p className="body-xs-regular text-ds-text-caption">
              No tokens yet. Create one to authorize an agent.
            </p>
          </div>
        ) : (
          <ul data-testid="mcp-token-list" className="divide-y divide-surface-divider">
            {tokens.map((token) => (
              <li
                key={token.uuid}
                className="group flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  className="body-xs-medium min-w-0 flex-1 truncate text-ds-text-body"
                  title={token.name}
                >
                  {token.name}
                </span>
                <span className="body-xs-regular w-[140px] shrink-0 truncate font-mono text-ds-text-caption">
                  {token.token_prefix}...
                </span>
                <span className="body-xs-regular w-[84px] shrink-0 text-right text-ds-text-caption">
                  {formatDate(token.created_date)}
                </span>
                <button
                  type="button"
                  aria-label={`Delete ${token.name} token`}
                  onClick={() => handleDelete(token)}
                  className="shrink-0 text-ds-text-caption opacity-0 transition-opacity hover:text-alert-error group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Icon id="trash-04" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsMenu>

      <McpCreateTokenDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        endpoint={endpoint}
      />
    </>
  );
}
McpActiveTokens.displayName = "McpActiveTokens";
