import type { AdminApp } from "~/api/adminMarketplace.api";
import type { SortState } from "~/components/ds/molecules/DataTable";
import { type MarketplaceTab, matchesTab } from "~/routes/admin/marketplaceStatus";

/**
 * Row shaping for the admin apps table. The list is fetched once and narrowed
 * client-side, so tab, search and sort are pure functions over the same array.
 */

/** Sort key for a column id. Dates compare as epoch ms, text case-insensitively. */
export function sortValue(app: AdminApp, id: string): string | number {
  switch (id) {
    case "name":
      return app.name.toLowerCase();
    case "vendor_name":
      return app.vendor_name.toLowerCase();
    case "version":
      return app.version.toLowerCase();
    case "status":
      return app.status;
    case "last_verified_at":
      return app.last_verified_at ? Date.parse(app.last_verified_at) : 0;
    case "updated_date":
      return app.updated_date ? Date.parse(app.updated_date) : 0;
    default:
      return "";
  }
}

export function sortApps(apps: AdminApp[], sort: SortState | null): AdminApp[] {
  if (!sort) return apps;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...apps].sort((a, b) => {
    const av = sortValue(a, sort.id);
    const bv = sortValue(b, sort.id);
    if (av < bv) return -1 * sign;
    if (av > bv) return 1 * sign;
    return 0;
  });
}

/** Tab + free-text narrowing, then sort. Search matches name, vendor or version. */
export function selectApps(
  apps: AdminApp[] | undefined,
  tab: MarketplaceTab,
  search: string,
  sort: SortState | null,
): AdminApp[] {
  const query = search.trim().toLowerCase();
  const rows = (apps ?? []).filter(
    (a) =>
      matchesTab(a.status, tab) &&
      (!query ||
        a.name.toLowerCase().includes(query) ||
        a.vendor_name.toLowerCase().includes(query) ||
        a.version.toLowerCase().includes(query)),
  );
  return sortApps(rows, sort);
}
