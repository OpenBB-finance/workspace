import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopilotContext } from "~/components/AI/CopilotContext";

const {
  mockConstants,
  mockFetchAgentsData,
  mockShowNotification,
  mockUseShallowCopilotStore,
  mockUseShallowCopilotDataStore,
} = vi.hoisted(() => ({
  mockConstants: {
    inSnowflakeNativeApp: false,
  },
  mockFetchAgentsData: vi.fn(),
  mockShowNotification: vi.fn(),
  mockUseShallowCopilotStore: vi.fn(),
  mockUseShallowCopilotDataStore: vi.fn(),
}));

vi.mock("~/api/auth.api", () => ({
  fetchAgentsData: (...args: unknown[]) => mockFetchAgentsData(...args),
}));

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get inSnowflakeNativeApp() {
      return mockConstants.inSnowflakeNativeApp;
    },
  };
});

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    urls: {
      backend: "",
      ai: "https://workspace.example.com",
      platform: "",
      database: "",
    },
    authentication: {
      allowEmailLogin: true,
      allowRegistration: true,
      allowForgotPassword: true,
      identityProviders: [],
      sendMicrosoftIdToken: false,
      sendOktaIdToken: false,
      sendUserEmailAsHeader: false,
    },
    authProviders: {
      googleClientId: "",
      azureClientId: "",
      azureTenantId: "",
      oktaClientId: "",
      oktaDomain: "",
    },
    copilot: {
      enabled: true,
      openbbCopilot: true,
      documentationLinks: true,
      webSearch: true,
      secFilings: false,
      jinaAi: true,
      aiEnhancements: true,
      showCustomKey: true,
    },
    ui: {
      showMinimizeWidget: true,
      showChartGeneration: true,
      showFeedbackButton: false,
      showInviteButton: false,
      showDemoRequestButton: false,
      showEnterpriseTags: true,
      showExternalDocLinks: true,
      showHelpDocumentation: true,
      showChangelog: true,
      showOnboardingQuestions: true,
      showTos: true,
      showCopilotSwitcher: true,
      showRemoveFromOrg: true,
      defaultTheme: "dark",
      odpDownloadInstaller: true,
      showSalesEmail: false,
    },
    services: {
      posthog: false,
      hubspotForms: false,
      email: true,
      nixtla: true,
      cloudflareWorker: true,
    },
    data: {
      packageDataEnabled: true,
      allowedDataVendors: [],
      allowedDbTypes: [],
      openDataPlatformInstallerEnabled: true,
      allowHtmlJsExecution: false,
    },
    mcp: {
      defaultServerEnabled: true,
    },
    analytics: {
      posthogKey: "",
      posthogUrl: "",
    },
    whiteLabel: {
      name: "OpenBB Workspace",
      shortName: "OpenBB",
      loginImage: "",
      loginImageDark: "",
      leftSidebarLogo: "",
      leftSidebarLogoDark: "",
      favicon: "",
      description: "",
      keywords: "",
      mainColor: "#0088CC",
      fontFamily: "Inter",
      showFloatingThemePreview: false,
    },
  }),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: unknown) => mockUseShallowCopilotStore(selector),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: unknown) =>
    mockUseShallowCopilotDataStore(selector),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (
    selector: (state: { theme: string; aiEnhancements: boolean }) => unknown,
  ) => selector({ theme: "dark", aiEnhancements: true }),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/lib/utils/toast", () => ({
  showNotification: (...args: unknown[]) => mockShowNotification(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({}),
  };
});

