import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListedAppDetailsModal } from "~/components/Apps/ListedAppDetailsModal";
import type { ListedApp } from "~/types/listedApps";

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("sonner", () => ({ toast: mockToast }));

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: unknown[]) =>
    (args as (string | boolean | null | undefined)[]).filter(Boolean).join(" "),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rest["aria-label"] as string | undefined}
    >
      {children}
    </button>
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Render only the popover trigger so stat labels/counts are assertable.
vi.mock("~/components/HoverPopover", () => ({
  HoverPopover: ({ trigger }: { trigger: ReactNode }) => <div>{trigger}</div>,
}));

// Leaf components irrelevant to this layout / pull in swiper or portals.
vi.mock("~/components/Apps/MediaCarousel", () => ({ MediaCarousel: () => null }));
vi.mock("~/components/Apps/McpAppPopover", () => ({ McpAppPopover: () => null }));
vi.mock("~/components/Apps/ApiKeyModal", () => ({
  ApiKeyModal: ({ isOpen, mcpToken }: { isOpen: boolean; mcpToken?: unknown }) =>
    isOpen ? (
      <div data-testid="api-key-modal">{mcpToken ? "has-mcp" : "no-mcp"}</div>
    ) : null,
}));
vi.mock("~/components/ds/dialogs/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("~/components/LayoutAuth/AppCard/AppCardDropdown", () => ({
  AppCardDropdown: () => null,
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (s: { theme: "light" | "dark" }) => unknown) =>
    selector({ theme: "light" }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: (s: unknown) => unknown) =>
    selector({ getApiSourceById: () => undefined }),
}));

const VENDOR_KEY = "listedAppDetails.vendorProfileOpen";
const APP_DETAILS_KEY = "listedAppDetails.appDetailsOpen";

const baseApp: ListedApp = {
  id: "app-1",
  vendorName: "Axiora Inc.",
  appName: "Japanese equity intelligence",
  description: "Financials and earnings signals for Japanese listed companies.",
  backendUrl: "https://example.com",
  thumbnail: "",
  vendorDescription: "Axiora delivers provable financial intelligence.",
  vendorWebsiteUrl: "https://axioraglobalsolutions.com",
  contactEmail: "support@axiora.dev",
  category: "Fundamentals",
  totalWidgets: 12,
  widgets: [{ name: "w1" }, { name: "w2" }, { name: "w3" }],
  prompts: ["p1", "p2", "p3", "p4", "p5"],
};

function renderModal(overrides: Partial<ListedApp> = {}, props = {}) {
  return render(
    <ListedAppDetailsModal
      app={{ ...baseApp, ...overrides }}
      isOpen
      onClose={vi.fn()}
      isSubscribed={false}
      onSubscribe={vi.fn()}
      onAuthSave={vi.fn().mockResolvedValue({ success: true })}
      {...props}
    />,
  );
}

