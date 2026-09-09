import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MetadataDialog } from "~/components/MetadataDialogDraggableCard";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";

const mockTriggerCustomEvent = vi.fn();
const mockProcessWidgetId = vi.fn();
const mockUpdateWidget = vi.fn();
const mockHandleWidgetMetadata = vi.fn();

let mockWidget: WidgetT;
let mockAiEnhancements = true;
let mockWidgetMetadataItem: any = null;

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("~/api/auth.api", () => ({
  getFileWidgets: vi.fn(),
  getSingleWidgets: vi.fn(),
  getWidgetMetadata: vi.fn().mockResolvedValue([]),
  patchWidgetMetadata: vi.fn().mockResolvedValue({ success: true }),
  postFileWidget: vi.fn(),
  postSingleWidget: vi.fn(),
  postWidgetMetadata: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/constants")>();
  return {
    ...actual,
    inSnowflakeNativeApp: false,
  };
});

// biome-ignore format: off
vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    urls: { backend: "", ai: "http://localhost:3000/ai", platform: "", database: "" },
    authentication: { allowEmailLogin: true, allowRegistration: true, allowForgotPassword: true, identityProviders: [], sendMicrosoftIdToken: false, sendOktaIdToken: false, sendUserEmailAsHeader: false },
    authProviders: { googleClientId: "", azureClientId: "", azureTenantId: "", oktaClientId: "", oktaDomain: "" },
    copilot: { enabled: true, openbbCopilot: true, documentationLinks: true, webSearch: true, secFilings: false, jinaAi: true, aiEnhancements: true, showCustomKey: true },
    ui: { showMinimizeWidget: true, showChartGeneration: true, showFeedbackButton: false, showInviteButton: false, showDemoRequestButton: false, showEnterpriseTags: true, showExternalDocLinks: true, showHelpDocumentation: true, showChangelog: true, showOnboardingQuestions: true, showTos: true, showCopilotSwitcher: true, showRemoveFromOrg: true, defaultTheme: "dark", odpDownloadInstaller: true, showSalesEmail: false },
    services: { posthog: false, hubspotForms: false, email: true, nixtla: true, cloudflareWorker: true },
    data: { packageDataEnabled: true, allowedDataVendors: [], allowedDbTypes: [], openDataPlatformInstallerEnabled: true, allowHtmlJsExecution: false },
    mcp: { defaultServerEnabled: true },
    analytics: { posthogKey: "", posthogUrl: "" },
    whiteLabel: { name: "OpenBB Workspace", shortName: "OpenBB", loginImage: "", loginImageDark: "", leftSidebarLogo: "", leftSidebarLogoDark: "", favicon: "", description: "", keywords: "", mainColor: "#0088CC", fontFamily: "Inter", showFloatingThemePreview: false },
  }),
  _resetConfig: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: { aiEnhancements: boolean }) => unknown) =>
    selector({ aiEnhancements: mockAiEnhancements }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  isMetadataType: vi.fn().mockReturnValue(false),
  useShallowBackendConnectorStore: (
    selector: (state: {
      setStoredFiles: () => void;
      setSingleWidgets: () => void;
      setWidgetMetadata: () => void;
      getWidgetMetadataById: () => any;
    }) => unknown,
  ) =>
    selector({
      setStoredFiles: vi.fn(),
      setSingleWidgets: vi.fn(),
      setWidgetMetadata: vi.fn(),
      getWidgetMetadataById: () => mockWidgetMetadataItem,
    }),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (
    selector: (state: {
      addDataOnDashboardWidget: () => void;
      dashboardWidgetsData: Record<string, unknown>;
    }) => unknown,
  ) =>
    selector({
      addDataOnDashboardWidget: vi.fn(),
      dashboardWidgetsData: {},
    }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (
    selector: (state: {
      getWidgetsByAttribute: () => Record<string, WidgetT[]>;
      updateWidget: () => void;
    }) => unknown,
  ) =>
    selector({
      getWidgetsByAttribute: () => ({}),
      updateWidget: vi.fn(),
    }),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useGetWidgetsStore: {
    getState: () => ({
      getAppWidget: vi.fn(),
      getSqlWidget: vi.fn(),
      getRunCodeWidget: vi.fn(),
    }),
  },
}));

vi.mock("~/utils/dataConnectorsHelpers", () => ({
  handleWidgetMetadata: (...args: unknown[]) => mockHandleWidgetMetadata(...args),
  isDatabaseType: vi.fn().mockReturnValue(false),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils")>();
  return {
    ...actual,
    dispatchSaveState: vi.fn(),
    dispatchUpdateWidget: vi.fn(),
    isOmniType: vi.fn().mockReturnValue(false),
    isSSRMType: vi.fn().mockImplementation((type: string) => type.includes("ssrm")),
    processWidgetId: (...args: unknown[]) => mockProcessWidgetId(...args),
    triggerCustomEvent: (...args: unknown[]) => mockTriggerCustomEvent(...args),
  };
});

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(),
}));

const useWidgetContextMock = vi.mocked(useWidgetContext);

