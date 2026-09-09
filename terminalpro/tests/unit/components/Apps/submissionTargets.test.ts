import { describe, expect, it } from "vitest";
import {
  hasOpenRevision,
  targetForBackendUrl,
} from "~/components/Apps/submissionTargets";
import type {
  MarketplaceSubmission,
  SubmissionStatus,
} from "~/types/marketplaceSubmission";

function makeSubmission(
  id: string,
  status: SubmissionStatus,
  overrides: Partial<MarketplaceSubmission> = {},
): MarketplaceSubmission {
  return {
    id,
    backendUrl: "https://api.acme.com",
    widgetCount: 2,
    version: "1",
    status,
    form: {
      appName: "Acme Options",
      vendorName: "Acme",
      vendorWebsiteUrl: "https://acme.com",
      vendorDescription: "Acme builds options analytics.",
      vendorThumbnailUrl: "",
      tagline: "",
      category: "Options",
      description: "Options analytics",
      thumbnail: "https://cdn.acme.com/thumb.png",
      documentationUrl: "",
      contactEmail: "dev@acme.com",
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
    },
    createdDate: "",
    updatedDate: "",
    ...overrides,
  };
}

describe("hasOpenRevision", () => {
  it("is false when the live listing is the only row", () => {
    const live = makeSubmission("a", "approved");
    expect(hasOpenRevision(live, [live])).toBe(false);
  });

  it("is true when a sibling revision is awaiting review", () => {
    const live = makeSubmission("a", "approved");
    const pending = makeSubmission("b", "pending", { version: "2" });
    expect(hasOpenRevision(live, [live, pending])).toBe(true);
  });

  it("is true when a sibling revision was rejected — it should be fixed, not re-created", () => {
    const live = makeSubmission("a", "approved");
    const rejected = makeSubmission("b", "rejected", { version: "2" });
    expect(hasOpenRevision(live, [live, rejected])).toBe(true);
  });

  it("ignores rows belonging to a different listing", () => {
    const live = makeSubmission("a", "approved");
    const other = makeSubmission("b", "pending", {
      form: { ...live.form, appName: "Acme Futures" },
    });
    expect(hasOpenRevision(live, [live, other])).toBe(false);
  });

  it("ignores another vendor's app with the same name", () => {
    const live = makeSubmission("a", "approved");
    const other = makeSubmission("b", "pending", {
      form: { ...live.form, vendorName: "Globex" },
    });
    expect(hasOpenRevision(live, [live, other])).toBe(false);
  });
});

describe("targetForBackendUrl", () => {
  const url = "https://api.acme.com";

  it("returns null when the backend isn't listed yet", () => {
    expect(targetForBackendUrl([], url)).toBeNull();
  });

  it("returns null for an empty backend url", () => {
    expect(targetForBackendUrl([makeSubmission("a", "pending")], "")).toBeNull();
  });

  it("edits the row still open for review", () => {
    const pending = makeSubmission("a", "pending");
    expect(targetForBackendUrl([pending], url)).toEqual({
      kind: "existing",
      submission: pending,
    });
  });

  it("proposes a new version when the only row is live", () => {
    const live = makeSubmission("a", "approved");
    expect(targetForBackendUrl([live], url)).toEqual({
      kind: "update",
      submission: live,
    });
  });

  // A live v1 and an in-review v2 share a backend url. PATCHing the published
  // row is rejected by the backend, so the open revision must win regardless of
  // which row the list happens to return first.
  it("prefers the open revision over the live listing", () => {
    const live = makeSubmission("a", "approved");
    const pending = makeSubmission("b", "pending", { version: "2" });
    expect(targetForBackendUrl([live, pending], url)).toEqual({
      kind: "existing",
      submission: pending,
    });
  });

  it("ignores submissions for other backends", () => {
    const other = makeSubmission("a", "pending", {
      backendUrl: "https://api.globex.com",
    });
    expect(targetForBackendUrl([other], url)).toBeNull();
  });
});
