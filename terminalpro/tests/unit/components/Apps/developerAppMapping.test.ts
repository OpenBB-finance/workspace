import { describe, expect, it } from "vitest";
import {
  developerAppToSubmission,
  incrementVersion,
  submissionFormToRequestBody,
} from "~/components/Apps/developerAppMapping";
import type { SubmissionFormData } from "~/types/marketplaceSubmission";

const baseForm: SubmissionFormData = {
  appName: "Acme Options",
  vendorName: "Acme",
  vendorWebsiteUrl: "https://acme.com",
  vendorDescription: "Acme builds options analytics.",
  vendorThumbnailUrl: "https://acme.com/logo.png",
  tagline: "Options flow",
  category: "Crypto",
  description: "Real-time options analytics.",
  thumbnail: "https://cdn.acme.com/cover.png",
  documentationUrl: "https://docs.acme.com",
  contactEmail: "dev@acme.com",
  screenshots: ["https://cdn.acme.com/s1.png", "https://cdn.acme.com/s2.png"],
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

describe("incrementVersion", () => {
  it("increments integer versions", () => {
    expect(incrementVersion("1")).toBe("2");
    expect(incrementVersion("9")).toBe("10");
  });

  it("increments the last dotted segment", () => {
    expect(incrementVersion("1.0")).toBe("1.1");
    expect(incrementVersion("2.5")).toBe("2.6");
  });

  it("falls back for non-numeric suffixes", () => {
    expect(incrementVersion("beta")).toBe("beta.1");
    expect(incrementVersion("")).toBe("2");
  });
});

describe("developerAppToSubmission", () => {
  it("maps version from the DTO", () => {
    const sub = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "published",
      version: "1.2",
    });
    expect(sub.version).toBe("1.2");
  });

  it("defaults version to 1 when missing", () => {
    const sub = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
    });
    expect(sub.version).toBe("1");
  });

  it("seeds auth off for default/missing api_key", () => {
    const missing = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
    });
    expect(missing.form.authEnabled).toBe(false);
    expect(missing.form.authMode).toBe("api_key");

    const apiKeyOnly = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
      authType: ["api_key"],
    });
    expect(apiKeyOnly.form.authEnabled).toBe(false);
    expect(apiKeyOnly.form.authMode).toBe("api_key");
  });

  it("seeds auth for none", () => {
    const sub = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
      authType: ["none"],
    });
    expect(sub.form.authEnabled).toBe(true);
    expect(sub.form.authMode).toBe("none");
    expect(sub.form.authAllowAnonymous).toBe(false);
  });

  it("seeds auth for none+api_key", () => {
    const sub = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
      authType: ["none", "api_key"],
    });
    expect(sub.form.authEnabled).toBe(true);
    expect(sub.form.authMode).toBe("api_key");
    expect(sub.form.authAllowAnonymous).toBe(true);
  });

  it("seeds auth for none+custom with fields (null prefix → empty string)", () => {
    const sub = developerAppToSubmission({
      id: "a",
      appName: "App",
      vendorName: "Vendor",
      status: "development",
      authType: ["none", "custom"],
      authFields: [
        { id: "api_key", label: "API Key", key: "Authorization", prefix: null },
        { id: "client_id", label: "Client ID", key: "X-Client-Id", prefix: "id " },
      ],
    });
    expect(sub.form.authEnabled).toBe(true);
    expect(sub.form.authMode).toBe("custom");
    expect(sub.form.authAllowAnonymous).toBe(true);
    expect(sub.form.authFields).toEqual([
      { label: "API Key", key: "Authorization", prefix: "" },
      { label: "Client ID", key: "X-Client-Id", prefix: "id " },
    ]);
  });
});

