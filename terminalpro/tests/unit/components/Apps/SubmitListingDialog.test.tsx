import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as marketplaceApi from "~/api/marketplaceSubmission.api";
import { SubmitListingDialog } from "~/components/Apps/SubmitListingDialog";
import * as toastUtils from "~/lib/utils/toast";
import type {
  MarketplaceSubmission,
  SubmissionTarget,
} from "~/types/marketplaceSubmission";

// The image probe uses `new Image()`, which never loads in jsdom. Stub the hook
// so `ensureSettled` is controllable per test and never hangs. The preview mock
// is controllable too so a test can hold back the "all modes viewed" signal.
const { ensureSettledMock, previewMock } = vi.hoisted(() => ({
  ensureSettledMock: vi.fn(),
  previewMock: vi.fn(),
}));
vi.mock("~/components/Apps/useImageUrlStatuses", () => ({
  useImageUrlStatuses: () => ({
    statuses: {},
    ensureSettled: ensureSettledMock,
    resetErrors: vi.fn(),
  }),
}));
vi.mock("~/components/Apps/SubmissionPreview", () => ({
  PREVIEW_MODES: ["general", "marketplace", "modal"],
  SubmissionPreview: (props: { onModeViewed: (mode: string) => void }) =>
    previewMock(props),
}));

/** Preview impl that reports all three modes viewed, opening the submit gate. */
function ViewsAllModes({ onModeViewed }: { onModeViewed: (mode: string) => void }) {
  React.useEffect(() => {
    ["general", "marketplace", "modal"].forEach((mode) => onModeViewed(mode));
  }, [onModeViewed]);
  return <div>App preview</div>;
}

function makeSubmission(
  formOverrides?: Partial<MarketplaceSubmission["form"]>,
): MarketplaceSubmission {
  return {
    id: "sub-1",
    backendUrl: "https://api.acme.com",
    widgetCount: 3,
    version: "1",
    status: "pending",
    form: {
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
      ...formOverrides,
    },
    createdDate: "2026-01-01T00:00:00.000Z",
    updatedDate: "2026-01-01T00:00:00.000Z",
  };
}

function existingTarget(
  formOverrides?: Partial<MarketplaceSubmission["form"]>,
): SubmissionTarget {
  return { kind: "existing", submission: makeSubmission(formOverrides) };
}

function updateTarget(
  formOverrides?: Partial<MarketplaceSubmission["form"]>,
  version = "1",
): SubmissionTarget {
  return {
    kind: "update",
    submission: { ...makeSubmission(formOverrides), version, status: "approved" },
  };
}

