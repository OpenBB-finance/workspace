import type { AdminApp } from "~/api/adminMarketplace.api";
import { previewPrompts, previewWidgets } from "~/components/Apps/appPreview";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import { noop } from "~/lib/utils";
import type { ListedApp } from "~/types/listedApps";

/**
 * Map an admin marketplace app to the {@link ListedApp} shape used by card and
 * details previews. Mirrors {@link submissionToListedApp} so admin Final Preview
 * reuses the same marketplace surfaces. Vendor profile fields not on AdminApp
 * are intentionally left undefined (no extra API).
 */
export function adminAppToListedApp(app: AdminApp): ListedApp {
  const widgetCount = app.widgets_count ?? 0;
  // Only the counts are available here, not the widget/prompt lists.
  const widgets = previewWidgets(widgetCount);
  const media = app.media?.length ? app.media : app.screenshots;
  const promptsCount = app.prompts_count ?? 0;

  return {
    id: app.id,
    vendorName: app.vendor_name,
    appName: app.name,
    description: app.short_description ?? "",
    backendUrl: app.backend_base_url ?? "",
    thumbnail: app.thumbnail_url ?? "",
    thumbnailDark: app.thumbnail_url_dark ?? undefined,
    thumbnailLight: app.thumbnail_url_light ?? undefined,
    version: app.version,
    apiKeyUrl: app.api_key_url ?? undefined,
    apiKeyInfoUrl: app.api_key_info_url ?? undefined,
    documentationUrl: app.more_information_url ?? undefined,
    widgets,
    totalWidgets: widgetCount,
    prompts: promptsCount > 0 ? previewPrompts(promptsCount) : undefined,
    screenshots: media?.length ? media : undefined,
    media: media?.length ? media : undefined,
    isBuiltIn: app.is_built_in,
    authType: app.auth_type ?? undefined,
    authFields: app.auth_fields
      ? app.auth_fields.map((f) => ({
          id: f.id,
          label: f.label,
          key: f.key,
          prefix: f.prefix ?? undefined,
        }))
      : undefined,
    mcpServers: app.mcp_servers?.length ? app.mcp_servers : undefined,
    createdDate: app.created_date ?? undefined,
    updatedDate: app.updated_date ?? undefined,
    category: app.category ?? undefined,
    tagline: app.tagline ?? undefined,
  };
}

/** Thin AppTemplate for the "General card" (My Apps) preview surface. */
export function adminAppToAppTemplate(app: AdminApp): AppTemplate {
  const listed = adminAppToListedApp(app);
  return {
    id: app.id,
    name: listed.appName,
    description: listed.description,
    type: "listed",
    widgets: listed.widgets,
    totalWidgets: listed.totalWidgets,
    prompts: listed.prompts ?? [],
    img: listed.thumbnail || undefined,
    vendorName: listed.vendorName,
    onClick: noop,
  };
}
