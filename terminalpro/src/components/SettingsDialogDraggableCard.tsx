import { memo, type ReactNode, useCallback } from "react";
import { Button } from "./ds/atoms/Button";
import { BaseDialog } from "./ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "./ds/dialogs/Dialog";
import { useWidgetContext } from "./Widget.context";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
  children?: ReactNode;
  onSubmit?: () => any | Promise<boolean>;
  extraActions?: ReactNode;
  showActionsSettings: boolean;
  className?: string;
}

export const SettingsDialog = memo((props: Props) => {
  const {
    open,
    setOpen,
    title,
    children = null,
    onSubmit,
    showActionsSettings,
    extraActions = null,
    className,
  } = props;

  const widgetId = useWidgetContext()?.widget?.widgetId;

  const handleSubmit = useCallback(async () => {
    const result = await onSubmit?.();
    if (result === false) return;
    setOpen(false);
  }, [onSubmit, setOpen]);

  if (!widgetId) return null;

  return (
    <BaseDialog
      // modal={true}
      open={open}
      onClose={() => setOpen(false)}
      className={className}
      focusOnOpen={false}
    >
      <DialogTitle>{title}</DialogTitle>
      <div className="flex flex-col gap-3 flex-1">{children}</div>
      {showActionsSettings && (
        <DialogFooter>
          {extraActions || (
            <>
              <Button variant="outlined" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmit}>
                Save
              </Button>
            </>
          )}
        </DialogFooter>
      )}
    </BaseDialog>
  );
});

SettingsDialog.displayName = "SettingsDialog";
