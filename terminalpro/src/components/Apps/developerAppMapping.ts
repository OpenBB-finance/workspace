import type { ListedAppMcpServer } from "~/types/listedApps";
import type {
  MarketplaceSubmission,
  SubmissionAuthMode,
  SubmissionFormData,
  SubmissionStatus,
} from "~/types/marketplaceSubmission";
import { buildAuthFields, buildAuthTypes } from "./submissionAuth";

/**
 * Maps between the developer-marketplace backend (`/marketplace/developer/apps`,
 * `VendorApp`) and the FE {@link MarketplaceSubmission} shape. The backend has no
 * "pending/rejected" status — it uses `development` for an owner-only app and a
 * `rejection_reason` set by a reviewer — so we derive the FE status here:
 *   development (no reason) -> pending · development + reason -> rejected ·
 *   published/disabled -> approved.
 */

/** camelCase response from GET/PATCH /marketplace/developer/apps (DeveloperAppResponse). */
export interface DeveloperAppDTO {
  id: string;
  appName: string;
  vendorName: string;
  description?: string;
  backendUrl?: string;
  thumbnail?: string;
  vendorThumbnailUrl?: string | null;
  vendorWebsiteUrl?: string | null;
  vendorDescription?: string | null;
  contactEmail?: string | null;
  documentationUrl?: string | null;
  category?: string | null;
  tagline?: string | null;
  media?: string[];
  screenshots?: string[];
  totalWidgets?: number;
  status: string;
  rejectionReason?: string | null;
  lastFetchStatus?: string | null;
  lastFetchError?: string | null;
  version?: string;
  createdDate?: string;
  updatedDate?: string;
  /** App-level auth strategy; absent/empty/`["api_key"]` maps to form toggle off. */
  authType?: ("api_key" | "none" | "custom")[];
  authFields?: {
    id: string;
    label: string;
    key: string;
    prefix?: string | null;
  }[];
  /**
   * The stored MCP override only — the backend's `mcpServers` merges this with
   * servers derived from the vendor's apps.json. Seeding the form from the
   * merged list would promote a manifest-derived server into stored config on
   * the next PATCH, freezing it against later apps.json updates.
   */
  storedMcpServers?: ListedAppMcpServer[] | null;
}

function mapStatus(status: string, rejectionReason?: string | null): SubmissionStatus {
  if (status === "published" || status === "disabled") return "approved";
  if (rejectionReason) return "rejected";
  // development / submitted / verified with no reviewer feedback = awaiting review.
  return "pending";
}

/** Seed dialog auth fields from a developer-app DTO (lossless for default api_key). */
function seedAuthFromDto(
  dto: DeveloperAppDTO,
): Pick<
  SubmissionFormData,
  "authEnabled" | "authMode" | "authAllowAnonymous" | "authFields"
> {
  const authType = dto.authType;
  const isDefaultApiKey =
    !authType?.length || (authType.length === 1 && authType[0] === "api_key");

  let authMode: SubmissionAuthMode = "api_key";
  if (authType?.includes("custom")) authMode = "custom";
  else if (authType?.includes("api_key")) authMode = "api_key";
  else if (authType?.includes("none")) authMode = "none";

  return {
    // OFF + omit on PATCH leaves stored `["api_key"]` untouched.
    authEnabled: !isDefaultApiKey,
    authMode,
    authAllowAnonymous: !!authType?.includes("none") && (authType?.length ?? 0) > 1,
    authFields: (dto.authFields ?? []).map((f) => ({
      label: f.label,
      key: f.key,
      prefix: f.prefix ?? "",
    })),
  };
}

/**
 * Seed the dialog's MCP section from a developer-app DTO. Only a stored
 * override turns the section on; a manifest-derived server stays off so it
 * keeps tracking the vendor's apps.json.
 */
function seedMcpFromDto(
  dto: DeveloperAppDTO,
): Pick<
  SubmissionFormData,
  "mcpEnabled" | "mcpName" | "mcpUrl" | "mcpDescription" | "mcpAuthType"
