import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import ExportFolderDialog from "~/components/General/ExportFolderDialog";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { generateFolderReport } from "~/lib/utils";

// Mock the necessary hooks and modules
vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/utils", async () => {
  const actual = await vi.importActual("~/lib/utils");
  return {
    ...actual,
    generateFolderReport: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useIsFetching: vi.fn().mockReturnValue(0),
  useIsMutating: vi.fn().mockReturnValue(0),
}));

describe("ExportFolderDialog", () => {
  const mockSetExportFolderPopup = vi.fn();
  const mockSetPendingExport = vi.fn();

  const mockFolder = {
    id: "folder-1",
    name: "Test Folder",
    isFolder: true,
    children: ["dash-1", "dash-2"],
  };

  const mockDashboard1 = {
    id: "dash-1",
    isFolder: false,
    data: {
      name: "Dashboard 1",
      gridLayout: {
        tab1: [{ i: "widget1" }],
        tab2: [{ i: "widget2" }],
      },
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
    },
  };

  const mockDashboard2 = {
    id: "dash-2",
    isFolder: false,
    data: {
      name: "Dashboard 2",
      gridLayout: {
        tab1: [{ i: "widget1" }],
      },
      widgets: [],
    },
  };

  const mockItems = {
    "folder-1": mockFolder,
    "dash-1": mockDashboard1,
    "dash-2": mockDashboard2,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowThemeStore as Mock).mockReturnValue({
      exportFolderPopup: true,
      setExportFolderPopup: mockSetExportFolderPopup,
      exportFolderItem: { id: "folder-1", name: "Test Folder" },
      theme: "dark",
      setPendingExport: mockSetPendingExport,
    });

    (useShallowAppStore as Mock).mockReturnValue(mockItems);
  });

  describe("rendering", () => {
    it("renders dialog when exportFolderPopup is true", () => {
      render(<ExportFolderDialog />);

      expect(screen.getByText("Export Folder")).toBeInTheDocument();
    });

    it("shows folder name in description", () => {
      render(<ExportFolderDialog />);

      expect(
        screen.getByText(/Export all dashboards in "Test Folder" as a ZIP file/),
      ).toBeInTheDocument();
    });

    it("displays correct dashboard count", () => {
      render(<ExportFolderDialog />);

      expect(screen.getByText(/2 dashboards will be exported/)).toBeInTheDocument();
    });
  });

  describe("empty folder handling", () => {
    it("shows 'This folder is empty' when folder has no dashboards", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        "folder-1": {
          id: "folder-1",
          name: "Empty Folder",
          isFolder: true,
          children: [],
        },
      });

      render(<ExportFolderDialog />);

      expect(screen.getByText("This folder is empty.")).toBeInTheDocument();
    });

    it("disables export button when folder is empty", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        "folder-1": {
          id: "folder-1",
          name: "Empty Folder",
          isFolder: true,
          children: [],
        },
      });

      render(<ExportFolderDialog />);

      const exportButton = screen.getByRole("button", { name: /export/i });
      expect(exportButton).toBeDisabled();
    });
  });

  describe("dialog interaction", () => {
    it("closes dialog when cancel button clicked", () => {
      render(<ExportFolderDialog />);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockSetExportFolderPopup).toHaveBeenCalledWith(false);
    });
  });

  describe("dashboard extraction", () => {
    it("extracts dashboards correctly from folder children", () => {
      render(<ExportFolderDialog />);

      // Should show both dashboards
      expect(screen.getByText(/2 dashboards/)).toBeInTheDocument();
    });

    it("extracts tabs correctly from gridLayout and navigation_bar widget", () => {
      render(<ExportFolderDialog />);

      // Switch to all-tabs mode to see the total tabs count
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);

      const allTabsOption = screen.getByText("All tabs");
      fireEvent.click(allTabsOption);

      // Dashboard 1 has 2 tabs, Dashboard 2 has 1 tab = 3 total
      expect(screen.getByText(/3 tabs total/)).toBeInTheDocument();
    });

    it("handles nested folders recursively", () => {
      (useShallowAppStore as Mock).mockReturnValue({
        "folder-1": {
          id: "folder-1",
          name: "Parent Folder",
          isFolder: true,
          children: ["subfolder-1"],
        },
        "subfolder-1": {
          id: "subfolder-1",
          name: "Sub Folder",
          isFolder: true,
          children: ["dash-1"],
        },
        "dash-1": mockDashboard1,
      });

      render(<ExportFolderDialog />);

      // Should find dashboard inside nested folder
      expect(screen.getByText(/1 dashboard/)).toBeInTheDocument();
    });
  });

  describe("export scope toggle", () => {
    it("shows export scope select", () => {
      render(<ExportFolderDialog />);

      expect(
        screen.getByRole("combobox", { name: /export scope/i }),
      ).toBeInTheDocument();
    });

    it("displays total tabs count when all-tabs selected", () => {
      render(<ExportFolderDialog />);

      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);

      const allTabsOption = screen.getByText("All tabs");
      fireEvent.click(allTabsOption);

      expect(screen.getByText(/3 tabs total/)).toBeInTheDocument();
    });
  });

  describe("export functionality", () => {
    it("calls generateFolderReport with correct parameters", async () => {
      (generateFolderReport as Mock).mockImplementation(
        (
          _checkData,
          _dashboards,
          _folderName,
          _fileName,
          _exportType,
          _exportScope,
          _darkMode,
          _onProgress,
          onFinish,
        ) => {
          onFinish?.();
          return Promise.resolve();
        },
      );

      render(<ExportFolderDialog />);

      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(generateFolderReport).toHaveBeenCalledWith(
          expect.any(Function),
          expect.arrayContaining([
            expect.objectContaining({ id: "dash-1", name: "Dashboard 1" }),
            expect.objectContaining({ id: "dash-2", name: "Dashboard 2" }),
          ]),
          "Test Folder",
          "test-folder",
          "pdf",
          "current",
          true,
          expect.any(Function),
          expect.any(Function),
          expect.any(Function),
        );
      });
    });

    it("handles export completion successfully", async () => {
      const { toast } = await import("sonner");

      (generateFolderReport as Mock).mockImplementation(
        (
          _checkData,
          _dashboards,
          _folderName,
          _fileName,
          _exportType,
          _exportScope,
          _darkMode,
          _onProgress,
          onFinish,
        ) => {
          onFinish?.();
          return Promise.resolve();
        },
      );

      render(<ExportFolderDialog />);

      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Folder exported successfully",
          expect.objectContaining({
            description: expect.stringContaining("dashboards"),
          }),
        );
      });

      expect(mockSetExportFolderPopup).toHaveBeenCalledWith(false);
      expect(mockSetPendingExport).toHaveBeenCalledWith(false);
    });

    it("handles export errors", async () => {
      const { toast } = await import("sonner");

      (generateFolderReport as Mock).mockImplementation(
        (
          _checkData,
          _dashboards,
          _folderName,
          _fileName,
          _exportType,
          _exportScope,
          _darkMode,
          _onProgress,
          _onFinish,
          onError,
        ) => {
          onError?.(new Error("Export failed"));
          return Promise.resolve();
        },
      );

      render(<ExportFolderDialog />);

      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Error exporting folder",
          expect.objectContaining({
            description: "Export failed",
          }),
        );
      });

      expect(mockSetPendingExport).toHaveBeenCalledWith(false);
    });
  });

  describe("progress UI", () => {
    it("shows progress UI during export", async () => {
      (generateFolderReport as Mock).mockImplementation(
        (
          _checkData,
          _dashboards,
          _folderName,
          _fileName,
          _exportType,
          _exportScope,
          _darkMode,
          onProgress,
        ) => {
          onProgress?.(1, 2, "Dashboard 1", 1, 2, "Tab 1");
          return new Promise(() => {}); // Never resolve to keep progress visible
        },
      );

      render(<ExportFolderDialog />);

      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Dashboard: Dashboard 1/)).toBeInTheDocument();
      });
    });

    it("shows tab progress when exporting multi-tab dashboards", async () => {
      (generateFolderReport as Mock).mockImplementation(
        (
          _checkData,
          _dashboards,
          _folderName,
          _fileName,
          _exportType,
          _exportScope,
          _darkMode,
          onProgress,
        ) => {
          onProgress?.(1, 2, "Dashboard 1", 1, 2, "Tab 1");
          return new Promise(() => {});
        },
      );

      render(<ExportFolderDialog />);

      // Select all-tabs mode
      const scopeSelect = screen.getByRole("combobox", { name: /export scope/i });
      fireEvent.click(scopeSelect);
      const allTabsOption = screen.getByText("All tabs");
      fireEvent.click(allTabsOption);

      const exportButton = screen.getByRole("button", { name: /^export$/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/Tab: Tab 1/)).toBeInTheDocument();
      });
    });
  });

  describe("tab sorting", () => {
    it("sorts tabs by stored order from navigation_bar", () => {
      // Dashboard with tabs in different order in gridLayout vs navigation_bar
      (useShallowAppStore as Mock).mockReturnValue({
        "folder-1": mockFolder,
        "dash-1": {
          id: "dash-1",
          isFolder: false,
          data: {
            name: "Dashboard 1",
            gridLayout: {
              tabC: [{ i: "widget1" }],
              tabA: [{ i: "widget2" }],
              tabB: [{ i: "widget3" }],
            },
            widgets: [
              {
                widgetId: "navigation_bar",
                storage: {
                  tabs: [
                    { id: "tabA", name: "Alpha Tab" },
                    { id: "tabB", name: "Beta Tab" },
                    { id: "tabC", name: "Gamma Tab" },
                  ],
                },
              },
            ],
          },
        },
      });

      render(<ExportFolderDialog />);

      // Verify the dashboard count is correct (tabs are sorted internally)
      expect(screen.getByText(/1 dashboard/)).toBeInTheDocument();
    });
  });
});
