import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotificationId,
  showNotification,
  showNotificationWithRememberMe,
} from "~/lib/utils/toast";

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const getToastDontShowAgainMock = vi.fn(() => false);
const setToastDontShowAgainMock = vi.fn();
vi.mock("~/lib/state/toast", () => ({
  useToastStore: {
    getState: vi.fn(() => ({
      getToastDontShowAgain: getToastDontShowAgainMock,
      setToastDontShowAgain: setToastDontShowAgainMock,
    })),
  },
}));

describe("toast utils - Additional Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getToastDontShowAgainMock.mockReturnValue(false);
  });

  describe("showNotification", () => {
    it("uses message as id when id is not provided", () => {
      showNotification({
        message: "Test Message",
        toastType: "success",
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Test Message",
        expect.objectContaining({
          id: "Test Message",
        }),
      );
    });

    it("uses provided id over message", () => {
      showNotification({
        id: "custom-id",
        message: "Test Message",
        toastType: "success",
      });

      expect(toast.success).toHaveBeenCalledWith(
        "Test Message",
        expect.objectContaining({
          id: "custom-id",
        }),
      );
    });

    it("adds close button when withClose is true", () => {
      showNotification({
        message: "Test",
        withClose: true,
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Close",
          }),
        }),
      );
    });

    it("respects provided cancel over withClose", () => {
      const cancelFn = vi.fn();
      showNotification({
        message: "Test",
        withClose: true,
        cancel: { label: "Custom Cancel", onClick: cancelFn },
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Custom Cancel",
          }),
        }),
      );
    });

    it("passes action to toast", () => {
      const actionFn = vi.fn();
      showNotification({
        message: "Test",
        toastType: "info",
        action: { label: "Confirm", onClick: actionFn },
      });

      expect(toast.info).toHaveBeenCalledWith(
        "Test",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Confirm",
          }),
        }),
      );
    });

    it("handles error toast type", () => {
      showNotification({
        message: "Error occurred",
        toastType: "error",
      });

      expect(toast.error).toHaveBeenCalledWith("Error occurred", expect.any(Object));
    });
  });

  describe("showNotificationWithRememberMe", () => {
    it("uses custom rememberOptionLabel", () => {
      getToastDontShowAgainMock.mockReturnValue(false);

      showNotificationWithRememberMe({
        id: NotificationId.WidgetRemoved,
        message: "Widget removed",
        rememberOptionLabel: "Never show again",
      });

      expect(toast.warning).toHaveBeenCalled();
    });

    it("handles cancel callback with remember me", () => {
      getToastDontShowAgainMock.mockReturnValue(false);
      const cancelFn = vi.fn();

      // Mock getElementById
      vi.spyOn(document, "getElementById").mockReturnValue({
        getAttribute: vi.fn(() => "checked"),
      } as any);

      showNotificationWithRememberMe({
        id: NotificationId.DeleteDashboard,
        message: "Delete dashboard?",
        cancel: { label: "Cancel", onClick: cancelFn },
        toastType: "warning",
      });

      expect(toast.warning).toHaveBeenCalled();
    });

    it("uses correct toast type from props", () => {
      getToastDontShowAgainMock.mockReturnValue(false);

      showNotificationWithRememberMe({
        id: NotificationId.WidgetMoved,
        message: "Widget moved",
        toastType: "success",
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it("handles dynamic notification id with colon separator", () => {
      const onClick = vi.fn();
      getToastDontShowAgainMock.mockReturnValue(true);

      showNotificationWithRememberMe({
        id: `${NotificationId.DeleteWidget}:widget-123`,
        message: "Delete widget?",
        action: { label: "Delete", onClick },
      });

      // Should call action immediately since dontShowAgain is true
      expect(onClick).toHaveBeenCalledWith(true);
      expect(toast.warning).not.toHaveBeenCalled();
    });
  });

  describe("NotificationId enum", () => {
    it("has all expected notification ids", () => {
      expect(NotificationId.SaveDashboards).toBe("save-dashboards");
      expect(NotificationId.DeleteDashboard).toBe("delete-dashboard");
      expect(NotificationId.WidgetRemoved).toBe("widget-removed");
      expect(NotificationId.FolderCreated).toBe("folder-created");
      expect(NotificationId.DashboardDuplicated).toBe("dashboard-duplicated");
    });
  });
});
