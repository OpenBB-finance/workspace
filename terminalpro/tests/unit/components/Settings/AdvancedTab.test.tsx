import * as TabsPrimitive from "@radix-ui/react-tabs";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdvancedTab from "~/components/Settings/AdvancedTab";

const { mockDeleteMe, mockDeleteAllDashboards, mockLogout, mockToastError } =
  vi.hoisted(() => ({
    mockDeleteMe: vi.fn(),
    mockDeleteAllDashboards: vi.fn(),
    mockLogout: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("~/api/admin.api", () => ({ deleteMe: mockDeleteMe }));

vi.mock("~/api/dashboard.api", () => ({
  deleteAllDashboards: mockDeleteAllDashboards,
}));

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: () => ({
    logout: mockLogout,
    user: { id: "user-1", email: "user@example.com" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

vi.mock("~/components/AdminUsers/AdminDeleteUserDialog", () => ({
  default: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" data-testid="confirm-delete-account" onClick={onConfirm}>
        Confirm delete
      </button>
    ) : null,
}));

const renderComponent = () =>
  render(
    <TabsPrimitive.Root value="advanced">
      <AdvancedTab />
    </TabsPrimitive.Root>,
  );

describe("AdvancedTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Delete Account", () => {
    it("logs out after the account is deleted successfully", async () => {
      const user = userEvent.setup();
      mockDeleteMe.mockResolvedValue(undefined);
      renderComponent();

      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      await user.click(screen.getByTestId("confirm-delete-account"));

      await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("shows an error toast and does not log out when account deletion fails", async () => {
      const user = userEvent.setup();
      mockDeleteMe.mockRejectedValue(new Error("network error"));
      renderComponent();

      await user.click(screen.getByRole("button", { name: "Delete Account" }));
      await user.click(screen.getByTestId("confirm-delete-account"));

      await waitFor(() => expect(mockToastError).toHaveBeenCalled());
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  describe("Clear All Dashboards", () => {
    it("logs out after dashboards are cleared successfully", async () => {
      const user = userEvent.setup();
      mockDeleteAllDashboards.mockResolvedValue(undefined);
      renderComponent();

      await user.click(screen.getByRole("button", { name: "Clear All Dashboards" }));

      await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
      expect(mockToastError).not.toHaveBeenCalled();
    });

    it("shows an error toast and does not log out when clearing dashboards fails", async () => {
      const user = userEvent.setup();
      mockDeleteAllDashboards.mockRejectedValue(new Error("network error"));
      renderComponent();

      await user.click(screen.getByRole("button", { name: "Clear All Dashboards" }));

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          "Failed to clear dashboards",
          expect.objectContaining({ description: expect.any(String) }),
        ),
      );
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });
});