describe("submissionFormToRequestBody", () => {
  it("omits auth_type and auth_fields when auth is disabled", () => {
    const body = submissionFormToRequestBody(baseForm, "https://api.acme.com");
    expect("auth_type" in body).toBe(false);
    expect("auth_fields" in body).toBe(false);
  });

  it("sends auth_type for each mode × anonymous matrix cell", () => {
    const cases: Array<{
      mode: SubmissionFormData["authMode"];
      anon: boolean;
      expected: string[];
    }> = [
      { mode: "none", anon: false, expected: ["none"] },
      { mode: "none", anon: true, expected: ["none"] },
      { mode: "api_key", anon: false, expected: ["api_key"] },
      { mode: "api_key", anon: true, expected: ["none", "api_key"] },
      { mode: "custom", anon: false, expected: ["custom"] },
      { mode: "custom", anon: true, expected: ["none", "custom"] },
    ];

    for (const { mode, anon, expected } of cases) {
      const body = submissionFormToRequestBody(
        {
          ...baseForm,
          authEnabled: true,
          authMode: mode,
          authAllowAnonymous: anon,
          authFields:
            mode === "custom"
              ? [{ label: "API Key", key: "Authorization", prefix: "Bearer " }]
              : [],
        },
        "https://api.acme.com",
      );
      expect(body.auth_type).toEqual(expected);
      if (mode === "custom") {
        expect(body.auth_fields).toEqual([
          {
            id: "api_key",
            label: "API Key",
            key: "Authorization",
            prefix: "Bearer ",
          },
        ]);
      } else {
        expect("auth_fields" in body).toBe(false);
      }
    }
  });

  it("never emits auth_fields without a custom-bearing auth_type", () => {
    const body = submissionFormToRequestBody(
      {
        ...baseForm,
        authEnabled: true,
        authMode: "api_key",
        authFields: [{ label: "API Key", key: "Authorization", prefix: "" }],
      },
      "https://api.acme.com",
    );
    expect(body.auth_type).toEqual(["api_key"]);
    expect("auth_fields" in body).toBe(false);
  });

  it("includes version and auth on update-style POST body", () => {
    const body = submissionFormToRequestBody(
      {
        ...baseForm,
        authEnabled: true,
        authMode: "none",
      },
      "https://api.acme.com",
      "2",
    );
    expect(body.version).toBe("2");
    expect(body.auth_type).toEqual(["none"]);
  });

  it("round-trips developerAppToSubmission ∘ submissionFormToRequestBody for custom auth", () => {
    const form: SubmissionFormData = {
      ...baseForm,
      authEnabled: true,
      authMode: "custom",
      authAllowAnonymous: true,
      authFields: [
        { label: "API Key", key: "Authorization", prefix: "Bearer " },
        { label: "Client ID", key: "X-Client-Id", prefix: "" },
      ],
    };
    const body = submissionFormToRequestBody(form, "https://api.acme.com");
    const seeded = developerAppToSubmission({
      id: "a",
      appName: form.appName,
      vendorName: form.vendorName,
      description: form.description,
      backendUrl: "https://api.acme.com",
      thumbnail: form.thumbnail,
      vendorThumbnailUrl: form.vendorThumbnailUrl,
      vendorWebsiteUrl: form.vendorWebsiteUrl,
      vendorDescription: form.vendorDescription,
      contactEmail: form.contactEmail,
      documentationUrl: form.documentationUrl,
      category: form.category,
      tagline: form.tagline,
      media: form.screenshots,
      status: "development",
      authType: body.auth_type,
      authFields: body.auth_fields,
    });
    const again = submissionFormToRequestBody(seeded.form, "https://api.acme.com");
    expect(again.auth_type).toEqual(body.auth_type);
    expect(again.auth_fields).toEqual(body.auth_fields);
  });

  describe("mcp servers", () => {
    it("omits mcp_servers entirely when the section is off", () => {
      const body = submissionFormToRequestBody(baseForm, "https://api.acme.com");
      // Omission is the contract: it tells the backend to keep deriving
      // servers from apps.json and to leave any stored override alone.
      expect("mcp_servers" in body).toBe(false);
    });

    it("sends a single-element list when enabled", () => {
      const body = submissionFormToRequestBody(
        {
          ...baseForm,
          mcpEnabled: true,
          mcpName: "  Acme Research  ",
          mcpUrl: "  https://mcp.acme.com/mcp  ",
          mcpDescription: "  Query Acme data  ",
          mcpAuthType: "token",
        },
        "https://api.acme.com",
      );
      expect(body.mcp_servers).toEqual([
        {
          name: "Acme Research",
          url: "https://mcp.acme.com/mcp",
          description: "Query Acme data",
          auth_type: "token",
        },
      ]);
    });

    it("omits auth_type for oauth and description when blank", () => {
      const body = submissionFormToRequestBody(
        {
          ...baseForm,
          mcpEnabled: true,
          mcpName: "Acme",
          mcpUrl: "https://mcp.acme.com/mcp",
          mcpDescription: "   ",
          mcpAuthType: "oauth",
        },
        "https://api.acme.com",
      );
      const server = body.mcp_servers?.[0];
      expect(server).toEqual({ name: "Acme", url: "https://mcp.acme.com/mcp" });
      expect(server && "auth_type" in server).toBe(false);
    });

    it("seeds the section from storedMcpServers only", () => {
      const stored = developerAppToSubmission({
        id: "a",
        appName: "Acme",
        vendorName: "Acme Inc",
        status: "development",
        storedMcpServers: [
          {
            name: "Acme MCP",
            url: "https://mcp.acme.com/mcp",
            description: "d",
            authType: "token",
          },
        ],
      });
      expect(stored.form.mcpEnabled).toBe(true);
      expect(stored.form.mcpName).toBe("Acme MCP");
      expect(stored.form.mcpUrl).toBe("https://mcp.acme.com/mcp");
      expect(stored.form.mcpDescription).toBe("d");
      expect(stored.form.mcpAuthType).toBe("token");
    });

    it("stays off when the backend only derived servers from apps.json", () => {
      // storedMcpServers is null while the merged `mcpServers` is populated.
      // Turning the section on here would freeze the manifest-derived server
      // into stored config on the next PATCH.
      const derived = developerAppToSubmission({
        id: "a",
        appName: "Acme",
        vendorName: "Acme Inc",
        status: "development",
        storedMcpServers: null,
      });
      expect(derived.form.mcpEnabled).toBe(false);
      expect(derived.form.mcpName).toBe("");
      expect(derived.form.mcpAuthType).toBe("oauth");
    });

    it("round-trips a stored server through body -> seed -> body", () => {
      const form = {
        ...baseForm,
        mcpEnabled: true,
        mcpName: "Acme MCP",
        mcpUrl: "https://mcp.acme.com/mcp",
        mcpAuthType: "token" as const,
      };
      const body = submissionFormToRequestBody(form, "https://api.acme.com");
      const seeded = developerAppToSubmission({
        id: "a",
        appName: form.appName,
        vendorName: form.vendorName,
        status: "development",
        storedMcpServers: [
          { name: "Acme MCP", url: "https://mcp.acme.com/mcp", authType: "token" },
        ],
      });
      const again = submissionFormToRequestBody(seeded.form, "https://api.acme.com");
      expect(again.mcp_servers).toEqual(body.mcp_servers);
    });
  });
});
