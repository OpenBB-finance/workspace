import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ParametersDialog } from "~/components/ParametersDialogDraggableCard";
import type { ParamDef, WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { createTestWidget } from "../helpers";

const mockUpdateWidget = vi.fn();
const mockSetOpen = vi.fn();

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

describe("ParametersDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render dialog when open is true", () => {
      const widget = createTestWidget({
        id: "test-widget",
        params: [
          { type: "text", paramName: "param1", value: "value1", label: "Parameter 1" },
        ],
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByText("Parameters")).toBeInTheDocument();
    });

    it("should not render when open is false", () => {
      const widget = createTestWidget({
        id: "test-widget",
        params: [
          { type: "text", paramName: "param1", value: "value1", label: "Parameter 1" },
        ],
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      const { container } = render(
        <ParametersDialog open={false} setOpen={mockSetOpen} />,
      );

      // Dialog should not be visible when closed
      expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });

    it("should render all parameters with labels", () => {
      const params: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "Parameter 1" },
        { type: "text", paramName: "param2", value: "value2", label: "Parameter 2" },
        { type: "text", paramName: "param3", value: "value3", label: "Parameter 3" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByText("Parameter 1")).toBeInTheDocument();
      expect(screen.getByText("Parameter 2")).toBeInTheDocument();
      expect(screen.getByText("Parameter 3")).toBeInTheDocument();
    });

    it("should use paramName as label when label is not provided", () => {
      const params: ParamDef[] = [
        { type: "text", paramName: "my_param", value: "value1" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByText("my_param")).toBeInTheDocument();
    });

    it("should render Save and Cancel buttons", () => {
      const widget = createTestWidget({
        id: "test-widget",
        params: [
          { type: "text", paramName: "param1", value: "value1", label: "Parameter 1" },
        ],
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    it("should return null when widget has no params", () => {
      const widget = createTestWidget({
        id: "test-widget",
        params: [],
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      const { container } = render(
        <ParametersDialog open={true} setOpen={mockSetOpen} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("should return null when widget is null", () => {
      useWidgetContextMock.mockReturnValue(createMockWidgetContext());

      const { container } = render(
        <ParametersDialog open={true} setOpen={mockSetOpen} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Parameter visibility toggle", () => {
    it("should initialize switches with correct checked state", () => {
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
        {
          type: "text",
          paramName: "param2",
          value: "value2",
          label: "Param 2",
          show: false,
        },
        { type: "text", paramName: "param3", value: "value3", label: "Param 3" }, // undefined show should default to true
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(3);
      expect(switches[0]).toBeChecked(); // param1: show: true
      expect(switches[1]).not.toBeChecked(); // param2: show: false
      expect(switches[2]).toBeChecked(); // param3: undefined defaults to true
    });

    it("should toggle parameter visibility when switch is clicked", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeChecked();

      await user.click(switchElement);

      await waitFor(() => {
        expect(switchElement).not.toBeChecked();
      });
    });

    it("should allow toggling multiple parameters independently", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
        {
          type: "text",
          paramName: "param2",
          value: "value2",
          label: "Param 2",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      const switches = screen.getAllByRole("switch");

      await user.click(switches[0]);

      await waitFor(() => {
        expect(switches[0]).not.toBeChecked();
        expect(switches[1]).toBeChecked(); // Should remain unchanged
      });
    });
  });

  describe("Save behavior", () => {
    it("should call updateWidget with updated params when Save is clicked", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
        {
          type: "text",
          paramName: "param2",
          value: "value2",
          label: "Param 2",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      // Toggle first parameter off
      const switches = screen.getAllByRole("switch");
      await user.click(switches[0]);

      // Click Save
      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalledTimes(1);
      });

      // Verify the update function was called with the correct params
      const updateFn = mockUpdateWidget.mock.calls[0][0];
      const updatedWidget = updateFn({ ...widget });

      expect(updatedWidget.params).toHaveLength(2);
      expect(updatedWidget.params[0].show).toBe(false); // param1 was toggled off
      expect(updatedWidget.params[1].show).toBe(true); // param2 remains on
      expect(updatedWidget.params[0].hidden).toBe(true); // param1 was toggled off
      expect(updatedWidget.params[1].hidden).toBe(false); // param2 remains on
    });

    it("should close dialog after saving", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "Param 1" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });
    });

    it("should preserve all param properties when saving", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "number",
          paramName: "param1",
          value: 42,
          label: "Number Param",
          description: "A number parameter",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      const saveButton = screen.getByRole("button", { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalled();
      });

      const updateFn = mockUpdateWidget.mock.calls[0][0];
      const updatedWidget = updateFn({ ...widget });
      const savedParam = updatedWidget.params[0];

      expect(savedParam.type).toBe("number");
      expect(savedParam.value).toBe(42);
      expect(savedParam.label).toBe("Number Param");
      expect(savedParam.description).toBe("A number parameter");
    });
  });

  describe("Cancel behavior", () => {
    it("should close dialog without saving when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      // Toggle parameter
      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      // Click Cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockSetOpen).toHaveBeenCalledWith(false);
      });

      // updateWidget should not have been called
      expect(mockUpdateWidget).not.toHaveBeenCalled();
    });

    it("should reset changes when dialog is reopened after canceling", async () => {
      const user = userEvent.setup();
      const params: ParamDef[] = [
        {
          type: "text",
          paramName: "param1",
          value: "value1",
          label: "Param 1",
          show: true,
        },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      const contextValue = createMockWidgetContext(widget);
      useWidgetContextMock.mockReturnValue(contextValue);

      const TestDialog = ({ open }: { open: boolean }) =>
        open ? <ParametersDialog open={open} setOpen={mockSetOpen} /> : null;

      const { rerender } = render(<TestDialog open={true} />);

      // Toggle parameter
      const switchElement = screen.getByRole("switch");
      await user.click(switchElement);

      await waitFor(() => {
        expect(switchElement).not.toBeChecked();
      });

      // Close dialog by unmounting component
      rerender(<TestDialog open={false} />);

      await waitFor(() => {
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
      });

      // Reopen dialog
      rerender(<TestDialog open={true} />);

      // Switch should be back to original state
      const reopenedSwitch = await screen.findByRole("switch");
      expect(reopenedSwitch).toBeChecked();
    });
  });

  describe("State management", () => {
    it("should handle params from widgetFromJSON when widget.params is undefined", () => {
      const params: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "From JSON" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
      });

      useWidgetContextMock.mockReturnValue({
        ...createMockWidgetContext(widget),
        widgetFromJSON: { params } as any,
      });

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByText("From JSON")).toBeInTheDocument();
    });

    it("should prioritize widget.params over widgetFromJSON.params", () => {
      const widgetParams: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "From Widget" },
      ];

      const jsonParams: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "From JSON" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params: widgetParams,
      });

      useWidgetContextMock.mockReturnValue({
        ...createMockWidgetContext(widget),
        widgetFromJSON: { params: jsonParams } as any,
      });

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      expect(screen.getByText("From Widget")).toBeInTheDocument();
      expect(screen.queryByText("From JSON")).not.toBeInTheDocument();
    });
  });

  describe("Drag handle", () => {
    it("should render drag handle button for each parameter", () => {
      const params: ParamDef[] = [
        { type: "text", paramName: "param1", value: "value1", label: "Param 1" },
        { type: "text", paramName: "param2", value: "value2", label: "Param 2" },
      ];

      const widget = createTestWidget({
        id: "test-widget",
        params,
      });

      useWidgetContextMock.mockReturnValue(createMockWidgetContext(widget));

      render(<ParametersDialog open={true} setOpen={mockSetOpen} />);

      // Each parameter row should have a drag handle button
      const dragHandles = screen.getAllByRole("button", { name: "" });
      // We expect 2 drag handles + 2 action buttons (Save/Cancel) = 4 total buttons
      // Filter for only the drag handles (they have tabIndex -1)
      const dragHandleButtons = dragHandles.filter(
        (button) => button.getAttribute("tabindex") === "-1",
      );

      expect(dragHandleButtons.length).toBeGreaterThanOrEqual(2);
    });
  });
});
