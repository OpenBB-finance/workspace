import { Content } from "@radix-ui/react-tabs";
import { AxiosError } from "axios";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getUser2FA, putUser2FA } from "~/api/auth.api";
import { Checkbox } from "~/components/Forms/Checkbox";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { type StateDispatch, useStateReducer } from "~/hooks/useStateReducer";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import TOTPSetDialog from "../Auth/TOTPSetDialog";
import { Button } from "../ds/atoms/Button";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import FeatureLock from "../General/FeatureLock";

interface Props extends BaseDialogProps {
  onConfirm: (token?: string) => void;
  checked: boolean;
}

const User2FADialog = (props: Props) => {
  const { open, onClose, onConfirm, checked } = props;
  const userToken = useShallowAuthStore((state) => state.user?.token);

  const handleSubmit = useCallback(async () => {
    try {
      const result = await putUser2FA({ two_factor_auth: checked });

      if (result.success) {
        onClose();

        // If user is enabling 2FA, pass the user's token to onConfirm
        if (checked && userToken) {
          onConfirm(userToken);
        } else {
          onConfirm();
        }

        showNotificationWithRememberMe({
          id: NotificationId.Account2FAToggled,
          message: "2FA configuration updated",
          toastType: "success",
        });
      }
    } catch (error) {
      console.error(error.response?.data);
      if (error instanceof AxiosError) {
        toast.error("Error enabling 2FA", {
          description: error.response?.data?.detail || error.message,
        });
      }
    }
  }, [onClose, onConfirm, checked, userToken]);

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      modal={true}
      className="w-fit max-w-sm bg-white p-6 text-black dark:text-white [&>.DialogXButton]:top-6 [&>button.absolute]:top-6"
    >
      <DialogTitle>Two-Factor Authentication Configuration</DialogTitle>
      <div data-testid="enable-2fa-dialog" className="pr-5 body-xs-medium">
        <p>
          Are you sure you want to {checked ? "turn on" : "turn off"} 2FA for your
          account?
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
          onClick={handleSubmit}
        >
          Yes, {checked ? "turn on" : "turn off"} 2FA
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
};

const TwoFactorToggle = ({
  is2FAEnabled,
  setIsDialogOpen,
  is2FAEntityRequired,
}: {
  is2FAEnabled: boolean;
  setIsDialogOpen: (open: boolean) => void;
  is2FAEntityRequired: boolean;
}) => {
  const disableToggle = is2FAEntityRequired && is2FAEnabled;
  const content = (
    <div className="flex items-center gap-3">
      <Checkbox
        checked={is2FAEnabled}
        onChange={() => setIsDialogOpen(true)}
        id="2fa"
        disabled={disableToggle}
        className={disableToggle ? "cursor-not-allowed opacity-50" : ""}
      />
      <label
        htmlFor="2fa"
        className={`grow cursor-pointer ${
          disableToggle ? "cursor-not-allowed opacity-50" : ""
        }`}
      >
        Enable 2FA
      </label>
    </div>
  );

  return is2FAEntityRequired ? (
    <Tooltip message="Your organization has 2FA enabled.">{content}</Tooltip>
  ) : (
    content
  );
};

type SecurityTabState = {
  isOpen: boolean;
  is2FAEnabled: boolean;
  is2FAEntityRequired: boolean;
  totpQRCode: string | null;
};

function update2FAState(dispatch: StateDispatch<SecurityTabState>) {
  getUser2FA().then((res) => {
    dispatch({
      is2FAEnabled: res.data.two_factor_auth,
      is2FAEntityRequired: res.data.entity_require_authenticator,
    });
  });
}

const SecurityTab = () => {
  const [state, dispatch] = useStateReducer<SecurityTabState>({
    isOpen: false,
    is2FAEnabled: false,
    is2FAEntityRequired: false,
    totpQRCode: null,
  });

  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );

  useEffect(() => {
    update2FAState(dispatch);
  }, []);

  const handleTOTPCancel = useCallback(async () => {
    try {
      // Turn off 2FA since user cancelled the setup
      await putUser2FA({ two_factor_auth: false });
      dispatch({ totpQRCode: null, is2FAEnabled: false });

      showNotificationWithRememberMe({
        id: NotificationId.Account2FAToggled,
        message: "2FA setup cancelled",
        toastType: "info",
      });
    } catch (error) {
      console.error(error.response?.data);
      if (error instanceof AxiosError) {
        toast.error("Error cancelling 2FA setup", {
          description: error.response?.data?.detail || error.message,
        });
      }
    }
  }, []);

  return (
    <div>
      <User2FADialog
        open={state.isOpen}
        onClose={() => {
          dispatch({ isOpen: false });
          update2FAState(dispatch);
        }}
        onConfirm={(token) => {
          dispatch((prev) => ({
            ...prev,
            is2FAEnabled: !prev.is2FAEnabled,
            totpQRCode: token ?? prev.totpQRCode,
          }));
        }}
        checked={!state.is2FAEnabled}
      />
      <TOTPSetDialog
        open={state.totpQRCode}
        setOpen={(totpQRCode: string | null) => dispatch({ totpQRCode })}
        onCancel={handleTOTPCancel}
        fromSettings={true}
      />
      <Content className="mt-5 text-xs" value="security">
        <div className="flex bg-general-bg-primary rounded-md p-4 flex-col gap-2.5 py-5">
          <p className="flex items-center gap-2 body-sm-medium">
            Two-Factor Authentication (2FA)
            <Tooltip
              message={
                <>
                  If your organization has 2FA enabled, you will be required to use it.
                  <br />
                  If not, you can still enable it for your account.
                </>
              }
            >
              <button type="button" className="ml-2">
                <Icon id="info-circled-icon" />
              </button>
            </Tooltip>
          </p>

          <div className="flex flex-col gap-3">
            <FeatureLock isLocked={!isProTier}>
              <div className="flex items-center gap-3">
                <TwoFactorToggle
                  is2FAEnabled={state.is2FAEnabled}
                  setIsDialogOpen={(isOpen) => dispatch({ isOpen })}
                  is2FAEntityRequired={state.is2FAEntityRequired}
                />
              </div>
            </FeatureLock>
          </div>
        </div>
      </Content>
    </div>
  );
};

export default SecurityTab;
