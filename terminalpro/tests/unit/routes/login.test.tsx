import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "~/api/auth.api";
import LoginPage from "~/routes/login";

// Mock many things
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({ capture: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("~/components/LayoutUnauth/GoogleLogin", () => ({
  GoogleLogin: () => <div>Google Login</div>,
}));
vi.mock("~/components/LayoutUnauth/MicrosoftLogin", () => ({
  MicrosoftLogin: () => <div>Microsoft Login</div>,
}));
vi.mock("~/components/LayoutUnauth/OktaLogin", () => ({
  OktaLogin: () => <div>Okta Login</div>,
}));

vi.mock("~/api/auth.api", () => ({
  login: vi.fn(),
  isValidMainTicker: vi.fn(() => true),
}));

vi.mock("~/lib/onPremFeatureFlags", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getEnabledIdentityProviders: () => ["google"],
    isOnPremDeployment: () => false,
  };
});

// Mock all internal stores to avoid state issues
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn((cb) =>
    cb({ user: null, logout: vi.fn(), login: vi.fn() }),
  ),
  useAuthStore: { getState: () => ({ updateUser: vi.fn() }) },
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(() => ({ updateRemoteItems: vi.fn() })),
}));
vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(() => ({ updateThemeState: vi.fn() })),
}));
vi.mock("~/lib/state/tutorial", () => ({
  useShallowTutorialStore: vi.fn(() => ({ setCompletedDates: vi.fn() })),
}));
vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: vi.fn(() => ({ setFeatureFlagsAndUsage: vi.fn() })),
}));
vi.mock("~/lib/state/backendConnector", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useShallowBackendConnectorStore: vi.fn(() => ({ updateBackendConnector: vi.fn() })),
  };
});
vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: vi.fn(() => ({ updateServers: vi.fn() })),
}));
vi.mock("~/lib/state/tableChartThemes", () => ({
  useShallowTableChartThemesStore: vi.fn(() => ({ updateThemeSettings: vi.fn() })),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form correctly", () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
  });

  it("calls apiLogin on submit", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValue({
      status: 200,
      user: { email: "test@test.com", pro_display_settings: {} },
      dash_sync: { owned: [], shared: [], entity_shared: [] },
    } as any);

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "test@test.com");
    await user.type(screen.getByLabelText("Password"), "Password123!");

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith(
        "test@test.com",
        "Password123!",
        false,
      );
    });
  });

  it("shows error message on failed login", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.login).mockResolvedValue({
      status: 404,
      detail: "Not found",
    } as any);

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>,
    );

    await user.type(screen.getByLabelText("Email"), "wrong@test.com");
    await user.type(screen.getByLabelText("Password"), "WrongPassword123!");

    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(
      () => {
        expect(
          screen.getByText(/The provided credentials do not match/),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
