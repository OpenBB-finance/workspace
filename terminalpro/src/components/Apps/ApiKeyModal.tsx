import { useCallback, useMemo, useRef } from "react";
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
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import {
  appUsesCustomAuth,
  getListedAppAuthFields,
  type ListedApp,
  type ListedAppAuthValue,
  stripBearerPrefix,
} from "~/types/listedApps";

export type ApiKeySaveResult = { success: boolean; error?: string };

/** Optional static-token MCP credential rendered alongside the API key fields. */
export interface McpTokenAuth {
  /** Existing token (already stripped of the `Bearer ` prefix). */
  currentToken?: string;
  /** Connection error to surface (e.g. an invalid-token failure). */
  error?: string;
  /** Receives the cleaned token (no `Bearer ` prefix). */
  onSave: (token: string) => void;
}

interface ApiKeyModalProps {
  app: ListedApp;
  hasSavedAuth: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSave: (authValues: ListedAppAuthValue[]) => Promise<ApiKeySaveResult>;
  onRemove: () => Promise<void>;
  /** When set, the app also exposes a static-token MCP server in the same dialog. */
  mcpToken?: McpTokenAuth;
}

export function ApiKeyModal({
  app,
  hasSavedAuth,
  isOpen,
  onClose,
  onSave,
  onRemove,
  mcpToken,
}: ApiKeyModalProps) {
  const { authFields, usesCustomAuth } = useMemo(() => {
    const fields = getListedAppAuthFields(app);
    const custom = appUsesCustomAuth(app);
    return { authFields: fields, usesCustomAuth: custom };
  }, [app]);
  const hasApiFields = authFields.length > 0;
  const mcpOnly = !hasApiFields && !!mcpToken;

  const currentAuthValues = useShallowBackendConnectorStore((s) => {
    const source = s.getApiSourceById(app.id);
    if (!source) return {};
    const values: Record<string, string> = {};
    for (const field of getListedAppAuthFields(app)) {
      const prefix = field.prefix ?? "";
      const header = source.endpointHeaders?.find(
        (h) => h.key.toLowerCase() === field.key.toLowerCase(),
      );
      if (header) values[field.id] = header.value.replace(prefix, "");
    }
    return values;
  });

  const [state, dispatch] = useStateReducer({
    authValues: currentAuthValues,
    mcpTokenValue: mcpToken?.currentToken ?? "",
    mcpErrorDismissed: false,
    isLoading: false,
    connectionError: null as string | null,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const resetState = useCallback(
    (close?: boolean) => {
      dispatch({
        authValues: close ? {} : currentAuthValues,
        mcpTokenValue: close ? "" : (mcpToken?.currentToken ?? ""),
        mcpErrorDismissed: false,
        connectionError: null,
      });
      if (close) onClose();
    },
    [onClose, currentAuthValues, mcpToken?.currentToken],
  );

  const handleSave = useCallback(async () => {
    const values = authFields.map((field) => ({
      id: field.id,
      value: state.authValues[field.id]?.trim() || "",
    }));
    dispatch({ connectionError: null, isLoading: true });

    try {
      if (hasApiFields) {
        if (values.some((field) => !field.value)) return;
        const result = await onSave(values);
        if (!result.success) {
          dispatch({ connectionError: result.error ?? null });
          return;
        }
      }
      // The MCP token is optional when an API key is also present; persist it
      // only when the user actually entered or changed it.
      if (mcpToken) {
        const cleaned = stripBearerPrefix(state.mcpTokenValue);
        if (cleaned && cleaned !== mcpToken.currentToken) mcpToken.onSave(cleaned);
      }
      onClose();
    } finally {
      dispatch({ isLoading: false });
    }
  }, [
    authFields,
    hasApiFields,
    state.authValues,
    state.mcpTokenValue,
    mcpToken,
    onSave,
    onClose,
  ]);

  const credentialNoun = mcpToken
    ? "API Keys"
    : usesCustomAuth
      ? "Authentication"
      : "API Key";
  const heading = `${hasSavedAuth ? "Configure" : "Add"} ${credentialNoun}`;

  const description = mcpToken
    ? hasApiFields
      ? "an API key and an MCP token"
      : "an MCP token"
    : usesCustomAuth
      ? "authentication credentials"
      : "an API key";
  const removeLabel = usesCustomAuth ? "Remove authentication" : "Remove API key";
  const submitLabel = hasSavedAuth ? "Update" : "Add";
  const isSubmitDisabled =
    state.isLoading ||
    authFields.some((field) => !(state.authValues[field.id] || "").trim()) ||
    (mcpOnly && !stripBearerPrefix(state.mcpTokenValue));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (open) resetState();
        else if (!state.isLoading) resetState(true);
      }}
    >
      <DialogContent
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
            Get {description} from{" "}
            {app.vendorWebsiteUrl ? (
              <button
                type="button"
                onClick={() =>
                  window.open(app.vendorWebsiteUrl, "_blank", "noopener,noreferrer")
                }
                className="text-link-color hover:underline"
              >
                {app.vendorName}
              </button>
            ) : (
              app.vendorName
            )}
            .
          </DialogDescription>

          {authFields.length > 0 && (
            <div className="flex flex-col gap-1.5 ">
              {authFields.map((field, index) => (
                <Input
                  key={field.id}
                  ref={index === 0 ? inputRef : undefined}
                  noPasswordSave={true}
                  type="password"
                  label={field.label}
                  size="sm"
                  placeholder={
                    hasSavedAuth
                      ? "•••••••• (saved)"
                      : (field.placeholder ?? `Insert ${field.label}`)
                  }
                  value={state.authValues[field.id] || ""}
                  onChange={(value) => {
                    dispatch({
                      authValues: {
                        ...state.authValues,
                        [field.id]: String(value),
                      },
                      ...(state.connectionError ? { connectionError: null } : {}),
                    });
                  }}
                  name={field.id}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-1p-ignore={true}
                  data-lpignore="true"
                  data-form-type="other"
                  disabled={state.isLoading}
                />
              ))}
              {state.connectionError && (
                <ConnectionTestResult
                  status="error"
                  message={state.connectionError}
                  className="mt-2"
                />
              )}
            </div>
          )}

          {mcpToken && (
            <div className="flex flex-col gap-1.5">
              <Input
                ref={hasApiFields ? undefined : inputRef}
                noPasswordSave={true}
                type="password"
                label={hasApiFields ? "MCP token (optional)" : "MCP token"}
                size="sm"
                placeholder={
                  mcpToken.currentToken ? "•••••••• (saved)" : "Paste your access token"
                }
                value={state.mcpTokenValue}
                onChange={(value) => {
                  dispatch({
                    mcpTokenValue: String(value),
                    ...(state.mcpErrorDismissed ? {} : { mcpErrorDismissed: true }),
                  });
                }}
                name="mcp_token"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-1p-ignore={true}
                data-lpignore="true"
                data-form-type="other"
                disabled={state.isLoading}
              />
              {mcpToken.error && !state.mcpErrorDismissed && (
                <ConnectionTestResult
                  status="error"
                  message={mcpToken.error}
                  className="mt-2"
                />
              )}
            </div>
          )}

          <p className="text-xs leading-[18px] text-ds-text-caption">
            Connecting this app will share your email address and usage data with{" "}
            {app.vendorName}. This data will be handled by {app.vendorName} according to
            their privacy policy.
          </p>

          <DialogFooter>
            {hasSavedAuth && (
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={async () => {
                  dispatch({ isLoading: true });
                  try {
                    await onRemove();
                    resetState(true);
                  } finally {
                    dispatch({ isLoading: false });
                  }
                }}
                disabled={state.isLoading}
                className="mr-auto text-alert-error"
              >
                {removeLabel}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => resetState(true)}
              disabled={state.isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={state.isLoading}
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
