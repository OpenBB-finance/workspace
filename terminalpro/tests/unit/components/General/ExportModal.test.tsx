// tests/unit/components/General/ExportModal.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePostHog } from "posthog-js/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import ExportModal from "~/components/General/ExportModal";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowThemeStore } from "~/lib/state/theme";
import { generateMultiTabReport } from "~/lib/utils";

// Mock the necessary hooks and modules
vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(() => ({
    exportPopup: true,
    setExportPopup: vi.fn(),
    theme: "light",
    setPendingExport: vi.fn(),
  })),
}));
vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));
vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: vi.fn(),
}));
vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: vi.fn(() => ({
    sharedItems: {},
  })),
}));
vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("~/lib/utils", async () => {
  const actual = await vi.importActual("~/lib/utils");
  return {
    ...actual,
    getWidgetsWithSupportedAssetClass: vi.fn(() => []),
    cn: vi.fn(),
    generateMultiTabReport: vi.fn(),
    generateReportImage: vi.fn(),
  };
});

vi.mock("@tanstack/react-query", () => ({
  useIsFetching: vi.fn().mockReturnValue(0),
  useIsMutating: vi.fn().mockReturnValue(0),
}));

describe("ExportModal", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock the return values of the hooks
    (useShallowThemeStore as Mock).mockReturnValue({
      exportPopup: true,
      setExportPopup: vi.fn(),
      theme: "light",
      setPendingExport: vi.fn(),
    });

    (useShallowAppStore as Mock).mockReturnValue({
      data: {
        name: "Test Dashboard",
        widgets: [{ id: 1 }],
        groups: [{ ticker: { symbol: "AAPL" } }, { ticker: { symbol: "GOOGL" } }],
      },
    });

    // Return just the function (selector is ignored by mock)
    (useShallowCopilotDataStore as Mock).mockReturnValue(vi.fn());

    // Return null so isShared is false (selector is ignored by mock)
    (useShallowSharedAppStore as Mock).mockReturnValue(null);

    // Mock posthog
    const mockCapture = vi.fn();
    (usePostHog as Mock).mockReturnValue({
      capture: mockCapture,
    });
  });

  it("renders the ExportModal component", () => {
    render(<ExportModal />);
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
    expect(
      screen.getByText("Export your dashboard as a PDF or PNG."),
    ).toBeInTheDocument();
  });

  it("displays PDF option on the screen", () => {
    render(<ExportModal />);

    // Check for the presence of PDF and PNG text
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });

  it("Verifies that the Export button is on the screen", async () => {
    render(<ExportModal />);
    const exportButton = screen.getByRole("button", { name: /export/i });
    expect(exportButton).toBeInTheDocument();
  });

  it("closes the modal when the cancel button is clicked", () => {
    const setExportPopup = vi.fn();
    (useShallowThemeStore as Mock).mockReturnValue({
      exportPopup: true,
      setExportPopup,
      theme: "light",
      setPendingExport: vi.fn(),
    });

    render(<ExportModal />);
    const cancelButton = screen.getByRole("button", { name: /cancel/i });

    fireEvent.click(cancelButton);

    expect(setExportPopup).toHaveBeenCalledWith(false);
  });

  describe("multi-tab detection", () => {
    it('shows "Export scope" select when dashboard has multiple tabs with content', () => {
      // Mock returns the dashboard directly (what the selector would return)
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "Tab 1" },
                  { id: "tab2", name: "Tab 2" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      render(<ExportModal />);

      expect(
        screen.getByRole("combobox", { name: /export scope/i }),
      ).toBeInTheDocument();
    });

    it('hides "Export scope" select when dashboard has single tab', () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [{ id: 1 }],
          gridLayout: {
            tab1: [{ i: "widget1" }],
          },
          groups: [],
        },
      });

      render(<ExportModal />);

      expect(
        screen.queryByRole("combobox", { name: /export scope/i }),
      ).not.toBeInTheDocument();
    });

    it("correctly identifies tabs from gridLayout keys with non-empty arrays", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [], // Empty - should not count as a tab
            tab3: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      render(<ExportModal />);

      // Should show export scope since we have 2 valid tabs
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      expect(scopeSelect).toBeInTheDocument();

      // Open dropdown to see options
      fireEvent.click(scopeSelect);
      expect(screen.getByText(/All tabs \(2\)/)).toBeInTheDocument();
    });
  });

  describe("tab info extraction", () => {
    it("extracts tab names from navigation_bar widget storage", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "First Tab" },
                  { id: "tab2", name: "Second Tab" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      render(<ExportModal />);

      // Switch to all-tabs scope to trigger the export
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);

      // Should show tab count in the option
      expect(screen.getByText(/All tabs \(2\)/)).toBeInTheDocument();
    });

    it("falls back to tabId as name when storedTabs is missing", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [], // No navigation_bar widget
          gridLayout: {
            "custom-tab-1": [{ i: "widget1" }],
            "custom-tab-2": [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      render(<ExportModal />);

      // Should still detect multiple tabs
      expect(
        screen.getByRole("combobox", { name: /export scope/i }),
      ).toBeInTheDocument();
    });
  });

  describe("multi-tab export", () => {
    it('calls generateMultiTabReport when scope is "all-tabs" and hasMultipleTabs', async () => {
      const mockSetExportPopup = vi.fn();
      const mockSetPendingExport = vi.fn();

      (useShallowThemeStore as Mock).mockReturnValue({
        exportPopup: true,
        setExportPopup: mockSetExportPopup,
        theme: "dark",
        setPendingExport: mockSetPendingExport,
      });

      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "Tab 1" },
                  { id: "tab2", name: "Tab 2" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      (generateMultiTabReport as Mock).mockImplementation(
        (_checkData, _tabs, _title, _slug, _type, _dark, _progress, onFinish) => {
          onFinish?.();
          return Promise.resolve();
        },
      );

      render(<ExportModal />);

      // Select all-tabs scope
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText(/All tabs/);
      fireEvent.click(allTabsOption);

      // Click export
      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(generateMultiTabReport).toHaveBeenCalled();
      });
    });

    it("passes correct tabsInfo array to generateMultiTabReport", async () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "First" },
                  { id: "tab2", name: "Second" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      (generateMultiTabReport as Mock).mockImplementation(
        (_checkData, _tabs, _title, _slug, _type, _dark, _progress, onFinish) => {
          onFinish?.();
          return Promise.resolve();
        },
      );

      render(<ExportModal />);

      // Select all-tabs scope
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText(/All tabs/);
      fireEvent.click(allTabsOption);

      // Click export
      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(generateMultiTabReport).toHaveBeenCalled();
        const [_checkData, tabsInfo] = (generateMultiTabReport as Mock).mock.calls[0];
        expect(tabsInfo).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: "tab1", name: "First" }),
            expect.objectContaining({ id: "tab2", name: "Second" }),
          ]),
        );
      });
    });

    it("shows progress bar during multi-tab export", async () => {
      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "Tab 1" },
                  { id: "tab2", name: "Tab 2" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      (generateMultiTabReport as Mock).mockImplementation(
        (_checkData, _tabs, _title, _slug, _type, _dark, onProgress) => {
          onProgress?.(1, 2, "Tab 1");
          return new Promise(() => {}); // Never resolve to keep progress visible
        },
      );

      render(<ExportModal />);

      // Select all-tabs scope
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText(/All tabs/);
      fireEvent.click(allTabsOption);

      // Click export
      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Exporting tab: Tab 1/)).toBeInTheDocument();
      });
    });

    it("clears progress and closes dialog on success", async () => {
      const mockSetExportPopup = vi.fn();
      const { toast } = await import("sonner");

      (useShallowThemeStore as Mock).mockReturnValue({
        exportPopup: true,
        setExportPopup: mockSetExportPopup,
        theme: "dark",
        setPendingExport: vi.fn(),
      });

      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "Tab 1" },
                  { id: "tab2", name: "Tab 2" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      (generateMultiTabReport as Mock).mockImplementation(
        (_checkData, _tabs, _title, _slug, _type, _dark, _progress, onFinish) => {
          onFinish?.();
          return Promise.resolve();
        },
      );

      render(<ExportModal />);

      // Select all-tabs scope
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText(/All tabs/);
      fireEvent.click(allTabsOption);

      // Click export
      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
        expect(mockSetExportPopup).toHaveBeenCalledWith(false);
      });
    });

    it("clears progress and shows error toast on failure", async () => {
      const { toast } = await import("sonner");

      (useShallowAppStore as Mock).mockReturnValue({
        data: {
          name: "Test Dashboard",
          widgets: [
            {
              widgetId: "navigation_bar",
              storage: {
                tabs: [
                  { id: "tab1", name: "Tab 1" },
                  { id: "tab2", name: "Tab 2" },
                ],
              },
            },
          ],
          gridLayout: {
            tab1: [{ i: "widget1" }],
            tab2: [{ i: "widget2" }],
          },
          groups: [],
        },
      });

      (generateMultiTabReport as Mock).mockImplementation(
        (
          _checkData,
          _tabs,
          _title,
          _slug,
          _type,
          _dark,
          _progress,
          _finish,
          onError,
        ) => {
          onError?.(new Error("Export failed"));
          return Promise.resolve();
        },
      );

      render(<ExportModal />);

      // Select all-tabs scope
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText(/All tabs/);
      fireEvent.click(allTabsOption);

      // Click export
      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Error generating report",
          expect.objectContaining({ description: "Export failed" }),
        );
      });
    });
  });
});