const setOpen = vi.fn();

function makeWidget(overrides: Partial<WidgetT> = {}): WidgetT {
  return {
    id: "widget-local-id",
    uuid: "widget-local-id",
    name: "Widget Name",
    description: "Widget Description",
    category: "Initial Category",
    subCategory: "Initial Sub Category",
    source: "Initial Source" as any,
    widgetId: "widget_studio-6630acf6-dcb1-4611-9430-5ac2e5b9bd22" as any,
    type: "ssrm_advanced",
    storage: {
      params: { query: "select * from foo" },
      chartView: { chartType: "column" },
      enableAdvanced: true,
    },
    params: [{ paramName: "query", type: "text", language: "sql" } as any],
    ...overrides,
  } as WidgetT;
}

function setupContext(widget: WidgetT) {
  useWidgetContextMock.mockReturnValue({
    widget,
    activeDashboardId: "dashboard-1",
    updateWidget: mockUpdateWidget,
  } as any);
}

describe("MetadataDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAiEnhancements = true;
    mockWidgetMetadataItem = {
      widgetId: "6630acf6-dcb1-4611-9430-5ac2e5b9bd22",
      name: "Stored Name",
      description: "Stored Description",
      category: "Stored Category",
      subCategory: "Stored Sub Category",
      source: "Stored Source",
      storage: {},
    };
    mockWidget = makeWidget();
    setupContext(mockWidget);
    mockHandleWidgetMetadata.mockReturnValue(mockWidgetMetadataItem);
    mockProcessWidgetId.mockReturnValue({
      uuid: "6630acf6-dcb1-4611-9430-5ac2e5b9bd22",
      cleanWidgetId: "widget_studio",
    });
  });

  it("defaults auto-update toggle to checked for SSRM advanced SQL widget when AI enhancements are enabled", () => {
    render(<MetadataDialog open={true} setOpen={setOpen} />);

    const autoUpdateToggle = screen.getByRole("checkbox", {
      name: /auto-update on run/i,
    });
    expect(autoUpdateToggle).toBeChecked();
  });

  it("dispatches run metadata update event with exact current metadata form values", async () => {
    const user = userEvent.setup();
    render(<MetadataDialog open={true} setOpen={setOpen} />);

    // Clear mock after initial render (dialog opening triggers requestStaleState event)
    mockTriggerCustomEvent.mockClear();

    await user.clear(await screen.findByLabelText("Name"));
    await user.type(
      await screen.findByLabelText("Name"),
      "SEC_CORPORATE_REPORT_ATTRIBUTES",
    );
    await user.clear(await screen.findByLabelText(/Description/i));
    await user.type(
      await screen.findByLabelText(/Description/i),
      "Company KPIs published in SEC filings using XBRL format.",
    );
    await user.clear(await screen.findByLabelText(/^Category\b/i));
    await user.type(
      await screen.findByLabelText(/^Category\b/i),
      "snowflake_public_data_free",
    );
    await user.clear(await screen.findByLabelText(/^Sub Category\b/i));
    await user.type(await screen.findByLabelText(/^Sub Category\b/i), "public-data");
    await user.clear(await screen.findByLabelText(/Source/i));
    await user.type(await screen.findByLabelText(/Source/i), "Table");

    await user.click(
      await screen.findByRole("button", { name: /generate new metadata/i }),
    );

    expect(mockTriggerCustomEvent).toHaveBeenCalledTimes(1);
    expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
      "runMetadataUpdate-widget-local-id",
      {
        runMetadataUpdate: true,
        metadata: {
          name: "SEC_CORPORATE_REPORT_ATTRIBUTES",
          description: "Company KPIs published in SEC filings using XBRL format.",
          category: "snowflake_public_data_free",
          subCategory: "public-data",
          source: "Table",
        },
      },
    );
  });

  it("updates widget storage immediately when auto-update toggle changes", async () => {
    const user = userEvent.setup();
    render(<MetadataDialog open={true} setOpen={setOpen} />);

    const autoUpdateToggle = screen.getByRole("checkbox", {
      name: /auto-update on run/i,
    });
    expect(autoUpdateToggle).toBeChecked();

    await user.click(autoUpdateToggle);

    expect(mockUpdateWidget).toHaveBeenCalledTimes(1);

    const updateArg = mockUpdateWidget.mock.calls[0]?.[0];
    expect(updateArg).toBeTypeOf("function");

    const updatedWidget = updateArg(mockWidget);
    expect(updatedWidget.storage?.autoUpdateMetadataOnRun).toBe(false);
  });

  it("hides metadata update section when AI enhancements are off", () => {
    mockAiEnhancements = false;
    render(<MetadataDialog open={true} setOpen={setOpen} />);

    const runButton = screen.queryByRole("button", { name: /generate new metadata/i });
    expect(runButton).not.toBeInTheDocument();

    const autoUpdateCheckbox = screen.queryByRole("checkbox", {
      name: /auto-update on run/i,
    });
    expect(autoUpdateCheckbox).not.toBeInTheDocument();
  });
});
