import { useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  deleteUserAppShare,
  getUserAppShares,
  getUserAppShareUsers,
  shareUserApp,
} from "~/api/auth.api";
import { saveDashboards } from "~/api/dashboard.api";
import { getUserInitials } from "~/components/AdminRoles/AddUsersSelect";
import Icon from "~/components/Icon";
import { useStateReducer } from "~/hooks/useStateReducer";
import { UNIQUE_AVATAR_COLORS as COLORS } from "~/lib/constants";
import type { Widget } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowUserAppsStore } from "~/lib/state/userApps";
import { zodEmail } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { Input } from "../ds/atoms/Input";
import {
  PopoverContent as DSPopoverContent,
  PopoverRoot,
  PopoverTrigger,
} from "../ds/atoms/Popover";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";

type ShareableUser = {
  [email: string]: {
    first_name: string;
    last_name: string;
    shared: boolean;
  };
};
type ShareData = {
  [email: string]: {
    first_name?: string;
    last_name?: string;
    created_date?: string;
    permissions?: "view" | "edit";
  };
};

export function ShareAppDialog({
  closeDialog,
  onClose,
}: {
  closeDialog: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { user, ownerFullName } = useShallowAuthStore((state) => ({
    user: state.user,
    ownerFullName: [state.name.first, state.name.last].filter(Boolean).join(" "),
  }));
  const isTrialOrg = user.entity_name === "OpenBB Trial";

  const shareUserAppsPopupId = useShallowThemeStore(
    (state) => state.shareUserAppsPopupId,
  );

  const { setAppShared, userApp } = useShallowUserAppsStore((state) => ({
    setAppShared: state.setAppShared,
    userApp: state.getUserApp(shareUserAppsPopupId),
  }));

  const appName = userApp?.name ?? "User App";

  const [state, dispatch] = useStateReducer({
    searchQuery: "",
    dropdownOpen: false,
    usersPermissions: {} as { [email: string]: "no-access" | "view" | "edit" },
    trialEmail: "",
    isSubmitting: false,
  });

  const { data: shareDataInfo } = useQuery<ShareData>({
    queryKey: ["userAppShares", shareUserAppsPopupId],
    queryFn: () => getUserAppShares(shareUserAppsPopupId),
    enabled: !!shareUserAppsPopupId,
  }); // user app shared info e.g., users that this user app is shared with and their permissions and when it was shared

  const { data: shareableUsers } = useQuery<ShareableUser>({
    queryKey: ["getUserAppShareUsers", shareUserAppsPopupId],
    queryFn: () => getUserAppShareUsers(shareUserAppsPopupId),
    enabled: !!shareUserAppsPopupId,
  }); // users that can be shared with

  const tabHasBYODWidgets = useMemo(() => {
    return userApp?.widgets.some((widget) => widget.external);
  }, [userApp]);

  useEffect(() => {
    if (shareableUsers && shareDataInfo) {
      const initialCheckedState = Object.entries(shareableUsers).reduce(
        (acc, [email, _userInfo]) => {
          acc[email] =
            shareDataInfo[email]?.created_date &&
            shareDataInfo[email]?.permissions === "view"
              ? "view"
              : "no-access";
          return acc;
        },
        {} as { [email: string]: "no-access" | "view" | "edit" },
      );
      const sharedEmails = Object.entries(initialCheckedState)
        .filter(([_email, permissions]) => permissions !== "no-access")
        .map(([email]) => email);

      setAppShared(shareUserAppsPopupId, sharedEmails.length > 0);
      dispatch({ usersPermissions: initialCheckedState });
    }
  }, [shareableUsers, shareDataInfo, shareUserAppsPopupId, setAppShared]);

  const clearQueryCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["getUserAppShareUsers", shareUserAppsPopupId],
    });
    queryClient.invalidateQueries({
      queryKey: ["userAppShares", shareUserAppsPopupId],
    });
  }, [queryClient, shareUserAppsPopupId]);

  const hasChanges = useMemo(() => {
    if (isTrialOrg && state.trialEmail) {
      return true;
    }
    return Object.entries(state.usersPermissions).some(([email, permissions]) => {
      const initialPermissions = shareDataInfo?.[email]?.permissions ?? "no-access";
      return permissions !== initialPermissions;
    });
  }, [state.usersPermissions, state.trialEmail, shareDataInfo, isTrialOrg]);

  const onSubmit = useCallback(async () => {
    dispatch({ isSubmitting: true });
    try {
      await saveDashboards();
      if (!shareUserAppsPopupId) {
        console.error("User App UUID is not available.");
        return;
      }

      const { sharedEmails, deletedEmails } = Object.entries(
        state.usersPermissions,
      ).reduce(
        (acc, [email, permissions]) => {
          if (permissions === "no-access") {
            acc.deletedEmails.push(email);
          } else {
            acc.sharedEmails.push(email);
          }
          return acc;
        },
        { sharedEmails: [] as string[], deletedEmails: [] as string[] },
      );

      if (deletedEmails.length > 0) {
        await deleteUserAppShare(shareUserAppsPopupId, deletedEmails);
        if (posthog) {
          posthog.capture("deleted_a_shared_user_app", {
            hasCustomWidgets: tabHasBYODWidgets,
            emails: deletedEmails,
            userApp: shareUserAppsPopupId,
          });
        }
      }

      if (isTrialOrg && state.trialEmail) {
        const emailToShareWith = zodEmail.safeParse(state.trialEmail);
        if (emailToShareWith.success) {
          sharedEmails.push(state.trialEmail);
        }

        if (sharedEmails.length === 0) {
          toast.error("Invalid email format", {
            description:
              "Please enter a valid email address to share the dashboard with.",
          });
          return;
        }
      }

      if (sharedEmails.length > 0) {
        const data = await shareUserApp(shareUserAppsPopupId, sharedEmails.join(","));

        if (!data?.success) {
          toast.error("User App Share Failed", { description: data?.detail });
          return;
        }
        if (posthog) {
          posthog.capture("shared_a_user_app", {
            hasCustomWidgets: tabHasBYODWidgets,
            emails: sharedEmails,
            userApp: shareUserAppsPopupId,
          });
        }
      }

      if (sharedEmails.length > 0 && tabHasBYODWidgets) {
        toast.success("User App shared permissions updated", {
          description:
            "Please note that shared users will not be able to view Data connectors widgets.",
        });
        dispatch({ trialEmail: "" });
      } else {
        toast.success("User App shared permissions updated");
      }

      clearQueryCache();
      onClose();
    } catch (error) {
      console.error("Failed to share the user app:", error);
    } finally {
      dispatch({ isSubmitting: false });
    }
  }, [
    state.trialEmail,
    state.usersPermissions,
    isTrialOrg,
    shareUserAppsPopupId,
    tabHasBYODWidgets,
    clearQueryCache,
    onClose,
  ]);

  const users = useMemo(() => {
    return Object.entries(shareableUsers ?? {}).map(([email, data]) => ({
      email,
      name: [data.first_name, data.last_name].filter(Boolean).join(" ") || email,
      firstName: data.first_name,
      lastName: data.last_name,
    }));
  }, [shareableUsers]);

  const filteredUsers = useMemo(() => {
    const query = state.searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query),
    );
  }, [users, state.searchQuery]);

  const handleToggleUser = useCallback((email: string) => {
    dispatch({
      usersPermissions: (prev) => ({
        ...prev,
        [email]: prev[email] === "view" ? "no-access" : "view",
      }),
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      const newPermissions = users.reduce(
        (acc, user) => {
          acc[user.email] = checked ? "view" : "no-access";
          return acc;
        },
        {} as { [email: string]: "no-access" | "view" | "edit" },
      );
      dispatch({ usersPermissions: newPermissions });
    },
    [users],
  );

  const handleRemoveUser = useCallback((email: string) => {
    dispatch({
      usersPermissions: (prev) => ({
        ...prev,
        [email]: "no-access",
      }),
    });
  }, []);

  const sharedUsers = useMemo(() => {
    return users.filter((user) => state.usersPermissions[user.email] === "view");
  }, [users, state.usersPermissions]);

  const allSelected =
    users.length > 0 &&
    users.every((user) => state.usersPermissions[user.email] === "view");

  return (
    <BaseDialog
      open={!!shareUserAppsPopupId && !closeDialog}
      onClose={onClose}
      className="w-[98vw] md:w-full lg:max-w-[500px]"
    >
      <DialogTitle>Share '{appName}' App</DialogTitle>
      <div className="flex flex-col gap-4">
        <p className="text-ds-text-body">
          Share this app with other users in your organization.
        </p>

        {isTrialOrg ? (
          <Input
            label="Email"
            placeholder="Enter email to share with"
            name="trialEmail"
            value={state.trialEmail}
            onChange={(trialEmail: string) => dispatch({ trialEmail })}
          />
        ) : (
          <PopoverRoot
            open={state.dropdownOpen}
            onOpenChange={(dropdownOpen) => dispatch({ dropdownOpen })}
          >
            <PopoverTrigger asChild={true}>
              <button
                type="button"
                className="w-full h-9 px-3 text-left rounded border
                  border-general-border-primary
                  bg-input-field-bg
                  hover:bg-input-field-bg-hover
                  flex items-center justify-between"
              >
                {sharedUsers.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {sharedUsers.slice(0, 3).map((user, idx) => (
                          <div
                            key={user.email}
                            className="flex items-center justify-center size-6 rounded-full text-white text-2xs font-medium border-2 border-general-bg-primary"
                            style={{
                              backgroundColor: COLORS[(idx + 1) % COLORS.length],
                            }}
                          >
                            {getUserInitials(user.name)}
                          </div>
                        ))}
                        {sharedUsers.length > 3 && (
                          <div className="flex items-center justify-center size-6 rounded-full text-2xs font-medium border-2 border-general-bg-primary bg-general-bg-secondary text-ds-text-body">
                            +{sharedUsers.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-ds-text-heading">
                        {sharedUsers.length}{" "}
                        {sharedUsers.length === 1 ? "user" : "users"} selected
                      </span>
                    </div>
                    <Icon id="chevron-down" className="size-4 text-ds-text-caption" />
                  </>
                ) : (
                  <>
                    <span className="text-ds-text-caption">
                      Click here to add people
                    </span>
                    <Icon id="chevron-down" className="size-4 text-ds-text-caption" />
                  </>
                )}
              </button>
            </PopoverTrigger>
            <DSPopoverContent
              align="start"
              sideOffset={4}
              className="w-[468px] max-w-[calc(100vw-2rem)] only-sm:z-[62] p-3 bg-dropdown-bg rounded-md shadow-lg border border-dropdown-border"
            >
              <div className="flex flex-col gap-3">
                <Input
                  prefix={<Icon id="search" />}
                  placeholder="Search users"
                  value={state.searchQuery}
                  onChange={(searchQuery: string) => dispatch({ searchQuery })}
                  size="md"
                />

                <div className="flex justify-between items-center [&_label]:whitespace-nowrap">
                  <p className="text-2xs text-ds-text-caption uppercase tracking-wide">
                    Users from your organization
                  </p>
                  <Checkbox
                    label="Select All"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </div>

                <hr className="border-surface-divider" />

                <div
                  className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-scrollbar-handle scrollbar-track-transparent" // add pr-1 to prevent scrollbar cutting off the elements
                  onWheel={(e) => e.stopPropagation()}
                >
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user, idx) => {
                      const initials = getUserInitials(user.name);
                      const isShared = state.usersPermissions[user.email] === "view";
                      return (
                        <div
                          key={`dropdown-user-${user.email}`}
                          className="flex items-center gap-2.5 justify-between py-1.5 px-1 rounded
                              hover:bg-general-bg-secondary-hover cursor-pointer"
                          onClick={() => handleToggleUser(user.email)}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="flex items-center justify-center w-8 h-8 rounded-full text-white font-medium"
                              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                            >
                              {initials}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-ds-text-heading">{user.name}</span>
                              <span className="text-ds-text-caption text-xs">
                                {user.email}
                              </span>
                            </div>
                          </div>
                          <Checkbox checked={isShared} />
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-ds-text-caption text-center py-4">
                      No users found
                    </p>
                  )}
                </div>
              </div>
            </DSPopoverContent>
          </PopoverRoot>
        )}

        <div className="flex flex-col gap-2">
          <p className="font-medium text-ds-text-heading">People with access</p>

          <div className="flex flex-col gap-2.5 h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-scrollbar-handle scrollbar-track-transparent">
            <div className="flex items-center gap-2.5 justify-between bg-surface-card rounded p-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full text-white font-medium"
                  style={{ backgroundColor: COLORS[0] }}
                >
                  {getUserInitials(ownerFullName || user.email)}
                </div>
                <div className="flex flex-col">
                  <span className="text-ds-text-heading">
                    {ownerFullName || "You"}{" "}
                    <span className="text-ds-text-caption">(you)</span>
                  </span>
                  <span className="text-ds-text-caption text-xs">{user.email}</span>
                </div>
              </div>
              <span className="obb-tag">Owner</span>
            </div>

            {sharedUsers.map((sharedUser, idx) => {
              const initials = getUserInitials(sharedUser.name);
              return (
                <div
                  key={`access-user-${sharedUser.email}`}
                  className="flex items-center gap-2.5 justify-between bg-surface-card rounded p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-full text-white font-medium"
                      style={{ backgroundColor: COLORS[(idx + 1) % COLORS.length] }}
                    >
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-ds-text-heading">{sharedUser.name}</span>
                      <span className="text-ds-text-caption text-xs">
                        {sharedUser.email}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(sharedUser.email)}
                      className="p-0.5 rounded hover:bg-general-bg-secondary-hover"
                    >
                      <Icon
                        id="x-outline-circle"
                        className="size-4 text-ds-text-body"
                      />
                    </button>
                  </div>
                </div>
              );
            })}

            {sharedUsers.length === 0 && (
              <p className="text-ds-text-caption py-2">
                No users have access yet. Add people using the button above.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-2">
          <DialogClose asChild={true}>
            <Button variant="outlined" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            disabled={!hasChanges || state.isSubmitting}
            loading={state.isSubmitting}
            onClick={onSubmit}
          >
            Save
          </Button>
        </DialogFooter>
      </div>
    </BaseDialog>
  );
}

function FileWarning({
  onAccept,
  onClose,
  api,
}: {
  onAccept: () => void;
  onClose: () => void;
  api: boolean;
}) {
  return (
    <BaseDialog open={true} onClose={onClose} modal={true}>
      <DialogTitle>
        <span className="flex">
          <Icon id="warning-icon" className="text-alert-warning size-5 mr-2" /> Widgets
          uploaded may contain sensitive data
        </span>
      </DialogTitle>
      <p>
        Please ensure that you have reviewed any confidential information before
        sharing. Do you want to continue?
      </p>
      <div className="font-bold text-alert-error">
        {api === true
          ? "We've detected a high probability of sensitive keys in your widgets. Please review before sharing - if you are certain you want to share, click continue."
          : ""}
      </div>{" "}
      <DialogFooter>
        <Button size="sm" variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onAccept} size="sm">
          Continue
        </Button>
      </DialogFooter>
    </BaseDialog>
  );
}

function getWarningMessages(widgets: Widget[]) {
  const warningMessages = { type: false, api: false };
  const connectionTypes = ["file", "single", "advanced-backend"];
  const urlRegex = /(?:(secret|api|key|token|auth)(?<=\1(?:[^&\s]*)))/;
  const headersRegex = /.*key.*|.*token.*|.*auth.*|.*secret.*|.*bearer.*|.*basic.*/;

  for (const widget of widgets) {
    if (!connectionTypes.includes(widget?.connectionType)) continue;

    warningMessages.type = true;
    const headersMessages = Object.keys(widget?.endpoint?.headers || {}).some(
      (header) => headersRegex.test(header),
    );

    if (urlRegex.test(widget?.endpoint?.url) || headersMessages) {
      warningMessages.api = true;
    }
  }
  return warningMessages;
}

export function ShareUserAppDialog() {
  const { setShareUserAppsPopupId, shareUserAppsPopupId } = useShallowThemeStore(
    (state) => ({
      setShareUserAppsPopupId: state.setShareUserAppsPopupId,
      shareUserAppsPopupId: state.shareUserAppsPopupId,
    }),
  );

  const widgets = useShallowUserAppsStore((state) => {
    const userApp = state.getUserApp(shareUserAppsPopupId);
    return userApp?.widgets || [];
  });

  const warningMessages = getWarningMessages(widgets);

  const [state, dispatch] = useStateReducer({
    acceptedFile: false,
    warningMessages,
    closeDialog: false,
  });

  useEffect(() => {
    if (state.closeDialog && shareUserAppsPopupId) {
      setTimeout(() => setShareUserAppsPopupId(null), 500);
    }
  }, [state.closeDialog, setShareUserAppsPopupId]);

  return (
    <>
      {state.warningMessages.type && !state.acceptedFile && (
        <FileWarning
          onAccept={() => dispatch({ acceptedFile: true })}
          onClose={() => dispatch({ closeDialog: true })}
          api={state.warningMessages.api}
        />
      )}
      {shareUserAppsPopupId && !(state.warningMessages.type && !state.acceptedFile) && (
        <ShareAppDialog
          closeDialog={state.closeDialog}
          onClose={() => dispatch({ closeDialog: true })}
        />
      )}
    </>
  );
}
