/**
 * Developer-side marketplace submission lifecycle.
 *
 * A submission moves: pending (submitted for review) -> approved (live/public)
 * | rejected (feedback + resubmit). The backend (`/marketplace/developer/apps`)
 * is the single source of truth — a submission only exists once it's been
 * created there. A not-yet-submitted listing is a {@link NewListingSeed}, held
 * only in the open dialog.
 */

import type { McpServerAuthType } from "~/types/listedApps";

export type SubmissionStatus = "pending" | "approved" | "rejected";

/** App-level auth mode declared in the submission dialog (maps to backend auth_type). */
export type SubmissionAuthMode = "none" | "api_key" | "custom";

/** One custom auth header row; id is derived from label at submit time. */
export interface SubmissionAuthFieldRow {
  label: string;
  key: string;
  prefix: string;
}

/** Listing metadata authored by the developer in the submission form. */
export interface SubmissionFormData {
  appName: string;
  vendorName: string;
  /** Vendor's public website URL, shown on the listing. */
  vendorWebsiteUrl: string;
  /** Short company/vendor blurb authored in the vendor-profile step. */
  vendorDescription: string;
  /** Square company logo shown as the icon on marketplace cards + details. */
  vendorThumbnailUrl: string;
  tagline: string;
  category: string;
  description: string;
  /** Hosted image URL shown as the listing thumbnail. */
  thumbnail: string;
  documentationUrl: string;
  contactEmail: string;
  /** Gallery image URLs shown in the details-view carousel. */
  screenshots: string[];
  /**
   * When false, the create/update body omits auth_type/auth_fields (backend
   * default `["api_key"]` is preserved). Distinct from mode `"none"`.
   */
  authEnabled: boolean;
  authMode: SubmissionAuthMode;
  /** When true and mode is api_key/custom, also allow anonymous access. */
  authAllowAnonymous: boolean;
  authFields: SubmissionAuthFieldRow[];
  /**
   * When false, the create/update body omits `mcp_servers`, leaving whatever is
   * stored untouched and letting the backend derive servers from the vendor's
   * apps.json. Seeded from `storedMcpServers`, never from the merged
   * `mcpServers` — see {@link DeveloperAppDTO}.
   */
  mcpEnabled: boolean;
  mcpName: string;
  mcpUrl: string;
  mcpDescription: string;
  mcpAuthType: McpServerAuthType;
}

export type SubmissionCheckId =
  | "backend-reachable"
  | "required-fields"
  | "has-widgets"
  | "valid-thumbnail"
  | "valid-contact-email";

export type SubmissionCheckStatus = "idle" | "running" | "passed" | "failed";

export interface SubmissionCheck {
  id: SubmissionCheckId;
  label: string;
  status: SubmissionCheckStatus;
  /** Specific failure reason, shown inline when {@link status} is `"failed"`. */
  error?: string;
}

export interface MarketplaceSubmission {
  id: string;
  /** Backend metadata snapshot used by automated checks. Not user-editable. */
  backendUrl: string;
  widgetCount: number;
  /** App version string from the backend (e.g. "1", "1.0"). */
  version: string;
  status: SubmissionStatus;
  form: SubmissionFormData;
  /** Last automated-check run; `undefined` until the developer runs tests. */
  checks?: SubmissionCheck[];
  /** Reviewer feedback, present when {@link status} is `"rejected"`. */
  rejectionFeedback?: string;
  createdDate: string;
  updatedDate: string;
}

/**
 * A not-yet-created listing for a connected backend. Lives only in the open
 * submission dialog — the snapshot fields seed the form + automated checks until
 * it's submitted and becomes a {@link MarketplaceSubmission} on the backend.
 */
export interface NewListingSeed {
  /** `id` of the connected backend (Source) this listing wraps. */
  backendSourceId: string;
  appName: string;
  backendUrl: string;
  widgetCount: number;
  /**
   * Absolute URL of the connected backend's existing app cover (apps.json
   * thumbnail), if any — used to pre-fill the cover field so vendors don't
   * re-supply an image they already have.
   */
  existingCover?: string;
}

/** What the submission dialog operates on: a brand-new listing or an existing one. */
export type SubmissionTarget =
  | { kind: "new"; seed: NewListingSeed }
  | { kind: "existing"; submission: MarketplaceSubmission }
  | { kind: "update"; submission: MarketplaceSubmission };
