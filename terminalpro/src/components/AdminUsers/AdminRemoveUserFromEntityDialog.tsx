import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useCallback } from "react";
import { toast } from "sonner";
import { deleteUser } from "~/api/admin.api";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { NotificationId, showNotification } from "~/lib/utils/toast";
import type { User } from "~/types/user.type";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";

interface Props extends BaseDialogProps {
  user: User;
  onConfirm: () => void;
}

export default function AdminRemoveUserFromEntityDialog(props: Props) {
  const { open, onClose, user, onConfirm } = props;
  const queryClient = useQueryClient();

  const handleSubmit = useCallback(async () => {
    try {
      await deleteUser(user.uuid, user.source, true);
      queryClient.invalidateQueries({
        queryKey: ["admin", "users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "entityInfo"],
      });
      onConfirm();
      onClose();
      showNotification({
        id: NotificationId.AccountRemoved,
        message: "Account removed",
        description: `Account ${user.email} has been removed`,
        toastType: "success",
      });
    } catch (error) {
      console.error(error.response?.data);
      if (error instanceof AxiosError) {
        toast.error("Error removing account", {
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
      <span className="body-sm-bold">Remove from organization</span>
      <div data-testid="remove-user-dialog" className="pr-5 body-xs-medium">
        <p>Are you sure you want to remove this account {user.email}?</p>
        <p>Access to the Organization and all API keys will be revoked.</p>
      </div>
      <AdminDialogFooter
        primaryButtonName="Yes, remove account"
        onPrimaryButtonClick={handleSubmit}
        primaryButtonVariant="danger"
      />
    </BaseDialog>
  );
}
