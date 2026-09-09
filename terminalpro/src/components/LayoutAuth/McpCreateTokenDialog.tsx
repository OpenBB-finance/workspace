import { useEffect, useState } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { Notice } from "~/components/ds/molecules/Notice";
import Icon from "~/components/Icon";
import { McpConnectSnippets } from "./McpConnectSnippets";
import { useCreateMcpToken } from "./useMcpTokens";

interface McpCreateTokenDialogProps {
  open: boolean;
  onClose: () => void;
  /** Hosted MCP endpoint baked into the install snippets. */
  endpoint: string;
}

export function McpCreateTokenDialog({
  open,
  onClose,
  endpoint,
}: McpCreateTokenDialogProps) {
  const [name, setName] = useState("");
  const createToken = useCreateMcpToken();
  const { reset } = createToken;
  const created = createToken.data ?? null;

  // The dialog stays mounted across open/close, so wipe the mutation state on
  // both transitions — the raw secret must not linger in the mutation cache
  // after Done, and a stale secret must not flash when the dialog reopens.
  useEffect(() => {
    setName("");
    reset();
  }, [open, reset]);

  const handleGenerate = () => {
    const trimmed = name.trim();
    if (!trimmed || createToken.isPending) return;
    createToken.mutate(trimmed);
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="max-w-[440px] sm:max-w-[440px]"
    >
      <DialogHeader>
        <DialogTitle>Create token</DialogTitle>
        <DialogDescription>
          Save the secret for your token somewhere safe — you won't be able to view it
          again. Anyone with it can access this Workspace through MCP.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 py-2">
        <div className="flex flex-col gap-1.5">
          <span className="body-xs-medium text-ds-text-body">Token name</span>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                size="sm"
                className="h-8 [&_input]:h-full"
                placeholder="Insert name"
                value={name}
                onChange={(value) => setName(String(value))}
                disabled={Boolean(created)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleGenerate}
              disabled={!name.trim() || Boolean(created)}
              loading={createToken.isPending}
              loadingChildren={null}
            >
              Generate Token
            </Button>
          </div>
          {createToken.isError && (
            <span className="body-xs-regular text-alert-error">
              {createToken.error instanceof Error
                ? createToken.error.message
                : "Failed to create token."}
            </span>
          )}
        </div>

        {created ? (
          <div className="flex flex-col gap-3">
            <Input
              size="sm"
              readOnly
              copiable
              value={created.token}
              inputClassName="font-mono"
            />
            <McpConnectSnippets endpoint={endpoint} token={created.token} />
            <Notice
              variant="warning"
              title="Save the API key. This API key won't be accessible afterwards."
              className="p-3"
            />
          </div>
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-sm border border-dashed border-general-border-secondary">
            {createToken.isPending ? (
              <Icon
                id="mdi-loading"
                className="size-5 animate-spin text-ds-text-caption"
              />
            ) : (
              <span className="body-xs-regular text-ds-text-caption">
                Generate a token to connect your Workspace
              </span>
            )}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
McpCreateTokenDialog.displayName = "McpCreateTokenDialog";
