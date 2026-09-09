/**
 * Tests for toast Zustand store
 *
 * Tests the toast preference state management including:
 * - "Don't show again" preferences per notification type
 * - Getting and setting toast preferences
 * - Persistence behavior
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "~/lib/state/toast";
import { NotificationId } from "~/lib/utils/toast";

describe("useToastStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useToastStore.setState({
        toasts: {},
      });
    });
  });

  describe("initial state", () => {
    it("should have empty toasts object initially", () => {
      const state = useToastStore.getState();
      expect(state.toasts).toEqual({});
    });
  });

  describe("getToastDontShowAgain", () => {
    it("should return undefined for unset notification", () => {
      const result = useToastStore
        .getState()
        .getToastDontShowAgain(NotificationId.SaveDashboards);

      expect(result).toBeUndefined();
    });

    it("should return true when notification is set to dont show again", () => {
      act(() => {
        useToastStore.setState({
          toasts: {
            [NotificationId.SaveDashboards]: { dontShowAgain: true },
          },
        });
      });

      const result = useToastStore
        .getState()
        .getToastDontShowAgain(NotificationId.SaveDashboards);

      expect(result).toBe(true);
    });

    it("should return false when notification is set to show again", () => {
      act(() => {
        useToastStore.setState({
          toasts: {
            [NotificationId.DeleteDashboard]: { dontShowAgain: false },
          },
        });
      });

      const result = useToastStore
        .getState()
        .getToastDontShowAgain(NotificationId.DeleteDashboard);

      expect(result).toBe(false);
    });
  });

  describe("setToastDontShowAgain", () => {
    it("should set dont show again to true", () => {
      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.WidgetMoved, true);
      });

      const state = useToastStore.getState();
      expect(state.toasts[NotificationId.WidgetMoved]?.dontShowAgain).toBe(true);
    });

    it("should set dont show again to false", () => {
      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.AccountRemoved, false);
      });

      const state = useToastStore.getState();
      expect(state.toasts[NotificationId.AccountRemoved]?.dontShowAgain).toBe(false);
    });

    it("should update existing preference", () => {
      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.FolderCreated, true);
      });

      expect(
        useToastStore.getState().toasts[NotificationId.FolderCreated]?.dontShowAgain,
      ).toBe(true);

      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.FolderCreated, false);
      });

      expect(
        useToastStore.getState().toasts[NotificationId.FolderCreated]?.dontShowAgain,
      ).toBe(false);
    });

    it("should preserve other toast preferences when setting one", () => {
      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.DeleteDashboard, true);
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.WidgetRemoved, true);
      });

      const state = useToastStore.getState();
      expect(state.toasts[NotificationId.DeleteDashboard]?.dontShowAgain).toBe(true);
      expect(state.toasts[NotificationId.WidgetRemoved]?.dontShowAgain).toBe(true);

      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.DeleteDashboard, false);
      });

      const newState = useToastStore.getState();
      expect(newState.toasts[NotificationId.DeleteDashboard]?.dontShowAgain).toBe(false);
      expect(newState.toasts[NotificationId.WidgetRemoved]?.dontShowAgain).toBe(true);
    });
  });

  describe("multiple notifications", () => {
    it("should handle multiple notifications independently", () => {
      const notifications = [
        NotificationId.SaveDashboards,
        NotificationId.DeleteDashboard,
        NotificationId.WidgetMoved,
        NotificationId.DashboardRenamed,
        NotificationId.FolderRenamed,
      ];

      notifications.forEach((notificationId, index) => {
        act(() => {
          useToastStore
            .getState()
            .setToastDontShowAgain(notificationId, index % 2 === 0);
        });
      });

      notifications.forEach((notificationId, index) => {
        expect(useToastStore.getState().getToastDontShowAgain(notificationId)).toBe(
          index % 2 === 0,
        );
      });
    });
  });

  describe("all NotificationId values", () => {
    it("should work with all NotificationId enum values", () => {
      const allNotificationIds = Object.values(NotificationId);

      allNotificationIds.forEach((notificationId) => {
        act(() => {
          useToastStore.getState().setToastDontShowAgain(notificationId, true);
        });
      });

      allNotificationIds.forEach((notificationId) => {
        expect(useToastStore.getState().getToastDontShowAgain(notificationId)).toBe(
          true,
        );
      });
    });
  });

  describe("edge cases", () => {
    it("should handle setting same value multiple times", () => {
      act(() => {
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.DeleteTab, true);
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.DeleteTab, true);
        useToastStore
          .getState()
          .setToastDontShowAgain(NotificationId.DeleteTab, true);
      });

      expect(
        useToastStore.getState().toasts[NotificationId.DeleteTab]?.dontShowAgain,
      ).toBe(true);
    });

    it("should handle rapid toggling", () => {
      for (let i = 0; i < 10; i++) {
        act(() => {
          useToastStore
            .getState()
            .setToastDontShowAgain(NotificationId.GroupNotEmpty, i % 2 === 0);
        });
      }

      // Last toggle was i=9, so 9 % 2 === 1, meaning false
      expect(
        useToastStore.getState().toasts[NotificationId.GroupNotEmpty]?.dontShowAgain,
      ).toBe(false);
    });
  });
});
