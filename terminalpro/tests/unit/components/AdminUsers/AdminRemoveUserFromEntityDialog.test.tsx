import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUser } from "~/api/admin.api";
import AdminRemoveUserFromEntityDialog from "~/components/AdminUsers/AdminRemoveUserFromEntityDialog";
import { NotificationId, showNotification } from "~/lib/utils/toast";

vi.mock("~/api/admin.api", () => ({
  deleteUser: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("~/lib/utils/toast", () => ({
  showNotification: vi.fn(),
  NotificationId: {
    AccountRemoved: "account-removed",
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("AdminRemoveUserFromEntityDialog", () => {
  const user = { uuid: "123", email: "test@example.com", source: "source" };
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog with the correct user email", () => {
    render(
      <AdminRemoveUserFromEntityDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        // @ts-expect-error - user is not typed for the sake of the test
        user={user}
      />,
    );

    expect(
      screen.getByText(`Are you sure you want to remove this account ${user.email}?`),
    ).toBeInTheDocument();
  });

  it("calls deleteUser and shows success notification on successful deletion", async () => {
    (deleteUser as Mock).mockResolvedValueOnce(undefined);

    render(
      <AdminRemoveUserFromEntityDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        // @ts-expect-error - user is not typed for the sake of the test
        user={user}
      />,
    );

    fireEvent.click(screen.getByText("Yes, remove account"));

    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith(user.uuid, user.source, true);
      expect(onConfirm).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(showNotification).toHaveBeenCalledWith({
        id: NotificationId.AccountRemoved,
        message: "Account removed",
        description: `Account ${user.email} has been removed`,
        toastType: "success",
      });
    });
  });

  it("shows error toast on deletion failure", async () => {
    const error = new AxiosError("Error removing account");
    (deleteUser as Mock).mockRejectedValueOnce(error);

    render(
      <AdminRemoveUserFromEntityDialog
        open={true}
        onClose={onClose}
        onConfirm={onConfirm}
        // @ts-expect-error - user is not typed for the sake of the test
        user={user}
      />,
    );

    fireEvent.click(screen.getByText("Yes, remove account"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error removing account", {
        description: "Error removing account",
      });
    });
  });
});
