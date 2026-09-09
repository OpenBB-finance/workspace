import { appSupportsAnonymousAccess, type ListedApp } from "~/types/listedApps";

export type SortValue =
  | "newest"
  | "oldest"
  | "app-a-z"
  | "app-z-a"
  | "vendor-a-z"
  | "vendor-z-a"
  | undefined;

const NEW_TAG_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** An app is "new" when it was listed within the last 7 days. */
export function isNewListedApp(createdDate: string | undefined): boolean {
  if (!createdDate) return false;
  const created = Date.parse(createdDate);
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= NEW_TAG_THRESHOLD_MS;
}

function parseCreatedDate(value: string | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = Date.parse(value);
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

/**
 * Sort listed apps for the marketplace grid. Returns a new array.
 *
 * In the default ordering (no explicit `sortBy`), apps that show the "New" tag
 * — recent, unsubscribed, and not built-in, matching `ListedAppCard`'s `isNew`
 * — are pinned to the top. Explicit sorts are respected as-is and do not pin.
 */
export function sortListedApps(
  apps: ListedApp[],
  sortBy: SortValue,
  subscribedAppIds: string[],
): ListedApp[] {
  const effectiveSort = sortBy ?? "app-a-z";
  const isDateSort = effectiveSort === "newest" || effectiveSort === "oldest";
  const isDefaultSort = sortBy == null;

  const isNewApp = (app: ListedApp) =>
    !subscribedAppIds.includes(app.id) &&
    !app.isBuiltIn &&
    isNewListedApp(app.createdDate);

  return [...apps].sort((a, b) => {
    if (isDefaultSort) {
      const aNew = isNewApp(a);
      const bNew = isNewApp(b);
      if (aNew !== bNew) return aNew ? -1 : 1;
    }

    if (!isDateSort) {
      const aIncluded = appSupportsAnonymousAccess(a);
      const bIncluded = appSupportsAnonymousAccess(b);
      if (aIncluded !== bIncluded) return aIncluded ? -1 : 1;
    }

    switch (effectiveSort) {
      case "newest": {
        const diff = parseCreatedDate(b.createdDate) - parseCreatedDate(a.createdDate);
        return diff !== 0 ? diff : a.appName.localeCompare(b.appName);
      }
      case "oldest": {
        const aTime = parseCreatedDate(a.createdDate);
        const bTime = parseCreatedDate(b.createdDate);
        const aHas = aTime !== Number.NEGATIVE_INFINITY;
        const bHas = bTime !== Number.NEGATIVE_INFINITY;
        if (aHas !== bHas) return aHas ? -1 : 1;
        const diff = aTime - bTime;
        return diff !== 0 ? diff : a.appName.localeCompare(b.appName);
      }
      case "app-a-z":
        return a.appName.localeCompare(b.appName);
      case "app-z-a":
        return b.appName.localeCompare(a.appName);
      case "vendor-a-z":
        return (
          a.vendorName.localeCompare(b.vendorName) || a.appName.localeCompare(b.appName)
        );
      case "vendor-z-a":
        return (
          b.vendorName.localeCompare(a.vendorName) || a.appName.localeCompare(b.appName)
        );
      default:
        return a.appName.localeCompare(b.appName);
    }
  });
}
