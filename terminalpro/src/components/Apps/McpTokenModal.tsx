import { useCallback, useRef } from "react";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";
import { ConnectionTestResult } from "~/components/ds/molecules/ConnectionTestResult";
import { useStateReducer } from "~/hooks/useStateReducer";
import { MCP_TOKEN_AUTH_FIELD, stripBearerPrefix } from "~/types/listedApps";

interface McpTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** MCP server name, used in copy. */
  serverName: string;
  /** Display name for the vendor; falls back to the server name. */
  vendorName?: string;
  /** Existing token (already stripped of the `Bearer ` prefix) for prefill state. */
  currentToken?: string;
  /** Receives the cleaned token (no `Bearer ` prefix). */
  onSave: (token: string) => void;
  /** When provided, renders a destructive "Remove token" action. */
  onRemove?: () => void;
  /** Optional connection error to surface (e.g. an invalid-token failure). */
  error?: string;
}

export function McpTokenModal({
  isOpen,
  onClose,
  serverName,
  vendorName,
  currentToken,
  onSave,
  onRemove,
  error,
}: McpTokenModalProps) {
  const hasSavedToken = Boolean(currentToken);
  const displayName = vendorName || serverName;
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, dispatch] = useStateReducer({
    token: currentToken ?? "",
    dismissedError: false,
  });

  const resetState = useCallback(
    (close?: boolean) => {
      dispatch({ token: close ? "" : (currentToken ?? ""), dismissedError: false });
      if (close) onClose();
    },
    [onClose, currentToken],
  );

  const handleSave = useCallback(() => {
    const cleaned = stripBearerPrefix(state.token);
    if (!cleaned) return;
    onSave(cleaned);
    resetState(true);
  }, [state.token, onSave, resetState]);

  const heading = hasSavedToken ? "Edit token" : "Add token";
  const submitLabel = hasSavedToken ? "Update" : "Add";
  const isSubmitDisabled = !stripBearerPrefix(state.token);
  const shownError = state.dismissedError ? undefined : error;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) resetState();
        else resetState(true);
      }}
    >
      <DialogContent
        data-testid="mcp-token-modal"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          autoComplete="off"
          className="flex flex-col gap-4"
        >
          <DialogTitle>{heading}</DialogTitle>

          <DialogDescription>
            Paste your access token for {displayName}. It is stored only for this MCP
            server and sent as an authorization header on its requests.
          </DialogDescription>

          <div className="flex flex-col gap-1.5">
            <Input
              ref={inputRef}
              data-testid="mcp-token-input"
              noPasswordSave={true}
              type="password"
              label={MCP_TOKEN_AUTH_FIELD.label}
              size="sm"
              placeholder={
                hasSavedToken ? "•••••••• (saved)" : MCP_TOKEN_AUTH_FIELD.placeholder
              }
              value={state.token}
              onChange={(value) => {
                dispatch({ token: String(value), dismissedError: true });
              }}
              name={MCP_TOKEN_AUTH_FIELD.id}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore={true}
              data-lpignore="true"
              data-form-type="other"
            />
            {shownError && (
              <ConnectionTestResult
                status="error"
                message={shownError}
                className="mt-2"
              />
            )}
          </div>

          <DialogFooter>
            {hasSavedToken && onRemove && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => {
                  onRemove();
                  resetState(true);
                }}
                className="mr-auto text-alert-error"
              >
                Remove token
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => resetState(true)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitDisabled}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
