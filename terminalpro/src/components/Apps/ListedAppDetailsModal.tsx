import { memo, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ApiKeyModal } from "~/components/Apps/ApiKeyModal";
import { Button } from "~/components/ds/atoms/Button";
import { Tag } from "~/components/ds/atoms/Tag";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import { Dialog, DialogContent, DialogTitle } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import { AppCardDropdown } from "~/components/LayoutAuth/AppCard/AppCardDropdown";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { slugify } from "~/lib/utils/utils";
import {
  appHasSavedAuth,
  appRequiresAuth,
  appSupportsAnonymousAccess,
  appUsesCustomAuth,
  getListedAppAuthFields,
  type ListedApp,
  type ListedAppAuthValue,
  mcpServerUsesTokenAuth,
} from "~/types/listedApps";
import { ListedAppDetailsContent } from "./ListedAppDetailsContent";
import { useMcpServerConnection } from "./useMcpServerConnection";

interface ListedAppDetailsModalProps {
  app: ListedApp;
  isOpen: boolean;
  onClose: () => void;
  isSubscribed: boolean;
  onSubscribe: () => void | Promise<void>;
  isSubscribing?: boolean;
  onAuthSave: (
    authValues: ListedAppAuthValue[],
    validateApiKey?: boolean,
  ) => Promise<{ success: boolean; error?: string }>;
  onApiKeyRemove?: (isSubscribed: boolean) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onAfterDisconnect?: () => void;
  onOpen?: () => void;
  onRate?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onContactVendor?: () => void;
}

