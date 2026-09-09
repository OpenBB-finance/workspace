import { apiClient } from "~/api/api";
import {
  type DeveloperAppDTO,
  developerAppToSubmission,
  incrementVersion,
  submissionFormToRequestBody,
} from "~/components/Apps/developerAppMapping";
import {
  allChecksPassed,
  evaluateSubmissionChecks,
  type SubmissionCheckMeta,
} from "~/components/Apps/submissionCheckUtils";
import type {
  MarketplaceSubmission,
  SubmissionCheck,
  SubmissionFormData,
  SubmissionTarget,
} from "~/types/marketplaceSubmission";

/**
 * Marketplace-submission service over the developer-marketplace backend
 * (`/marketplace/developer/apps`). The backend is the single source of truth;
 * React Query caches the list in memory and refetches on demand. A listing only
 * exists once submitted — before that it's a client-only {@link SubmissionTarget}
 * "new" seed held in the dialog.
 */

export const MARKETPLACE_SUBMISSIONS_QUERY_KEY = [
  "marketplace",
  "submissions",
] as const;

const DEVELOPER_APPS_PATH = "/marketplace/developer/apps";
const nowIso = () => new Date().toISOString();

export const EMPTY_SUBMISSION_FORM: SubmissionFormData = {
  appName: "",
  vendorName: "",
  vendorWebsiteUrl: "",
  vendorDescription: "",
  vendorThumbnailUrl: "",
  tagline: "",
  category: "",
  description: "",
  thumbnail: "",
  documentationUrl: "",
  contactEmail: "",
  screenshots: [],
  authEnabled: false,
  authMode: "api_key",
  authAllowAnonymous: false,
  authFields: [],
  mcpEnabled: false,
  mcpName: "",
  mcpUrl: "",
  mcpDescription: "",
  mcpAuthType: "oauth",
};

/** Backend snapshot the automated checks run against, derived from the target. */
function snapshotOf(target: SubmissionTarget): {
  backendUrl: string;
  widgetCount: number;
} {
  if (target.kind === "new") {
    return { backendUrl: target.seed.backendUrl, widgetCount: target.seed.widgetCount };
  }
  return {
    backendUrl: target.submission.backendUrl,
    widgetCount: target.submission.widgetCount,
  };
}

/**
 * Re-runs the automated checks server-request-side and throws if any fail. The
 * dialog already ran them via {@link runTests}, but this is the last gate before
 * a write, so it doesn't trust the caller to have done so.
 */
function assertChecksPassed(
  form: SubmissionFormData,
  snapshot: SubmissionCheckMeta,
): SubmissionCheck[] {
  const checks = evaluateSubmissionChecks(form, snapshot);
  if (!allChecksPassed(checks)) {
    throw new Error("Cannot submit: automated checks have not passed.");
  }
  return checks;
}

/** Ping reviewers after a submission is created or updated. Non-fatal if email fails. */
async function notifyReviewers(appId: string): Promise<void> {
  try {
    await apiClient.post(`${DEVELOPER_APPS_PATH}/${appId}/submit-for-review`, {});
  } catch {
    // non-fatal
  }
}

/** The caller's submissions — remote is the source of truth. */
export async function listSubmissions(): Promise<MarketplaceSubmission[]> {
  const { data } = await apiClient.get<DeveloperAppDTO[]>(DEVELOPER_APPS_PATH);
  return data.map(developerAppToSubmission);
}

/** Client-side pre-submit checks against the connected backend snapshot. */
export async function runTests(
  target: SubmissionTarget,
  form: SubmissionFormData,
): Promise<SubmissionCheck[]> {
  return evaluateSubmissionChecks(form, snapshotOf(target));
}

/**
 * Submit a new version of a published listing for review. Creates a sibling row
 * with a bumped version string, then emails the reviewers.
 */
export async function submitUpdate(
  target: Extract<SubmissionTarget, { kind: "update" }>,
  form: SubmissionFormData,
): Promise<MarketplaceSubmission> {
  const snapshot = snapshotOf(target);
  const checks = assertChecksPassed(form, snapshot);

  const version = incrementVersion(target.submission.version);
  const body = submissionFormToRequestBody(form, snapshot.backendUrl, version);

  const { data: created } = await apiClient.post<{ app_id: string }>(
    DEVELOPER_APPS_PATH,
    body,
  );
  await notifyReviewers(created.app_id);

  const ts = nowIso();
  return {
    id: created.app_id,
    backendUrl: snapshot.backendUrl,
    widgetCount: snapshot.widgetCount,
    version,
    status: "pending",
    form,
    checks,
    createdDate: ts,
    updatedDate: ts,
  };
}

/**
 * Submit for review. Rejects if the automated checks don't all pass. A new
 * listing is created (`POST` → `development` = pending); an existing one (a
 * pending edit or a rejected app being re-submitted) is `PATCH`ed, which clears
 * its rejection reason. Either way the reviewers are pinged, since both leave a
 * changed listing sitting in their queue.
 */
export async function submitForReview(
  target: SubmissionTarget,
  form: SubmissionFormData,
): Promise<MarketplaceSubmission> {
  if (target.kind === "update") {
    return submitUpdate(target, form);
  }

  const snapshot = snapshotOf(target);
  const checks = assertChecksPassed(form, snapshot);

  const body = submissionFormToRequestBody(form, snapshot.backendUrl);

  if (target.kind === "existing") {
    const { data } = await apiClient.patch<DeveloperAppDTO>(
      `${DEVELOPER_APPS_PATH}/${target.submission.id}`,
      body,
    );
    await notifyReviewers(target.submission.id);
    return developerAppToSubmission(data);
  }

  const { data: created } = await apiClient.post<{ app_id: string }>(
    DEVELOPER_APPS_PATH,
    body,
  );
  await notifyReviewers(created.app_id);

  const ts = nowIso();
  return {
    id: created.app_id,
    backendUrl: snapshot.backendUrl,
    widgetCount: snapshot.widgetCount,
    version: "1",
    status: "pending",
    form,
    checks,
    createdDate: ts,
    updatedDate: ts,
  };
}

/** Remove a submission (any non-published status; published needs an admin). */
export async function deleteSubmission(id: string): Promise<void> {
  await apiClient.delete(`${DEVELOPER_APPS_PATH}/${id}`);
}
