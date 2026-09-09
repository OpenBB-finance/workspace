import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";

// Mock dependencies
const mockGetWidgetMetadata = vi.fn();
const mockPatchWidgetMetadata = vi.fn();
const mockPostWidgetMetadata = vi.fn();
const mockGetSSRRows = vi.fn();
const mockProcessWidgetId = vi.fn();
const mockHandleWidgetMetadata = vi.fn();
const mockTriggerCustomEvent = vi.fn();

let mockAiEnhancements = true;
let mockUserToken: string | null = "test-token";
let mockSetWidgetMetadata = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockUpdateWidget = vi.fn();

function createMockWidget(overrides: Partial<WidgetT> = {}): WidgetT {
  return {
    id: "widget-123",
    uuid: "widget-123",
    name: "Test Widget",
    description: "Test description",
    category: "Test Category",
    subCategory: "Test Sub",
    widgetId: "widget_studio-abc123",
    type: "ssrm_advanced",
    storage: {
      params: { query: "SELECT * FROM test" },
      autoUpdateMetadataOnRun: true,
    },
    params: [{ paramName: "query", type: "text", language: "sql" }],
    endpoint: { url: "/api/test" },
    ...overrides,
  } as WidgetT;
}

const createMockWidgetContext = (
  overrides: Partial<WidgetT> = {},
  isPreview = false,
) => {
  const widget = createMockWidget(overrides);
  return {
    widget: widget as WidgetT,
    widgetFromJSON: undefined,
    updateWidget: mockUpdateWidget,
    widgetRef: { current: widget as WidgetT },
    activeDashboardId: "test-dashboard",
    isShared: false,
    uuid: "test-uuid",
    isPreview,
    getWidget: () => widget as WidgetT,
  };
};

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(() => createMockWidgetContext()),
}));

const useWidgetContextMock = vi.mocked(useWidgetContext);

vi.mock("~/api/auth.api", () => ({
  getWidgetMetadata: () => mockGetWidgetMetadata(),
  patchWidgetMetadata: (...args: unknown[]) => mockPatchWidgetMetadata(...args),
  postWidgetMetadata: (...args: unknown[]) => mockPostWidgetMetadata(...args),
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({
    urls: { backend: "", ai: "http://localhost:3000/ai", platform: "", database: "" },
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
    mcp: { defaultServerEnabled: true },
    analytics: { posthogKey: "", posthogUrl: "" },
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
  _resetConfig: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: { aiEnhancements: boolean }) => unknown) =>
    selector({ aiEnhancements: mockAiEnhancements }),
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (
    selector: (state: { user: { token: string | null } | null }) => unknown,
  ) => selector({ user: mockUserToken ? { token: mockUserToken } : null }),
  useAuthStore: () => ({ getState: () => ({}) }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (
    selector: (state: { setWidgetMetadata: typeof mockSetWidgetMetadata }) => unknown,
  ) => selector({ setWidgetMetadata: mockSetWidgetMetadata }),
}));

vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils")>();
  return {
    ...actual,
    processWidgetId: (...args: unknown[]) => mockProcessWidgetId(...args),
    triggerCustomEvent: (...args: unknown[]) => mockTriggerCustomEvent(...args),
  };
});

vi.mock("~/utils/dataConnectorsHelpers", () => ({
  handleWidgetMetadata: (...args: unknown[]) => mockHandleWidgetMetadata(...args),
}));

vi.mock("~/components/General/Table/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/components/General/Table/utils")>();
  return {
    ...actual,
    getSSRRows: (...args: unknown[]) => mockGetSSRRows(...args),
  };
});

// Import after mocks
import { useAutoMetadataUpdate } from "~/components/General/Table/hooks/useAutoMetadataUpdate";
import { useWidgetContext } from "~/components/Widget.context";

