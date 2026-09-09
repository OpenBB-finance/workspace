import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { extendTrialUser, updateUser } from "~/api/admin.api";
import { useEntityMap } from "~/components/AdminRoles/adminUseQueries";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import { useStateReducer } from "~/hooks/useStateReducer";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import type { User } from "~/types/user.type";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Select } from "../ds/atoms/Select";
import { Tag } from "../ds/atoms/Tag";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import SettingsMenu from "../ds/molecules/SettingsMenu";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import AdminDeleteUserDialog from "./AdminDeleteUserDialog";
import AdminRemoveUserFromEntityDialog from "./AdminRemoveUserFromEntityDialog";
import AdminResetUser2FADialog from "./AdminResetUser2FADialog";
import AdminResetUserPasswordDialog from "./AdminResetUserPasswordDialog";
import AdminUserPermissionsSection from "./AdminUserPermissionsSection";
import AdminUserStatus from "./AdminUserStatus";

const uiShowRemoveFromOrgFF = getConfig().ui.showRemoveFromOrg;

interface Props {
  user: User;
  onClose: () => void;
  /** Role names assigned to this user, shown as tags in the general info section. */
  roles?: string[];
}

interface UserInfo {
  permissions_uuid: User["permissions_uuid"];
  billing_active: User["billing_active"];
  pro_entitlements: User["pro_entitlements"];
}

interface BaseState extends UserInfo {
  generalInfoOpen: boolean;
  permissionsOpen: boolean;
  openDelete: boolean;
  openRemove: boolean;
  openResetPassword: boolean;
  openReset2FA: boolean;
  temporaryPassword: string | null;
}

const initialState = {
  generalInfoOpen: true,
  permissionsOpen: false,
  openDelete: false,
  openRemove: false,
  openResetPassword: false,
  openReset2FA: false,
  temporaryPassword: null,
};

export function getBaseState(user: User | UserInfo, initial?: Partial<BaseState>) {
  return {
    permissions_uuid: user.permissions_uuid,
    billing_active: user.billing_active,
    pro_entitlements: user.pro_entitlements,
    ...(initial || {}),
  } as BaseState;
}

