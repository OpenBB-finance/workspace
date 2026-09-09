import type {
  MarketplaceSubmission,
  SubmissionTarget,
} from "~/types/marketplaceSubmission";

/**
 * Picks which submission row the listing dialog should operate on. Versioning
 * means one listing can span several backend rows — a live v1 alongside an
 * in-review v2 — so "the submission for this app" is a choice, not a lookup.
 */

/** Backend identity of a listing across its versions (unique per vendor+name). */
function listingKey(submission: MarketplaceSubmission): string {
  return `${submission.form.vendorName}::${submission.form.appName}`;
}

/**
 * Whether a live listing already has a revision in review or rejected. The next
 * version is derived from the live row, so a second update would re-use the
 * version string the open revision already took and the backend would 409.
 */
export function hasOpenRevision(
  submission: MarketplaceSubmission,
  submissions: MarketplaceSubmission[],
): boolean {
  const key = listingKey(submission);
  return submissions.some(
    (s) => s.id !== submission.id && s.status !== "approved" && listingKey(s) === key,
  );
}

/**
 * The dialog target for a connected backend that may already be listed: edit the
 * row still open for review, else propose a new version of the live listing
 * (published rows reject `PATCH`). `null` means it isn't listed yet, so the
 * caller seeds a brand-new listing.
 */
export function targetForBackendUrl(
  submissions: MarketplaceSubmission[],
  backendUrl: string,
): SubmissionTarget | null {
  if (!backendUrl) return null;
  const siblings = submissions.filter((s) => s.backendUrl === backendUrl);
  const openRevision = siblings.find((s) => s.status !== "approved");
  if (openRevision) return { kind: "existing", submission: openRevision };
  const live = siblings.find((s) => s.status === "approved");
  return live ? { kind: "update", submission: live } : null;
}