vi.mock("~/components/Tooltip", () => ({
  default: ({ children }: { children: ReactNode; message: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("~/components/General/SnowflakeHide", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/ds/atoms/HintLabel", () => ({
  HintLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: () => <input type="text" />,
}));

vi.mock("~/components/ds/atoms/Popover", () => ({
  Popover: ({
    children,
    content,
    open,
  }: {
    children: ReactNode;
    content?: ReactNode;
    open?: boolean;
  }) => (
    <div>
      {children}
      {open ? content : null}
    </div>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  SelectRoot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/AI/hooks/useCopilotAddToContext", () => ({
  useCopilotContextSuggestions: () => ({
    searchSuggestions: vi.fn(),
    getRichWidgetTooltip: vi.fn(),
    handleKeyDown: vi.fn(),
    suggestionElements: [],
    handleRemoveMentionFromText: vi.fn(),
  }),
}));

vi.mock("~/components/AI/hooks/useGetCopilotRequestHeaders", () => ({
  useGetCopilotRequestHeaders: () => () => ({}),
}));

vi.mock("~/components/AI/McpToolsButton", () => ({
  McpToolsButton: () => <div data-testid="mcp-tools-button" />,
}));

vi.mock("~/components/AI/SemanticViewsDropdown", () => ({
  SemanticViewsButton: () => <div data-testid="semantic-views-button" />,
}));

type CopilotStoreState = {
  selectedCopilot: {
    holderUuid?: string | null;
    features: Record<string, boolean | object | undefined>;
  } | null;
  setSelectedCopilot: ReturnType<typeof vi.fn>;
  initializeCustomFeatures: ReturnType<typeof vi.fn>;
  setHovered: ReturnType<typeof vi.fn>;
  setHoveredTabId: ReturnType<typeof vi.fn>;
  hoveredTabId: null | string;
};

type CopilotDataStoreState = {
  copilotWidgets: {
    selectedWidgets: Array<{
      uuid?: string;
      widget_id?: string;
      metadata?: { innerTabId?: string };
      name?: string;
    }>;
  };
  extraWidgetsEnabled: boolean;
  toggleExtraWidgetsEnabled: ReturnType<typeof vi.fn>;
  generativeUiEnabled: boolean;
  toggleGenerativeUiEnabled: ReturnType<typeof vi.fn>;
  toggleSelectedWidget: ReturnType<typeof vi.fn>;
  isMentionTrackedWidget: ReturnType<typeof vi.fn>;
  getCopilotWidgets: ReturnType<typeof vi.fn>;
  removeMentionTrackedWidget: ReturnType<typeof vi.fn>;
  isWidgetSelected: ReturnType<typeof vi.fn>;
  setCopilotWidgets: ReturnType<typeof vi.fn>;
  removeDataFromDashboardWidget: ReturnType<typeof vi.fn>;
  removePreSelectedWidget: ReturnType<typeof vi.fn>;
};

let copilotStoreState: CopilotStoreState;
let copilotDataStoreState: CopilotDataStoreState;

describe("CopilotContext", () => {
  beforeEach(() => {
    mockConstants.inSnowflakeNativeApp = false;
    mockFetchAgentsData.mockResolvedValue([]);
    mockShowNotification.mockReset();

    copilotStoreState = {
      selectedCopilot: {
        holderUuid: null,
        features: {},
      },
      setSelectedCopilot: vi.fn(),
      initializeCustomFeatures: vi.fn(),
      setHovered: vi.fn(),
      setHoveredTabId: vi.fn(),
      hoveredTabId: null,
    };

    copilotDataStoreState = {
      copilotWidgets: {
        selectedWidgets: [],
      },
      extraWidgetsEnabled: false,
      toggleExtraWidgetsEnabled: vi.fn(),
      generativeUiEnabled: false,
      toggleGenerativeUiEnabled: vi.fn(),
      toggleSelectedWidget: vi.fn(),
      isMentionTrackedWidget: vi.fn().mockReturnValue(false),
      getCopilotWidgets: vi.fn().mockReturnValue({ selectedWidgets: [] }),
      removeMentionTrackedWidget: vi.fn(),
      isWidgetSelected: vi.fn().mockReturnValue(false),
      setCopilotWidgets: vi.fn(),
      removeDataFromDashboardWidget: vi.fn(),
      removePreSelectedWidget: vi.fn(),
    };

    mockUseShallowCopilotStore.mockImplementation(
      (selector: (state: object) => unknown) => selector(copilotStoreState),
    );
    mockUseShallowCopilotDataStore.mockImplementation(
      (selector: (state: object) => unknown) => selector(copilotDataStoreState),
    );
  });

  it("renders the copilot settings button", () => {
    render(<CopilotContext />);

    expect(screen.getByRole("button", { name: "Copilot settings" })).toBeInTheDocument();
  });
});