export const ListedAppDetailsModal = memo((props: ListedAppDetailsModalProps) => {
  const {
    app,
    isOpen,
    onClose,
    isSubscribed,
    onSubscribe,
    isSubscribing,
    onAuthSave,
    onApiKeyRemove,
    onDisconnect,
    onAfterDisconnect,
    onOpen,
    onRate,
    onPrev,
    onNext,
    onContactVendor,
  } = props;

  const { requiresAuth, hasOptionalAuth, authButtonLabel } = useMemo(() => {
    const requiresAuth = appRequiresAuth(app);
    const hasOptionalAuth =
      appSupportsAnonymousAccess(app) && getListedAppAuthFields(app).length > 0;
    const authButtonLabel = appUsesCustomAuth(app) ? "Authentication" : "API key";

    return { requiresAuth, hasOptionalAuth, authButtonLabel };
  }, [app]);

  const [state, dispatch] = useStateReducer({
    modalOpen: null as "auth" | "dataSharing" | "disconnectConfirm" | null,
    pendingAuthValues: [] as ListedAppAuthValue[],
    isDisconnecting: false,
  });

  // The first MCP server that authenticates with a static token is surfaced as
  // an optional field inside the same auth dialog as the API key.
  const tokenMcpServer = useMemo(
    () => app.mcpServers?.find(mcpServerUsesTokenAuth),
    [app.mcpServers],
  );
  const mcpToken = useMcpServerConnection(tokenMcpServer, {
    vendorAppUuid: app.id,
    vendorName: app.vendorName,
  });

  const hasSavedAuth = useShallowBackendConnectorStore((s) => {
    const source = s.getApiSourceById(app.id);
    return (
      appHasSavedAuth(app, source?.endpointHeaders) ||
      state.pendingAuthValues.length > 0
    );
  });

  // A single button opens the auth dialog. When the app also exposes a token
  // MCP server, both credentials live in one place and the label goes plural.
  const showAuthButton = requiresAuth || hasOptionalAuth || !!tokenMcpServer;
  const credentialLabel = tokenMcpServer ? "API Keys" : authButtonLabel;
  const hasSavedCredentials = hasSavedAuth || !!mcpToken.currentToken;

  const showDisconnectMenu = !app.isBuiltIn && isSubscribed && !!onDisconnect;

  useEffect(() => {
    if (!isOpen || state.modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && onPrev) {
        e.preventDefault();
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, state.modalOpen, onPrev, onNext]);

  const handleDisconnectConfirm = useCallback(async () => {
    if (!onDisconnect) return;
    dispatch({ isDisconnecting: true });
    try {
      await onDisconnect();
      onAfterDisconnect?.();
    } finally {
      dispatch({ isDisconnecting: false, modalOpen: null });
    }
  }, [onDisconnect, onAfterDisconnect]);

  const handleShare = useCallback(() => {
    const url = `${window.location.origin}/app?tab=apps-marketplace&app=${slugify(app.appName)}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success("Link copied to clipboard"))
      .catch((err) => toast.error("Failed to copy link", { description: err.message }));
  }, [app.appName]);

  const handleAuthenticateClick = useCallback(() => {
    dispatch({ modalOpen: "auth" });
  }, []);

  const handleOnSubscribe = useCallback(() => {
    if (!app) return;
    if (app.isBuiltIn) return onSubscribe?.();

    dispatch({ modalOpen: "dataSharing" });
  }, [app, onSubscribe]);

  const handleDataSharingConfirm = useCallback(async () => {
    try {
      if (state.pendingAuthValues.length > 0)
        return await onAuthSave(state.pendingAuthValues);
      await onSubscribe?.();
    } finally {
      dispatch({ modalOpen: null, pendingAuthValues: [] });
    }
  }, [onSubscribe, onAuthSave, state.pendingAuthValues]);

  const handleOnClose = useCallback(() => {
    if (isSubscribing) return;
    dispatch({ modalOpen: null, pendingAuthValues: [] });
    onClose();
  }, [isSubscribing, onClose]);

  const handleAuthSave = useCallback(
    async (authValues: ListedAppAuthValue[]) => {
      const result = await onAuthSave(authValues, !isSubscribed);
      if (result.success && !isSubscribed) dispatch({ pendingAuthValues: authValues });
      return result;
    },
    [onAuthSave, isSubscribed],
  );

  const handleApiKeyRemove = useCallback(async () => {
    await onApiKeyRemove?.(isSubscribed);
    dispatch({ pendingAuthValues: [] });
  }, [onApiKeyRemove, isSubscribed]);

  const dropdownItems = useMemo(() => {
    const items = [];
    if (onOpen) items.push({ label: "Open App", onClick: onOpen });
    if (onRate) items.push({ label: "Rate App", onClick: onRate });
    if (showDisconnectMenu) {
      items.push({
        label: "Disconnect",
        onClick: () => dispatch({ modalOpen: "disconnectConfirm" }),
        color: "#E03C3C",
      });
    }
    return items;
  }, [onOpen, onRate, onDisconnect, showDisconnectMenu]);

  const appActions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        {app.isBuiltIn ? (
          <Tag color="grey">Included</Tag>
        ) : isSubscribed ? (
          <span className="flex items-center gap-1 body-xs-regular text-alert-success">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Connected
          </span>
        ) : null}
        {onContactVendor ? (
          !isSubscribed &&
          !app.isBuiltIn && (
            <Button variant="primary" size="xs" onClick={onContactVendor}>
              Contact
            </Button>
          )
        ) : (
          <>
            {showAuthButton && (
              <Button variant="secondary" size="xs" onClick={handleAuthenticateClick}>
                {hasSavedCredentials
                  ? `Edit ${credentialLabel}`
                  : `Add ${credentialLabel}`}
              </Button>
            )}
            {!app.isBuiltIn && !isSubscribed && (
              <Tooltip
                message={`Add valid ${authButtonLabel.toLowerCase()} first.`}
                position="bottom"
                hide={!(requiresAuth && !hasSavedAuth)}
              >
                <Button
                  variant={requiresAuth && !hasSavedAuth ? "secondary" : "primary"}
                  size="xs"
                  loading={isSubscribing}
                  onClick={handleOnSubscribe}
                  disabled={requiresAuth && !hasSavedAuth}
                >
                  Connect App
                </Button>
              </Tooltip>
            )}
          </>
        )}
        {dropdownItems.length > 0 && <AppCardDropdown items={dropdownItems} />}
      </div>
    ),
    [
      app.isBuiltIn,
      isSubscribed,
      onContactVendor,
      showAuthButton,
      handleAuthenticateClick,
      hasSavedCredentials,
      credentialLabel,
      authButtonLabel,
      requiresAuth,
      hasSavedAuth,
      isSubscribing,
      handleOnSubscribe,
      dropdownItems,
    ],
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleOnClose()}>
        <DialogContent className="sm:!w-[680px] !max-w-[680px] !p-0 !gap-0 !max-h-[90vh] bg-general-bg-primary !overflow-visible">
          {onPrev && (
            <button
              type="button"
              onClick={onPrev}
              className="hidden lg:flex absolute -left-12 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-general-bg-secondary border border-general-border-primary items-center justify-center text-ds-text-body hover:text-ds-text-heading shadow-md"
              aria-label="Previous app"
            >
              <Icon id="chevron-left" className="w-4 h-4" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="hidden lg:flex absolute -right-12 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-general-bg-secondary border border-general-border-primary items-center justify-center text-ds-text-body hover:text-ds-text-heading shadow-md"
              aria-label="Next app"
            >
              <Icon id="chevron-right" className="w-4 h-4" />
            </button>
          )}
          <ListedAppDetailsContent
            app={app}
            isSubscribed={isSubscribed}
            titleSlot={
              <div className="flex items-center gap-0.5">
                <DialogTitle className="truncate !pr-0">{app.appName}</DialogTitle>
                <Tooltip message="Copy app link to clipboard" position="bottom">
                  <Button
                    tabIndex={-1}
                    variant="outlined"
                    icon
                    onClick={handleShare}
                    aria-label="Copy share link"
                    className="h-6 w-6 shrink-0 border-none"
                  >
                    <Icon id="link-03" className="w-3.5 h-3.5" />
                  </Button>
                </Tooltip>
              </div>
            }
            appActions={appActions}
          />
        </DialogContent>
      </Dialog>

      <ApiKeyModal
        app={app}
        isOpen={state.modalOpen === "auth"}
        onClose={() => dispatch({ modalOpen: null })}
        hasSavedAuth={hasSavedAuth}
        onSave={handleAuthSave}
        onRemove={handleApiKeyRemove}
        mcpToken={
          tokenMcpServer
            ? {
                currentToken: mcpToken.currentToken,
                error: mcpToken.isFailed ? mcpToken.connectionError : undefined,
                onSave: mcpToken.saveToken,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={state.modalOpen === "dataSharing"}
        onClose={() => dispatch({ modalOpen: null })}
        title="Before you connect"
        description={`Connecting to this app will share your email address and usage data with ${app.vendorName}. This data will be handled by ${app.vendorName} according to their privacy policy.`}
        cancelText="Cancel"
        confirmButton={
          <Button
            variant="primary"
            size="sm"
            loading={isSubscribing}
            onClick={handleDataSharingConfirm}
          >
            Agree and connect
          </Button>
        }
      />

      <ConfirmDialog
        open={state.modalOpen === "disconnectConfirm"}
        onClose={() => dispatch({ modalOpen: null })}
        title="Disconnect App"
        description={
          <>
            Are you sure you want to disconnect{" "}
            <span className="font-semibold">{app.appName}</span>? Any widgets using this
            app will be disabled.
          </>
        }
        cancelText="Cancel"
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            loading={state.isDisconnecting}
            onClick={handleDisconnectConfirm}
          >
            Disconnect
          </Button>
        }
      />
    </>
  );
});
