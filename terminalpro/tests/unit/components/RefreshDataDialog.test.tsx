import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshDataDialog } from "~/components/RefreshDataDialog";
import { useWidgetContext } from "~/components/Widget.context";
import type { WidgetT } from "~/components/types";
import { createTestWidget } from "../helpers";

const mockUpdateWidget = vi.fn();
const mockOnClose = vi.fn();

const createMockWidgetContext = (widget: Partial<WidgetT> = {}) => ({
  widget: widget as WidgetT,
  widgetFromJSON: undefined,
  updateWidget: mockUpdateWidget,
  widgetRef: { current: widget as WidgetT },
  activeDashboardId: "test-dashboard",
  isShared: false,
  uuid: "test-uuid",
  getWidget: () => widget as WidgetT,
});

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(() => createMockWidgetContext()),
}));

const useWidgetContextMock = vi.mocked(useWidgetContext);

describe("RefreshDataDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render dialog when open is true", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByText("Refresh Data")).toBeInTheDocument();
    });

    it("should not render dialog when open is false", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      const { container } = render(
        <RefreshDataDialog open={false} onClose={mockOnClose} />,
      );

      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it("should render auto refresh switch", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByText("Auto refresh")).toBeInTheDocument();
    });

    it("should render refresh interval input", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByText("Refresh interval (seconds)")).toBeInTheDocument();
      expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    });

    it("should render Save and Cancel buttons", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });
  });

  describe("Default values", () => {
    it("should show default values when no refresh data in storage", () => {
      const widget = createTestWidget({ storage: {} });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(30);
    });

    it("should show saved values from widget storage", () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: true,
            refreshRate: 60,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveValue(60);
    });
  });

  describe("Interactions", () => {
    it("should call onClose when Cancel is clicked", async () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call updateWidget and onClose when Save is clicked", async () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockUpdateWidget).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should toggle refresh enabled when switch is clicked", async () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toHaveAttribute("aria-checked", "false");

      await userEvent.click(switchElement);

      expect(switchElement).toHaveAttribute("aria-checked", "true");
    });

    it("should update refresh rate when input changes", async () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: true,
            refreshRate: 30,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "45" } });

      expect(input).toHaveValue(45);
    });

    it("should disable input when auto refresh is disabled", () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      expect(input).toBeDisabled();
    });

    it("should enable input when auto refresh is enabled", async () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const switchElement = screen.getByRole("switch");
      await userEvent.click(switchElement);

      const input = screen.getByRole("spinbutton");
      expect(input).not.toBeDisabled();
    });
  });

  describe("Validation", () => {
    it("should show error when refresh rate is below minimum", async () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: true,
            refreshRate: 30,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "5" } });

      expect(screen.getByText("Minimum is 10 seconds")).toBeInTheDocument();
    });

    it("should clamp refresh rate to minimum on save", async () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: true,
            refreshRate: 30,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "5" } });

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockUpdateWidget).toHaveBeenCalledWith(expect.any(Function));

      const updateFn = mockUpdateWidget.mock.calls[0][0];
      const result = updateFn({ storage: {} });
      expect(result.storage.refreshData.refreshRate).toBe(10);
    });
  });

  describe("State reset on reopen", () => {
    it("should reset to saved values when dialog reopens", async () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: true,
            refreshRate: 30,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      const { rerender } = render(
        <RefreshDataDialog open={true} onClose={mockOnClose} />,
      );

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "99" } });

      expect(input).toHaveValue(99);

      rerender(<RefreshDataDialog open={false} onClose={mockOnClose} />);
      rerender(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const inputAfterReopen = screen.getByRole("spinbutton");
      expect(inputAfterReopen).toHaveValue(30);
    });

    it("should reset switch state when dialog reopens after cancel", async () => {
      const widget = createTestWidget({
        storage: {
          refreshData: {
            refreshEnabled: false,
            refreshRate: 30,
          },
        },
      });
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      const { rerender } = render(
        <RefreshDataDialog open={true} onClose={mockOnClose} />,
      );

      const switchElement = screen.getByRole("switch");
      await userEvent.click(switchElement);
      expect(switchElement).toHaveAttribute("aria-checked", "true");

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      rerender(<RefreshDataDialog open={false} onClose={mockOnClose} />);
      rerender(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const switchAfterReopen = screen.getByRole("switch");
      expect(switchAfterReopen).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Save functionality", () => {
    it("should save correct values to widget storage", async () => {
      const widget = createTestWidget();
      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<RefreshDataDialog open={true} onClose={mockOnClose} />);

      const switchElement = screen.getByRole("switch");
      await userEvent.click(switchElement);

      const input = screen.getByRole("spinbutton");
      fireEvent.change(input, { target: { value: "45" } });

      await userEvent.click(screen.getByRole("button", { name: "Save" }));

      expect(mockUpdateWidget).toHaveBeenCalledWith(expect.any(Function));

      const updateFn = mockUpdateWidget.mock.calls[0][0];
      const result = updateFn({ storage: {} });

      expect(result.storage.refreshData).toEqual({
        refreshEnabled: true,
        refreshRate: 45,
      });
    });
  });
});
