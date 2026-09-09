import debounce from "lodash.debounce";
import isEqual from "lodash.isequal";
import type { TreeItem } from "react-complex-tree";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import { migrateDefaultTicker } from "~/api/auth.api";
import { updateUserDisplaySettings } from "~/api/user.api";
import type { SearchTabId } from "~/components/LayoutAuth/Search/SearchDialog";
import type { WidgetItem } from "~/components/LayoutAuth/Search/WidgetMenu";
import type { Ticker } from "~/components/types";
import { getConfig } from "~/lib/runtimeConfig";
import type { DefaultSkillSlugs, DisplaySettings } from "~/types/auth.type";
import { DEFAULT_TICKERS } from "../types";
import type { Selector } from "./app";
import { useAuthStore } from "./auth";
import type { Source } from "./backendConnector";

type McpAuthPopup = {
  serverName: string;
  serverUrlHash: string;
  url: string;
  authUrl: string;
  popupFeatures: string;
};
interface ThemeState {
  // Track removed default skills by slug to prevent re-adding them
  removedSkillSlugs: DefaultSkillSlugs[];
  removeDefaultSkill: (slug: DefaultSkillSlugs) => void;
  mcpAuthPopup: McpAuthPopup | null;
  setMcpAuthPopup: (popup: ThemeState["mcpAuthPopup"]) => void;
  promptsSuggestionsMenuOpen: boolean;
  setPromptsSuggestionsMenuOpen: (open: boolean) => void;
  manageAppsDialogOpen: boolean;
  setManageAppsDialogOpen: (open: boolean) => void;
  manageAppDialog: {
    isOpen: boolean;
    mode: "add" | "edit";
    data: Source | null;
  };
  setManageAppDialog: (dialogState: Partial<ThemeState["manageAppDialog"]>) => void;
  groupingVisible: boolean; // to be able to toggle the visibility of the grouping button in the dashboard toolbar
  setGroupingVisible: (visible: boolean) => void;
  toggleGroupingVisibility: () => void;
  showAddAgentsDialog: boolean;
  setShowAddAgentsDialog: (open: boolean) => void;
  agentConfigDialogOpen: boolean;
  setAgentConfigDialogOpen: (open: boolean) => void;
  exportTemplatePopup: boolean;
  setExportTemplatePopup: (open: boolean) => void;
  recentlyAddedWidgets: WidgetItem[];
  setRecentlyAddedWidgets: (widget: WidgetItem[]) => void;
  apiKeyDialogOpen: boolean;
  setApiKeyDialogOpen: (open: boolean) => void;
  bookingOpen: boolean;
  setBookingOpen: (open: boolean) => void;
  shareDashboardPopupId: string | null;
  setShareDashboardPopupId: (id: string | null) => void;
  shareUserAppsPopupId: string | null;
  setShareUserAppsPopupId: (id: string | null) => void;
  defaultTicker: Ticker;
  updateThemeState: (state: Partial<ThemeState>) => void;
  setDefaultTicker: (ticker: Ticker) => void;
  userAcknowledgedMobile: boolean;
  setUserAcknowledgedMobile: (acknowledged: boolean) => void;
  userAcknowledgedNonChromium: boolean;
  setUserAcknowledgedNonChromium: (acknowledged: boolean) => void;
  decimalDigits: number;
  setDecimalDigits: (digits: number) => void;
  gridCorners: Array<"ne" | "nw" | "se" | "sw">;
  setGridCorners: (corners: Array<"ne" | "nw" | "se" | "sw">) => void;
  showWidgetControlsEllipsis: boolean;
  setShowWidgetControlsEllipsis: (show: boolean) => void;
  aiEnhancements: boolean;
  setAiEnhancements: (enabled: boolean) => void;
  quickAddButtonVisible: boolean;
  setQuickAddButtonVisible: (visible: boolean) => void;
  showMinimizeButton: boolean;
  setShowMinimizeButton: (show: boolean) => void;
  showChartGeneration: boolean;
  setShowChartGeneration: (show: boolean) => void;
  fontSize: "medium" | "large";
  setFontSize: (size: "medium" | "large") => void;
  tablePagination: boolean;
  setTablePagination: (pagination: boolean) => void;
  isEditingTab: boolean;
  setIsEditingTab: (mode: boolean) => void;
  gridSnapping: "off" | "vertical";
  setGridSnapping: (snapping: "off" | "vertical") => void;
  editingType: "folder" | "tab";
  tabEditingId: string;
  createFolderParentId: string | null;
  createFolderPopup: boolean | ((value: string) => void);
  setCreateFolderPopup: (
    popup: boolean | ((value: string) => void),
    parentId?: string | null,
  ) => void;
  renamePopup: boolean;
  defaultRename: string;
  setRenamePopup: (
    popup: boolean,
    defaultRename: string,
    tabEditingId: string,
    editingType: "folder" | "tab",
  ) => void;
  toggleRenameTabPopup: () => void;
  externalDataPopup: boolean;
  setExternalDataPopup: (popup: boolean) => void;
  toggleExternalDataPopup: () => void;
  search: boolean;
  pendingExport: boolean;
  setPendingExport: (pending: boolean) => void;
  exportPopup: boolean;
  toggleExportPopup: () => void;
  setExportPopup: (popup: boolean) => void;
  exportWidgetData: {
    widgetId: string;
    widgetName: string;
    selectedExportFormat: string;
    possibleExportFormats: {
      value: string;
      fn: any;
    }[];
  } | null;
  setExportWidgetData: (
    data: {
      widgetId: string;
      widgetName: string;
      selectedExportFormat: string;
      possibleExportFormats: {
        value: string;
        fn: any;
      }[];
    } | null,
  ) => void;
  changeSearch: (search: boolean) => void;
  toggleSearch: () => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  collapsedPanelExpandOnHover: boolean;
  setCollapsedPanelExpandOnHover: (value: boolean) => void;
  autoHideWidgetNavbar: boolean;
  setAutoHideWidgetNavbar: (value: boolean) => void;
  shortcutSidebarOpen: boolean;
  toggleShortcutSidebar: () => void;
  setShortcutSidebarOpen: (open: boolean) => void;
  openDataPlatformModalOpen: boolean;
  setOpenDataPlatformModalOpen: (open: boolean) => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (open: boolean) => void;
  presenterMode: boolean;
  togglePresenterMode: () => void;
  setPresenterMode: (mode: boolean) => void;
  initialSelectedSearchTab: SearchTabId;
  setInitialSelectedSearchTab: (tab: SearchTabId) => void;
  pulseAnimationButtonsAlreadyClicked: boolean;
  setPulseAnimationButtonsAlreadyClicked: (clicked: boolean) => void;
  isResizingGridElement: string;
  setIsResizingGridElement: (resizing: string) => void;
  getDisplaySettings: () => DisplaySettings;
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => void;
  debouncedUpdateSettings: () => Promise<void>;
  excelExportPopup: boolean;
  setExcelExportPopup: (popup: boolean) => void;
  excelExportItem: (TreeItem<any> & { index: string }) | null;
  setExcelExportItem: (item: (TreeItem<any> & { index: string }) | null) => void;
  setEditAppDialog: (dialogState: Partial<ThemeState["editAppDialog"]>) => void;
  exportFolderPopup: boolean;
  setExportFolderPopup: (popup: boolean) => void;
  exportFolderItem: { id: string; name: string } | null;
  setExportFolderItem: (item: { id: string; name: string } | null) => void;

