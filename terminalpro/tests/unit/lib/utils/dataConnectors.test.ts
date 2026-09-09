import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetJsonT, WidgetT } from "~/components/types";
import { handleConnectionAdded } from "~/lib/utils/dataConnectors";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mocked-uuid-1234",
}));

vi.mock("~/lib/utils", () => ({
  generateRandomName: () => "Random Dashboard Name",
}));

const mockAddWidget = vi.fn();
const mockAddTab = vi.fn();
const mockAddWidgets = vi
  .fn()
  .mockImplementation((dashboardId: string, widgets: WidgetT[]) => {
    widgets.forEach((widget) => {
      mockAddWidget(dashboardId, widget);
    });
  });

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      addWidget: mockAddWidget,
      addWidgets: mockAddWidgets,
      addTab: mockAddTab,
    }),
  },
}));

describe("dataConnectors utility functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleConnectionAdded", () => {
    function createMockWidget(overrides: Partial<WidgetT> = {}): WidgetT {
      return {
        id: "widget-1",
        name: "Test Widget",
        widgetId: "test_widget" as any,
        type: "table",
        ...overrides,
      } as WidgetT;
    }

    describe("when user is inside a dashboard", () => {
      const dashboardId = "dashboard-123";
      const navigate = vi.fn();

      it("should add single widget to current dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(mockAddWidget).toHaveBeenCalledTimes(1);
        expect(mockAddWidget).toHaveBeenCalledWith(dashboardId, widgets[0]);
      });

      it("should add multiple widgets to current dashboard", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
          createMockWidget({ id: "widget-3" }),
        ];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(mockAddWidget).toHaveBeenCalledTimes(3);
      });

      it("should show success toast for single widget", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "1 widget added to dashboard",
          expect.objectContaining({
            description: expect.stringContaining("has been added"),
          }),
        );
      });

      it("should show success toast for multiple widgets", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
        ];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "2 widgets added to dashboard",
          expect.objectContaining({
            description: expect.stringContaining("have been added"),
          }),
        );
      });

      it("should not navigate when adding to current dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(navigate).not.toHaveBeenCalled();
      });
    });

    describe("when user is outside a dashboard", () => {
      const dashboardId = "";
      const navigate = vi.fn();

      it("should not add widgets directly to any dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(mockAddWidget).not.toHaveBeenCalled();
      });

      it("should show success toast with widget menu info for single widget", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "1 widget added to widget menu",
          expect.objectContaining({
            description: expect.stringContaining("Ctrl + K"),
            action: expect.objectContaining({
              label: "Add to new dashboard",
            }),
          }),
        );
      });

      it("should show success toast with widget menu info for multiple widgets", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
        ];

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "2 widgets added to widget menu",
          expect.objectContaining({
            description: expect.stringContaining("have been added"),
          }),
        );
      });

      it("should provide action to add widgets to new dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1]).toHaveProperty("action");
        expect(toastCall[1].action.label).toBe("Add to new dashboard");
      });

      it("should create new dashboard when action is clicked", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded(dashboardId, widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        const action = toastCall[1].action;

        action.onClick();

        expect(mockAddTab).toHaveBeenCalledWith(
          expect.objectContaining({
            index: "mocked-uuid-1234",
            data: expect.objectContaining({
              name: "Random Dashboard Name",
              type: "custom",
              widgets: widgets,
            }),
          }),
        );
        expect(navigate).toHaveBeenCalledWith("/app/mocked-uuid-1234");
      });
    });

    describe("when widget count exceeds 10", () => {
      const navigate = vi.fn();

      it("should show success toast without action for dashboard context", () => {
        const dashboardId = "dashboard-123";
        const widgets = Array.from({ length: 11 }, (_, i) =>
          createMockWidget({ id: `widget-${i}` }),
        );

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "11 widgets added to widget menu",
          expect.objectContaining({
            description: expect.stringContaining("have been added"),
          }),
        );
        expect(mockAddWidget).not.toHaveBeenCalled();
      });

      it("should show success toast without action when outside dashboard", () => {
        const dashboardId = "";
        const widgets = Array.from({ length: 15 }, (_, i) =>
          createMockWidget({ id: `widget-${i}` }),
        );

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(toast.success).toHaveBeenCalledWith(
          "15 widgets added to widget menu",
          expect.objectContaining({
            description: expect.stringContaining("have been added"),
          }),
        );
        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1]).not.toHaveProperty("action");
      });

      it("should return early and not add widgets to dashboard", () => {
        const dashboardId = "dashboard-123";
        const widgets = Array.from({ length: 11 }, (_, i) =>
          createMockWidget({ id: `widget-${i}` }),
        );

        handleConnectionAdded(dashboardId, widgets, navigate);

        expect(mockAddWidget).not.toHaveBeenCalled();
      });
    });

    describe("edit mode (isEdit = true)", () => {
      const navigate = vi.fn();

      it("should show updated message for single widget when editing", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded("", widgets, navigate, true);

        expect(toast.success).toHaveBeenCalledWith(
          "1 widget updated on the widget menu",
          expect.objectContaining({
            description: expect.stringContaining("has been updated"),
          }),
        );
      });

      it("should show updated message for multiple widgets when editing", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
        ];

        handleConnectionAdded("", widgets, navigate, true);

        expect(toast.success).toHaveBeenCalledWith(
          "2 widgets updated on the widget menu",
          expect.objectContaining({
            description: expect.stringContaining("have been updated"),
          }),
        );
      });
    });

    describe("boundary conditions", () => {
      const navigate = vi.fn();

      it("should handle exactly 10 widgets with action available", () => {
        const widgets = Array.from({ length: 10 }, (_, i) =>
          createMockWidget({ id: `widget-${i}` }),
        );

        handleConnectionAdded("", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1]).toHaveProperty("action");
      });

      it("should handle empty widgets array gracefully", () => {
        const widgets: WidgetT[] = [];

        handleConnectionAdded("dashboard-123", widgets, navigate);

        // Uses singular "widget" when count is 0 (0 > 1 is false)
        expect(toast.success).toHaveBeenCalledWith(
          "0 widget added to dashboard",
          expect.anything(),
        );
      });

      it("should handle widgets with WidgetJsonT type", () => {
        const jsonWidget: WidgetJsonT = {
          widgetId: "test_widget" as any,
          name: "JSON Widget",
          description: "A test widget",
        } as WidgetJsonT;

        handleConnectionAdded("dashboard-123", [jsonWidget as any], navigate);

        expect(mockAddWidget).toHaveBeenCalledWith("dashboard-123", jsonWidget);
      });

      it("should add CSS class to toast for styling", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded("", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1]).toHaveProperty("className", "_toast-success");
      });
    });

    describe("toast message grammar", () => {
      const navigate = vi.fn();

      it("should use singular 'widget' and 'has' for single widget in dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded("dashboard-123", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[0]).toBe("1 widget added to dashboard");
        expect(toastCall[1].description).toContain("has been added");
      });

      it("should use plural 'widgets' and 'have' for multiple widgets in dashboard", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
        ];

        handleConnectionAdded("dashboard-123", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[0]).toBe("2 widgets added to dashboard");
        expect(toastCall[1].description).toContain("have been added");
      });

      it("should use singular 'widget' and 'has' for single widget outside dashboard", () => {
        const widgets = [createMockWidget()];

        handleConnectionAdded("", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1].description).toContain("has been added");
      });

      it("should use plural 'widgets' and 'have' for multiple widgets outside dashboard", () => {
        const widgets = [
          createMockWidget({ id: "widget-1" }),
          createMockWidget({ id: "widget-2" }),
        ];

        handleConnectionAdded("", widgets, navigate);

        const toastCall = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
        expect(toastCall[1].description).toContain("have been added");
      });
    });
  });
});