function renderDialog(target: SubmissionTarget, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SubmitListingDialog target={target} onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

/** Walk the wizard vendor → app → preview (steps have no forward validation). */
async function goToPreview() {
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  await screen.findByText("App name");
  fireEvent.click(screen.getByRole("button", { name: /next/i }));
  await screen.findByText("App preview");
}

beforeEach(() => {
  ensureSettledMock.mockResolvedValue({});
  previewMock.mockImplementation(ViewsAllModes);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SubmitListingDialog", () => {
  it("shows Edit Submission title when editing a pending listing", () => {
    renderDialog(existingTarget());
    expect(screen.getByText("Edit Submission")).toBeInTheDocument();
  });

  it("shows Update Listing title and version notice in update mode", () => {
    renderDialog(updateTarget(undefined, "1.0"));
    expect(screen.getByText("Update Listing")).toBeInTheDocument();
    expect(screen.getByText(/version 1\.1/i)).toBeInTheDocument();
  });

  it("opens on the Vendor Profile step with the Next action", () => {
    renderDialog(existingTarget());
    expect(screen.getByText("Company Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    // App Details fields are not shown until the user advances.
    expect(screen.queryByText("App name")).not.toBeInTheDocument();
  });

  it("blocks advancing to App Details until the vendor fields are valid", async () => {
    renderDialog(
      existingTarget({ vendorName: "", vendorWebsiteUrl: "", vendorDescription: "" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(screen.queryByText("App name")).not.toBeInTheDocument();
  });

  it("advances to App Details once the vendor profile is valid", async () => {
    renderDialog(existingTarget());

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("App name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("keeps Submit disabled until all preview modes are viewed", async () => {
    // Preview that reports nothing viewed → the gate stays closed.
    previewMock.mockImplementation(() => <div>App preview</div>);
    renderDialog(existingTarget());
    await goToPreview();

    expect(screen.getByRole("button", { name: /submit app/i })).toBeDisabled();
    expect(
      screen.getByText(/check all three previews above to enable submit/i),
    ).toBeInTheDocument();
  });

  it("runs checks then submits an update as a new version", async () => {
    const submitSpy = vi
      .spyOn(marketplaceApi, "submitForReview")
      .mockResolvedValue(makeSubmission());
    const { onClose } = renderDialog(updateTarget());

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit update/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 });
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "update" }),
      expect.objectContaining({ appName: "Acme Options" }),
    );
  });

  it("runs checks then submits for review on a valid App Details submit", async () => {
    const submitSpy = vi
      .spyOn(marketplaceApi, "submitForReview")
      .mockResolvedValue(makeSubmission());
    const { onClose } = renderDialog(existingTarget());

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit app/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 4000 });
    // The dialog passes the whole target (snapshot travels) + the form.
    expect(submitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "existing" }),
      expect.objectContaining({ appName: "Acme Options" }),
    );
  });

  it("blocks advancing to preview with the min-screenshots error when fewer than two", async () => {
    renderDialog(existingTarget({ screenshots: [] }));

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // attempt preview

    expect(
      await screen.findByText(/add at least 2 screenshot urls/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("App preview")).not.toBeInTheDocument();
  });

  it("blocks advancing to preview until the required app fields are filled", async () => {
    renderDialog(existingTarget({ appName: "", description: "", thumbnail: "" }));

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");
    fireEvent.click(screen.getByRole("button", { name: /next/i })); // attempt preview

    expect(await screen.findByText(/app name is required/i)).toBeInTheDocument();
    expect(screen.queryByText("App preview")).not.toBeInTheDocument();
  });

  it("blocks submission and flags the field when an image URL fails to load", async () => {
    ensureSettledMock.mockResolvedValue({ "https://acme.com/logo.png": "error" });
    const submitSpy = vi.spyOn(marketplaceApi, "submitForReview");
    const { onClose } = renderDialog(existingTarget());

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit app/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    // Broken image → jumps to the offending (vendor) step with an inline error.
    expect(await screen.findByText(/this image url doesn't load/i)).toBeInTheDocument();
    expect(submitSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders Category as a fixed-option dropdown, not a free-text input", async () => {
    renderDialog(existingTarget({ category: "" }));

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Select a category")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("e.g. Equities & Macro"),
    ).not.toBeInTheDocument();
  });

  it("does not carry typed vendor values into the App Details inputs", async () => {
    renderDialog(existingTarget());

    const companyName = screen.getByPlaceholderText("e.g. Alpha Vantage");
    fireEvent.change(companyName, { target: { value: "ZZZ_TYPED_VENDOR" } });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");

    const appName = screen.getByPlaceholderText(
      "e.g. Market Intelligence",
    ) as HTMLInputElement;
    expect(appName.value).toBe("Acme Options");
    expect(appName.value).not.toBe("ZZZ_TYPED_VENDOR");
  });

  it("shows an error toast and stays open when the submission service fails", async () => {
    const notifySpy = vi
      .spyOn(toastUtils, "showNotification")
      .mockReturnValue(undefined);
    vi.spyOn(marketplaceApi, "submitForReview").mockRejectedValueOnce(
      new Error("network down"),
    );
    const { onClose } = renderDialog(existingTarget());

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit app/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() =>
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({ toastType: "error" }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the authentication section collapsed/off by default", async () => {
    renderDialog(existingTarget());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");

    expect(screen.getByText("Authentication (optional)")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", {
      name: /enable authentication configuration/i,
    });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByText("API key")).not.toBeInTheDocument();
  });

  it("reveals auth radios when the authentication toggle is turned on", async () => {
    renderDialog(existingTarget());
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");

    fireEvent.click(
      screen.getByRole("switch", { name: /enable authentication configuration/i }),
    );

    expect(await screen.findByText("API key")).toBeInTheDocument();
    expect(screen.getByText("Custom headers")).toBeInTheDocument();
    expect(screen.getByText("No authentication")).toBeInTheDocument();
  });

  it("blocks Next when custom auth is enabled with empty rows", async () => {
    renderDialog(
      existingTarget({
        authEnabled: true,
        authMode: "custom",
        authFields: [],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByText(/add at least one authentication field/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("App preview")).not.toBeInTheDocument();
  });

  it("submits with auth disabled in the form payload by default", async () => {
    const submitSpy = vi
      .spyOn(marketplaceApi, "submitForReview")
      .mockResolvedValue(makeSubmission());
    renderDialog(existingTarget());

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit app/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    expect(submitSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authEnabled: false }),
    );
  });

  it("submits with custom auth when configured", async () => {
    const submitSpy = vi
      .spyOn(marketplaceApi, "submitForReview")
      .mockResolvedValue(makeSubmission());
    renderDialog(
      existingTarget({
        authEnabled: true,
        authMode: "custom",
        authAllowAnonymous: true,
        authFields: [
          { label: "API Key", key: "Authorization", prefix: "Bearer " },
        ],
      }),
    );

    await goToPreview();
    const submit = await screen.findByRole("button", { name: /submit app/i });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    await waitFor(() => expect(submitSpy).toHaveBeenCalled());
    expect(submitSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        authEnabled: true,
        authMode: "custom",
        authAllowAnonymous: true,
        authFields: [
          { label: "API Key", key: "Authorization", prefix: "Bearer " },
        ],
      }),
    );
  });

  it("seeds the auth section open for none+custom edit targets", async () => {
    renderDialog(
      existingTarget({
        authEnabled: true,
        authMode: "custom",
        authAllowAnonymous: true,
        authFields: [
          { label: "API Key", key: "Authorization", prefix: "Bearer " },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    await screen.findByText("App name");

    const toggle = screen.getByRole("switch", {
      name: /enable authentication configuration/i,
    });
    expect(toggle).toBeChecked();
    expect(screen.getByText("Custom headers")).toBeInTheDocument();
    expect(screen.getByDisplayValue("API Key")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Authorization")).toBeInTheDocument();
  });
});
