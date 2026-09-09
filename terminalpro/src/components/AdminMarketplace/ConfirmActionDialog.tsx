import type { AdminApp } from "~/api/adminMarketplace.api";
import { Button } from "~/components/ds/atoms/Button";
import { ConfirmDialog } from "~/components/ds/dialogs/ConfirmDialog";
import Icon from "~/components/Icon";

export interface ConfirmActionTarget {
  app: AdminApp;
  action: "publish" | "remove";
}

interface ConfirmActionDialogProps {
  target: ConfirmActionTarget | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/** Publish is refused when a non-built-in app's last verification failed. */
function needsReverify(app: AdminApp): boolean {
  return app.last_fetch_status === "error" && !app.is_built_in;
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-general-border-secondary bg-general-bg-secondary p-3 text-alert-warning body-xs-medium">
      <Icon id="exclamation-outline-triangle" className="size-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

export function ConfirmActionDialog({
  target,
  isPending,
  onClose,
  onConfirm,
}: ConfirmActionDialogProps) {
  if (!target) return null;

  const { app, action } = target;
  const isPublish = action === "publish";

  const title = isPublish ? "Publish app" : "Remove app";
  const description = isPublish
    ? `Publishing ${app.name} v${app.version} makes it live in the marketplace.`
    : `Remove ${app.name} v${app.version} permanently. This can't be undone.`;

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={title}
      description={description}
      content={
        <div className="flex flex-col gap-2">
          {isPublish && (
            <Warning>
              Publishing this version will auto-disable other published versions of this
              app.
            </Warning>
          )}
          {isPublish && needsReverify(app) && (
            <Warning>
              Re-verify first — the last verification failed, so publish will be
              refused.
            </Warning>
          )}
        </div>
      }
      confirmButton={
        <Button
          variant={isPublish ? "primary" : "danger"}
          size="sm"
          loading={isPending}
          onClick={onConfirm}
        >
          {isPublish ? "Publish" : "Remove"}
        </Button>
      }
    />
  );
}
