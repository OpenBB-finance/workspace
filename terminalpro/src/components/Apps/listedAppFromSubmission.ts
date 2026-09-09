import type { ListedApp } from "~/types/listedApps";
import type { MarketplaceSubmission } from "~/types/marketplaceSubmission";
import { buildAuthFields, buildAuthTypes } from "./submissionAuth";

/**
 * Map an owner submission to the {@link ListedApp} shape the marketplace cards
 * and details view render from. Shared by the marketplace tab (owner cards) and
 * the submission dialog's live preview so both stay in sync.
 */
export function submissionToListedApp(sub: MarketplaceSubmission): ListedApp {
  const screenshots = sub.form.screenshots?.filter((url) => url.trim());
  const { form } = sub;
  return {
    id: sub.id,
    vendorName: form.vendorName || form.appName || "Your app",
    appName: form.appName || "Untitled app",
    description: form.description,
    backendUrl: sub.backendUrl,
    thumbnail: form.thumbnail,
    widgets: [],
    category: form.category || undefined,
    tagline: form.tagline || undefined,
    documentationUrl: form.documentationUrl || undefined,
    contactEmail: form.contactEmail || undefined,
    screenshots: screenshots?.length ? screenshots : undefined,
    vendorWebsiteUrl: form.vendorWebsiteUrl || undefined,
    vendorDescription: form.vendorDescription || undefined,
    vendorThumbnailUrl: form.vendorThumbnailUrl || undefined,
    createdDate: sub.createdDate,
    authType: form.authEnabled ? buildAuthTypes(form) : undefined,
    authFields:
      form.authEnabled && form.authMode === "custom"
        ? buildAuthFields(form)
        : undefined,
    mcpServers: form.mcpEnabled
      ? [
          {
            name: form.mcpName.trim(),
            url: form.mcpUrl.trim(),
            description: form.mcpDescription.trim() || undefined,
            authType: form.mcpAuthType,
          },
        ]
      : undefined,
  };
}
