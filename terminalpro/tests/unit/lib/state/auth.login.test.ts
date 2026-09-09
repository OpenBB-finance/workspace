import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "~/lib/state/auth";
import type { ProLoginResponse } from "~/types/auth.type";

// Mock all external dependencies
vi.mock("~/api/auth.api", () => ({
  putEnabledBundles: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/lib/state/copilot", () => ({
  useCopilotStore: {
    persist: { clearStorage: vi.fn() },
  },
}));

vi.mock("~/lib/state/dataConnector", () => ({
  useDataConnectorStore: {
    persist: { clearStorage: vi.fn() },
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    persist: { clearStorage: vi.fn() },
  },
}));

vi.mock("~/lib/state/tutorial", () => ({
  useTutorialStore: {
    persist: { clearStorage: vi.fn() },
  },
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useSharedAppStore: {
    persist: { clearStorage: vi.fn() },
  },
}));

vi.mock("~/lib/widget_bundles.json", () => ({
  default: {
    openbb: {
      name: "OpenBB",
      enabled_by_default: true,
      widgets: ["equity_profile", "company_news"],
    },
    analytics: {
      name: "Analytics",
      enabled_by_default: false,
      widgets: ["analytics_widget"],
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useAuthStore - Login Tests", () => {
  const createMockLoginResponse = (
    overrides: Partial<ProLoginResponse> = {},
  ): ProLoginResponse => ({
    email: "test@example.com",
    username: "testuser",
    access_token: "token-123",
    entity_name: "Test Entity",
    role: "user",
    uuid: "user-uuid-123",
    is_first_login: false,
    show_changelog: false,
    microsoftIdToken: undefined,
    oktaIdToken: undefined,
    developer_onboarding_info: null,
    // @ts-expect-error - ignored for now
    feature_entitlements: { tier: "free" },
    enabled_widget_bundles: {
      enabled_bundles: ["openbb"],
      disabled_widgets: [],
    },
    user: {
      first_name: "Test",
      last_name: "User",
      primary_usage: "",
      accepted_pro_tos: true,
      // @ts-expect-error - ignored for now
      pro_display_settings: {
        lastVisitedPage: "/app",
      },
    },
    ...overrides,
  });

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      enabledBundles: ["openbb"],
      disabledWidgets: [],
      tosAccepted: false,
      isFirstLogin: false,
      needsOnboarding: false,
      needsInAppOnboarding: true,
      showChangelog: false,
      name: { first: "", last: "" },
      onBoardingData: {
        role: "",
        organizationName: "",
        organization: "",
        assetClasses: [],
        geographies: [],
        industrySectors: [],
        primaryUsage: "",
        programmingExperience: "",
        dataTypes: [],
        otherDataType: "",
        skipOnboarding: false,
      },
      searchTickerHistory: [],
      promptHistory: [],
      lastVisitedPage: "/app",
      identified: false,
      openaiApiKey: "",
      perplexityApiKey: "",
      onboardingQuestions: null,
      alphaWarning: true,
      microsoftIdToken: "",
      oktaIdToken: "",
    });
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("sets user data from login response", async () => {
      const response = createMockLoginResponse();
      const { login } = useAuthStore.getState();

      await login(response);

      const state = useAuthStore.getState();
      expect(state.user?.email).toBe("test@example.com");
      expect(state.user?.username).toBe("testuser");
      expect(state.user?.token).toBe("token-123");
      expect(state.user?.uuid).toBe("user-uuid-123");
    });

    it("sets name from user data", async () => {
      const response = createMockLoginResponse({
        user: {
          first_name: "John",
          last_name: "Doe",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {},
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      const state = useAuthStore.getState();
      expect(state.name.first).toBe("John");
      expect(state.name.last).toBe("Doe");
    });

    it("sets tosAccepted from user data", async () => {
      const response = createMockLoginResponse({
        user: {
          first_name: "Test",
          last_name: "User",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {},
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().tosAccepted).toBe(true);
    });

    it("sets showChangelog from response", async () => {
      const response = createMockLoginResponse({ show_changelog: true });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().showChangelog).toBe(true);
    });

    it("sets isFirstLogin from response", async () => {
      const response = createMockLoginResponse({ is_first_login: true });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().isFirstLogin).toBe(true);
    });

    it("sets enabledBundles from response", async () => {
      const response = createMockLoginResponse({
        enabled_widget_bundles: {
          enabled_bundles: ["openbb", "analytics"],
          disabled_widgets: [],
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      const bundles = useAuthStore.getState().enabledBundles;
      expect(bundles).toContain("openbb");
      expect(bundles).toContain("analytics");
    });

    it("sets disabledWidgets from response", async () => {
      const response = createMockLoginResponse({
        enabled_widget_bundles: {
          enabled_bundles: ["openbb"],
          disabled_widgets: ["equity_profile"],
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().disabledWidgets).toContain("equity_profile");
    });

    it("returns true when onboarding is valid", async () => {
      const response = createMockLoginResponse({
        // @ts-expect-error - ignored for now
        developer_onboarding_info: {
          role: "developer",
          organization: "Test Org",
          skipOnboarding: false,
        },
        user: {
          first_name: "John",
          last_name: "Doe",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {},
        },
      });
      const { login } = useAuthStore.getState();

      const result = await login(response);

      expect(result).toBe(true);
      expect(useAuthStore.getState().needsOnboarding).toBe(false);
    });

    it("returns false when onboarding is needed", async () => {
      const response = createMockLoginResponse({
        developer_onboarding_info: null,
        user: {
          first_name: "",
          last_name: "",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {},
        },
      });
      const { login } = useAuthStore.getState();

      const result = await login(response);

      expect(result).toBe(false);
      expect(useAuthStore.getState().needsOnboarding).toBe(true);
    });

    it("returns true when skipOnboarding is true", async () => {
      const response = createMockLoginResponse({
        // @ts-expect-error - ignored for now
        developer_onboarding_info: {
          skipOnboarding: true,
        },
        user: {
          first_name: "",
          last_name: "",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {},
        },
      });
      const { login } = useAuthStore.getState();

      const result = await login(response);

      expect(result).toBe(true);
    });

    it("sets lastVisitedPage from display settings", async () => {
      const response = createMockLoginResponse({
        user: {
          first_name: "Test",
          last_name: "User",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {
            lastVisitedPage: "/app/explore",
          },
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().lastVisitedPage).toBe("/app/explore");
    });

    it("sets API keys from display settings", async () => {
      const response = createMockLoginResponse({
        user: {
          first_name: "Test",
          last_name: "User",
          primary_usage: "",
          accepted_pro_tos: true,
          // @ts-expect-error - ignored for now
          pro_display_settings: {
            openaiApiKey: "openai-key-123",
            perplexityApiKey: "perplexity-key-456",
          },
        },
      });
      const { login } = useAuthStore.getState();

      await login(response);

      const state = useAuthStore.getState();
      expect(state.openaiApiKey).toBe("openai-key-123");
      expect(state.perplexityApiKey).toBe("perplexity-key-456");
    });

    it("sets onboardingQuestions from response", async () => {
      const onboardingInfo = {
        role: "analyst",
        organization: "Finance Corp",
        programmingExperience: "intermediate",
        dataTypes: ["financial", "market"],
        otherDataType: "",
        organizationName: "Finance Corp",
        skipOnboarding: false,
      };
      const response = createMockLoginResponse({
        // @ts-expect-error - ignored for now
        developer_onboarding_info: onboardingInfo,
      });
      const { login } = useAuthStore.getState();

      await login(response);

      expect(useAuthStore.getState().onboardingQuestions).toEqual(onboardingInfo);
    });
  });

  describe("checkNewBundles", () => {
    it("enables new default bundles for free tier", () => {
      useAuthStore.setState({
        enabledBundles: [],
        disabledWidgets: [],
      });

      const { checkNewBundles } = useAuthStore.getState();
      checkNewBundles(false);

      expect(useAuthStore.getState().enabledBundles).toContain("openbb");
    });
  });
});
