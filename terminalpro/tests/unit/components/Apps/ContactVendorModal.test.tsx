import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactVendorModal } from "~/components/Apps/ContactVendorModal";
import { CONTACT_VENDOR_FORM_URL } from "~/lib/constants";
import type { ListedApp } from "~/types/listedApps";

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: unknown[]) =>
    (args as (string | boolean | null | undefined)[]).filter(Boolean).join(" "),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={rest["aria-label"] as string | undefined}
    >
      {children}
    </button>
  ),
}));

const baseApp: ListedApp = {
  id: "app-1",
  vendorName: "Acme Corp",
  appName: "Acme Data",
  description: "A great data application",
  backendUrl: "https://example.com",
  thumbnail: "",
  widgets: [],
};

describe("ContactVendorModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing when app is null", () => {
    const { container } = render(
      <ContactVendorModal app={null} isOpen onClose={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("_contact-vendor-modal")).not.toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    render(<ContactVendorModal app={baseApp} isOpen={false} onClose={vi.fn()} />);

    expect(screen.queryByTestId("_contact-vendor-modal")).not.toBeInTheDocument();
  });

  it("shows vendor name, app name, and the Formbricks form when open", () => {
    render(<ContactVendorModal app={baseApp} isOpen onClose={vi.fn()} />);

    expect(screen.getByText("Contact Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Acme Data")).toBeInTheDocument();

    const iframe = screen.getByTitle("Contact Acme Corp");
    expect(iframe).toHaveAttribute("src", CONTACT_VENDOR_FORM_URL);
  });
});
