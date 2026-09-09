import { describe, expect, it } from "vitest";
import {
  MIN_SCREENSHOTS,
  submissionFormSchema,
} from "~/components/Apps/submissionForm";

const validForm = {
  appName: "Acme Options",
  vendorName: "Acme",
  vendorWebsiteUrl: "https://acme.com",
  vendorDescription: "Acme builds options analytics.",
  vendorThumbnailUrl: "https://acme.com/logo.png",
  tagline: "",
  category: "Crypto",
  description: "Real-time options analytics.",
  thumbnail: "https://cdn.acme.com/cover.png",
  documentationUrl: "",
  contactEmail: "",
  screenshots: ["https://cdn.acme.com/s1.png", "https://cdn.acme.com/s2.png"],
  authEnabled: false,
  authMode: "api_key" as const,
  authAllowAnonymous: false,
  authFields: [] as { label: string; key: string; prefix: string }[],
  mcpEnabled: false,
  mcpName: "",
  mcpUrl: "",
  mcpDescription: "",
  mcpAuthType: "oauth" as const,
};

const screenshotsIssue = (screenshots: string[]) =>
  submissionFormSchema
    .safeParse({ ...validForm, screenshots })
    .error?.issues.find((issue) => issue.path[0] === "screenshots");

describe("submissionFormSchema", () => {
  it("accepts a fully valid form", () => {
    expect(submissionFormSchema.safeParse(validForm).success).toBe(true);
  });

  it(`rejects fewer than ${MIN_SCREENSHOTS} screenshots`, () => {
    const issue = screenshotsIssue(["https://cdn.acme.com/s1.png"]);
    expect(issue?.message).toMatch(/at least 2/i);
  });

  it("ignores empty rows when counting screenshots", () => {
    const issue = screenshotsIssue(["https://cdn.acme.com/s1.png", "", "  "]);
    expect(issue?.message).toMatch(/at least 2/i);
  });

  it("rejects a malformed screenshot URL", () => {
    const issue = screenshotsIssue([
      "https://cdn.acme.com/s1.png",
      "not-a-url",
      "https://cdn.acme.com/s3.png",
    ]);
    expect(issue?.message).toMatch(/valid url/i);
  });

  it("still requires the cover thumbnail", () => {
    const result = submissionFormSchema.safeParse({ ...validForm, thumbnail: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "thumbnail")).toBe(true);
  });

  it("accepts auth disabled even with garbage custom rows", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: false,
      authMode: "custom",
      authFields: [
        { label: "", key: "", prefix: "" },
        { label: "!!!", key: "X", prefix: "" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts enabled + api_key with stale custom rows ignored", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "api_key",
      authFields: [{ label: "", key: "", prefix: "" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts enabled + none with no rows", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "none",
      authFields: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects enabled + custom with zero rows", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "custom",
      authFields: [],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path[0] === "authFields")).toBe(true);
  });

  it("rejects empty label and key on custom rows", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "custom",
      authFields: [{ label: "  ", key: "", prefix: "" }],
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toContain("authFields.0.label");
    expect(paths).toContain("authFields.0.key");
  });

  it("rejects punctuation-only labels that produce empty ids", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "custom",
      authFields: [{ label: "!!!", key: "Authorization", prefix: "" }],
    });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find(
      (i) => i.path.join(".") === "authFields.0.label",
    );
    expect(issue?.message).toMatch(/letters or numbers/i);
  });

  it("rejects slug-colliding labels (API Key vs API Key!)", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "custom",
      authFields: [
        { label: "API Key", key: "Authorization", prefix: "Bearer " },
        { label: "API Key!", key: "X-Api-Key", prefix: "" },
      ],
    });
    expect(result.success).toBe(false);
    const issue = result.error?.issues.find(
      (i) => i.path.join(".") === "authFields.1.label",
    );
    expect(issue?.message).toMatch(/unique ids/i);
  });

  it("rejects duplicate header keys", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      authEnabled: true,
      authMode: "custom",
      authFields: [
        { label: "API Key", key: "Authorization", prefix: "" },
        { label: "Token", key: "Authorization", prefix: "" },
      ],
    });
    expect(result.success).toBe(false);
    expect(
      result.error?.issues.some((i) => i.path.join(".") === "authFields.1.key"),
    ).toBe(true);
  });

  it("accepts the form while the mcp section is off, even with junk fields", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      mcpEnabled: false,
      mcpName: "",
      mcpUrl: "not-a-url",
    });
    expect(result.success).toBe(true);
  });

  it("requires a name and a valid url once the mcp section is on", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      mcpEnabled: true,
      mcpName: "   ",
      mcpUrl: "not-a-url",
    });
    const paths = result.error?.issues.map((i) => i.path.join(".")) ?? [];
    expect(paths).toContain("mcpName");
    expect(paths).toContain("mcpUrl");
  });

  it("accepts a valid mcp server", () => {
    const result = submissionFormSchema.safeParse({
      ...validForm,
      mcpEnabled: true,
      mcpName: "Acme MCP",
      mcpUrl: "https://mcp.acme.com/mcp",
      mcpAuthType: "token",
    });
    expect(result.success).toBe(true);
  });
});