describe("ListedAppDetailsModal", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows appName as the title and vendorName as the subtitle", () => {
    renderModal();
    expect(screen.getByText("Japanese equity intelligence")).toBeInTheDocument();
    // Subtitle renders regardless of accordion state.
    expect(screen.getAllByText("Axiora Inc.").length).toBeGreaterThanOrEqual(1);
  });

  it("renders both collapsible section headers", () => {
    renderModal();
    expect(screen.getByText("Vendor Profile")).toBeInTheDocument();
    expect(screen.getByText("App Details")).toBeInTheDocument();
  });

  it("defaults to vendor profile collapsed and app details expanded", () => {
    renderModal();
    // Vendor profile body is collapsed -> its rows are not mounted.
    expect(screen.queryByText("Name")).not.toBeInTheDocument();
    // App details body is expanded -> its stats are mounted.
    expect(screen.getByText(/Widgets:/)).toBeInTheDocument();
  });

  it("respects persisted open state from localStorage", () => {
    localStorage.setItem(VENDOR_KEY, "true");
    localStorage.setItem(APP_DETAILS_KEY, "false");
    renderModal();
    // Vendor profile expanded -> rows visible.
    expect(screen.getByText("Name")).toBeInTheDocument();
    // App details collapsed -> stats hidden.
    expect(screen.queryByText(/Widgets:/)).not.toBeInTheDocument();
  });

  it("persists the accordion state to localStorage when toggled", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("Vendor Profile"));
    expect(localStorage.getItem(VENDOR_KEY)).toBe("true");

    await user.click(screen.getByText("App Details"));
    expect(localStorage.getItem(APP_DETAILS_KEY)).toBe("false");
  });

  it("renders the vendor profile as tabular rows with values when expanded", () => {
    localStorage.setItem(VENDOR_KEY, "true");
    renderModal();
    for (const label of ["Name", "Email", "Website", "Category", "Description"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText("support@axiora.dev")).toBeInTheDocument();
    expect(screen.getByText("axioraglobalsolutions.com")).toBeInTheDocument();
    expect(screen.getByText("Fundamentals")).toBeInTheDocument();
    expect(
      screen.getByText("Axiora delivers provable financial intelligence."),
    ).toBeInTheDocument();
  });

  it("omits optional rows when their data is missing", () => {
    localStorage.setItem(VENDOR_KEY, "true");
    renderModal({
      vendorWebsiteUrl: undefined,
      category: undefined,
      vendorDescription: undefined,
    });
    expect(screen.queryByText("Website")).not.toBeInTheDocument();
    expect(screen.queryByText("Category")).not.toBeInTheDocument();
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    // Required rows still render.
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders widget and prompt counts in the app details header", () => {
    renderModal();
    expect(screen.getByText(/Widgets:/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText(/Prompts:/)).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("opens the vendor website in a new tab when the website row is clicked", async () => {
    localStorage.setItem(VENDOR_KEY, "true");
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByText("axioraglobalsolutions.com"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://axioraglobalsolutions.com",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("shows Connect App and no status badge when not subscribed and not built-in", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Connect App" })).toBeInTheDocument();
    expect(screen.queryByText("Included")).not.toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("shows the Included badge for built-in apps", () => {
    renderModal({ isBuiltIn: true });
    expect(screen.getByText("Included")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect App" }),
    ).not.toBeInTheDocument();
  });

  it("shows the Connected status when subscribed and not built-in", () => {
    renderModal({}, { isSubscribed: true });
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect App" }),
    ).not.toBeInTheDocument();
  });

  it("shows a single Add API Keys button for a token-auth MCP server", () => {
    renderModal({
      isBuiltIn: true,
      mcpServers: [{ name: "Demo", url: "https://example.com/mcp", authType: "token" }],
    });
    expect(
      screen.getByRole("button", { name: "Add API Keys" }),
    ).toBeInTheDocument();
    // No separate MCP token button — everything lives in one dialog.
    expect(
      screen.queryByRole("button", { name: /MCP token/ }),
    ).not.toBeInTheDocument();
  });

  it("omits the auth button for an OAuth MCP server with no API key", () => {
    renderModal({
      isBuiltIn: true,
      mcpServers: [{ name: "Demo", url: "https://example.com/mcp" }],
    });
    expect(
      screen.queryByRole("button", { name: /API Keys?/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the auth dialog with the MCP token field when clicked", async () => {
    const user = userEvent.setup();
    renderModal({
      isBuiltIn: true,
      mcpServers: [{ name: "Demo", url: "https://example.com/mcp", authType: "token" }],
    });
    expect(screen.queryByTestId("api-key-modal")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add API Keys" }));

    const modal = await screen.findByTestId("api-key-modal");
    expect(modal).toHaveTextContent("has-mcp");
  });

  it("renders a Share button in the header", () => {
    renderModal();
    expect(
      screen.getByRole("button", { name: "Copy share link" }),
    ).toBeInTheDocument();
  });

  it("copies the marketplace deep link and toasts on Share click", async () => {
    const user = userEvent.setup();
    // userEvent.setup() stubs navigator.clipboard; install our spy afterwards.
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    renderModal();

    await user.click(screen.getByRole("button", { name: "Copy share link" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining(
        "/app?tab=apps-marketplace&app=japanese-equity-intelligence",
      ),
    );
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith("Link copied to clipboard"),
    );
  });

  describe("Contact CTA (lite)", () => {
    it("shows Contact and hides Connect App / auth button when onContactVendor is provided", () => {
      renderModal({}, { onContactVendor: vi.fn() });

      expect(screen.getByRole("button", { name: "Contact" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Connect App" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /API key/i }),
      ).not.toBeInTheDocument();
    });

    it("clicking Contact calls onContactVendor", async () => {
      const onContactVendor = vi.fn();
      const user = userEvent.setup();
      renderModal({}, { onContactVendor });

      await user.click(screen.getByRole("button", { name: "Contact" }));

      expect(onContactVendor).toHaveBeenCalledTimes(1);
    });

    it("does not show Contact for built-in apps", () => {
      renderModal({ isBuiltIn: true }, { onContactVendor: vi.fn() });

      expect(
        screen.queryByRole("button", { name: "Contact" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Included")).toBeInTheDocument();
    });

    it("does not show Contact when already subscribed", () => {
      renderModal({}, { isSubscribed: true, onContactVendor: vi.fn() });

      expect(
        screen.queryByRole("button", { name: "Contact" }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });
  });
});
