import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListedAppCard } from "~/components/Apps/ListedAppCard";
import type { ListedApp } from "~/types/listedApps";
import type {
  MarketplaceSubmission,
  SubmissionStatus,
} from "~/types/marketplaceSubmission";

const ownerApp: ListedApp = {
  id: "sub-1",
  vendorName: "Acme",
  appName: "Acme Options",
  description: "Options analytics",
  backendUrl: "https://api.acme.com",
  thumbnail: "https://cdn.acme.com/thumb.png",
  widgets: [],
};

function makeSubmission(
  status: SubmissionStatus,
  rejectionFeedback?: string,
  version = "1",
): MarketplaceSubmission {
  return {
    id: "sub-1",
    backendUrl: "https://api.acme.com",
    widgetCount: 2,
    version,
    status,
    rejectionFeedback,
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
    createdDate: "2026-01-01T00:00:00.000Z",
    updatedDate: "2026-01-01T00:00:00.000Z",
  };
}

describe("ListedAppCard — owner submission", () => {
  it("pending: shows Pending tag and an Edit submission button", () => {
    render(
      <ListedAppCard
        app={ownerApp}
        isSubscribed={false}
        onOpenDetails={vi.fn()}
        submission={makeSubmission("pending")}
        onSubmitListing={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit submission/i })).toBeEnabled();
  });

  it("approved: shows Live status, View Details, and Update listing buttons", () => {
    const onUpdate = vi.fn();
    render(
      <ListedAppCard
        app={ownerApp}
        isSubscribed={false}
        onOpenDetails={vi.fn()}
        submission={makeSubmission("approved")}
        onSubmitListing={vi.fn()}
        onUpdateListing={onUpdate}
      />,
    );

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update listing/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /update listing/i }));
    expect(onUpdate).toHaveBeenCalled();
  });

  it("approved with an open revision: hides Update listing", () => {
    render(
      <ListedAppCard
        app={ownerApp}
        isSubscribed={false}
        onOpenDetails={vi.fn()}
        submission={makeSubmission("approved")}
        onSubmitListing={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /view details/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update listing/i }),
    ).not.toBeInTheDocument();
  });

  // A live listing and its in-review revision render as sibling cards with the
  // same name — the version is what tells them apart.
  it("shows the listing version next to the status", () => {
    render(
      <ListedAppCard
        app={ownerApp}
        isSubscribed={false}
        onOpenDetails={vi.fn()}
        submission={makeSubmission("pending", undefined, "2")}
        onSubmitListing={vi.fn()}
      />,
    );

    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("rejected: shows Rejected tag, feedback affordance, and a resubmit CTA", () => {
    render(
      <ListedAppCard
        app={ownerApp}
        isSubscribed={false}
        onOpenDetails={vi.fn()}
        submission={makeSubmission("rejected", "Thumbnail too low-res.")}
        onSubmitListing={vi.fn()}
      />,
    );

    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText(/why was this rejected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit submission/i })).toBeInTheDocument();
  });
});
