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

// Mock DOM for ID lookup
vi.spyOn(document, "getElementById").mockReturnValue({
  getAttribute: vi.fn(() => "checked"),
} as any);

describe("toast utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("showNotification", () => {
    it("should call toast function with correct parameters", () => {
      showNotification({
        message: "Test Message",
        toastType: "success",
      });

      expect(toast.success).toHaveBeenCalledWith("Test Message", expect.any(Object));
    });

    it("should default to warning if toastType is invalid", () => {
      // @ts-ignore
      showNotification({ message: "Test Warning", toastType: "invalid" });
      expect(toast.warning).toHaveBeenCalledWith("Test Warning", expect.any(Object));
    });
  });

  describe("showNotificationWithRememberMe", () => {
    it("should call action immediately if rememberMe is true", () => {
      const onClick = vi.fn();
      getToastDontShowAgainMock.mockReturnValue(true);

      showNotificationWithRememberMe({
        id: NotificationId.SaveDashboards,
        message: "Test",
        action: { label: "Confirm", onClick },
      });

      expect(onClick).toHaveBeenCalledWith(true);
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it("should show toast if rememberMe is false", () => {
      getToastDontShowAgainMock.mockReturnValue(false);

      showNotificationWithRememberMe({
        id: NotificationId.SaveDashboards,
        message: "Test",
        toastType: "info",
      });

      expect(toast.info).toHaveBeenCalled();
    });
  });
});