> {
  // The backend only ever reads the first server, so the dialog edits one.
  const stored = dto.storedMcpServers?.[0];
  return {
    mcpEnabled: !!stored,
    mcpName: stored?.name ?? "",
    mcpUrl: stored?.url ?? "",
    mcpDescription: stored?.description ?? "",
    mcpAuthType: stored?.authType === "token" ? "token" : "oauth",
  };
}

/** Bumps a version string for a new listing revision (e.g. "1" → "2", "1.0" → "1.1"). */
export function incrementVersion(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) return "2";
  if (/^\d+$/.test(trimmed)) {
    return String(Number.parseInt(trimmed, 10) + 1);
  }
  const parts = trimmed.split(".");
  const last = parts[parts.length - 1] ?? "";
  if (/^\d+$/.test(last)) {
    parts[parts.length - 1] = String(Number.parseInt(last, 10) + 1);
    return parts.join(".");
  }
  return `${trimmed}.1`;
}

export function developerAppToSubmission(dto: DeveloperAppDTO): MarketplaceSubmission {
  const screenshots = dto.media ?? dto.screenshots ?? [];
  return {
    id: dto.id,
    backendUrl: dto.backendUrl ?? "",
    widgetCount: dto.totalWidgets ?? 0,
    version: dto.version ?? "1",
    status: mapStatus(dto.status, dto.rejectionReason),
    form: {
      appName: dto.appName ?? "",
      vendorName: dto.vendorName ?? "",
      vendorWebsiteUrl: dto.vendorWebsiteUrl ?? "",
      vendorDescription: dto.vendorDescription ?? "",
      vendorThumbnailUrl: dto.vendorThumbnailUrl ?? "",
      tagline: dto.tagline ?? "",
      category: dto.category ?? "",
      description: dto.description ?? "",
      thumbnail: dto.thumbnail ?? "",
      documentationUrl: dto.documentationUrl ?? "",
      contactEmail: dto.contactEmail ?? "",
      screenshots,
      ...seedAuthFromDto(dto),
      ...seedMcpFromDto(dto),
    },
    rejectionFeedback: dto.rejectionReason ?? undefined,
    createdDate: dto.createdDate ?? "",
    updatedDate: dto.updatedDate ?? "",
  };
}

/** Maps the submission form to the developer create/update request body (snake_case). */
export function submissionFormToRequestBody(
  form: SubmissionFormData,
  backendUrl: string,
  version?: string,
) {
  return {
    vendor_name: form.vendorName,
    vendor_description: form.vendorDescription || undefined,
    vendor_website_url: form.vendorWebsiteUrl || undefined,
    vendor_thumbnail_url: form.vendorThumbnailUrl || undefined,
    contact_email: form.contactEmail || undefined,
    documentation_url: form.documentationUrl || undefined,
    app_name: form.appName,
    short_description: form.description,
    category: form.category || undefined,
    tagline: form.tagline || undefined,
    thumbnail_url: form.thumbnail || undefined,
    media: form.screenshots.filter((url) => url.trim()),
    backend_base_url: backendUrl,
    ...(version ? { version } : {}),
    ...(form.authEnabled
      ? {
          auth_type: buildAuthTypes(form),
          ...(form.authMode === "custom" ? { auth_fields: buildAuthFields(form) } : {}),
        }
      : {}),
    // Omitted when off so the backend keeps deriving servers from the vendor's
    // apps.json (and leaves any stored override alone on PATCH).
    ...(form.mcpEnabled
      ? {
          mcp_servers: [
            {
              name: form.mcpName.trim(),
              url: form.mcpUrl.trim(),
              ...(form.mcpDescription.trim()
                ? { description: form.mcpDescription.trim() }
                : {}),
              ...(form.mcpAuthType === "token" ? { auth_type: "token" } : {}),
            },
          ],
        }
      : {}),
  };
}
