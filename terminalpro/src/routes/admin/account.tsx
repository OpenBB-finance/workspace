import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getEntity, updateEntity } from "~/api/admin.api";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { BaseDialog, type BaseDialogProps } from "~/components/ds/dialogs/BaseDialog";
import { DialogClose, DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { SettingsLayout } from "~/components/LayoutAuth/Skeleton/SettingsLayout";
import { RenderNoData } from "~/routes/admin";
import type { EntitySettings } from "~/types/entity.type";

interface Props extends BaseDialogProps {
  onConfirm: (require_authenticator: boolean) => void;
  checked: boolean;
}

const User2FADialog = (props: Props) => {
  const { open, onClose, onConfirm, checked } = props;

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      modal={true}
      className="w-fit max-w-sm p-6 text-general-label-hover [&>.DialogXButton]:top-6 [&>button.absolute]:top-6"
    >
      <DialogTitle>Two-Factor Authentication Configuration</DialogTitle>
      <div data-testid="enable-2fa-dialog" className="pr-5 body-xs-medium">
        <p>
          Are you sure you want to {checked ? "turn on" : "turn off"} 2FA for your
          organization? Please take into consideration that this change will affect{" "}
          <b>all users</b>.
        </p>
      </div>
      <DialogFooter>
        <DialogClose asChild={true}>
          <Button variant="outlined" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </DialogClose>
        <Button
          size="sm"
          type="submit"
          variant={checked ? "primary" : "danger"}
          onClick={() => {
            onConfirm(checked);
          }}
        >
          Yes, {checked ? "turn on" : "turn off"} 2FA
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
};

export default function AdminAccountSettings() {
  const queryClient = useQueryClient();
  const entityQuery = useQuery({
    queryKey: ["admin", "entity"],
    queryFn: getEntity,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  useEffect(() => {
    if (entityQuery.data) {
      setIs2FAEnabled(entityQuery.data.require_authenticator);
    }
  }, [entityQuery.data]);

  const entityMutation = useMutation({
    mutationFn: (data: Partial<EntitySettings>) => updateEntity(data),
    onSuccess: (_data) => {
      toast.success("Entity preferences updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["admin", "entity"],
      });
    },
    onError: (err) => {
      toast.error("Something went wrong");
      console.error(err);
    },
  });

  const handleToggle2FA = useCallback(() => {
    setIs2FAEnabled((prev) => !prev);
    setIsDialogOpen(true);
  }, []);

  const handleDialogClose = useCallback(() => {
    setIs2FAEnabled(entityQuery.data?.require_authenticator ?? false);
    setIsDialogOpen(false);
  }, [entityQuery.data?.require_authenticator]);

  return (
    <SettingsLayout title="Account Settings" tabs={[]} defaultTab="account">
      <TabsPrimitive.Content
        value="account"
        className="p-6 text-sm only-sm:h-screen flex flex-col flex-1 h-[calc(100vh-72px)]"
      >
        {isDialogOpen && (
          <User2FADialog
            open={isDialogOpen}
            onClose={handleDialogClose}
            onConfirm={(require_authenticator) => {
              typeof require_authenticator === "boolean" &&
                entityMutation.mutate({ require_authenticator });
              setIsDialogOpen(false);
            }}
            checked={is2FAEnabled}
          />
        )}

        <div className="relative flex-1">
          {!entityQuery.data ? (
            <RenderNoData
              isError={entityQuery.isError}
              isLoading={entityQuery.isLoading}
            >
              <div>No data found</div>
            </RenderNoData>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md bg-general-bg-primary p-4 space-y-1">
                <h3 className="body-sm-medium text-ds-text-heading">
                  Two-factor authentication
                </h3>
                <p className="body-xs-regular text-ds-text-caption">
                  When checked, this option forces mandatory two-factor authentication
                  for all users.
                </p>
                <div className="pt-3">
                  <Checkbox
                    label="Force two-factor authentication"
                    checked={is2FAEnabled}
                    onCheckedChange={handleToggle2FA}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </TabsPrimitive.Content>
    </SettingsLayout>
  );
}
