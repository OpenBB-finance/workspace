import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { resetUserPassword } from "~/api/admin.api";
import AdminResetUserPasswordDialog from "~/components/AdminUsers/AdminResetUserPasswordDialog";
import { showNotification } from "~/lib/utils/toast";

// Define mockNavigate at the top level
const mockNavigate = vi.fn();

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock dependencies
vi.mock("~/api/admin.api", () => ({
  resetUserPassword: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("~/lib/utils/toast", () => ({
  NotificationId: {
    AccountResetPassword: "account-reset-password",
  },
  showNotification: vi.fn(),
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe("AdminResetUserPasswordDialog", () => {
  const mockUser = {
    uuid: "123",
    email: "test@example.com",
  };

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    user: mockUser,
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog with correct user information", () => {
    render(<AdminResetUserPasswordDialog {...defaultProps} />);

    expect(
      screen.getByText(
        `Are you sure you want to reset the password for this account ${mockUser.email}?`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Yes, reset password")).toBeInTheDocument();
  });

  it("handles successful password reset", async () => {
    const temporaryPassword = "temp123";
    vi.mocked(resetUserPassword).mockResolvedValueOnce({
      success: true,
      temporary_password: temporaryPassword,
    });

    render(<AdminResetUserPasswordDialog {...defaultProps} />);

    const resetButton = screen.getByText(/Yes, reset password/i);
    fireEvent.click(resetButton);

    await waitFor(() => {
      // Check if API was called
      expect(resetUserPassword).toHaveBeenCalledWith(mockUser.uuid);

      // Check if password was copied to clipboard
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(temporaryPassword);

      // Check if notification was shown
      expect(showNotification).toHaveBeenCalledWith({
        id: "account-reset-password",
        message: "Account reset password",
        description: expect.stringContaining(
          `Password has been reset for ${defaultProps.user.email}. Temporary password was copied to your clipboard.`,
        ),
        toastType: "success",
      });

      // Check if callbacks were called
      expect(defaultProps.onConfirm).toHaveBeenCalledWith(temporaryPassword);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it("shows error toast on reset password failure", async () => {
    const error = new AxiosError("Error resetting user password");
    (resetUserPassword as Mock).mockRejectedValueOnce(error);

    render(<AdminResetUserPasswordDialog {...defaultProps} />);

    const resetButton = screen.getByText(/Yes, reset password/i);
    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Error resetting user password", {
        description: "Error resetting user password",
      });
    });
  });

  it("closes dialog when cancel is clicked", () => {
    render(<AdminResetUserPasswordDialog {...defaultProps} />);

    const cancelButton = screen.getByText(/Cancel/i);
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
