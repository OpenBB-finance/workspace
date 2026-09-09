import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "~/lib/state/toast";
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

describe("Toast Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: {} });
  });

  describe("showNotification", () => {
    it("shows a warning notification by default", () => {
      showNotification({
        message: "Test message",
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          id: "Test message",
          style: { pointerEvents: "auto", paddingBottom: "16px" },
        }),
      );
    });

    it("shows notification with custom id", () => {
      showNotification({
        id: "custom-id",
        message: "Test message",
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          id: "custom-id",
        }),
      );
    });

    it("shows notification with description", () => {
      showNotification({
        message: "Test message",
        description: "Test description",
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          description: expect.anything(),
        }),
      );
    });

    it("shows error notification when toastType is error", () => {
      showNotification({
        message: "Error message",
        toastType: "error",
      });

      expect(toast.error).toHaveBeenCalled();
    });

    it("shows success notification when toastType is success", () => {
      showNotification({
        message: "Success message",
        toastType: "success",
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it("shows info notification when toastType is info", () => {
      showNotification({
        message: "Info message",
        toastType: "info",
      });

      expect(toast.info).toHaveBeenCalled();
    });

    it("includes action button when action prop is provided", () => {
      const actionHandler = vi.fn();

      showNotification({
        message: "Test message",
        action: {
          label: "Action",
          onClick: actionHandler,
        },
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Action",
          }),
        }),
      );
    });

    it("includes cancel button when withClose is true", () => {
      showNotification({
        message: "Test message",
        withClose: true,
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Close",
          }),
        }),
      );
    });

    it("includes custom cancel button when cancel prop is provided", () => {
      const cancelHandler = vi.fn();

      showNotification({
        message: "Test message",
        cancel: {
          label: "Dismiss",
          onClick: cancelHandler,
        },
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Test message",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Dismiss",
          }),
        }),
      );
    });
  });

  describe("showNotificationWithRememberMe", () => {
    it("shows notification with remember me checkbox", () => {
      showNotificationWithRememberMe({
        id: NotificationId.SaveDashboards,
        message: "Save changes?",
        action: {
          label: "Confirm",
          onClick: vi.fn(),
        },
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Save changes?",
        expect.objectContaining({
          id: NotificationId.SaveDashboards,
          action: expect.objectContaining({
            label: "Confirm",
          }),
        }),
      );
    });

    it("uses custom remember option label", () => {
      showNotificationWithRememberMe({
        id: NotificationId.DeleteDashboard,
        message: "Delete?",
        rememberOptionLabel: "Never ask again",
      });

      expect(toast.warning).toHaveBeenCalled();
    });

    it("does not show notification if dontShowAgain is set", () => {
      const actionHandler = vi.fn();
      useToastStore.setState({
        toasts: {
          [NotificationId.WidgetMoved]: { dontShowAgain: true },
        },
      });

      showNotificationWithRememberMe({
        id: NotificationId.WidgetMoved,
        message: "Widget moved",
        action: {
          label: "Confirm",
          onClick: actionHandler,
        },
      });

      expect(toast.warning).not.toHaveBeenCalled();
      expect(actionHandler).toHaveBeenCalledWith(true);
    });

    it("shows notification with error type", () => {
      showNotificationWithRememberMe({
        id: NotificationId.AccountRemoved,
        message: "Account removed",
        toastType: "error",
      });

      expect(toast.error).toHaveBeenCalled();
    });

    it("includes cancel button when provided", () => {
      const cancelHandler = vi.fn();

      showNotificationWithRememberMe({
        id: NotificationId.FolderCreated,
        message: "Folder created",
        cancel: {
          label: "Undo",
          onClick: cancelHandler,
        },
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Folder created",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Undo",
          }),
        }),
      );
    });

    it("handles dynamic notification ids with suffix", () => {
      showNotificationWithRememberMe({
        id: `${NotificationId.DeleteWidget}:widget-123`,
        message: "Delete widget?",
      });

      expect(toast.warning).toHaveBeenCalledWith(
        "Delete widget?",
        expect.objectContaining({
          id: `${NotificationId.DeleteWidget}:widget-123`,
        }),
      );
    });
  });

  describe("NotificationId Enum", () => {
    it("contains expected notification IDs", () => {
      expect(NotificationId.SaveDashboards).toBe("save-dashboards");
      expect(NotificationId.DeleteDashboard).toBe("delete-dashboard");
      expect(NotificationId.WidgetMoved).toBe("widget-moved");
      expect(NotificationId.AccountRemoved).toBe("account-removed");
      expect(NotificationId.FolderCreated).toBe("folder-created");
      expect(NotificationId.DashboardRenamed).toBe("dashboard-renamed");
    });
  });
});

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: {} });
  });

  describe("getToastDontShowAgain", () => {
    it("returns undefined when toast preference is not set", () => {
      const { result } = renderHook(() => useToastStore());

      const dontShowAgain = result.current.getToastDontShowAgain(
        NotificationId.SaveDashboards,
      );

      expect(dontShowAgain).toBeUndefined();
    });

    it("returns true when toast preference is set to dontShowAgain", () => {
      useToastStore.setState({
        toasts: {
          [NotificationId.DeleteDashboard]: { dontShowAgain: true },
        },
      });

      const { result } = renderHook(() => useToastStore());

      const dontShowAgain = result.current.getToastDontShowAgain(
        NotificationId.DeleteDashboard,
      );

      expect(dontShowAgain).toBe(true);
    });

    it("returns false when toast preference is set to show again", () => {
      useToastStore.setState({
        toasts: {
          [NotificationId.WidgetMoved]: { dontShowAgain: false },
        },
      });

      const { result } = renderHook(() => useToastStore());

      const dontShowAgain = result.current.getToastDontShowAgain(
        NotificationId.WidgetMoved,
      );

      expect(dontShowAgain).toBe(false);
    });
  });

  describe("setToastDontShowAgain", () => {
    it("sets toast preference to dontShowAgain", () => {
      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.setToastDontShowAgain(NotificationId.FolderCreated, true);
      });

      expect(result.current.toasts[NotificationId.FolderCreated]).toEqual({
        dontShowAgain: true,
      });
    });

    it("sets toast preference to show again", () => {
      useToastStore.setState({
        toasts: {
          [NotificationId.AccountRemoved]: { dontShowAgain: true },
        },
      });

      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.setToastDontShowAgain(NotificationId.AccountRemoved, false);
      });

      expect(result.current.toasts[NotificationId.AccountRemoved]).toEqual({
        dontShowAgain: false,
      });
    });

    it("preserves other toast preferences when setting a new one", () => {
      useToastStore.setState({
        toasts: {
          [NotificationId.SaveDashboards]: { dontShowAgain: true },
        },
      });

      const { result } = renderHook(() => useToastStore());

      act(() => {
        result.current.setToastDontShowAgain(NotificationId.DeleteDashboard, true);
      });

      expect(result.current.toasts[NotificationId.SaveDashboards]).toEqual({
        dontShowAgain: true,
      });
      expect(result.current.toasts[NotificationId.DeleteDashboard]).toEqual({
        dontShowAgain: true,
      });
    });
  });

  describe("Store persistence", () => {
    it("has correct persistence name", () => {
      expect(useToastStore.persist?.getOptions?.()?.name).toBe("toast-storage");
    });
  });
});
