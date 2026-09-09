import type { TagProps } from "~/components/ds/atoms/Tag";

/**
 * Admin marketplace app lifecycle. Mirrors the backend `TRANSITIONS` table
 * (`routers/marketplace.py`) so the row/dialog actions we offer never diverge
 * from what the server accepts.
 */
export type AppStatus =
  | "submitted"
  | "verified"
  | "development"
  | "published"
  | "disabled"
  | "removed";

/** Publish accepts `verified` or `development` (backend `/publish`). */
export function canPublish(status: AppStatus): boolean {
  return status === "verified" || status === "development";
}

/** Only a live app can be hidden. */
export function canDisable(status: AppStatus): boolean {
  return status === "published";
}

/** Only a disabled app can be brought back. */
export function canEnable(status: AppStatus): boolean {
  return status === "disabled";
}

/** Remove works from any status except the terminal `removed`. */
export function canRemove(status: AppStatus): boolean {
  return status !== "removed";
}

/** Reject only applies to a developer submission in review (`development`). */
export function canReject(status: AppStatus): boolean {
  return status === "development";
}

/** Re-verify is allowed from any status — re-fetching an app is never invalid. */
export const canVerify = (): boolean => true;

export type MarketplaceTab = "in-review" | "published" | "disabled" | "all";

export const MARKETPLACE_TABS: { id: MarketplaceTab; label: string }[] = [
  { id: "in-review", label: "In review" },
  { id: "published", label: "Published" },
  { id: "disabled", label: "Disabled" },
  { id: "all", label: "All" },
];

/** Client-side tab filter over the single fetched list. */
export function matchesTab(status: AppStatus, tab: MarketplaceTab): boolean {
  switch (tab) {
    case "in-review":
      return status === "submitted" || status === "development";
    case "published":
      return status === "published";
    case "disabled":
      return status === "disabled";
    case "all":
      return true;
  }
}

const STATUS_COLORS: Record<AppStatus, NonNullable<TagProps["color"]>> = {
  published: "success",
  submitted: "warning",
  development: "warning",
  verified: "brand",
  disabled: "grey",
  removed: "danger",
};

export function statusTagColor(status: AppStatus): NonNullable<TagProps["color"]> {
  return STATUS_COLORS[status] ?? "grey";
}
