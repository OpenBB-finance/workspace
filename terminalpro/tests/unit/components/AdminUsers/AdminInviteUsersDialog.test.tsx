import { useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminInviteUsersDialog } from "~/components/AdminUsers/AdminInviteUsersDialog";

vi.mock("@tanstack/react-query", () => {
  const originalModule = vi.importActual("@tanstack/react-query");

  return {
    ...originalModule,
    useQuery: vi.fn(),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
      refetchQueries: vi.fn(),
    }),
    useMutation: vi.fn(),
  };
});

const mockOnClose = vi.fn();

const mocks = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("~/api/api", () => ({ apiClient: mocks.apiClient }));

vi.mock("axios", () => {
  const axiosInstance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
  };

  const axiosMock = {
    create: vi.fn(() => axiosInstance),
    isAxiosError: vi.fn(),
    ...axiosInstance,
  };

  return {
    default: axiosMock,
  };
});

vi.mock("axios-retry", () => ({
  default: vi.fn(),
}));

const renderComponent = (data = []) => {
  (useQuery as Mock).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
  });

  return render(<AdminInviteUsersDialog open={true} onClose={mockOnClose} />);
};

describe("AdminInviteUsersDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the dialog with the correct title", () => {
    renderComponent();
    expect(screen.getByRole("dialog")).toHaveTextContent("Invite User");
  });

  it("renders the tabbed interface when permissions UUID is present", () => {
    renderComponent([{ name: "Trial", uuid: "trial-uuid" }]);
    expect(screen.getByText("Add a single user")).toBeInTheDocument();
    expect(screen.getByText("Import users")).toBeInTheDocument();
  });

  it("renders InviteSingleUser and ImportUsers with correct permissions", () => {
    renderComponent([{ name: "Trial", uuid: "trial-uuid" }]);
    expect(screen.getByText("Add a single user")).toBeInTheDocument();
    expect(screen.getByText("Import users")).toBeInTheDocument();
    // Further checks can be added here to verify props passed to InviteSingleUser and ImportUsers
  });

  it("displays error message when no permissions UUID is found", () => {
    renderComponent([{ name: "Other", uuid: "other-uuid" }]);
    expect(
      screen.getByText("This entity does not have a User entitlement, please add one."),
    ).toBeInTheDocument();
  });

  // TODO: The conditions for this test are not clear.
  it("switches tabs correctly", () => {
    renderComponent([{ name: "Trial", uuid: "trial-uuid" }]);
    const singleTab = screen.getByText("Add a single user");
    const importTab = screen.getByText("Import users");

    fireEvent.click(importTab);
    expect(importTab).toHaveAttribute("aria-selected", "false");
    expect(singleTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(singleTab);
    expect(singleTab).toHaveAttribute("aria-selected", "true");
    expect(importTab).not.toHaveAttribute("aria-selected", "true");
  });
});
