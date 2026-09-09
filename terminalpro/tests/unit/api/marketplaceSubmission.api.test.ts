import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "~/api/api";
import {
  deleteSubmission,
  listSubmissions,
  runTests,
  submitForReview,
  submitUpdate,
} from "~/api/marketplaceSubmission.api";
import type {
  MarketplaceSubmission,
  NewListingSeed,
  SubmissionFormData,
} from "~/types/marketplaceSubmission";

// Must include interceptors: developerAppMapping → submissionAuth → utils
// pulls in dashboard.api, which calls axiosRetry(apiClient) at module load.
vi.mock("~/api/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const validForm: SubmissionFormData = {
  appName: "Acme Options",
  vendorName: "Acme",
  vendorWebsiteUrl: "https://acme.com",
  vendorDescription: "Acme builds options analytics.",
  vendorThumbnailUrl: "https://acme.com/logo.png",
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

const seed: NewListingSeed = {
  backendSourceId: "src-1",
  appName: "Acme Options",
  backendUrl: "https://api.acme.com",
  widgetCount: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTests", () => {
  it("passes for a complete new listing", async () => {
    const checks = await runTests({ kind: "new", seed }, validForm);
    expect(checks).toHaveLength(5);
    expect(checks.every((c) => c.status === "passed")).toBe(true);
  });

  it("fails has-widgets when the snapshot has no widgets", async () => {
    const checks = await runTests(
      { kind: "new", seed: { ...seed, widgetCount: 0 } },
      validForm,
    );
    expect(checks.find((c) => c.id === "has-widgets")?.status).toBe("failed");
  });
});

describe("submitForReview — new listing", () => {
  it("throws and makes no request when checks fail", async () => {
    await expect(
      submitForReview({ kind: "new", seed: { ...seed, widgetCount: 0 } }, validForm),
    ).rejects.toThrow(/checks/);
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("POSTs create, pings reviewers, returns pending", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { app_id: "backend-9" } });

    const result = await submitForReview({ kind: "new", seed }, validForm);

    expect(result.id).toBe("backend-9");
    expect(result.status).toBe("pending");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps",
      expect.objectContaining({
        vendor_name: "Acme",
        app_name: "Acme Options",
        short_description: validForm.description,
        backend_base_url: "https://api.acme.com",
      }),
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-9/submit-for-review",
      {},
    );
  });

  it("succeeds even if the reviewer-ping email fails", async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { app_id: "backend-9" } })
      .mockRejectedValueOnce(new Error("mail down"));

    const result = await submitForReview({ kind: "new", seed }, validForm);
    expect(result.status).toBe("pending");
  });
});

describe("submitForReview — existing listing", () => {
  it("PATCHes a rejected listing instead of creating a duplicate, and re-notifies reviewers", async () => {
    const submission: MarketplaceSubmission = {
      id: "backend-9",
      backendUrl: "https://api.acme.com",
      widgetCount: 3,
      version: "1",
      status: "rejected",
      form: validForm,
      rejectionFeedback: "Fix thumbnail",
      createdDate: "",
      updatedDate: "",
    };
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: {
        id: "backend-9",
        appName: "Acme Options",
        vendorName: "Acme",
        backendUrl: "https://api.acme.com",
        totalWidgets: 3,
        version: "1",
        status: "development",
        rejectionReason: null,
      },
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    const result = await submitForReview({ kind: "existing", submission }, validForm);

    expect(apiClient.patch).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-9",
      expect.any(Object),
    );
    // A fixed-up rejection is exactly what reviewers need to hear about.
    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-9/submit-for-review",
      {},
    );
    expect(apiClient.post).not.toHaveBeenCalledWith(
      "/marketplace/developer/apps",
      expect.anything(),
    );
    expect(result.status).toBe("pending");
    expect(result.rejectionFeedback).toBeUndefined();
  });

  it("re-notifies reviewers when editing a pending submission", async () => {
    const submission: MarketplaceSubmission = {
      id: "backend-9",
      backendUrl: "https://api.acme.com",
      widgetCount: 3,
      version: "1",
      status: "pending",
      form: validForm,
      createdDate: "",
      updatedDate: "",
    };
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: {
        id: "backend-9",
        appName: "Acme Options",
        vendorName: "Acme",
        backendUrl: "https://api.acme.com",
        totalWidgets: 3,
        version: "1",
        status: "submitted",
        rejectionReason: null,
      },
    });
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await submitForReview({ kind: "existing", submission }, validForm);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-9/submit-for-review",
      {},
    );
  });
});

describe("submitUpdate", () => {
  it("POSTs a new version and pings reviewers", async () => {
    const submission: MarketplaceSubmission = {
      id: "backend-9",
      backendUrl: "https://api.acme.com",
      widgetCount: 3,
      version: "1",
      status: "approved",
      form: validForm,
      createdDate: "",
      updatedDate: "",
    };
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { app_id: "backend-10" } })
      .mockResolvedValueOnce({ data: {} });

    const result = await submitUpdate({ kind: "update", submission }, validForm);

    expect(result.id).toBe("backend-10");
    expect(result.version).toBe("2");
    expect(result.status).toBe("pending");
    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps",
      expect.objectContaining({ version: "2", app_name: "Acme Options" }),
    );
    expect(apiClient.post).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-10/submit-for-review",
      {},
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});

describe("listSubmissions", () => {
  it("maps backend apps and derives pending / approved / rejected", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        { id: "a", appName: "A", vendorName: "V", status: "development", rejectionReason: null },
        { id: "b", appName: "B", vendorName: "V", status: "published", rejectionReason: null },
        {
          id: "c",
          appName: "C",
          vendorName: "V",
          status: "development",
          rejectionReason: "Fix thumbnail",
        },
      ],
    });

    const byId = Object.fromEntries((await listSubmissions()).map((s) => [s.id, s]));
    expect(byId.a.status).toBe("pending");
    expect(byId.b.status).toBe("approved");
    expect(byId.c.status).toBe("rejected");
    expect(byId.c.rejectionFeedback).toBe("Fix thumbnail");
  });
});

describe("deleteSubmission", () => {
  it("DELETEs the backend app", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ status: 200 });
    await deleteSubmission("backend-9");
    expect(apiClient.delete).toHaveBeenCalledWith(
      "/marketplace/developer/apps/backend-9",
    );
  });
});
