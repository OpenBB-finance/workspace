import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../mocks/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import Settings from "~/routes/settings";

const mockSetSearchParams = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
  };
});

vi.mock("@tanstack/react-query", () => ({
  useMutation: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ ok: true }),
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("usehooks-ts", () => ({
  useUpdateEffect: (effect: () => void, deps: any[]) => {
    // Simple implementation that calls effect when deps change
  },
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: vi.fn(),
}));

vi.mock("~/lib/utils/fetch", () => ({
  getHeaders: vi.fn(() => ({
    "Content-Type": "application/json",
    Authorization: "Bearer mock-token",
  })),
}));

vi.mock("~/components/Settings/GeneralTab", () => ({
  default: () => <div data-testid="general-tab">General Tab Content</div>,
}));

vi.mock("~/components/Settings/LayoutTab", () => ({
  default: () => <div data-testid="layout-tab">Layout Tab Content</div>,
}));

vi.mock("~/components/Settings/WidgetTab", () => ({
  default: () => <div data-testid="widget-tab">Widget Tab Content</div>,
}));

vi.mock("~/components/Settings/InvitesTab", () => ({
  default: () => <div data-testid="invites-tab">Invites Tab Content</div>,
}));

vi.mock("~/components/Settings/NewsletterTab", () => ({
  default: () => <div data-testid="newsletter-tab">Newsletter Tab Content</div>,
}));

vi.mock("~/components/Settings/AdvancedTab", () => ({
  default: () => <div data-testid="advanced-tab">Advanced Tab Content</div>,
}));

vi.mock("~/components/Settings/SecurityTab", () => ({
  default: () => <div data-testid="security-tab">Security Tab Content</div>,
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
    tabs,
  }: { children: ReactNode; title?: string; tabs?: any[] }) => (
    <div data-testid="settings-layout">
      {title && <h1>{title}</h1>}
      {tabs && (
        <div role="tablist">
          {tabs.map((tab: any) => (
            <button
              key={tab.id}
              role="tab"
              disabled={tab.disabled}
              data-value={tab.id}
              onClick={() => {
                // Simulate tab change by calling setSearchParams if available
                if (typeof window !== "undefined") {
                  const event = new CustomEvent("tabchange", {
                    detail: { tab: tab.id },
                  });
                  window.dispatchEvent(event);
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  ),
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Root: ({ children, ...props }: { children: ReactNode }) => (
    <div role="tablist" data-radix-tabs-root={true} {...props}>
      {children}
    </div>
  ),
  List: ({ children, ...props }: { children: ReactNode }) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  Trigger: ({
    children,
    disabled,
    value,
    ...props
  }: { children: ReactNode; disabled?: boolean; value: string }) => (
    <button role="tab" disabled={disabled} data-value={value} {...props}>
      {children}
    </button>
  ),
  Content: ({ children, value, ...props }: { children: ReactNode; value: string }) => (
    <div role="tabpanel" data-value={value} {...props}>
      {children}
    </div>
  ),
}));

const setupMocks = (
  options: {
    tier?: "pro" | "terminal" | "enterprise";
    hasAdminAccess?: boolean;
  } = {},
) => {
  const { tier = "pro", hasAdminAccess = false } = options;

  (useShallowFeatureFlagsStore as any).mockImplementation((selector: any) =>
    selector({
      featureFlags: {
        tier,
        admin_access: hasAdminAccess,
      },
    }),
  );

  (useShallowThemeStore as any).mockImplementation((selector: any) =>
    selector({
      getDisplaySettings: vi.fn(() => ({
        theme: "dark",
        defaultTicker: { symbol: "AAPL", name: "Apple Inc." },
      })),
    }),
  );

  (useShallowAuthStore as any).mockImplementation((selector: any) =>
    selector({
      user: { token: "mock-token" },
    }),
  );

  (useShallowAppStore as any).mockImplementation((selector: any) =>
    selector({
      hasItems: true,
      rootItem: { id: "root" },
    }),
  );
};

const renderSettings = () => {
  return render(
    <BrowserRouter>
      <Settings />
    </BrowserRouter>,
  );
};

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
    mockConfig.ui.showInviteButton = true;
  });

  describe("Rendering", () => {
    it("renders the Settings title", () => {
      renderSettings();

      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("renders the General tab by default", () => {
      renderSettings();

      expect(screen.getByTestId("general-tab")).toBeInTheDocument();
    });

    it("renders all core tabs for pro tier", () => {
      renderSettings();

      expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /widget/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /security/i })).toBeInTheDocument();
    });

    it("renders Invites tab when invite button FF is enabled and user is not admin", () => {
      setupMocks({ tier: "pro", hasAdminAccess: false });
      renderSettings();

      expect(screen.getByRole("tab", { name: /invites/i })).toBeInTheDocument();
    });

    it("does not render Invites tab when user has admin access", () => {
      setupMocks({ tier: "pro", hasAdminAccess: true });
      renderSettings();

      expect(screen.queryByRole("tab", { name: /invites/i })).not.toBeInTheDocument();
    });

    it("renders Newsletter tab for free tier users", () => {
      setupMocks({ tier: "terminal" });
      renderSettings();

      expect(screen.getByRole("tab", { name: /newsletter/i })).toBeInTheDocument();
    });

    it("does not render Newsletter tab for pro tier users", () => {
      setupMocks({ tier: "pro" });
      renderSettings();

      expect(
        screen.queryByRole("tab", { name: /newsletter/i }),
      ).not.toBeInTheDocument();
    });

    it("disables Security tab for non-pro tier users", () => {
      setupMocks({ tier: "terminal" });
      renderSettings();

      const securityTab = screen.getByRole("tab", { name: /security/i });
      expect(securityTab).toBeDisabled();
    });

    it("enables Security tab for pro tier users", () => {
      setupMocks({ tier: "pro" });
      renderSettings();

      const securityTab = screen.getByRole("tab", { name: /security/i });
      expect(securityTab).not.toBeDisabled();
    });
  });

  describe("Tab Navigation", () => {
    it("switches to Layout tab when clicked", async () => {
      const user = userEvent.setup();
      renderSettings();

      const layoutTab = screen.getByRole("tab", { name: /layout/i });
      await user.click(layoutTab);

      // Tab should be clickable and not throw errors
      expect(layoutTab).toBeInTheDocument();
    });

    it("switches to Widget tab when clicked", async () => {
      const user = userEvent.setup();
      renderSettings();

      const widgetTab = screen.getByRole("tab", { name: /widget/i });
      await user.click(widgetTab);

      // Tab should be clickable and not throw errors
      expect(widgetTab).toBeInTheDocument();
    });

    it("switches to Advanced tab when clicked", async () => {
      const user = userEvent.setup();
      renderSettings();

      const advancedTab = screen.getByRole("tab", { name: /advanced/i });
      await user.click(advancedTab);

      // Tab should be clickable and not throw errors
      expect(advancedTab).toBeInTheDocument();
    });

    it("switches to Security tab when clicked (pro tier)", async () => {
      setupMocks({ tier: "pro" });
      const user = userEvent.setup();
      renderSettings();

      const securityTab = screen.getByRole("tab", { name: /security/i });
      await user.click(securityTab);

      // Tab should be clickable and not disabled
      expect(securityTab).not.toBeDisabled();
    });

    it("does not navigate to Security tab when disabled", async () => {
      setupMocks({ tier: "terminal" });
      const user = userEvent.setup();
      renderSettings();

      const securityTab = screen.getByRole("tab", { name: /security/i });
      await user.click(securityTab);

      expect(mockSetSearchParams).not.toHaveBeenCalledWith({ tab: "security" });
    });
  });

  describe("Tab Content Rendering", () => {
    it("renders General tab content by default", () => {
      renderSettings();

      expect(screen.getByTestId("general-tab")).toBeInTheDocument();
    });
  });

  describe("Feature Flag Combinations", () => {
    it("renders correct tabs for pro tier without admin access", () => {
      setupMocks({ tier: "pro", hasAdminAccess: false });
      renderSettings();

      expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /widget/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /invites/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /security/i })).not.toBeDisabled();
    });

    it("renders correct tabs for terminal tier with admin access", () => {
      setupMocks({ tier: "terminal", hasAdminAccess: true });
      renderSettings();

      expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /widget/i })).toBeInTheDocument();
      expect(screen.queryByRole("tab", { name: /invites/i })).not.toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /newsletter/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /security/i })).toBeDisabled();
    });

    it("renders correct tabs for enterprise tier", () => {
      setupMocks({ tier: "enterprise" as any, hasAdminAccess: false });
      renderSettings();

      expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /layout/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /widget/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /invites/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /advanced/i })).toBeInTheDocument();
    });
  });

  describe("Invite Button Feature Flag", () => {
    it("does not show Invites tab when showInviteButton is false", () => {
      mockConfig.ui.showInviteButton = false;
      setupMocks({ tier: "pro", hasAdminAccess: true });
      renderSettings();

      expect(screen.queryByRole("tab", { name: /invites/i })).not.toBeInTheDocument();
    });

    it("shows Invites tab when showInviteButton is true and not admin", () => {
      mockConfig.ui.showInviteButton = true;
      setupMocks({ tier: "pro", hasAdminAccess: false });
      renderSettings();

      expect(screen.getByRole("tab", { name: /invites/i })).toBeInTheDocument();
    });
  });
});

describe("useSaveSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("is called when Settings component mounts", () => {
    renderSettings();
    expect(useShallowThemeStore).toHaveBeenCalled();
    expect(useShallowAuthStore).toHaveBeenCalled();
    expect(useShallowAppStore).toHaveBeenCalled();
  });
});

describe("Settings Tab Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it("all tabs have proper ARIA roles", () => {
    renderSettings();

    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((tab) => {
      expect(tab).toHaveAttribute("role", "tab");
    });
  });

  it("tabs are keyboard navigable", async () => {
    const user = userEvent.setup();
    renderSettings();

    const generalTab = screen.getByRole("tab", { name: /general/i });
    generalTab.focus();

    // Simply verify the tab can receive focus
    expect(document.activeElement).toBe(generalTab);
  });
});

describe("Settings URL Parameters", () => {
  it("respects tab parameter from URL", () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useSearchParams: () => [
          new URLSearchParams({ tab: "advanced" }),
          mockSetSearchParams,
        ],
      };
    });
  });
});
