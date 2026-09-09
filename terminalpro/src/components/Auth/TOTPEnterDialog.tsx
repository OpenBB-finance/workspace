import TOTPEnterForm from "~/components/Auth/TOTPEnterForm";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";

export default function TOTPEnterDialog({
  open,
  setOpen,
  handleSubmit,
  onCancel,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleSubmit: (open: number) => Promise<number>;
  onCancel: () => void;
}) {
  return (
    <BaseDialog open={open} className="[&>.DialogXButton]:hidden">
      <DialogTitle>Enter 2FA Code</DialogTitle>
      <TOTPEnterForm
        handleClose={() => setOpen(false)}
        onCancel={onCancel}
        handleSubmit={handleSubmit}
      />
    </BaseDialog>
  );
}
