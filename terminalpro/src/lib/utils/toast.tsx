import type { ReactNode } from "react";
import { toast } from "sonner";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { useToastStore } from "~/lib/state/toast";

export enum NotificationId {
  SaveDashboards = "save-dashboards",
  DeleteDashboard = "delete-dashboard",
  DeleteDashboardShared = "delete-dashboard-shared",
  WidgetMoved = "widget-moved",
  AccountRemoved = "account-removed",
  AccountResetPassword = "account-reset-password",
  AccountReset2FA = "account-reset-2fa",
  Account2FAToggled = "account-2fa-toggled",
  WidgetRemoved = "widget-removed",
  NavWidgetRemoved = "nav-widget-removed",
  NavTabRemoved = "nav-tab-removed",
  NavTabsDeleted = "nav-tabs-deleted",
  FolderCreated = "folder-created",
  GroupNotEmpty = "group-not-empty",
  DashboardRenamed = "dashboard-renamed",
  FolderRenamed = "folder-renamed",
  DeleteFolder = "delete-folder",
  DeleteFolderShared = "delete-folder-shared",
  DeleteFolderDynamic = "delete-folder-dynamic",
  DashboardRemoved = "dashboard-removed",
  DashboardDuplicated = "dashboard-duplicated",
  DashboardCreated = "dashboard-created",
  WidgetRemovedInfo = "widget-removed-info",
  DeleteWidget = "delete-widget",
  DeletedTabs = "deleted-tabs",
  DeleteTab = "delete-tab",
  WidgetRemovedDC = "widget-removed-dc",
  DeleteSharedDashboard = "delete-shared-dashboard",
  ConfigureFilePermissions = "configure-file-permissions",
  ConfigureBackendPermissions = "configure-backend-permissions",
  WebsiteNotEmbeddable = "website-not-embeddable",
}

export interface ShowNotificationProps {
  id?: string;
  message: string;
  description?: string | ReactNode;
  cancel?: {
    label: string;
    onClick: () => void;
  };
  action?: {
    label: string;
    onClick: () => void;
  };
  toastType?: "warning" | "error" | "success" | "info";
  withClose?: boolean;
}

interface WithRememberMeProps extends Omit<ShowNotificationProps, "withClose"> {
  id: NotificationId | `${NotificationId}:${string}`;
  rememberOptionLabel?: string;
  action?: {
    label: string;
    onClick: (dontShowAgain?: boolean | undefined) => void;
  };
}

export function showNotificationWithRememberMe(props: WithRememberMeProps) {
  const {
    id,
    message,
    description = "",
    rememberOptionLabel = "Don't show me again",
    cancel,
    action = {
      label: "Confirm",
      onClick: () => {},
    },
    toastType,
  } = props;

  const toastId = id?.split?.(":")?.[0] as NotificationId;

  const toastDontShowAgain = useToastStore.getState().getToastDontShowAgain(toastId);

  if (toastDontShowAgain) {
    action.onClick(toastDontShowAgain);
  } else {
    const toastFunction = toast[toastType] || toast.warning; // Default to warning if type is not valid

    toastFunction(message, {
      id,
      description: (
        <>
          {description}
          <div className="mt-2 [&_.BB-Checkbox]:!border-light-800 [&_.BB-Checkbox]:!bg-transparent [&_.BB-Checkbox]:hover:!border-light-800 [&_.BB-Checkbox[data-state=checked]]:!border-brand-main [&_.BB-Checkbox[data-state=checked]]:!bg-brand-main [&_.BB-Checkbox[data-state=checked]]:!text-white [&_label]:!text-light-900">
            {id && <Checkbox id={id} label={rememberOptionLabel} />}
          </div>
        </>
      ),
      style: { pointerEvents: "auto" },
      cancel: cancel
        ? {
            label: cancel.label,
            onClick: () => {
              if (!id) return cancel.onClick();
              const isChecked =
                document.getElementById(id).getAttribute("data-state") === "checked";
              if (isChecked) {
                useToastStore.getState().setToastDontShowAgain(toastId, isChecked);
              }
              cancel.onClick();
            },
          }
        : undefined,
      action: {
        label: action.label,
        onClick: () => {
          if (!id) return action.onClick();
          const isChecked =
            document.getElementById(id).getAttribute("data-state") === "checked";
          if (isChecked) {
            useToastStore.getState().setToastDontShowAgain(toastId, isChecked);
          }
          action.onClick();
        },
      },
    });
  }
}

export function showNotification(props: ShowNotificationProps) {
  const { id, message, description = "", toastType, action, withClose = false } = props;

  if (withClose && !props?.cancel?.onClick) {
    props.cancel = {
      label: "Close",
      onClick: () => {},
    };
  }

  const toastFunction = toast[toastType] || toast.warning; // Default to warning if type is not valid

  toastFunction(message, {
    id: id ?? message,
    description: description ? <div className="mb-2">{description}</div> : undefined,
    action,
    cancel: props.cancel,
    style: { pointerEvents: "auto", paddingBottom: "16px" },
  });
}
