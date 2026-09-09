import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { forwardRef } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "~/api/auth.api";
import RegisterPage from "~/routes/register";

// Mock dependencies
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

vi.mock("~/components/LayoutUnauth/GoogleRegister", () => ({
  GoogleRegister: () => <div>Google Register</div>,
}));
vi.mock("~/components/LayoutUnauth/MicrosoftRegister", () => ({
  MicrosoftRegister: () => <div>Microsoft Register</div>,
}));
vi.mock("~/components/LayoutUnauth/OktaRegister", () => ({
  OktaRegister: () => <div>Okta Register</div>,
}));

vi.mock("~/api/auth.api", () => ({
  registerUser: vi.fn(),
  isValidMainTicker: vi.fn(() => true),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  FormSelect: forwardRef(({ options, value, onChange, placeholder }: any, _ref) => (
    <select
      aria-label={placeholder}
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="" disabled={true}>
        {placeholder}
      </option>
      {options?.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )),
}));

vi.mock("~/lib/onPremFeatureFlags", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getEnabledIdentityProviders: () => ["google"],
  };
});

// Mock stores
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn((cb) =>
    cb({ login: vi.fn(), needsOnboarding: false, lastVisitedPage: "/" }),
  ),
  useAuthStore: () => ({ getState: () => ({}) }),
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
vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: vi.fn(() => ({ updateBackendConnector: vi.fn() })),
}));
vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: vi.fn(() => ({ updateServers: vi.fn() })),
}));
vi.mock("~/lib/state/tableChartThemes", () => ({
  useShallowTableChartThemesStore: vi.fn(() => ({ updateThemeSettings: vi.fn() })),
}));

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders registration form", () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>,
    );

    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
  });

  it("calls registerUser on submit", async () => {
    vi.mocked(authApi.registerUser).mockResolvedValue({
      status: 200,
      detail: "",
    } as any);

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newuser@test.com" },
    });

    fireEvent.change(screen.getByLabelText(/select option/i), {
      target: { value: "linkedin" },
    });

    fireEvent.click(screen.getByLabelText(/I agree/i)); // Agreement checkbox

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(authApi.registerUser).toHaveBeenCalledWith(
        "newuser@test.com",
        false,
        "linkedin",
      );
    });
  });
});
