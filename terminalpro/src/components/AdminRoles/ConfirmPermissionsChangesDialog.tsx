import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import { cn } from "../ds/utils";
import Icon from "../Icon";

export type Changes = {
  widgets: { removed?: number; added?: number };
  prompts: { removed?: number; added?: number };
};
export type AppChanges = { name?: string } & Changes;
interface PermissionChanges {
  libraryChanges?: Changes;
  appChanges?: AppChanges[];
}

const ChangesDisplay = ({ changes }: { changes: Changes }) => (
  <div className="bg-general-bg-secondary p-3 rounded">
    <div className="grid grid-cols-2 gap-4 text-xs text-ds-text-body">
      <div>
        <div className="p-0.5 font-bold">Widgets</div>
        <div className="border-b border-general-border-primary my-1" />
        <div className="p-0.5">
          <span className="text-alert-success">{changes?.widgets.added} </span>
          added
        </div>
        <div className="border-b border-general-border-primary my-1" />
        <div className="p-0.5">
          <span className="text-alert-warning">{changes?.widgets.removed} </span>
          removed
        </div>
      </div>

      <div>
        <div className="p-0.5 font-bold">Prompts</div>
        <div className="border-b border-general-border-primary my-1" />
        <div className="p-0.5">
          <span className="text-alert-success">{changes?.prompts.added} </span>
          added
        </div>
        <div className="border-b border-general-border-primary my-1" />
        <div className="p-0.5">
          <span className="text-alert-warning">{changes?.prompts.removed} </span>
          removed
        </div>
      </div>
    </div>
  </div>
);

const SectionContainer = ({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flew-1 w-full bg-general-bg-secondary p-2.5 rounded", className)}>
    <h3 className="obb-uppercase-small-title mb-2.5">{title}</h3>
    {children}
  </div>
);

export default function ConfirmPermissionsChangesDialog({
  open,
  onClose,
  onConfirm,
  roleName,
  changes: { appChanges, libraryChanges } = {},
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  roleName: string;
  changes: PermissionChanges;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error("Error confirming changes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, onClose]);

  useEffect(() => {
    if (!open) setIsLoading(false);
  }, [open]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="flex flex-col justify-center items-end w-[517px] p-4 gap-6
      rounded-md bg-general-bg-primary text-ds-text-heading
      shadow-1"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Icon
            id="exclamation-outline-triangle"
            className="h-4 w-4 text-alert-error"
          />
          <DialogTitle className="body-sm-bold">Confirm Permission Changes</DialogTitle>
        </div>
      </div>
      <div className="flex flex-col items-start justify-center w-full gap-4">
        <p className="text-xs">
          Are you sure you want to continue? You are about to make critical changes to
          the <span className="font-medium">{roleName}</span> permissions. Please review
          before proceeding.
        </p>

        {appChanges?.length > 0 && (
          <SectionContainer title="APPS">
            <div className="w-full max-h-[300px] overflow-y-auto space-y-4">
              {appChanges?.map((backend, index) => (
                <div key={index}>
                  <h4 className="body-xs-regular mb-2.5">{backend.name}</h4>
                  <ChangesDisplay changes={backend} />
                </div>
              ))}
            </div>
          </SectionContainer>
        )}

        {libraryChanges && (
          <SectionContainer title="LIBRARY">
            <ChangesDisplay changes={libraryChanges} />
          </SectionContainer>
        )}
      </div>
      <DialogFooter>
        <Button onClick={onClose} size="sm" variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          size="sm"
          variant="primary"
          loading={isLoading}
          disabled={isLoading}
        >
          Yes, Continue
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}
