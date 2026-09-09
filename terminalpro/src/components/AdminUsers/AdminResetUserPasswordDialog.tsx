import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useCallback } from "react";
import { toast } from "sonner";
import { resetUserPassword } from "~/api/admin.api";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { NotificationId, showNotification } from "~/lib/utils/toast";
import type { User } from "~/types/user.type";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";

interface Props extends BaseDialogProps {
  user: Partial<User>;
  onConfirm: (temporaryPassword: string) => void;
}

export default function AdminResetUserPasswordDialog(props: Props) {
  const { open, onClose, user, onConfirm } = props;
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async () => {
    try {
      const result = await resetUserPassword(user.uuid);

      if (result.success) {
        await navigator.clipboard.writeText(result.temporary_password);
        onConfirm(result.temporary_password);
        onClose();
        showNotification({
          id: NotificationId.AccountResetPassword,
          message: "Account reset password",
          description: `Password has been reset for ${user.email}. Temporary password was copied to your clipboard.`,
          toastType: "success",
        });
      }
    } catch (error) {
      console.error(error.response?.data);
      if (error instanceof AxiosError) {
        toast.error("Error resetting user password", {
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
      <span className="body-sm-bold">Reset password</span>
      <div data-testid="reset-password-dialog" className="pr-5 body-xs-medium">
        <p>
          Are you sure you want to reset the password for this account {user.email}?
        </p>
      </div>
      <AdminDialogFooter
        primaryButtonName="Yes, reset password"
        onPrimaryButtonClick={handleSubmit}
        primaryButtonVariant="danger"
      />
    </BaseDialog>
  );
}
