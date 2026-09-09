import { describe, expect, it } from "vitest";
import {
  buildAuthFields,
  buildAuthTypes,
  deriveAuthFieldId,
} from "~/components/Apps/submissionAuth";
import type { SubmissionFormData } from "~/types/marketplaceSubmission";

const baseForm = {
  authEnabled: true,
  authMode: "api_key" as const,
  authAllowAnonymous: false,
  authFields: [] as SubmissionFormData["authFields"],
} as SubmissionFormData;

describe("deriveAuthFieldId", () => {
  it("slugifies labels with underscores", () => {
    expect(deriveAuthFieldId("API Key")).toBe("api_key");
    expect(deriveAuthFieldId("  Client ID  ")).toBe("client_id");
  });

  it("returns empty string for punctuation-only labels", () => {
    expect(deriveAuthFieldId("!!!")).toBe("");
    expect(deriveAuthFieldId("   ")).toBe("");
  });
});

describe("buildAuthTypes", () => {
  it("returns [none] for none mode regardless of anonymous checkbox", () => {
    expect(
      buildAuthTypes({ ...baseForm, authMode: "none", authAllowAnonymous: true }),
    ).toEqual(["none"]);
    expect(
      buildAuthTypes({ ...baseForm, authMode: "none", authAllowAnonymous: false }),
    ).toEqual(["none"]);
  });

  it("returns [api_key] or [none, api_key]", () => {
    expect(
      buildAuthTypes({
        ...baseForm,
        authMode: "api_key",
        authAllowAnonymous: false,
      }),
    ).toEqual(["api_key"]);
    expect(
      buildAuthTypes({
        ...baseForm,
        authMode: "api_key",
        authAllowAnonymous: true,
      }),
    ).toEqual(["none", "api_key"]);
  });

  it("returns [custom] or [none, custom]", () => {
    expect(
      buildAuthTypes({
        ...baseForm,
        authMode: "custom",
        authAllowAnonymous: false,
      }),
    ).toEqual(["custom"]);
    expect(
      buildAuthTypes({
        ...baseForm,
        authMode: "custom",
        authAllowAnonymous: true,
      }),
    ).toEqual(["none", "custom"]);
  });
});

describe("buildAuthFields", () => {
  it("trims label/key, derives ids, omits empty prefixes, keeps Bearer spacing", () => {
    const fields = buildAuthFields({
      ...baseForm,
      authMode: "custom",
      authFields: [
        { label: "  API Key  ", key: "  Authorization  ", prefix: "Bearer " },
        { label: "Client ID", key: "X-Client-Id", prefix: "   " },
      ],
    });
    expect(fields).toEqual([
      {
        id: "api_key",
        label: "API Key",
        key: "Authorization",
        prefix: "Bearer ",
      },
      { id: "client_id", label: "Client ID", key: "X-Client-Id" },
    ]);
  });
});
