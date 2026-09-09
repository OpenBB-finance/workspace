import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AuthState, useAuthStore } from "~/lib/state/auth";

// Mock all external dependencies
vi.mock("~/api/auth.api", () => ({
  putEnabledBundles: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/lib/widget_bundles.json", () => ({
  default: {
    openbb: {
      name: "OpenBB",
      enabled_by_default: true,
      widgets: ["widget1", "widget2"],
    },
    premium: {
      name: "Premium",
      enabled_by_default: false,
      pro_only: true,
      widgets: ["premiumWidget1"],
    },
    analytics: {
      name: "Analytics",
      enabled_by_default: true,
      widgets: ["analyticsWidget1"],
    },
  },
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

vi.mock("~/lib/state/sharedApp", () => ({
  useSharedAppStore: {
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Store the initial state for resetting
let initialState: AuthState;

describe("useAuthStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    initialState = useAuthStore.getState();
    useAuthStore.setState({
      user: null,
      enabledBundles: ["openbb", "analytics"],
      disabledWidgets: [],
      tosAccepted: false,
      needsOnboarding: false,
      needsInAppOnboarding: true,
      showChangelog: false,
      searchTickerHistory: [],
      promptHistory: [],
      perplexityApiKey: "",
      openaiApiKey: "",
      identified: false,
      lastVisitedPage: "/app",
      isFirstLogin: false,
      onboardingQuestions: null,
      alphaWarning: true,
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
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("API keys management", () => {
    it("should set perplexity API key", () => {
      useAuthStore.getState().setPerplexityApiKey("test-perplexity-key");
      expect(useAuthStore.getState().perplexityApiKey).toBe("test-perplexity-key");
    });

    it("should set openai API key", () => {
      useAuthStore.getState().setOpenaiApiKey("test-openai-key");
      expect(useAuthStore.getState().openaiApiKey).toBe("test-openai-key");
    });

    it("should set both copilot API keys at once", () => {
      useAuthStore.getState().setCopilotApiKeys({
        perplexityApiKey: "perplexity-123",
        openaiApiKey: "openai-456",
      });

      const state = useAuthStore.getState();
      expect(state.perplexityApiKey).toBe("perplexity-123");
      expect(state.openaiApiKey).toBe("openai-456");
    });

    it("should handle empty strings in setCopilotApiKeys", () => {
      useAuthStore.getState().setPerplexityApiKey("existing-key");
      useAuthStore.getState().setCopilotApiKeys({
        perplexityApiKey: "",
        openaiApiKey: "",
      });

      const state = useAuthStore.getState();
      expect(state.perplexityApiKey).toBe("");
      expect(state.openaiApiKey).toBe("");
    });
  });

  describe("identified state", () => {
    it("should update identified state", () => {
      expect(useAuthStore.getState().identified).toBe(false);

      useAuthStore.getState().setIdentified(true);
      expect(useAuthStore.getState().identified).toBe(true);

      useAuthStore.getState().setIdentified(false);
      expect(useAuthStore.getState().identified).toBe(false);
    });
  });

  describe("lastVisitedPage", () => {
    it("should update last visited page", () => {
      useAuthStore.getState().updateLastVisitedPage("/app/dashboard/123");
      expect(useAuthStore.getState().lastVisitedPage).toBe("/app/dashboard/123");
    });

    it("should handle various page paths", () => {
      const paths = ["/app", "/app/settings", "/app/dashboard/abc-123?tab=overview"];

      for (const path of paths) {
        useAuthStore.getState().updateLastVisitedPage(path);
        expect(useAuthStore.getState().lastVisitedPage).toBe(path);
      }
    });
  });

  describe("toggleBundle", () => {
    it("should enable a disabled bundle", () => {
      useAuthStore.setState({ enabledBundles: ["openbb"] });

      useAuthStore.getState().toggleBundle("analytics");

      expect(useAuthStore.getState().enabledBundles).toContain("analytics");
    });

    it("should disable an enabled bundle", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb", "analytics"],
        disabledWidgets: [],
      });

      useAuthStore.getState().toggleBundle("analytics");

      expect(useAuthStore.getState().enabledBundles).not.toContain("analytics");
    });

    it("should add bundle widgets to disabled list when disabling bundle", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb", "analytics"],
        disabledWidgets: [],
      });

      useAuthStore.getState().toggleBundle("analytics");

      expect(useAuthStore.getState().disabledWidgets).toContain("analyticsWidget1");
    });

    it("should remove bundle widgets from disabled list when enabling bundle", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb"],
        disabledWidgets: ["analyticsWidget1"],
      });

      useAuthStore.getState().toggleBundle("analytics");

      expect(useAuthStore.getState().disabledWidgets).not.toContain("analyticsWidget1");
    });
  });

  describe("toggleWidgetDisabled", () => {
    it("should disable an enabled widget", () => {
      useAuthStore.setState({ disabledWidgets: [] });

      useAuthStore.getState().toggleWidgetDisabled("widget1");

      expect(useAuthStore.getState().disabledWidgets).toContain("widget1");
    });

    it("should enable a disabled widget", () => {
      useAuthStore.setState({ disabledWidgets: ["widget1"] });

      useAuthStore.getState().toggleWidgetDisabled("widget1");

      expect(useAuthStore.getState().disabledWidgets).not.toContain("widget1");
    });

    it("should enable bundle when enabling a widget from that bundle", () => {
      useAuthStore.setState({
        enabledBundles: [],
        disabledWidgets: ["widget1"],
      });

      useAuthStore.getState().toggleWidgetDisabled("widget1");

      // widget1 belongs to openbb bundle
      expect(useAuthStore.getState().enabledBundles).toContain("openbb");
    });
  });

  describe("updateUser", () => {
    it("should update user with partial data", () => {
      useAuthStore.setState({
        user: {
          email: "test@example.com",
          username: "testuser",
          token: "token123",
          entity_name: null,
          role: null,
          uuid: "uuid-123",
        },
      });

      useAuthStore.getState().updateUser({ email: "new@example.com" });

      const user = useAuthStore.getState().user;
      expect(user?.email).toBe("new@example.com");
      expect(user?.username).toBe("testuser");
      expect(user?.token).toBe("token123");
    });

    it("should handle updating when user is null", () => {
      useAuthStore.setState({ user: null });

      useAuthStore.getState().updateUser({ email: "test@example.com" });

      // Should create user object with the new property
      expect(useAuthStore.getState().user?.email).toBe("test@example.com");
    });
  });

  describe("updateOnboarding", () => {
    it("should update needsOnboarding flag", () => {
      useAuthStore.setState({ needsOnboarding: false });

      useAuthStore.getState().updateOnboarding(true);
      expect(useAuthStore.getState().needsOnboarding).toBe(true);

      useAuthStore.getState().updateOnboarding(false);
      expect(useAuthStore.getState().needsOnboarding).toBe(false);
    });
  });

  describe("updateInAppOnboarding", () => {
    it("should update needsInAppOnboarding flag", () => {
      useAuthStore.setState({ needsInAppOnboarding: true });

      useAuthStore.getState().updateInAppOnboarding(false);
      expect(useAuthStore.getState().needsInAppOnboarding).toBe(false);
    });
  });

  describe("updateOnboardingData", () => {
    it("should merge onboarding data with existing data", () => {
      useAuthStore.setState({
        onBoardingData: {
          role: "developer",
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
      });

      useAuthStore.getState().updateOnboardingData({
        organization: "Tech Corp",
        primaryUsage: "research",
      });

      const data = useAuthStore.getState().onBoardingData;
      expect(data.role).toBe("developer");
      expect(data.organization).toBe("Tech Corp");
      expect(data.primaryUsage).toBe("research");
    });

    it("should handle array updates", () => {
      useAuthStore.getState().updateOnboardingData({
        assetClasses: ["equities", "bonds"],
        dataTypes: ["financial", "economic"],
      });

      const data = useAuthStore.getState().onBoardingData;
      expect(data.assetClasses).toEqual(["equities", "bonds"]);
      expect(data.dataTypes).toEqual(["financial", "economic"]);
    });
  });

  describe("updateName", () => {
    it("should update name with partial data", () => {
      useAuthStore.setState({ name: { first: "John", last: "Doe" } });

      useAuthStore.getState().updateName({ first: "Jane", last: "Doe" });

      const name = useAuthStore.getState().name;
      expect(name.first).toBe("Jane");
      expect(name.last).toBe("Doe");
    });

    it("should merge with existing name", () => {
      useAuthStore.setState({ name: { first: "John", last: "Doe" } });

      useAuthStore.getState().updateName({ first: "Jane", last: "Smith" });

      const name = useAuthStore.getState().name;
      expect(name.first).toBe("Jane");
      expect(name.last).toBe("Smith");
    });
  });

  describe("updateSearchTickerHistory", () => {
    it("should update search ticker history", () => {
      const tickers = [
        { symbol: "AAPL", id: "AAPL", name: "Apple Inc", category: "equity" },
        { symbol: "MSFT", id: "MSFT", name: "Microsoft", category: "equity" },
      ] as any[];

      useAuthStore.getState().updateSearchTickerHistory(tickers);

      expect(useAuthStore.getState().searchTickerHistory).toHaveLength(2);
    });

    it("should deduplicate tickers by symbol", () => {
      const tickers = [
        { symbol: "AAPL", id: "AAPL-1", name: "Apple Inc", category: "equity" },
        { symbol: "AAPL", id: "AAPL-2", name: "Apple Updated", category: "equity" },
        { symbol: "MSFT", id: "MSFT", name: "Microsoft", category: "equity" },
      ] as any[];

      useAuthStore.getState().updateSearchTickerHistory(tickers);

      const history = useAuthStore.getState().searchTickerHistory;
      expect(history).toHaveLength(2);
      // Should keep last occurrence
      const aapl = history.find((t) => t.symbol === "AAPL");
      expect(aapl?.id).toBe("AAPL-2");
    });
  });

  describe("updatePromptHistory", () => {
    it("should update prompt history", () => {
      const prompts = [
        { prompt: "Show me AAPL data", widgetId: "widget1" },
        { prompt: "Compare stocks", widgetId: "widget2" },
      ];

      useAuthStore.getState().updatePromptHistory(prompts);

      expect(useAuthStore.getState().promptHistory).toEqual(prompts);
    });

    it("should replace existing prompt history", () => {
      useAuthStore.setState({
        promptHistory: [{ prompt: "old", widgetId: "old" }],
      });

      const newPrompts = [{ prompt: "new", widgetId: "new" }];
      useAuthStore.getState().updatePromptHistory(newPrompts);

      expect(useAuthStore.getState().promptHistory).toEqual(newPrompts);
    });
  });

  describe("updateTosAccepted", () => {
    it("should update TOS accepted state", () => {
      useAuthStore.setState({ tosAccepted: false });

      useAuthStore.getState().updateTosAccepted(true);
      expect(useAuthStore.getState().tosAccepted).toBe(true);
    });
  });

  describe("updateShowChangelog", () => {
    it("should update show changelog state", () => {
      useAuthStore.setState({ showChangelog: false });

      useAuthStore.getState().updateShowChangelog(true);
      expect(useAuthStore.getState().showChangelog).toBe(true);
    });
  });

  describe("updateAlphaWarning", () => {
    it("should update alpha warning state", () => {
      useAuthStore.setState({ alphaWarning: true });

      useAuthStore.getState().updateAlphaWarning(false);
      expect(useAuthStore.getState().alphaWarning).toBe(false);
    });
  });

  describe("checkNewBundles", () => {
    it("should not update bundles when all default bundles are present", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb", "analytics"],
        disabledWidgets: [],
      });

      const initialBundles = [...useAuthStore.getState().enabledBundles];
      useAuthStore.getState().checkNewBundles(false);

      expect(useAuthStore.getState().enabledBundles).toEqual(initialBundles);
    });

    it("should add missing default bundles", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb"],
        disabledWidgets: [],
      });

      useAuthStore.getState().checkNewBundles(false);

      expect(useAuthStore.getState().enabledBundles).toContain("analytics");
    });

    it("should not add pro-only bundles for non-pro tier", () => {
      useAuthStore.setState({
        enabledBundles: ["openbb"],
        disabledWidgets: [],
      });

      useAuthStore.getState().checkNewBundles(false);

      expect(useAuthStore.getState().enabledBundles).not.toContain("premium");
    });
  });
});
