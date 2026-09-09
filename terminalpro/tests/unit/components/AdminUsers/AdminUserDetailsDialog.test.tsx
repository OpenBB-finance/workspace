// import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserDetailsDialog from "~/components/AdminUsers/AdminUserDetailsDialog";
import { useAuthStore } from "~/lib/state/auth";

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

vi.mock("~/lib/utils", async () => {
  const original = await vi.importActual("~/lib/utils");
  return {
    ...original,
    getWidgetsWithSupportedAssetClass: vi.fn(() => []),
  };
});

const mockAuthState = {
  user: { token: "test-token" },
  logout: vi.fn(),
};

vi.mock("~/lib/state/auth", () => ({
  useAuthStore: vi.fn(() => ({
    getState: () => mockAuthState,
  })),
  useShallowAuthStore: vi.fn(() => ({
    user: { role: "User" },
    showChangelog: false,
    updateShowChangelog: vi.fn(),
    tosAccepted: true,
  })),
}));

vi.mock("@tanstack/react-query", async () => {
  const original = await vi.importActual("@tanstack/react-query");
  return {
    ...original,
    useMutation: vi.fn().mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
    }),
    useQueryClient: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("dayjs", () => {
  const mockInstance = {
    locale: vi.fn().mockReturnThis(),
    format: vi.fn().mockReturnValue("Oct 1, 2023 12:00 PM"),
    utc: vi.fn().mockReturnThis(),
    tz: vi.fn().mockReturnThis(),
    add: vi.fn().mockReturnThis(),
    subtract: vi.fn().mockReturnThis(),
    businessDaysAdd: vi.fn().mockReturnThis(),
    businessDaysSubtract: vi.fn().mockReturnThis(),
  };

  const mockDayjs: any = vi.fn(() => mockInstance);
  mockDayjs.extend = vi.fn();
  mockDayjs.utc = vi.fn(() => mockInstance);
  mockDayjs.tz = vi.fn(() => mockInstance);

  return {
    default: mockDayjs,
  };
});

describe("AdminUserDetailsDialog", () => {
  const mockUser = {
    uuid: "123",
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    status: "active",
    permissions_uuid: "22222222-2222-2222-2222-222222222222",
    billing_active: true,
    pro_entitlements: {},
    last_login: "2023-10-01T12:00:00Z",
    renewed: false,
  };

  const mockLoggedInUser = {
    email: "admin@example.com",
  };
  const queryClient = new QueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as unknown as Mock).mockReturnValue({
      user: mockLoggedInUser,
    });
    (useQueryClient as unknown as Mock).mockReturnValue({
      invalidateQueries: vi.fn(),
    });
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it("renders user details correctly", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);

    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("correctly converts user status", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);
    expect(screen.getByTestId("user-status")).toHaveTextContent("verified");
  });

  it("correctly converts last login date", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);
    expect(screen.getByTestId("last-login")).toHaveTextContent("Oct 1, 2023 12:00 PM");
  });

  // TODO: Fix toast mock for it to be testable
  it("updates user details successfully", async () => {
    const mockAsync = vi.fn().mockResolvedValue({});
    (useMutation as Mock).mockReturnValue({ mutateAsync: mockAsync });
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockAsync).toHaveBeenCalledWith({
        permissions_uuid: mockUser.permissions_uuid,
        billing_active: mockUser.billing_active,
        pro_entitlements: mockUser.pro_entitlements,
      });
      // expect(toast.success).toHaveBeenCalledWith("User updated successfully!", {
      //   description: `User ${mockUser.email} has been updated`,
      // });
    });
  });

  //
  it("extends trial user successfully", async () => {
    const mockExtend = vi.fn().mockResolvedValue({});
    (useMutation as Mock).mockReturnValue({ mutateAsync: mockExtend });

    const trialUser = {
      ...mockUser,
      permissions_uuid: "11111111-1111-1111-1111-111111111111",
    };

    renderWithQueryClient(
      // @ts-expect-error - User type is not complete for the sake of testing
      <AdminUserDetailsDialog user={trialUser} onClose={vi.fn()} />,
    );

    fireEvent.click(screen.getByText("Extend Account"));

    await waitFor(() => {
      expect(mockExtend).toHaveBeenCalled();
      // expect(toast.success).toHaveBeenCalledWith("User extended successfully!");
    });
  });

  it("opens and closes delete user dialog", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("delete-account-button"));
    expect(screen.getByTestId("delete-user-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByTestId("delete-user-dialog")).not.toBeInTheDocument();
  });

  it("opens and closes reset password dialog", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("reset-password-button"));
    expect(screen.getByTestId("reset-password-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByTestId("reset-password-dialog")).not.toBeInTheDocument();
  });

  it("opens and closes remove user from organization dialog", () => {
    // @ts-expect-error - User type is not complete for the sake of testing
    renderWithQueryClient(<AdminUserDetailsDialog user={mockUser} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("remove-account-button"));
    expect(screen.getByTestId("remove-user-dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByTestId("remove-user-dialog")).not.toBeInTheDocument();
  });
});
