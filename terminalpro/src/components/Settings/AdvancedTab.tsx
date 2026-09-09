import { Content } from "@radix-ui/react-tabs";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { deleteMe } from "~/api/admin.api";
import { deleteAllDashboards } from "~/api/dashboard.api";
import AdminDeleteUserDialog from "~/components/AdminUsers/AdminDeleteUserDialog";
import { Button } from "~/components/ds/atoms/Button";
import SnowflakeHide from "~/components/General/SnowflakeHide";
import { useAuthStore } from "~/lib/state/auth";

export default function AdvancedTab() {
  const { logout, user } = useAuthStore();
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const clearAllDashboards = useCallback(async () => {
    setIsClearing(true);
    try {
      await deleteAllDashboards();
      logout();
    } catch {
      toast.error("Failed to clear dashboards", {
        description: "Your dashboards were not deleted. Please try again.",
      });
    } finally {
      setIsClearing(false);
    }
  }, [logout]);

  const handleDeleteAccount = useCallback(async () => {
    if (!user) return;
    try {
      await deleteMe();
      logout();
    } catch {
      toast.error("Failed to delete account", {
        description: "Your account was not deleted. Please try again.",
      });
    }
  }, [user, logout]);

  const openDeleteAccountDialog = useCallback(() => {
    setIsDeleteAccountDialogOpen(true);
  }, []);

  const closeDeleteAccountDialog = useCallback(() => {
    setIsDeleteAccountDialogOpen(false);
  }, []);

  return (
    <Content className="mt-5 text-xs" value="advanced">
      <div className="flex gap-4 flex-col">
        <div className="flex flex-col gap-5 bg-general-bg-primary rounded-md p-4 py-5">
          <p className="body-md-medium text-alert-error">Danger Zone</p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <p className="body-sm-medium text-ds-text-heading">Delete Dashboards</p>
              <p className="body-xs-regular text-ds-text-body">
                By selecting this option, you will permanently delete all your
                dashboards and you will need to login again.
                <br />
                This action is not reversible.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              loading={isClearing}
              onClick={clearAllDashboards}
            >
              Clear All Dashboards
            </Button>
          </div>

          <SnowflakeHide>
            <div className="flex flex-col gap-5">
              <hr className="border-surface-divider" />
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <p className="body-sm-medium text-ds-text-heading">Delete Account</p>
                  <p className="body-xs-regular text-ds-text-body">
                    By selecting this option, you will permanently delete your account
                    and all of its contents from the OpenBB Workspace.
                    <br />
                    This action is not reversible, so please continue with caution.
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  className="w-fit"
                  onClick={openDeleteAccountDialog}
                >
                  Delete Account
                </Button>
              </div>
            </div>
          </SnowflakeHide>
        </div>
      </div>

      {!!user && (
        <AdminDeleteUserDialog
          open={isDeleteAccountDialogOpen}
          onClose={closeDeleteAccountDialog}
          user={user}
          onConfirm={handleDeleteAccount}
        />
      )}
    </Content>
  );
}