describe("useAutoMetadataUpdate", () => {
  const mockCurrentQueryRef = { current: "SELECT * FROM test" };
  const widgetUuid = "widget-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAiEnhancements = true;
    mockUserToken = "test-token";
    mockSetWidgetMetadata = vi.fn();
    mockProcessWidgetId.mockReturnValue({
      uuid: "abc123",
      cleanWidgetId: "widget_studio",
    });
    mockHandleWidgetMetadata.mockReturnValue({
      widgetId: "abc123",
      name: "Test Widget",
    });
    mockGetWidgetMetadata.mockResolvedValue([]);
    mockPatchWidgetMetadata.mockResolvedValue({ success: true });
    mockPostWidgetMetadata.mockResolvedValue({ success: true });
    mockGetSSRRows.mockResolvedValue({
      rowData: [{ id: 1, name: "test" }],
    });
    useWidgetContextMock.mockReturnValue(createMockWidgetContext());

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          title: "AI Generated Title",
          description: "AI Generated Description",
          category: "AI Category",
          subcategory: "AI Subcategory",
        }),
    });
  });

  describe("triggerMetadataUpdate", () => {
    it("is a callable function", () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      expect(typeof result.current).toBe("function");
    });

    it("calls fetch with correct AI API URL on trigger", async () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/ai/v1/generate/widget_info",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });

    it("calls patchWidgetMetadata with merged AI-returned metadata", async () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(mockPatchWidgetMetadata).toHaveBeenCalled());
      });

      expect(mockPatchWidgetMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "AI Generated Title",
          description: "AI Generated Description",
          category: "AI Category",
          subCategory: "AI Subcategory",
        }),
        "abc123",
      );
    });

    it("calls updateWidget with AI-returned values", async () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(mockUpdateWidget).toHaveBeenCalled());
      });

      const updater = mockUpdateWidget.mock.calls[0][0];
      const result2 = updater({ name: "old" });
      expect(result2.name).toBe("AI Generated Title");
      expect(result2.description).toBe("AI Generated Description");
    });

    it("skips auto-update when query is unchanged (duplicate query)", async () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      // First call succeeds
      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      vi.mocked(global.fetch).mockClear();
      mockGetSSRRows.mockClear();

      // Second call with same query should be skipped
      await act(async () => {
        result.current();
      });

      // Allow microtasks to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("always fetches fresh data via getSSRRows", async () => {
      const existingData = [{ id: 99, name: "stale" }];
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, existingData),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(mockGetSSRRows).toHaveBeenCalled());
      });

      expect(mockGetSSRRows).toHaveBeenCalledWith(
        createMockWidget().endpoint,
        expect.any(Object),
        expect.objectContaining({ startRow: 0, endRow: 500 }),
      );
    });

    it("does not auto-update from stale rows when the latest fetch returns nothing", async () => {
      mockGetSSRRows.mockResolvedValue({ rowData: [] });
      const existingData = [{ id: 99, name: "fallback" }];
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, existingData),
      );

      await act(async () => {
        result.current();
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(mockPatchWidgetMetadata).not.toHaveBeenCalled();
    });

    it("allows manual updates to reuse existing rows when the refresh fetch returns nothing", async () => {
      mockGetSSRRows.mockResolvedValue({ rowData: [] });
      const existingData = [{ id: 99, name: "fallback" }];

      renderHook(() => useAutoMetadataUpdate(mockCurrentQueryRef, existingData));

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it("uses successful run rows directly for auto-update without refetching", async () => {
      const runRowData = [
        {
          HTML_CONTENT:
            "Management discussion and analysis text returned from the successful run",
        },
      ];
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current({ rowDataOverride: runRowData });
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      expect(mockGetSSRRows).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:3000/ai/v1/generate/widget_info",
        expect.objectContaining({
          body: expect.stringContaining("HTML_CONTENT"),
        }),
      );
    });
  });

  describe("error handling", () => {
    it("shows toast on manual update when AI API fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
      // getSSRRows must return data so the code reaches the AI call
      mockGetSSRRows.mockResolvedValue({ rowData: [{ id: 1, name: "test" }] });
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
        await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
      });

      expect(toast.error).toHaveBeenCalledWith(
        "AI Metadata Error",
        expect.objectContaining({
          description: "Failed to generate metadata with AI.",
        }),
      );
      expect(mockTriggerCustomEvent).toHaveBeenCalledWith(
        "metadataUpdateComplete-widget-123",
        expect.objectContaining({ success: false }),
      );
    });

    it("is silent on auto-update when AI API fails", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
      });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("handles empty AI response gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
      });

      expect(mockPatchWidgetMetadata).not.toHaveBeenCalled();
    });

    it("handles network errors in auto-update silently", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
      });

      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("validation", () => {
    it("requires user authentication for manual metadata updates", async () => {
      mockUserToken = null;
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Authentication Required",
        expect.objectContaining({
          description: "You need to be authenticated to run metadata update.",
        }),
      );
      expect(mockPatchWidgetMetadata).not.toHaveBeenCalled();
    });

    it("shows error when query is empty on manual update", async () => {
      const emptyQueryRef = { current: "" };
      const { result } = renderHook(() => useAutoMetadataUpdate(emptyQueryRef, []));

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Invalid Query",
        expect.objectContaining({
          description: "Query is empty. Enter a query before running metadata update.",
        }),
      );
    });
  });

  describe("metadata creation", () => {
    it("creates new metadata when none exists", async () => {
      mockHandleWidgetMetadata.mockReturnValue(null);
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(mockPostWidgetMetadata).toHaveBeenCalled());
      });

      expect(mockPostWidgetMetadata).toHaveBeenCalled();
    });

    it("uses existing metadata when available", async () => {
      mockHandleWidgetMetadata.mockReturnValue({
        widgetId: "existing-id",
        name: "Existing Widget",
      });

      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        result.current();
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      expect(mockPostWidgetMetadata).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("manual event listener", () => {
    it("responds to runMetadataUpdate event", async () => {
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: {
              metadata: {
                name: "Manual Name",
                description: "Manual Desc",
              },
            },
          }),
        );
        await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it("rejects manual update when AI enhancements are disabled", async () => {
      mockAiEnhancements = false;
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
      });

      expect(toast.error).toHaveBeenCalledWith(
        "AI Enhancements Disabled",
        expect.objectContaining({
          description: "AI Enhancements must be enabled to run metadata update.",
        }),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("rejects manual update for unsupported widget types", async () => {
      useWidgetContextMock.mockReturnValue(
        createMockWidgetContext({
          params: [{ paramName: "query", type: "text", language: "markdown" }],
        }),
      );
      const { result } = renderHook(() =>
        useAutoMetadataUpdate(mockCurrentQueryRef, []),
      );

      await act(async () => {
        window.dispatchEvent(
          new CustomEvent(`runMetadataUpdate-${widgetUuid}`, {
            detail: { metadata: { name: "test" } },
          }),
        );
      });

      expect(toast.error).toHaveBeenCalledWith(
        "Unsupported Widget Type",
        expect.objectContaining({
          description:
            "Metadata update is only available for SQL/Python query widgets.",
        }),
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