  generateAppDashboardId: string | null;
  setGenerateAppDashboardId: (dashboardId: string) => void;

  editAppDialog: {
    isOpen: boolean;
    appId: string | null;
    data: {
      name: string;
      description: string;
      img?: string;
      prompts: string[];
    } | null;
  };
}

export const useThemeStore = createWithEqualityFn<ThemeState>()(
  subscribeWithSelector(
    persist(
      (set, get: () => ThemeState) => {
        const uiCfg = getConfig().ui;
        const resolvedTheme = uiCfg.defaultTheme || "dark";

        return {
          removedSkillSlugs: [],
          removeDefaultSkill: (slug) => {
            const { removedSkillSlugs } = get();
            const updatedRemovedSkillSlugs = new Set([...removedSkillSlugs, slug]);
            set({ removedSkillSlugs: Array.from(updatedRemovedSkillSlugs) });
            get().debouncedUpdateSettings();
          },
          mcpAuthPopup: null,
          setMcpAuthPopup: (popup) => set({ mcpAuthPopup: popup }),
          generateAppDashboardId: null,
          setGenerateAppDashboardId: (dashboardId: string) =>
            set({ generateAppDashboardId: dashboardId }),
          editAppDialog: {
            isOpen: false,
            appId: null,
            data: null,
          },
          setEditAppDialog: (dialogState) =>
            set({ editAppDialog: { ...get().editAppDialog, ...dialogState } }),
          promptsSuggestionsMenuOpen: false,
          setPromptsSuggestionsMenuOpen: (open) =>
            set({ promptsSuggestionsMenuOpen: open }),
          manageAppsDialogOpen: false,
          setManageAppsDialogOpen: (open) => set({ manageAppsDialogOpen: open }),
          manageAppDialog: {
            isOpen: false,
            mode: "add",
            data: null,
          },
          setManageAppDialog: (dialogState) =>
            set({ manageAppDialog: { ...get().manageAppDialog, ...dialogState } }),
          groupingVisible: true,
          setGroupingVisible: (visible) => set({ groupingVisible: visible }),
          toggleGroupingVisibility: () => {
            const { groupingVisible, setGroupingVisible } = get();
            setGroupingVisible(!groupingVisible);
          },
          showAddAgentsDialog: false,
          setShowAddAgentsDialog: (open) => set({ showAddAgentsDialog: open }),
          agentConfigDialogOpen: false,
          setAgentConfigDialogOpen: (open) => set({ agentConfigDialogOpen: open }),
          exportTemplatePopup: false,
          setExportTemplatePopup: (open) => set({ exportTemplatePopup: open }),
          recentlyAddedWidgets: [],
          setRecentlyAddedWidgets: (widget: WidgetItem[]) =>
            set({ recentlyAddedWidgets: widget }),
          bookingOpen: false,
          setBookingOpen: (open) => set({ bookingOpen: open }),
          apiKeyDialogOpen: false,
          setApiKeyDialogOpen: (open) => set({ apiKeyDialogOpen: open }),
          shareDashboardPopupId: null,
          setShareDashboardPopupId: (id) => set({ shareDashboardPopupId: id }),
          shareUserAppsPopupId: null,
          setShareUserAppsPopupId: (id) => set({ shareUserAppsPopupId: id }),
          defaultTicker: DEFAULT_TICKERS.AAPL,
          setDefaultTicker: (ticker) => set({ defaultTicker: ticker }),
          updateThemeState: (state) => {
            const fontSize = state.fontSize;
            state.theme = state.theme || localStorage.theme || resolvedTheme;

            if (state.theme) {
              localStorage.theme = state.theme;
              if (state.theme === "dark")
                document.documentElement.classList.add("dark");
              else document.documentElement.classList.remove("dark");
              const colorSchemeMeta = document.querySelector(
                'meta[name="color-scheme"]',
              ) as HTMLMetaElement;
              colorSchemeMeta.content = state.theme;
            }

            if (fontSize) {
              const root = document?.documentElement;
              root?.style?.setProperty(
                "--text-scale",
                fontSize === "large" ? "1.25" : "1",
              );
            }

            if (state.aiEnhancements === undefined) {
              state.aiEnhancements = true;
            }

            set(state);
          },
          userAcknowledgedMobile: false,
          setUserAcknowledgedMobile: (acknowledged) =>
            set({ userAcknowledgedMobile: acknowledged }),
          userAcknowledgedNonChromium: false,
          setUserAcknowledgedNonChromium: (acknowledged) =>
            set({ userAcknowledgedNonChromium: acknowledged }),
          decimalDigits: 2,
          setDecimalDigits: (digits) => set({ decimalDigits: digits }),
          pulseAnimationButtonsAlreadyClicked: false,
          setPulseAnimationButtonsAlreadyClicked: (clicked) =>
            set({ pulseAnimationButtonsAlreadyClicked: clicked }),
          exportWidgetData: null,
          setExportWidgetData: (data) => set({ exportWidgetData: data }),
          gridCorners: ["se"] as Array<"ne" | "nw" | "se" | "sw">,
          setGridCorners: (corners) => set({ gridCorners: corners }),
          initialSelectedSearchTab: "widgets",
          setInitialSelectedSearchTab: (tab) => set({ initialSelectedSearchTab: tab }),
          showWidgetControlsEllipsis: false,
          setShowWidgetControlsEllipsis: (show) =>
            set({ showWidgetControlsEllipsis: show }),
          aiEnhancements: true,
          setAiEnhancements: (enabled) => set({ aiEnhancements: enabled }),
          quickAddButtonVisible: true,
          setQuickAddButtonVisible: (visible) =>
            set({ quickAddButtonVisible: visible }),
          showMinimizeButton: uiCfg.showMinimizeWidget,
          setShowMinimizeButton: (show) => set({ showMinimizeButton: show }),
          showChartGeneration: uiCfg.showChartGeneration,
          setShowChartGeneration: (show) => set({ showChartGeneration: show }),
          fontSize: "medium" as "medium" | "large",
          setFontSize: (size) => {
            const root = document?.documentElement;
            root?.style?.setProperty("--text-scale", size === "large" ? "1.25" : "1");
            set({ fontSize: size });
          },
          tablePagination: true,
          setTablePagination: (pagination) => set({ tablePagination: pagination }),
          isEditingTab: true,
          setIsEditingTab: (mode) => set({ isEditingTab: mode }),
          gridSnapping: "vertical" as "off" | "vertical",
          setGridSnapping: (snapping) => set({ gridSnapping: snapping }),
          createFolderPopup: false,
          createFolderParentId: null,
          setCreateFolderPopup: (popup, parentId = null) =>
            set({ createFolderPopup: popup, createFolderParentId: parentId }),
          editingType: "tab" as "folder" | "tab",
          tabEditingId: "",
          renamePopup: false,
          defaultRename: "",
          setRenamePopup: (popup, defaultRename, tabEditingId, editingType) =>
            set({ renamePopup: popup, defaultRename, tabEditingId, editingType }),
          toggleRenameTabPopup: () => {
            const { renamePopup, setRenamePopup } = get();
            setRenamePopup(!renamePopup, "", "", "tab");
          },
          externalDataPopup: false,
          setExternalDataPopup: (popup) => set({ externalDataPopup: popup }),
          toggleExternalDataPopup: () => {
            const { externalDataPopup, setExternalDataPopup } = get();
            setExternalDataPopup(!externalDataPopup);
          },
          search: false,
          exportPopup: false,
          pendingExport: false,
          setPendingExport: (pending) => set({ pendingExport: pending }),
          setExportPopup: (popup) => set({ exportPopup: popup }),
          toggleExportPopup: () => {
            const { exportPopup, setExportPopup } = get();
            setExportPopup(!exportPopup);
          },
          changeSearch: (search) => set({ search }),
          toggleSearch: () => {
            const { search, changeSearch } = get();
            changeSearch(!search);
          },
          theme: resolvedTheme,
          toggleTheme: () => {
            const { theme, setTheme } = get();
            setTheme(theme === "light" ? "dark" : "light");
          },
          collapsedPanelExpandOnHover: false,
          setCollapsedPanelExpandOnHover: (value) =>
            set({ collapsedPanelExpandOnHover: value }),
          autoHideWidgetNavbar: false,
          setAutoHideWidgetNavbar: (value) => set({ autoHideWidgetNavbar: value }),
          setTheme: (theme) => {
            localStorage.theme = theme;
            if (theme === "dark") document.documentElement.classList.add("dark");
            else document.documentElement.classList.remove("dark");
            const colorSchemeMeta = document.querySelector(
              'meta[name="color-scheme"]',
            ) as HTMLMetaElement;
            colorSchemeMeta.content = theme;
            set({ theme });
          },
          shortcutSidebarOpen: false,
          setShortcutSidebarOpen: (open) => set({ shortcutSidebarOpen: open }),
          toggleShortcutSidebar: () => {
            const { shortcutSidebarOpen, setShortcutSidebarOpen } = get();
            setShortcutSidebarOpen(!shortcutSidebarOpen);
          },
          openDataPlatformModalOpen: false,
          setOpenDataPlatformModalOpen: (open) =>
            set({ openDataPlatformModalOpen: open }),
          feedbackOpen: false,
          setFeedbackOpen: (open) => set({ feedbackOpen: open }),
          isResizingGridElement: "",
          setIsResizingGridElement: (resizing) =>
            set({ isResizingGridElement: resizing }),
          presenterMode: false,
          setPresenterMode: (mode) => set({ presenterMode: mode }),
          togglePresenterMode: () => {
            const { presenterMode, setPresenterMode } = get();
            setPresenterMode(!presenterMode);
            setTimeout(() => {
              window.dispatchEvent(new Event("resize"));
              if (presenterMode) {
                document.exitFullscreen();
              } else {
                document.documentElement.requestFullscreen();
              }
            }, 100);
          },
          getDisplaySettings: () => {
            const {
              decimalDigits,
              theme,
              showWidgetControlsEllipsis,
              aiEnhancements,
              tablePagination,
              fontSize,
              defaultTicker,
              gridCorners,
              gridSnapping,
              quickAddButtonVisible,
              showMinimizeButton,
              showChartGeneration,
              collapsedPanelExpandOnHover,
              autoHideWidgetNavbar,
              removedSkillSlugs,
            } = get();

            const {
              lastVisitedPage = "/app",
              openaiApiKey,
              perplexityApiKey,
            } = useAuthStore.getState();

            return {
              decimalDigits,
              theme,
              showWidgetControlsEllipsis,
              aiEnhancements,
              tablePagination,
              fontSize,
              defaultTicker,
              gridCorners,
              gridSnapping,
              quickAddButtonVisible,
              showMinimizeButton,
              showChartGeneration,
              lastVisitedPage,
              openaiApiKey,
              perplexityApiKey,
              collapsedPanelExpandOnHover,
              autoHideWidgetNavbar,
              removedSkillSlugs,
            } as DisplaySettings;
          },
          updateDisplaySettings: (settings) => {
            const { fontSize, theme, autoHideWidgetNavbar } = settings;

            if (theme) get().setTheme(theme);
            if (fontSize) get().setFontSize(fontSize);
            if (autoHideWidgetNavbar !== undefined)
              get().setAutoHideWidgetNavbar(autoHideWidgetNavbar);
            set(settings);
          },
          debouncedUpdateSettings: debounce(async () => {
            const settings = get().getDisplaySettings();
            updateUserDisplaySettings(settings);
          }, 5000),
          excelExportPopup: false,
          setExcelExportPopup: (popup) => set({ excelExportPopup: popup }),
          excelExportItem: null,
          setExcelExportItem: (item) => set({ excelExportItem: item }),
          exportFolderPopup: false,
          setExportFolderPopup: (popup) => set({ exportFolderPopup: popup }),
          exportFolderItem: null,
          setExportFolderItem: (item) => set({ exportFolderItem: item }),
        };
      },
      {
        name: "theme-storage",
        version: 2,
        onRehydrateStorage: () => (state) => {
          if (state) state.mcpAuthPopup = null;
        },
        migrate: (persistedState: any) => {
          console.log("Migrating theme storage");

          if (typeof persistedState.defaultTicker === "string") {
            Promise.all([migrateDefaultTicker(persistedState.defaultTicker)]).then(
              ([newTicker]) => {
                persistedState.defaultTicker = newTicker;
              },
            );
          }

          console.log("Migrated theme storage to version 1");
          console.log(persistedState);
          return persistedState as ThemeState;
        },
      },
    ),
  ),
  shallow,
);

export function useShallowThemeStore<S extends ThemeState, T>(
  selector: Selector<S, T>,
): T {
  return useThemeStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
