import { useCallback } from "react";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import type { BaseDialogProps } from "~/components/ds/dialogs/BaseDialog";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";

interface Props extends BaseDialogProps {
  name: string;
  onConfirm: () => Promise<void>;
}

export default function ConfirmDeleteBackendDialog(props: Props) {
  const { open, onClose, name, onConfirm } = props;

  const handleSubmit = useCallback(async () => {
    await onConfirm();
    onClose();
  }, [onConfirm, onClose]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      modal={true}
      className="w-fit max-w-sm bg-white p-6 text-black dark:text-white [&>.DialogXButton]:top-6 [&>button.absolute]:top-6"
    >
      <span className="body-sm-bold">Delete Backend Connection</span>
      <div data-testid="delete-backend-dialog" className="pr-5 body-xs-medium">
        <p>
          Are you sure you want to delete the connection to "{name}"? This will remove
          all associated widgets from your dashboards.
        </p>
        <p className="text-light-600 dark:text-dark-50 text-xs mt-2">
          This action cannot be undone.
        </p>
      </div>
      <AdminDialogFooter
        primaryButtonName="Delete"
        onPrimaryButtonClick={handleSubmit}
        primaryButtonVariant="danger"
      />
    </BaseDialog>
  );
}
