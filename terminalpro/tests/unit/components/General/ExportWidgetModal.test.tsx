import { fireEvent, render, screen } from "@testing-library/react";
import { usePostHog } from "posthog-js/react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import ExportWidgetModal from "~/components/General/ExportWidgetModal";
import { useThemeStore } from "~/lib/state/theme";

// Mock the necessary hooks and modules
vi.mock("~/lib/state/theme", () => ({
  useThemeStore: vi.fn(() => ({
    exportWidgetData: {
      widgetName: "Test Widget",
      widgetId: "123",
      possibleExportFormats: [
        { value: "pdf", fn: vi.fn() },
        { value: "png", fn: vi.fn() },
      ],
      selectedExportFormat: "pdf",
    },
    setExportWidgetData: vi.fn(),
  })),
}));

vi.mock("~/lib/utils", () => ({
  slugify: vi.fn((value: string) => value),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

describe("ExportWidgetModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock the return values of the hooks
    (useThemeStore as unknown as Mock).mockReturnValue({
      exportWidgetData: {
        widgetName: "Test Widget",
        widgetId: "123",
        possibleExportFormats: [
          { value: "csv", fn: vi.fn() },
          { value: "xlsx", fn: vi.fn() },
          { value: "png", fn: vi.fn() },
        ],
        selectedExportFormat: "csv",
      },
      setExportWidgetData: vi.fn(),
    });

    // Mock posthog
    const mockCapture = vi.fn();
    (usePostHog as Mock).mockReturnValue({
      capture: mockCapture,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders the ExportWidgetModal component", () => {
    render(<ExportWidgetModal />);
    expect(screen.getByText("Export widget")).toBeInTheDocument();
  });

  it("displays export format options", () => {
    render(<ExportWidgetModal />);
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText("PNG")).toBeInTheDocument();
    expect(screen.getByText("XLSX")).toBeInTheDocument();
  });

  it("calls the export function when the Export button is clicked", () => {
    vi.useFakeTimers();
    const { exportWidgetData, setExportWidgetData } = useThemeStore();
    const exportFn = exportWidgetData.possibleExportFormats[0].fn;
    render(<ExportWidgetModal />);
    const exportButton = screen.getByRole("button", { name: /export/i });

    fireEvent.click(exportButton);

    expect(usePostHog().capture).toHaveBeenCalledWith("user_exported_data_widget", {
      widgetName: exportWidgetData.widgetName,
      widgetId: exportWidgetData.widgetId,
      selectedExportFormat: exportWidgetData.selectedExportFormat,
    });

    expect(toast.info).toHaveBeenCalledWith("Widget export is being generated", {
      description: "The file will be downloaded shortly",
    });

    vi.runAllTimers();

    const selectedFormat = exportWidgetData.possibleExportFormats.find(
      (format: any) => format.value === exportWidgetData.selectedExportFormat,
    );
    expect(selectedFormat?.fn).toHaveBeenCalled();

    expect(setExportWidgetData).toHaveBeenCalledWith(null);

    vi.advanceTimersByTime(3000);
    expect(exportFn).toHaveBeenCalledWith(
      expect.stringContaining("Test Widget Widget"),
    );
  });

  it("closes the modal when the cancel button is clicked", () => {
    const { setExportWidgetData } = useThemeStore();
    render(<ExportWidgetModal />);

    // Find the cancel button
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(setExportWidgetData).toHaveBeenCalledWith(null);
  });
});
