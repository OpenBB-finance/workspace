import { useEffect, useState } from "react";
import type { AdminApp } from "~/api/adminMarketplace.api";
import { Button } from "~/components/ds/atoms/Button";
import { Textarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import {
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "~/components/ds/dialogs/Dialog";

interface RejectDialogProps {
  app: AdminApp | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function RejectDialog({
  app,
  isPending,
  onClose,
  onConfirm,
}: RejectDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (app) setReason("");
  }, [app]);

  const trimmed = reason.trim();

  return (
    <BaseDialog open={!!app} onClose={onClose} className="gap-4 max-w-lg">
      <div className="space-y-3">
        <DialogTitle>Reject submission</DialogTitle>
        <DialogDescription>
          The developer sees this reason in their Workspace. Explain what needs to
          change before {app?.name ?? "this app"} can be published.
        </DialogDescription>
      </div>
      <Textarea
        autoheight={false}
        className="min-h-[120px]"
        placeholder="Reason for rejection"
        value={reason}
        onChange={setReason}
      />
      <DialogFooter>
        <Button variant="outlined" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={isPending}
          disabled={!trimmed}
          onClick={() => onConfirm(trimmed)}
        >
          Reject
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
