import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "~/api/auth.api";
import * as dashboardApi from "~/api/dashboard.api";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useShallowThemeStore } from "~/lib/state/theme";
import DeveloperOnboardingHomepage from "~/routes/developer_onboarding/DeveloperOnboardingHomepage";

// Define mockNavigate at the top level
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Add these mocks at the top with your other mocks
vi.mock("dayjs", () => {
  const dayjs = () => ({
    year: () => 2024,
    quarter: () => 1,
    format: () => "2024-01-01",
    // Add any other dayjs methods you need
  });
  dayjs.extend = vi.fn();
  return { default: dayjs };
});

// Mock dayjs plugins if needed
vi.mock("dayjs/plugin/quarter", () => ({
  default: vi.fn(),
}));

vi.mock("dayjs/plugin/isSameOrAfter", () => ({
  default: vi.fn(),
}));

vi.mock("dayjs/plugin/isSameOrBefore", () => ({
  default: vi.fn(),
}));

// Mock all the stores and APIs
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(),
  useAuthStore: () => ({ getState: () => ({}) }),
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

vi.mock("~/api/auth.api", () => ({
  getDeveloperOnboardingQuestions: vi.fn(),
  submitDeveloperOnboardingQuestions: vi.fn(),
  updateFullName: vi.fn(),
  userHasEntity: vi.fn(),
}));

vi.mock("~/api/dashboard.api", () => ({
  getDashboards: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("~/lib/utils/utils", () => ({
  cn: vi.fn(),
  formatDate: vi.fn(),
}));

// Add this mock for utils
vi.mock("~/lib/utils", () => ({
  getWidgetsWithSupportedAssetClass: vi.fn().mockReturnValue([]),
  COLORS: ["#000000", "#111111"],
  getJsonWidget: vi.fn(),
  isLight: vi.fn(),
  generateRandomColor: vi.fn().mockReturnValue("#FF0000"),
  cn: vi.fn(),
  formatDate: vi.fn(),
}));

// Mock the entire ChartHighcharts component
vi.mock("~/components/Widgets/charting/ChartHighcharts", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

// Mock any other components that might use Highcharts
vi.mock("~/components/Charting/FinancialMetricsTabs", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

vi.mock("~/components/Charting/TVIndicatorsDialog", () => ({
  default: vi.fn().mockImplementation(() => null),
}));

describe("DeveloperOnboardingHomepage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default store states
    (useShallowAuthStore as any).mockImplementation(() => ({
      user: { id: "123" },
      name: { first: "", last: "" },
      onBoardingData: {},
      updateOnboardingData: vi.fn(),
      updateOnboarding: vi.fn(),
      entityName: "test-entity",
    }));

    (useShallowAppStore as any).mockImplementation(() => ({
      addTab: vi.fn(),
      items: [],
    }));

    (useShallowThemeStore as any).mockImplementation(() => ({
      theme: "dark",
      defaultTicker: "AAPL",
    }));

    (useShallowFeatureFlagsStore as any).mockImplementation(() => ({
      featureFlags: {},
    }));

    // Setup default API responses
    vi.mocked(authApi.userHasEntity).mockResolvedValue({ success: true });
    vi.mocked(authApi.getDeveloperOnboardingQuestions).mockResolvedValue(null);
    // @ts-expect-error - ignored for now
    vi.mocked(dashboardApi.getDashboards).mockResolvedValue({ owned: {} });
  });

  it("renders the form with all required fields", async () => {
    render(
      <BrowserRouter>
        <DeveloperOnboardingHomepage />
      </BrowserRouter>,
    );

    // Check for required form elements
    await waitFor(() => {
      expect(screen.getByText("Organization Type")).toBeInTheDocument();
      expect(screen.getByText("Role")).toBeInTheDocument();
    });
  });
});
