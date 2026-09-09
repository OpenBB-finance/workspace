import { useQuery, useQueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  deleteDashboardShare,
  getDashboardShares,
  getDashboardShareUsers,
  saveDashboards,
  shareDashboard,
} from "~/api/dashboard.api";
import Icon from "~/components/Icon";
import { useStateReducer } from "~/hooks/useStateReducer";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useShallowAppStore, type Widget } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";
import { getRandomUserListBackgroundByEmail } from "~/lib/utils";
import { zodEmail } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { Input } from "../ds/atoms/Input";
import { Select } from "../ds/atoms/Select";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import Tooltip from "../Tooltip";

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

export function ShareDashboard({
  closeDialog,
  onClose,
}: {
  closeDialog: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const user = useShallowAuthStore((state) => state.user);
  const isTrialOrg = user.entity_name === "OpenBB Trial";

  const { setDashboardShared, getTabById } = useShallowAppStore((state) => ({
    setDashboardShared: state.setDashboardShared,
    getTabById: state.getTabById,
  }));
  const shareDashboardPopupId = useShallowThemeStore(
    (state) => state.shareDashboardPopupId,
  );

  const [state, dispatch] = useStateReducer({
    shareWithEmail: "",
    usersPermissions: {} as { [email: string]: "no-access" | "view" | "edit" },
    isSaving: false,
    tooltipEmail: null as string | null,
  });

  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimer = useCallback(() => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  }, []);

  const handleTooltipPointerEnter = useCallback(
    (email: string) => {
      tooltipTimerRef.current = setTimeout(
        () => dispatch({ tooltipEmail: email }),
        2500,
      );
    },
    [dispatch],
  );

  const handleTooltipPointerLeave = useCallback(() => {
    clearTooltipTimer();
    dispatch({ tooltipEmail: null });
  }, [clearTooltipTimer, dispatch]);

  useEffect(() => clearTooltipTimer, [clearTooltipTimer]);

  useEffect(() => {
    if (shareDashboardPopupId) {
      saveDashboards();
    }
  }, [shareDashboardPopupId]);

  const { data: shareDataInfo } = useQuery<ShareData>({
    queryKey: ["dashboardShares", shareDashboardPopupId],
    queryFn: () => getDashboardShares(shareDashboardPopupId),
    enabled: !!shareDashboardPopupId,
  }); // dashboard shared info e.g., users that this dashboard is shared with and their permissions and when it was shared

  const { data } = useQuery<ShareableUser>({
    queryKey: ["getDashboardShareUsers", shareDashboardPopupId],
    queryFn: () => getDashboardShareUsers(shareDashboardPopupId),
    enabled: !!shareDashboardPopupId,
  }); // users that can be shared with

  const tabHasBYODWidgets = useMemo(() => {
    const tab = getTabById(shareDashboardPopupId);
    return tab?.data?.widgets.some((widget) => widget.external);
  }, [shareDashboardPopupId]);

  // Initialize checkedUsers state when data is fetched
  useEffect(() => {
    if (data && shareDataInfo) {
      const initialCheckedState = Object.entries(data).reduce(
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

      setDashboardShared(shareDashboardPopupId, sharedEmails.length > 0);
      dispatch({ usersPermissions: initialCheckedState });
    }
  }, [data, shareDataInfo, shareDashboardPopupId]);

  const clearQueryCache = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["getDashboardShareUsers", shareDashboardPopupId],
    });
    queryClient.invalidateQueries({
      queryKey: ["dashboardShares", shareDashboardPopupId],
    });
  }, [queryClient, shareDashboardPopupId]);

  const showSaveChanges = useMemo(() => {
    if (isTrialOrg) {
      return true;
    }
    // we need to compare the current state with the initial state to see if there are any changes
    return Object.entries(state.usersPermissions).some(([email, permissions]) => {
      const initialPermissions = shareDataInfo?.[email]?.permissions ?? "no-access";
      return permissions !== initialPermissions;
    });
  }, [state.usersPermissions, shareDataInfo]);

  const onSubmit = useCallback(async () => {
    dispatch({ isSaving: true });
    try {
      await saveDashboards();
      // Assuming shareDashboardPopupId holds the dashboardUuid
      if (!shareDashboardPopupId) {
        console.error("Dashboard UUID is not available.");
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
        { sharedEmails: [], deletedEmails: [] },
      );

      if (deletedEmails.length > 0) {
        // Delete the shares
        await deleteDashboardShare(shareDashboardPopupId, deletedEmails);
        if (posthog) {
          posthog.capture("deleted_a_shared_dashboard", {
            hasCustomWidgets: tabHasBYODWidgets,
            emails: deletedEmails,
            dashboard: shareDashboardPopupId,
          });
        }
      }

      if (isTrialOrg && state.shareWithEmail) {
        const emailToShareWith = zodEmail.safeParse(state.shareWithEmail);
        if (emailToShareWith.success) {
          sharedEmails.push(state.shareWithEmail);
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
        const data = await shareDashboard(
          shareDashboardPopupId,
          sharedEmails.join(","),
        );

        if (!data?.success) {
          toast.error("Dashboard Share Failed", { description: data?.detail });
          return;
        }
        if (posthog) {
          posthog.capture("shared_a_dashboard", {
            hasCustomWidgets: tabHasBYODWidgets,
            emails: sharedEmails,
            dashboard: shareDashboardPopupId,
          });
        }
      }
      if (sharedEmails.length > 0 && tabHasBYODWidgets && !inSnowflakeNativeApp) {
        toast.success("Dashboard shared permissions updated", {
          description:
            "Please note that shared users will not be able to view Data connectors widgets.",
        });
        dispatch({ shareWithEmail: "" });
      } else {
        toast.success("Dashboard shared permissions updated");
      }

      clearQueryCache();
      onClose();
    } catch (error) {
      // Handle error (e.g., show an error message)
      console.error("Failed to share the dashboard:", error);
    } finally {
      dispatch({ isSaving: false });
    }
  }, [
    state.shareWithEmail,
    isTrialOrg,
    shareDashboardPopupId,
    tabHasBYODWidgets,
    state.usersPermissions,
    clearQueryCache,
    onClose,
  ]);

  const users = useMemo(
    () =>
      Object.entries(data ?? {}).filter(([userEmail]) =>
        userEmail.includes(state.shareWithEmail),
      ),
    [data, state.shareWithEmail],
  );

  const showList = !isTrialOrg || users.length > 0;

  return (
    <BaseDialog
      open={!!shareDashboardPopupId && !closeDialog}
      onClose={onClose}
      className="w-[98vw] md:w-full lg:max-w-[500px]"
    >
      <DialogTitle>Share dashboard with</DialogTitle>
      <div className="flex flex-col gap-4">
        <Input
          label="Email"
          placeholder="Enter email"
          name="email"
          value={state.shareWithEmail}
          onChange={(shareWithEmail: string) => dispatch({ shareWithEmail })}
        />
        {showList && (
          <div className="space-y-2 bg-general-bg-secondary p-2.5 rounded">
            <p className="body-xs-medium uppercase text-ds-text-caption tracking-wide mb-4">
              {isTrialOrg ? "Shared with" : "Users from your organization"}
            </p>
            {users.length === 0 && (
              <div className="text-left body-xs-regular text-ds-text-caption">
                No users found with the email <strong>{state.shareWithEmail}</strong>
              </div>
            )}
            <div className="space-y-2 overflow-y-auto max-h-[300px] xl:max-h-[400px] 2xl:max-h-[500px] p-0.5">
              {users
                .sort(
                  // we need to sort by shared status and then by email. we need to use sharedDataInfo to see if the user is shared
                  (a, b) => {
                    const aShared = shareDataInfo?.[a[0]] ? 1 : 0;
                    const bShared = shareDataInfo?.[b[0]] ? 1 : 0;
                    if (aShared !== bShared) {
                      return bShared - aShared; // Prioritize shared users
                    }
                    return a[0].localeCompare(b[0]); // Then sort by email
                  },
                )
                .map(([email, data]) => {
                  return (
                    <div
                      key={email ?? ""}
                      className="flex gap-2 justify-between items-center"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          style={{
                            backgroundColor: getRandomUserListBackgroundByEmail(email),
                          }}
                          className="w-6 h-6 rounded-full inline-flex justify-center items-center text-white"
                        >
                          <span>
                            {data.first_name?.[0] ?? email[0].toUpperCase()}
                            {data.last_name?.[0] ?? ""}
                          </span>
                        </span>
                        <span className="flex flex-col items-start">
                          <span className="body-xs-regular text-ds-text-heading -mb-1">
                            {data.first_name} {data.last_name}
                          </span>
                          <span className="body-xs-regular text-ds-text-caption">
                            {email}
                          </span>
                        </span>
                      </span>
                      <div className="flex gap-2 items-center">
                        {/*shareDataInfo?.[email]?.created_date && (
                      <Tooltip
                        position="top"
                        message={formatDate(
                          new Date(shareDataInfo[email].created_date),
                        )}
                      >
                        <span className="obb-tag w-fit">Already shared</span>
                      </Tooltip>
                    )*/}

                        {/*<Checkbox
                      className="w-5 h-5"
                      name={email}
                      checked={checkedUsers[email]}
                      onCheckedChange={(isChecked) => {
                        handleCheckboxChange(email, !!isChecked);
                      }}
                    />*/}
                        <Tooltip
                          position="top"
                          open={state.tooltipEmail === email}
                          message={
                            shareDataInfo?.[email]?.created_date
                              ? `Shared on ${new Date(
                                  shareDataInfo[email].created_date,
                                ).toLocaleDateString()}`
                              : "No access to the dashboard"
                          }
                        >
                          <span
                            onPointerEnter={() => handleTooltipPointerEnter(email)}
                            onPointerLeave={handleTooltipPointerLeave}
                            onPointerDown={handleTooltipPointerLeave}
                          >
                            <Select
                              className="w-[120px]"
                              options={[
                                {
                                  label: "No Access",
                                  value: "no-access",
                                },
                                {
                                  label: "View",
                                  value: "view",
                                },
                              ]}
                              value={state.usersPermissions[email] ?? "no-access"}
                              onChange={(value: "view" | "edit" | "no-access") =>
                                dispatch({
                                  usersPermissions: (prev) => ({
                                    ...prev,
                                    [email]: value,
                                  }),
                                })
                              }
                            />
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="mt-2 flex items-center justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outlined" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="primary"
            size="sm"
            disabled={!showSaveChanges}
            loading={state.isSaving}
            loadingChildren={isTrialOrg ? "Sharing..." : "Saving..."}
            onClick={() => onSubmit()}
          >
            {isTrialOrg ? "Share" : "Save"}
          </Button>
        </div>
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
          <Icon id="warning-icon" className="text-[#F97316] size-5 mr-2" /> Widgets
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

// test the url we hit and the headers if they contain sensitive information

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

export function ShareDashboardDialog() {
  const { setShareDashboardPopupId, shareDashboardPopupId } = useThemeStore();
  const { getTabById } = useShallowAppStore((state) => ({
    getTabById: state.getTabById,
  }));

  // Extract the condition for hasFileWidgets into a separate variable
  const widgets = getTabById(shareDashboardPopupId)?.data?.widgets ?? [];

  const warningMessages = getWarningMessages(widgets);

  const [state, dispatch] = useStateReducer({
    acceptedFile: false,
    warningMessages,
    closeDialog: false,
  });

  useEffect(() => {
    if (state.closeDialog && shareDashboardPopupId) {
      setTimeout(() => setShareDashboardPopupId(null), 500);
    }
  }, [state.closeDialog, setShareDashboardPopupId]);

  return (
    <>
      {state.warningMessages.type && !state.acceptedFile && (
        <FileWarning
          onAccept={() => dispatch({ acceptedFile: true })}
          onClose={() => dispatch({ closeDialog: true })}
          api={state.warningMessages.api}
        />
      )}
      {shareDashboardPopupId &&
        !(state.warningMessages.type && !state.acceptedFile) && (
          <ShareDashboard
            closeDialog={state.closeDialog}
            onClose={() => dispatch({ closeDialog: true })}
          />
        )}
    </>
  );
}
