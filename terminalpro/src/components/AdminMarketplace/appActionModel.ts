import type { AdminApp } from "~/api/adminMarketplace.api";
import type { IconId } from "~/components/Icon.types";
import {
  type AppStatus,
  canDisable,
  canEnable,
  canPublish,
  canReject,
  canRemove,
  canVerify,
} from "~/routes/admin/marketplaceStatus";

export type MarketplaceAction =
  | "verify"
  | "publish"
  | "disable"
  | "enable"
  | "reject"
  | "remove";

interface ActionDescriptor {
  action: MarketplaceAction;
  label: string;
  icon: IconId;
  allowed: (status: AppStatus) => boolean;
  /** Why the action is unavailable in the current status. */
  disabledReason: string;
}

const DESCRIPTORS: ActionDescriptor[] = [
  {
    action: "verify",
    label: "Re-verify",
    icon: "refresh-icon-ds",
    allowed: canVerify,
    disabledReason: "",
  },
  {
    action: "publish",
    label: "Publish",
    icon: "check",
    allowed: canPublish,
    disabledReason: "Only a verified or in-review app can be published",
  },
  {
    action: "disable",
    label: "Disable",
    icon: "eye-closed-icon",
    allowed: canDisable,
    disabledReason: "Only a published app can be disabled",
  },
  {
    action: "enable",
    label: "Enable",
    icon: "eye-opened-icon",
    allowed: canEnable,
    disabledReason: "Only a disabled app can be re-enabled",
  },
  {
    action: "reject",
    label: "Reject",
    icon: "cross-icon",
    allowed: canReject,
    disabledReason: "Only an in-review submission can be rejected",
  },
  {
    action: "remove",
    label: "Remove",
    icon: "trash-icon",
    allowed: canRemove,
    disabledReason: "This app is already removed",
  },
];

export interface ResolvedAction {
  action: MarketplaceAction;
  label: string;
  icon: IconId;
  enabled: boolean;
  /** Tooltip text — the label when enabled, the reason when not. */
  tooltip: string;
}

export function resolveActions(app: AdminApp): ResolvedAction[] {
  return DESCRIPTORS.map((d) => {
    const enabled = d.allowed(app.status);
    return {
      action: d.action,
      label: d.label,
      icon: d.icon,
      enabled,
      tooltip: enabled ? d.label : d.disabledReason,
    };
  });
}