export default function AdminUserDetailsDialog({ onClose, user, roles = [] }: Props) {
  const navigate = useNavigate();
  const loggedInUser = useShallowAuthStore((s) => s.user);
  const [state, dispatch] = useStateReducer(getBaseState(user, initialState));

  const userInfo = useMemo(() => {
    const activeUser = user.status === "active";
    const sameUser = user.email === loggedInUser.email;
    const isTrial = user.permissions_uuid === "11111111-1111-1111-1111-111111111111";
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const lastLogin = user.last_login
      ? dayjs(user.last_login).locale("en").format("MMM D, YYYY h:mm A")
      : "-";

    return { activeUser, sameUser, isTrial, fullName, lastLogin };
  }, [user, loggedInUser?.email]);

  useEffect(() => {
    dispatch(getBaseState(user));
  }, [user, dispatch]);

  const queryClient = useQueryClient();

  const userMutation = useMutation({
    mutationFn: async (data: Partial<User>) => updateUser(user.uuid, data),
    onSuccess: () => {
      toast.success("User updated successfully!", {
        description: `User ${user.email} has been updated`,
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin", "entityInfo"],
      });
      onClose();
    },
    onError: (err: { response: { data: { detail?: string } } }) => {
      const detail = err?.response?.data?.detail;
      toast.error(detail ?? "Something went wrong");
      console.error(err);
    },
  });
  const { data: entityMap = [] } = useEntityMap();
  const rolesOptions = useMemo(
    () => entityMap.map((item) => ({ label: item.name, value: item.uuid })),
    [entityMap],
  );

  const userExtension = useMutation({
    mutationFn: async () => extendTrialUser(user.uuid),
    onSuccess: (_data) => {
      toast.success("User extended successfully!");
      onClose();
    },
    onError: (err) => {
      toast.error("Something went wrong");
      console.error(err);
    },
  });

  const handleSubmit = useCallback(async () => {
    await userMutation.mutateAsync(getBaseState(state));
  }, [userMutation.mutateAsync, state]);

  const handleExtend = useCallback(async () => {
    if (userExtension.isPending) return;
    await userExtension.mutateAsync();
  }, [userExtension.isPending, userExtension.mutateAsync]);

  return (
    <>
      <BaseDialog
        open={!!user}
        onClose={() => {
          dispatch({ openDelete: false });
          onClose();
        }}
        modal={true}
        focusOnOpen={false}
        className="max-w-md lg:max-w-3xl xl:max-w-5xl max-h-[760px] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pb-2">
          <SettingsMenu
            title="General information"
            canCollapse
            open={state.generalInfoOpen}
            onOpenChange={(open) => dispatch({ generalInfoOpen: open })}
            bodyClassName="space-y-3"
            rightElement={
              !userInfo.sameUser ? (
                <div className="flex items-center gap-1">
                  <Tooltip message="Reset 2FA" position="bottom">
                    <button
                      type="button"
                      data-testid="reset-2fa-button"
                      className="obb-small-navbar-btn flex items-center justify-center size-6 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ openReset2FA: true });
                      }}
                    >
                      <Icon id="lock-01" className="size-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip message="Reset password" position="bottom">
                    <button
                      type="button"
                      data-testid="reset-password-button"
                      className="obb-small-navbar-btn flex items-center justify-center size-6 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ openResetPassword: true });
                      }}
                    >
                      <Icon id="key-icon" className="size-3.5" />
                    </button>
                  </Tooltip>
                  {uiShowRemoveFromOrgFF && (
                    <Tooltip message="Remove from organization" position="bottom">
                      <button
                        type="button"
                        data-testid="remove-account-button"
                        className="obb-small-navbar-btn flex items-center justify-center size-6 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          dispatch({ openRemove: true });
                        }}
                      >
                        <Icon id="slash-circle-01" className="size-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip message="Delete account" position="bottom">
                    <button
                      type="button"
                      data-testid="delete-account-button"
                      className="obb-small-navbar-btn flex items-center justify-center size-6 rounded"
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ openDelete: true });
                      }}
                    >
                      <Icon id="trash-02" className="size-3.5" />
                    </button>
                  </Tooltip>
                </div>
              ) : undefined
            }
          >
            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <span className="font-medium">Name</span>
              <span className="text-ds-text-body">{userInfo.fullName || "-"}</span>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <span className="font-medium">Email</span>
              <span className="text-ds-text-body">{user.email}</span>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <span className="font-medium">Type</span>
              <div className="[&>.BB-Select]:inline">
                <Select
                  className="inline-flex h-7 w-[120px] rounded-sm px-2"
                  options={rolesOptions}
                  placeholder="Select role"
                  disabled={!userInfo.activeUser || userInfo.sameUser}
                  value={state.permissions_uuid}
                  onValueChange={(permissions_uuid) => dispatch({ permissions_uuid })}
                />
              </div>
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-start">
              <span className="font-medium pt-0.5">Roles</span>
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {roles.map((role) => (
                    <Tag key={role} color="grey">
                      {role}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span className="text-ds-text-body">-</span>
              )}
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <span className="font-medium">Status</span>
              <AdminUserStatus value={user.status} />
            </div>

            <div className="grid grid-cols-[100px_1fr] gap-4 items-center">
              <span className="font-medium">Last log in</span>
              <span data-testid="last-login" className="text-ds-text-body">
                {userInfo.lastLogin}
              </span>
            </div>
          </SettingsMenu>

          <SettingsMenu
            title="Roles / Permissions"
            canCollapse
            open={state.permissionsOpen}
            onOpenChange={(open) => dispatch({ permissionsOpen: open })}
            tooltip="Permissions granted to this user by their roles, per resource"
            bodyClassName="p-3"
            rightElement={
              <Button
                variant="outlined"
                size="xs"
                className="text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/admin/roles");
                }}
              >
                Edit permissions
              </Button>
            }
          >
            <AdminUserPermissionsSection userUuid={user.uuid} />
          </SettingsMenu>

          <div className="hidden">
            <Checkbox
              label="Seat Assigned"
              defaultChecked={state.billing_active}
              onCheckedChange={(billing_active) =>
                typeof billing_active === "boolean" && dispatch({ billing_active })
              }
              disabled={!userInfo.activeUser || userInfo.sameUser}
            />
            {userInfo.isTrial && !user.renewed && (
              <Button variant="secondary" size="xs" onClick={handleExtend}>
                Extend Account
              </Button>
            )}
            {state.temporaryPassword && (
              <div className="flex items-center gap-1">
                <span className="body-xs-medium">Temporary password:</span>
                <span className="body-xs-regular">{state.temporaryPassword}</span>
              </div>
            )}
          </div>
        </div>
        <AdminDialogFooter
          primaryButtonName="Save"
          onPrimaryButtonClick={handleSubmit}
        />
      </BaseDialog>
      {!!user && state.openDelete && (
        <AdminDeleteUserDialog
          open={state.openDelete}
          onClose={() => dispatch({ openDelete: false })}
          user={user}
          onConfirm={() => {
            onClose();
          }}
        />
      )}
      {!!user && state.openRemove && (
        <AdminRemoveUserFromEntityDialog
          open={state.openRemove}
          onClose={() => dispatch({ openRemove: false })}
          user={user}
          onConfirm={() => {
            onClose();
          }}
        />
      )}
      {!!user && state.openResetPassword && (
        <AdminResetUserPasswordDialog
          open={state.openResetPassword}
          onClose={() => dispatch({ openResetPassword: false })}
          user={user}
          onConfirm={(temporaryPassword) => {
            dispatch({ temporaryPassword });
            queryClient.invalidateQueries({
              queryKey: ["admin", "users"],
            });
          }}
        />
      )}
      {!!user && state.openReset2FA && (
        <AdminResetUser2FADialog
          open={state.openReset2FA}
          onClose={() => dispatch({ openReset2FA: false })}
          user={user}
          onConfirm={() => {
            onClose();
          }}
        />
      )}
    </>
  );
}
