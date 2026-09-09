import type { AppStatus } from "~/routes/admin/marketplaceStatus";
import type { ListedAppMcpServer } from "~/types/listedApps";
import { apiClient } from "./api";

/**
 * Admin marketplace service over `/admin/marketplace/*` (superuser only).
 *
 * Unlike the developer endpoints, these responses are not camel-cased by the
 * backend, so the types below mirror `AdminAppResponse` in
 * `marketplace_schemas.py` field-for-field. A rename on either side surfaces as
 * silently blank table cells rather than a type error — keep them in step.
 */

export const ADMIN_MARKETPLACE_APPS_KEY = ["admin", "marketplace", "apps"] as const;
export const ADMIN_MARKETPLACE_WHITELIST_KEY = [
  "admin",
  "marketplace",
  "whitelist",
] as const;

export type MarketplaceAuthType = "none" | "api_key" | "custom";

export interface MarketplaceAuthField {
  id: string;
  label: string;
  key: string;
  prefix?: string | null;
}

export interface MarketplaceVerification {
  status: string;
  errors: string[];
  warnings: string[];
}

/** Mirror of `AdminAppResponse` (marketplace_schemas.py). */
export interface AdminApp {
  id: string;
  vendor_id: string;
  vendor_name: string;
  name: string;
  version: string;
  short_description: string | null;
  category: string | null;
  tagline: string | null;
  thumbnail_url: string | null;
  thumbnail_url_dark: string | null;
  thumbnail_url_light: string | null;
  media: string[];
  /** Deprecated alias for `media`, still emitted by the backend. */
  screenshots: string[];
  api_key_url: string | null;
  api_key_info_url: string | null;
  more_information_url: string | null;
  backend_base_url: string | null;
  apps_json_url: string | null;
  widgets_json_url: string | null;
  is_built_in: boolean;
  auth_type: MarketplaceAuthType[] | null;
  auth_fields: MarketplaceAuthField[] | null;
  status: AppStatus;
  created_date: string | null;
  updated_date: string | null;
  last_fetched_at: string | null;
  last_fetch_status: string | null;
  last_fetch_error: string | null;
  last_verified_at: string | null;
  rejection_reason: string | null;
  widgets_count: number | null;
  prompts_count: number | null;
  /**
   * Merged the same way as the public catalog: the app's stored override when
   * it has one, otherwise whatever its apps.json manifest declares. Nested keys
   * stay camelCase because the backend's `AppMCPServer` carries its own alias
   * generator, unlike the rest of this response.
   */
  mcp_servers: ListedAppMcpServer[] | null;
  verification: MarketplaceVerification | null;
}

export type AdminAppTransition = "publish" | "disable" | "enable" | "remove" | "verify";

export interface AppSubscriptionStats {
  app_id: string;
  app_name: string;
  active_count: number | null;
  total_count: number | null;
}

export interface WhitelistEntry {
  uuid: string;
  email: string;
  created_date: string;
}

const APPS_PATH = "/admin/marketplace/apps";
const WHITELIST_PATH = "/admin/marketplace/whitelist";

export async function listAdminApps(): Promise<AdminApp[]> {
  const { data } = await apiClient.get<AdminApp[]>(APPS_PATH);
  return data;
}

/** Editable subset of `AdminApp` fields the PATCH endpoint accepts. */
export type AdminAppUpdate = Partial<
  Pick<
    AdminApp,
    | "name"
    | "short_description"
    | "category"
    | "tagline"
    | "thumbnail_url"
    | "thumbnail_url_dark"
    | "thumbnail_url_light"
    | "media"
    | "api_key_url"
    | "api_key_info_url"
    | "more_information_url"
    | "backend_base_url"
    | "apps_json_url"
    | "widgets_json_url"
    | "is_built_in"
    | "auth_type"
    | "auth_fields"
  >
> & { owner_email?: string };

export async function updateAdminApp(
  id: string,
  payload: AdminAppUpdate,
): Promise<AdminApp> {
  const { data } = await apiClient.patch<AdminApp>(`${APPS_PATH}/${id}`, payload);
  return data;
}

export async function transitionAdminApp(
  id: string,
  action: AdminAppTransition,
): Promise<AdminApp> {
  const { data } = await apiClient.post<AdminApp>(`${APPS_PATH}/${id}/${action}`, {});
  return data;
}

export async function rejectAdminApp(id: string, reason: string): Promise<AdminApp> {
  const { data } = await apiClient.post<AdminApp>(`${APPS_PATH}/${id}/reject`, {
    reason,
  });
  return data;
}

export async function getAppSubscriptions(id: string): Promise<AppSubscriptionStats> {
  const { data } = await apiClient.get<AppSubscriptionStats>(
    `${APPS_PATH}/${id}/subscriptions`,
  );
  return data;
}

export async function listWhitelist(): Promise<WhitelistEntry[]> {
  const { data } = await apiClient.get<WhitelistEntry[]>(WHITELIST_PATH);
  return data;
}

export async function addWhitelist(email: string): Promise<WhitelistEntry> {
  const { data } = await apiClient.post<WhitelistEntry>(WHITELIST_PATH, { email });
  return data;
}

export async function deleteWhitelist(userUuid: string): Promise<void> {
  await apiClient.delete(`${WHITELIST_PATH}/${userUuid}`);
}

/** Superuser visibility probe — 200 for superusers, 401/403 otherwise. */
export async function validateMarketplaceAdmin(): Promise<{ success: boolean }> {
  const { data } = await apiClient.get<{ success: boolean }>(
    "/admin/marketplace/validate",
  );
  return data;
}
