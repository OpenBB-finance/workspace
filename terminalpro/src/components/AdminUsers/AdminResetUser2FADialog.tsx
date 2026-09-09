import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useCallback } from "react";
import { toast } from "sonner";
import { resetUser2FA } from "~/api/admin.api";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { NotificationId, showNotification } from "~/lib/utils/toast";
import type { User } from "~/types/user.type";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";

interface Props extends BaseDialogProps {
  user: User;
  onConfirm: () => void;
}

export default function AdminResetUser2FADialog(props: Props) {
  const { open, onClose, user, onConfirm } = props;
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async () => {
    try {
      const result = await resetUser2FA(user.uuid);

      if (result.success) {
        onClose();
        showNotification({
          id: NotificationId.AccountReset2FA,
          message: "Account reset 2FA",
          description: `2FA has been reset for ${user.email}`,
          toastType: "success",
        });
      }
    } catch (error) {
      console.error(error.response?.data);
      if (error instanceof AxiosError) {
        toast.error("Error resetting user 2FA", {
          description: error.response?.data?.detail || error.message,
        });
      }
    }
  }, [user.uuid, user.email, user.source, onClose, onConfirm, queryClient]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      modal={true}
      className="w-fit max-w-sm bg-general-bg-primary p-6 text-ds-text-heading [&>.DialogXButton]:top-6 [&>button.absolute]:top-6"
    >
      <span className="body-sm-bold">Reset 2FA</span>
      <div data-testid="reset-2fa-dialog" className="pr-5 body-xs-medium">
        <p>Are you sure you want to reset the 2FA for this account {user.email}?</p>
      </div>
      <AdminDialogFooter
        primaryButtonName="Yes, reset 2FA"
        onPrimaryButtonClick={handleSubmit}
        primaryButtonVariant="danger"
      />
    </BaseDialog>
  );
}
