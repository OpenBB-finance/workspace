import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeStore } from "~/lib/state/theme";

// Mock external dependencies
vi.mock("~/api/auth.api", () => ({
  migrateDefaultTicker: vi.fn().mockResolvedValue({
    symbol: "AAPL",
    id: "AAPL",
    type: "stock",
    name: "Apple Inc.",
    category: "equity",
  }),
}));

vi.mock("~/api/user.api", () => ({
  updateUserDisplaySettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: {
    getState: () => ({
      lastVisitedPage: "/app",
      openaiApiKey: "test-openai-key",
      perplexityApiKey: "test-perplexity-key",
    }),
  },
}));

vi.mock("~/lib/types", () => ({
  DEFAULT_TICKERS: {
    AAPL: {
      id: "AAPL",
      symbol: "AAPL",
      type: "stock",
      name: "Apple Inc.",
      category: "equity",
    },
  },
}));

// Store original document state
const originalDocumentElement = document.documentElement;

describe("useThemeStore", () => {
  let colorSchemeMeta: HTMLMetaElement;

  beforeEach(() => {
    // Create color-scheme meta element
    colorSchemeMeta = document.createElement("meta");
    colorSchemeMeta.name = "color-scheme";
    colorSchemeMeta.content = "dark";
    document.head.appendChild(colorSchemeMeta);

    // Clear localStorage
    localStorage.clear();

    // Reset store to default state
    useThemeStore.setState({
      mcpAuthPopup: null,
      promptsSuggestionsMenuOpen: false,
      manageAppsDialogOpen: false,
      manageAppDialog: { isOpen: false, mode: "add", data: null },
      groupingVisible: true,
      showAddAgentsDialog: false,
      agentConfigDialogOpen: false,
      exportTemplatePopup: false,
      recentlyAddedWidgets: [],
      apiKeyDialogOpen: false,
      bookingOpen: false,
      shareDashboardPopupId: null,
      defaultTicker: {
        id: "AAPL",
        symbol: "AAPL",
        type: "stock",
        name: "Apple Inc.",
        category: "equity",
      },
      userAcknowledgedMobile: false,
      userAcknowledgedNonChromium: false,
      decimalDigits: 2,
      gridCorners: ["se"],
      showWidgetControlsEllipsis: false,
      aiEnhancements: true,
      quickAddButtonVisible: true,
      showMinimizeButton: false,
      showChartGeneration: false,
      fontSize: "medium",
      tablePagination: true,
      isEditingTab: true,
      gridSnapping: "vertical",
      editingType: "tab",
      tabEditingId: "",
      createFolderParentId: null,
      createFolderPopup: false,
      renamePopup: false,
      defaultRename: "",
      externalDataPopup: false,
      search: false,
      pendingExport: false,
      exportPopup: false,
      exportWidgetData: null,
      theme: "dark",
      collapsedPanelExpandOnHover: false,
      shortcutSidebarOpen: false,
      openDataPlatformModalOpen: false,
      feedbackOpen: false,
      presenterMode: false,
      initialSelectedSearchTab: "widgets",
      pulseAnimationButtonsAlreadyClicked: false,
      isResizingGridElement: "",
      excelExportPopup: false,
      excelExportItem: null,
    });

    // Reset document state
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("--text-scale");
  });

  afterEach(() => {
    vi.clearAllMocks();
    colorSchemeMeta.remove();
  });

  describe("Initial State", () => {
    it("should have correct default values for all state properties", () => {
      const state = useThemeStore.getState();

      expect(state.mcpAuthPopup).toBeNull();
      expect(state.promptsSuggestionsMenuOpen).toBe(false);
      expect(state.manageAppsDialogOpen).toBe(false);
      expect(state.manageAppDialog).toEqual({
        isOpen: false,
        mode: "add",
        data: null,
      });
      expect(state.groupingVisible).toBe(true);
      expect(state.showAddAgentsDialog).toBe(false);
      expect(state.agentConfigDialogOpen).toBe(false);
      expect(state.exportTemplatePopup).toBe(false);
      expect(state.recentlyAddedWidgets).toEqual([]);
      expect(state.apiKeyDialogOpen).toBe(false);
      expect(state.bookingOpen).toBe(false);
      expect(state.shareDashboardPopupId).toBeNull();
      expect(state.defaultTicker).toBeDefined();
      expect(state.userAcknowledgedMobile).toBe(false);
      expect(state.userAcknowledgedNonChromium).toBe(false);
      expect(state.decimalDigits).toBe(2);
      expect(state.gridCorners).toEqual(["se"]);
      expect(state.showWidgetControlsEllipsis).toBe(false);
      expect(state.aiEnhancements).toBe(true);
      expect(state.quickAddButtonVisible).toBe(true);
      expect(state.fontSize).toBe("medium");
      expect(state.tablePagination).toBe(true);
      expect(state.isEditingTab).toBe(true);
      expect(state.gridSnapping).toBe("vertical");
      expect(state.editingType).toBe("tab");
      expect(state.tabEditingId).toBe("");
      expect(state.createFolderParentId).toBeNull();
      expect(state.createFolderPopup).toBe(false);
      expect(state.renamePopup).toBe(false);
      expect(state.defaultRename).toBe("");
      expect(state.externalDataPopup).toBe(false);
      expect(state.search).toBe(false);
      expect(state.pendingExport).toBe(false);
      expect(state.exportPopup).toBe(false);
      expect(state.exportWidgetData).toBeNull();
      expect(state.theme).toBe("dark");
      expect(state.collapsedPanelExpandOnHover).toBe(false);
      expect(state.shortcutSidebarOpen).toBe(false);
      expect(state.openDataPlatformModalOpen).toBe(false);
      expect(state.feedbackOpen).toBe(false);
      expect(state.presenterMode).toBe(false);
      expect(state.initialSelectedSearchTab).toBe("widgets");
      expect(state.pulseAnimationButtonsAlreadyClicked).toBe(false);
      expect(state.isResizingGridElement).toBe("");
      expect(state.excelExportPopup).toBe(false);
      expect(state.excelExportItem).toBeNull();
    });
  });

  describe("Theme Toggle", () => {
    it("should toggle theme from dark to light", () => {
      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("should toggle theme from light to dark", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().toggleTheme();

      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("should update localStorage when setting theme", () => {
      useThemeStore.getState().setTheme("light");

      expect(localStorage.theme).toBe("light");
    });

    it("should add dark class to documentElement when theme is dark", () => {
      useThemeStore.getState().setTheme("dark");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("should remove dark class from documentElement when theme is light", () => {
      document.documentElement.classList.add("dark");
      useThemeStore.getState().setTheme("light");

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should update color-scheme meta tag", () => {
      useThemeStore.getState().setTheme("light");

      const meta = document.querySelector(
        'meta[name="color-scheme"]',
      ) as HTMLMetaElement;
      expect(meta.content).toBe("light");
    });
  });

  describe("Font Size", () => {
    it("should set font size to medium", () => {
      useThemeStore.getState().setFontSize("medium");

      expect(useThemeStore.getState().fontSize).toBe("medium");
    });

    it("should set font size to large", () => {
      useThemeStore.getState().setFontSize("large");

      expect(useThemeStore.getState().fontSize).toBe("large");
    });

    it("should update CSS variable for medium font size", () => {
      useThemeStore.getState().setFontSize("medium");

      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1");
    });

    it("should update CSS variable for large font size", () => {
      useThemeStore.getState().setFontSize("large");

      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe(
        "1.25",
      );
    });
  });

  describe("Display Settings", () => {
    it("should return display settings with all required properties", () => {
      const settings = useThemeStore.getState().getDisplaySettings();

      expect(settings).toHaveProperty("decimalDigits");
      expect(settings).toHaveProperty("theme");
      expect(settings).toHaveProperty("showWidgetControlsEllipsis");
      expect(settings).toHaveProperty("aiEnhancements");
      expect(settings).toHaveProperty("tablePagination");
      expect(settings).toHaveProperty("fontSize");
      expect(settings).toHaveProperty("defaultTicker");
      expect(settings).toHaveProperty("gridCorners");
      expect(settings).toHaveProperty("gridSnapping");
      expect(settings).toHaveProperty("quickAddButtonVisible");
      expect(settings).toHaveProperty("showMinimizeButton");
      expect(settings).toHaveProperty("showChartGeneration");
      expect(settings).toHaveProperty("lastVisitedPage");
      expect(settings).toHaveProperty("openaiApiKey");
      expect(settings).toHaveProperty("perplexityApiKey");
      expect(settings).toHaveProperty("collapsedPanelExpandOnHover");
    });

    it("should update display settings with theme change", () => {
      useThemeStore.getState().updateDisplaySettings({ theme: "light" });

      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("should update display settings with font size change", () => {
      useThemeStore.getState().updateDisplaySettings({ fontSize: "large" });

      expect(useThemeStore.getState().fontSize).toBe("large");
    });

    it("should update multiple display settings at once", () => {
      useThemeStore.getState().updateDisplaySettings({
        decimalDigits: 4,
        tablePagination: false,
        aiEnhancements: false,
      });

      const state = useThemeStore.getState();
      expect(state.decimalDigits).toBe(4);
      expect(state.tablePagination).toBe(false);
      expect(state.aiEnhancements).toBe(false);
    });
  });

  describe("Dialog State Management", () => {
    it("should set MCP auth popup", () => {
      const popup = {
        serverName: "test-server",
        serverUrlHash: "hash123",
        authUrl: "https://auth.example.com",
        popupFeatures: "width=500,height=600",
      };

      useThemeStore.getState().setMcpAuthPopup(popup);

      expect(useThemeStore.getState().mcpAuthPopup).toEqual(popup);
    });

    it("should clear MCP auth popup", () => {
      useThemeStore.setState({
        mcpAuthPopup: {
          serverName: "test",
          serverUrlHash: "hash",
          authUrl: "url",
          popupFeatures: "features",
        },
      });

      useThemeStore.getState().setMcpAuthPopup(null);

      expect(useThemeStore.getState().mcpAuthPopup).toBeNull();
    });

    it("should toggle prompts suggestions menu", () => {
      useThemeStore.getState().setPromptsSuggestionsMenuOpen(true);
      expect(useThemeStore.getState().promptsSuggestionsMenuOpen).toBe(true);

      useThemeStore.getState().setPromptsSuggestionsMenuOpen(false);
      expect(useThemeStore.getState().promptsSuggestionsMenuOpen).toBe(false);
    });

    it("should toggle manage apps dialog", () => {
      useThemeStore.getState().setManageAppsDialogOpen(true);
      expect(useThemeStore.getState().manageAppsDialogOpen).toBe(true);
    });

    it("should update manage app dialog state partially", () => {
      useThemeStore.getState().setManageAppDialog({ isOpen: true });
      expect(useThemeStore.getState().manageAppDialog.isOpen).toBe(true);
      expect(useThemeStore.getState().manageAppDialog.mode).toBe("add");

      useThemeStore.getState().setManageAppDialog({ mode: "edit" });
      expect(useThemeStore.getState().manageAppDialog.mode).toBe("edit");
      expect(useThemeStore.getState().manageAppDialog.isOpen).toBe(true);
    });

    it("should toggle API key dialog", () => {
      useThemeStore.getState().setApiKeyDialogOpen(true);
      expect(useThemeStore.getState().apiKeyDialogOpen).toBe(true);
    });

    it("should toggle booking dialog", () => {
      useThemeStore.getState().setBookingOpen(true);
      expect(useThemeStore.getState().bookingOpen).toBe(true);
    });

    it("should set share dashboard popup id", () => {
      useThemeStore.getState().setShareDashboardPopupId("dashboard-123");
      expect(useThemeStore.getState().shareDashboardPopupId).toBe("dashboard-123");
    });

    it("should toggle agent config dialog", () => {
      useThemeStore.getState().setAgentConfigDialogOpen(true);
      expect(useThemeStore.getState().agentConfigDialogOpen).toBe(true);
    });

    it("should toggle show add agents dialog", () => {
      useThemeStore.getState().setShowAddAgentsDialog(true);
      expect(useThemeStore.getState().showAddAgentsDialog).toBe(true);
    });

    it("should toggle export template popup", () => {
      useThemeStore.getState().setExportTemplatePopup(true);
      expect(useThemeStore.getState().exportTemplatePopup).toBe(true);
    });

    it("should toggle feedback dialog", () => {
      useThemeStore.getState().setFeedbackOpen(true);
      expect(useThemeStore.getState().feedbackOpen).toBe(true);
    });

    it("should toggle open data platform modal", () => {
      useThemeStore.getState().setOpenDataPlatformModalOpen(true);
      expect(useThemeStore.getState().openDataPlatformModalOpen).toBe(true);
    });

    it("should toggle excel export popup", () => {
      useThemeStore.getState().setExcelExportPopup(true);
      expect(useThemeStore.getState().excelExportPopup).toBe(true);
    });

    it("should set excel export item", () => {
      const item = { index: "test-item", data: { name: "Test" } } as any;
      useThemeStore.getState().setExcelExportItem(item);
      expect(useThemeStore.getState().excelExportItem).toEqual(item);
    });
  });

  describe("Grouping Visibility", () => {
    it("should set grouping visible", () => {
      useThemeStore.getState().setGroupingVisible(false);
      expect(useThemeStore.getState().groupingVisible).toBe(false);
    });

    it("should toggle grouping visibility", () => {
      expect(useThemeStore.getState().groupingVisible).toBe(true);

      useThemeStore.getState().toggleGroupingVisibility();
      expect(useThemeStore.getState().groupingVisible).toBe(false);

      useThemeStore.getState().toggleGroupingVisibility();
      expect(useThemeStore.getState().groupingVisible).toBe(true);
    });
  });

  describe("Search", () => {
    it("should change search state", () => {
      useThemeStore.getState().changeSearch(true);
      expect(useThemeStore.getState().search).toBe(true);
    });

    it("should toggle search", () => {
      useThemeStore.getState().toggleSearch();
      expect(useThemeStore.getState().search).toBe(true);

      useThemeStore.getState().toggleSearch();
      expect(useThemeStore.getState().search).toBe(false);
    });

    it("should set initial selected search tab", () => {
      useThemeStore.getState().setInitialSelectedSearchTab("data");
      expect(useThemeStore.getState().initialSelectedSearchTab).toBe("data");
    });
  });

  describe("Export Popup", () => {
    it("should set export popup", () => {
      useThemeStore.getState().setExportPopup(true);
      expect(useThemeStore.getState().exportPopup).toBe(true);
    });

    it("should toggle export popup", () => {
      useThemeStore.getState().toggleExportPopup();
      expect(useThemeStore.getState().exportPopup).toBe(true);

      useThemeStore.getState().toggleExportPopup();
      expect(useThemeStore.getState().exportPopup).toBe(false);
    });

    it("should set pending export", () => {
      useThemeStore.getState().setPendingExport(true);
      expect(useThemeStore.getState().pendingExport).toBe(true);
    });

    it("should set export widget data", () => {
      const exportData = {
        widgetId: "widget-1",
        widgetName: "Test Widget",
        selectedExportFormat: "csv",
        possibleExportFormats: [
          { value: "csv", fn: vi.fn() },
          { value: "json", fn: vi.fn() },
        ],
      };

      useThemeStore.getState().setExportWidgetData(exportData);
      expect(useThemeStore.getState().exportWidgetData).toEqual(exportData);
    });

    it("should clear export widget data", () => {
      useThemeStore.setState({
        exportWidgetData: {
          widgetId: "widget-1",
          widgetName: "Test",
          selectedExportFormat: "csv",
          possibleExportFormats: [],
        },
      });

      useThemeStore.getState().setExportWidgetData(null);
      expect(useThemeStore.getState().exportWidgetData).toBeNull();
    });
  });

  describe("Rename and Folder Popups", () => {
    it("should set rename popup with all parameters", () => {
      useThemeStore
        .getState()
        .setRenamePopup(true, "Default Name", "tab-123", "folder");

      const state = useThemeStore.getState();
      expect(state.renamePopup).toBe(true);
      expect(state.defaultRename).toBe("Default Name");
      expect(state.tabEditingId).toBe("tab-123");
      expect(state.editingType).toBe("folder");
    });

    it("should toggle rename tab popup", () => {
      useThemeStore.getState().setRenamePopup(true, "Test", "tab-id", "tab");
      useThemeStore.getState().toggleRenameTabPopup();

      expect(useThemeStore.getState().renamePopup).toBe(false);
    });

    it("should set create folder popup", () => {
      useThemeStore.getState().setCreateFolderPopup(true, "parent-folder");

      expect(useThemeStore.getState().createFolderPopup).toBe(true);
      expect(useThemeStore.getState().createFolderParentId).toBe("parent-folder");
    });

    it("should set create folder popup with callback", () => {
      const callback = vi.fn();
      useThemeStore.getState().setCreateFolderPopup(callback, null);

      expect(typeof useThemeStore.getState().createFolderPopup).toBe("function");
    });
  });

  describe("External Data Popup", () => {
    it("should set external data popup", () => {
      useThemeStore.getState().setExternalDataPopup(true);
      expect(useThemeStore.getState().externalDataPopup).toBe(true);
    });

    it("should toggle external data popup", () => {
      useThemeStore.getState().toggleExternalDataPopup();
      expect(useThemeStore.getState().externalDataPopup).toBe(true);

      useThemeStore.getState().toggleExternalDataPopup();
      expect(useThemeStore.getState().externalDataPopup).toBe(false);
    });
  });

  describe("Shortcut Sidebar", () => {
    it("should set shortcut sidebar open", () => {
      useThemeStore.getState().setShortcutSidebarOpen(true);
      expect(useThemeStore.getState().shortcutSidebarOpen).toBe(true);
    });

    it("should toggle shortcut sidebar", () => {
      useThemeStore.getState().toggleShortcutSidebar();
      expect(useThemeStore.getState().shortcutSidebarOpen).toBe(true);

      useThemeStore.getState().toggleShortcutSidebar();
      expect(useThemeStore.getState().shortcutSidebarOpen).toBe(false);
    });
  });

  describe("Presenter Mode", () => {
    it("should set presenter mode", () => {
      useThemeStore.getState().setPresenterMode(true);
      expect(useThemeStore.getState().presenterMode).toBe(true);
    });

    it("should toggle presenter mode and dispatch resize event", async () => {
      const resizeHandler = vi.fn();
      window.addEventListener("resize", resizeHandler);

      // Mock fullscreen APIs
      const requestFullscreen = vi.fn().mockResolvedValue(undefined);
      const exitFullscreen = vi.fn().mockResolvedValue(undefined);

      document.documentElement.requestFullscreen = requestFullscreen;
      document.exitFullscreen = exitFullscreen;

      useThemeStore.getState().togglePresenterMode();

      // Wait for the setTimeout
      await vi.waitFor(() => {
        expect(resizeHandler).toHaveBeenCalled();
      });

      expect(useThemeStore.getState().presenterMode).toBe(true);

      window.removeEventListener("resize", resizeHandler);
    });
  });

  describe("Collapsed Panel Expand on Hover", () => {
    it("should set collapsed panel expand on hover", () => {
      useThemeStore.getState().setCollapsedPanelExpandOnHover(true);
      expect(useThemeStore.getState().collapsedPanelExpandOnHover).toBe(true);
    });
  });

  describe("Default Ticker", () => {
    it("should set default ticker", () => {
      const ticker = {
        id: "MSFT",
        symbol: "MSFT",
        name: "Microsoft Corporation",
        category: "equity",
      };

      useThemeStore.getState().setDefaultTicker(ticker as any);

      expect(useThemeStore.getState().defaultTicker).toEqual(ticker);
    });
  });

  describe("Recently Added Widgets", () => {
    it("should set recently added widgets", () => {
      const widgets = [
        { widgetId: "widget-1", name: "Widget 1" },
        { widgetId: "widget-2", name: "Widget 2" },
      ] as any[];

      useThemeStore.getState().setRecentlyAddedWidgets(widgets);

      expect(useThemeStore.getState().recentlyAddedWidgets).toEqual(widgets);
    });
  });

  describe("User Acknowledgements", () => {
    it("should set user acknowledged mobile", () => {
      useThemeStore.getState().setUserAcknowledgedMobile(true);
      expect(useThemeStore.getState().userAcknowledgedMobile).toBe(true);
    });

    it("should set user acknowledged non-chromium", () => {
      useThemeStore.getState().setUserAcknowledgedNonChromium(true);
      expect(useThemeStore.getState().userAcknowledgedNonChromium).toBe(true);
    });
  });

  describe("Decimal Digits", () => {
    it("should set decimal digits", () => {
      useThemeStore.getState().setDecimalDigits(4);
      expect(useThemeStore.getState().decimalDigits).toBe(4);
    });
  });

  describe("Grid Settings", () => {
    it("should set grid corners", () => {
      const corners: Array<"ne" | "nw" | "se" | "sw"> = ["ne", "sw"];
      useThemeStore.getState().setGridCorners(corners);
      expect(useThemeStore.getState().gridCorners).toEqual(corners);
    });

    it("should set grid snapping", () => {
      useThemeStore.getState().setGridSnapping("off");
      expect(useThemeStore.getState().gridSnapping).toBe("off");

      useThemeStore.getState().setGridSnapping("vertical");
      expect(useThemeStore.getState().gridSnapping).toBe("vertical");
    });
  });

  describe("Widget Controls", () => {
    it("should set show widget controls ellipsis", () => {
      useThemeStore.getState().setShowWidgetControlsEllipsis(true);
      expect(useThemeStore.getState().showWidgetControlsEllipsis).toBe(true);
    });

    it("should set show minimize button", () => {
      useThemeStore.getState().setShowMinimizeButton(true);
      expect(useThemeStore.getState().showMinimizeButton).toBe(true);
    });

    it("should set show chart generation", () => {
      useThemeStore.getState().setShowChartGeneration(true);
      expect(useThemeStore.getState().showChartGeneration).toBe(true);
    });

    it("should set quick add button visible", () => {
      useThemeStore.getState().setQuickAddButtonVisible(false);
      expect(useThemeStore.getState().quickAddButtonVisible).toBe(false);
    });
  });

  describe("AI Enhancements", () => {
    it("should set AI enhancements", () => {
      useThemeStore.getState().setAiEnhancements(false);
      expect(useThemeStore.getState().aiEnhancements).toBe(false);

      useThemeStore.getState().setAiEnhancements(true);
      expect(useThemeStore.getState().aiEnhancements).toBe(true);
    });
  });

  describe("Table Pagination", () => {
    it("should set table pagination", () => {
      useThemeStore.getState().setTablePagination(false);
      expect(useThemeStore.getState().tablePagination).toBe(false);
    });
  });

  describe("Tab Editing", () => {
    it("should set is editing tab", () => {
      useThemeStore.getState().setIsEditingTab(false);
      expect(useThemeStore.getState().isEditingTab).toBe(false);
    });
  });

  describe("Resizing Grid Element", () => {
    it("should set is resizing grid element", () => {
      useThemeStore.getState().setIsResizingGridElement("widget-123");
      expect(useThemeStore.getState().isResizingGridElement).toBe("widget-123");
    });

    it("should clear resizing grid element", () => {
      useThemeStore.setState({ isResizingGridElement: "widget-123" });
      useThemeStore.getState().setIsResizingGridElement("");
      expect(useThemeStore.getState().isResizingGridElement).toBe("");
    });
  });

  describe("Pulse Animation Buttons", () => {
    it("should set pulse animation buttons already clicked", () => {
      useThemeStore.getState().setPulseAnimationButtonsAlreadyClicked(true);
      expect(useThemeStore.getState().pulseAnimationButtonsAlreadyClicked).toBe(true);
    });
  });

  describe("updateThemeState", () => {
    it("should update multiple state properties at once", () => {
      useThemeStore.getState().updateThemeState({
        fontSize: "large",
        aiEnhancements: false,
        tablePagination: false,
      });

      const state = useThemeStore.getState();
      expect(state.fontSize).toBe("large");
      expect(state.aiEnhancements).toBe(false);
      expect(state.tablePagination).toBe(false);
    });

    it("should apply theme from state when provided", () => {
      useThemeStore.getState().updateThemeState({ theme: "light" });

      expect(localStorage.theme).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should apply font size CSS variable when fontSize is provided", () => {
      useThemeStore.getState().updateThemeState({ fontSize: "large" });

      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe(
        "1.25",
      );
    });

    it("should default aiEnhancements to true if undefined", () => {
      useThemeStore.setState({ aiEnhancements: undefined as any });
      useThemeStore.getState().updateThemeState({});

      expect(useThemeStore.getState().aiEnhancements).toBe(true);
    });
  });

  describe("Debounced Settings Persistence", () => {
    it("should have debouncedUpdateSettings function", () => {
      expect(typeof useThemeStore.getState().debouncedUpdateSettings).toBe("function");
    });

    it("should call debouncedUpdateSettings without throwing", async () => {
      // The debounced function should be callable without errors
      expect(() => {
        useThemeStore.getState().debouncedUpdateSettings();
      }).not.toThrow();
    });

    it("should return a promise from debouncedUpdateSettings", () => {
      const result = useThemeStore.getState().debouncedUpdateSettings();
      // Debounced functions from lodash.debounce return the result of the debounced function
      // or undefined if not yet called
      expect(result === undefined || result instanceof Promise).toBe(true);
    });
  });

  describe("localStorage Persistence", () => {
    it("should persist theme to localStorage on setTheme", () => {
      useThemeStore.getState().setTheme("light");
      expect(localStorage.theme).toBe("light");

      useThemeStore.getState().setTheme("dark");
      expect(localStorage.theme).toBe("dark");
    });

    it("should persist theme via updateThemeState", () => {
      useThemeStore.getState().updateThemeState({ theme: "light" });
      expect(localStorage.theme).toBe("light");
    });
  });

  describe("Rehydration", () => {
    it("should clear mcpAuthPopup after rehydrating from persisted storage", async () => {
      const persistedPopup = {
        serverName: "persisted-server",
        serverUrlHash: "persisted-hash",
        authUrl: "https://auth.example.com",
        popupFeatures: "width=500,height=600",
      };

      localStorage.setItem(
        "theme-storage",
        JSON.stringify({
          state: { mcpAuthPopup: persistedPopup, theme: "dark" },
          version: 2,
        }),
      );

      await useThemeStore.persist.rehydrate();

      expect(useThemeStore.getState().mcpAuthPopup).toBeNull();
    });

    it("should not throw when rehydrating with no persisted storage", async () => {
      localStorage.clear();

      await expect(useThemeStore.persist.rehydrate()).resolves.not.toThrow();
      expect(useThemeStore.getState().mcpAuthPopup).toBeNull();
    });
  });

  describe("DOM Updates", () => {
    it("should add dark class when theme is set to dark", () => {
      document.documentElement.classList.remove("dark");
      useThemeStore.getState().setTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("should remove dark class when theme is set to light", () => {
      document.documentElement.classList.add("dark");
      useThemeStore.getState().setTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("should update --text-scale CSS variable on font size change", () => {
      useThemeStore.getState().setFontSize("large");
      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe(
        "1.25",
      );

      useThemeStore.getState().setFontSize("medium");
      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe("1");
    });

    it("should update color-scheme meta tag content on theme change", () => {
      useThemeStore.getState().setTheme("light");
      const meta = document.querySelector(
        'meta[name="color-scheme"]',
      ) as HTMLMetaElement;
      expect(meta.content).toBe("light");

      useThemeStore.getState().setTheme("dark");
      expect(meta.content).toBe("dark");
    });

    it("should update DOM via updateThemeState", () => {
      useThemeStore.getState().updateThemeState({
        theme: "light",
        fontSize: "large",
      });

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(document.documentElement.style.getPropertyValue("--text-scale")).toBe(
        "1.25",
      );
    });
  });
});
