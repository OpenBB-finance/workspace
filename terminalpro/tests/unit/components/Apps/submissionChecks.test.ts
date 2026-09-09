import { describe, expect, it } from "vitest";
import {
  allChecksPassed,
  evaluateSubmissionChecks,
  type SubmissionCheckMeta,
} from "~/components/Apps/submissionCheckUtils";
import type { SubmissionCheck, SubmissionFormData } from "~/types/marketplaceSubmission";

const validForm: SubmissionFormData = {
  appName: "Acme Options",
  vendorName: "Acme",
  vendorWebsiteUrl: "https://acme.com",
  vendorDescription: "Acme builds options analytics.",
  vendorThumbnailUrl: "",
  tagline: "Options flow",
  category: "Options",
  description: "Real-time options analytics.",
  thumbnail: "https://cdn.acme.com/thumb.png",
  documentationUrl: "https://docs.acme.com",
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
};

const validMeta: SubmissionCheckMeta = {
  backendUrl: "https://api.acme.com",
  widgetCount: 5,
};

const byId = (checks: SubmissionCheck[], id: SubmissionCheck["id"]) =>
  checks.find((c) => c.id === id) as SubmissionCheck;

describe("evaluateSubmissionChecks", () => {
  it("passes every check for a complete, valid submission", () => {
    const checks = evaluateSubmissionChecks(validForm, validMeta);
    expect(checks).toHaveLength(5);
    expect(checks.every((c) => c.status === "passed")).toBe(true);
    expect(allChecksPassed(checks)).toBe(true);
  });

  it("fails required-fields and names the missing fields", () => {
    const checks = evaluateSubmissionChecks(
      { ...validForm, appName: "  ", category: "" },
      validMeta,
    );
    const required = byId(checks, "required-fields");
    expect(required.status).toBe("failed");
    expect(required.error).toContain("App name");
    expect(required.error).toContain("Category");
    expect(allChecksPassed(checks)).toBe(false);
  });

  it("fails backend-reachable when the backend URL is missing", () => {
    const checks = evaluateSubmissionChecks(validForm, { ...validMeta, backendUrl: "" });
    expect(byId(checks, "backend-reachable").status).toBe("failed");
  });

  it("fails has-widgets when the backend exposes no widgets", () => {
    const checks = evaluateSubmissionChecks(validForm, { ...validMeta, widgetCount: 0 });
    expect(byId(checks, "has-widgets").status).toBe("failed");
  });

  it("fails valid-thumbnail for a non-URL thumbnail", () => {
    const checks = evaluateSubmissionChecks(
      { ...validForm, thumbnail: "not-a-url" },
      validMeta,
    );
    expect(byId(checks, "valid-thumbnail").status).toBe("failed");
  });

  it("fails valid-contact-email for a malformed email", () => {
    const checks = evaluateSubmissionChecks(
      { ...validForm, contactEmail: "dev@acme" },
      validMeta,
    );
    expect(byId(checks, "valid-contact-email").status).toBe("failed");
  });

  it("passes valid-contact-email when the optional email is blank", () => {
    const checks = evaluateSubmissionChecks(
      { ...validForm, contactEmail: "" },
      validMeta,
    );
    expect(byId(checks, "valid-contact-email").status).toBe("passed");
  });
});

describe("allChecksPassed", () => {
  it("is false for undefined or empty checks", () => {
    expect(allChecksPassed(undefined)).toBe(false);
    expect(allChecksPassed([])).toBe(false);
  });

  it("is false when any check failed", () => {
    const checks = evaluateSubmissionChecks(validForm, { ...validMeta, widgetCount: 0 });
    expect(allChecksPassed(checks)).toBe(false);
  });
});
