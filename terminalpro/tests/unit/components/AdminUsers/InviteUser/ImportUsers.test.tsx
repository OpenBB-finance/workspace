import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { inviteUser } from "~/api/admin.api";
import ImportUsers from "~/components/AdminUsers/InviteUser/ImportUsers";
import { Tabs } from "~/components/ds/molecules/Tabs";

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
  DialogClose: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("papaparse", () => ({
  default: {
    parse: vi.fn(),
  },
}));

vi.mock("~/api/admin.api", () => ({
  inviteUser: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
  }),
}));

describe("ImportUsers Component", () => {
  const mockOnClose = vi.fn();
  const permissions = "test-permissions";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles file selection and parsing correctly", async () => {
    const Papa = (await import("papaparse")).default;
    (Papa.parse as Mock).mockImplementation((file, options) => {
      if (options.complete) {
        options.complete({
          data: [
            { first_name: "John", last_name: "Doe", email: "john.doe@example.com" },
            { first_name: "Jane", last_name: "Smith", email: "jane.smith@example.com" },
          ],
          errors: [],
        });
      }
    });

    render(
      <Tabs defaultValue="import">
        <ImportUsers permissions={permissions} onClose={mockOnClose} />
      </Tabs>,
    );

    const fileInput = screen.getByTestId("upload-import-file");
    const file = new File(
      [
        "first_name,last_name,email\nJohn,Doe,john.doe@example.com\nJane,Smith,jane.smith@example.com",
      ],
      "users.csv",
      { type: "text/csv" },
    );

    // We need to use fireEvent.change for the hidden input
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/2\s*users\s*found/i)).toBeInTheDocument();
    });

    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("Jane")).toBeInTheDocument();
  });

  it("invites multiple users successfully", async () => {
    const Papa = (await import("papaparse")).default;
    (Papa.parse as Mock).mockImplementation((file, options) => {
      if (options.complete) {
        options.complete({
          data: [
            { first_name: "John", last_name: "Doe", email: "john.doe@example.com" },
          ],
          errors: [],
        });
      }
    });

    (inviteUser as Mock).mockResolvedValue({ success: true });

    render(
      <Tabs defaultValue="import">
        <ImportUsers permissions={permissions} onClose={mockOnClose} />
      </Tabs>,
    );

    const fileInput = screen.getByTestId("upload-import-file");
    const file = new File(
      ["first_name,last_name,email\nJohn,Doe,john.doe@example.com"],
      "users.csv",
      { type: "text/csv" },
    );

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/1\s*user\s*found/i)).toBeInTheDocument();
    });

    const inviteButton = screen.getByTestId("invite-users-button");
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(inviteUser).toHaveBeenCalledWith({
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        permissions_uuid: permissions,
      });
      expect(toast.success).toHaveBeenCalledWith("Users invited", expect.any(Object));
    });
  });

  it("shows error when CSV is invalid", async () => {
    // Re-mock Papa.parse for this specific test
    const Papa = (await import("papaparse")).default;
    (Papa.parse as Mock).mockImplementationOnce((file, options) => {
      if (options.complete) {
        options.complete({
          data: [],
          errors: [{ code: "TooFewFields", message: "Too few fields" }],
        });
      }
    });

    render(
      <Tabs defaultValue="import">
        <ImportUsers permissions={permissions} onClose={mockOnClose} />
      </Tabs>,
    );

    const fileInput = screen.getByTestId("upload-import-file");
    const file = new File(["invalid content"], "invalid.csv", { type: "text/csv" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(
        screen.getByText("No valid users found in the CSV file"),
      ).toBeInTheDocument();
    });
  });

  it("handles partial user invitation", async () => {
    const Papa = (await import("papaparse")).default;
    (Papa.parse as Mock).mockImplementationOnce((file, options) => {
      if (options.complete) {
        options.complete({
          data: [
            { first_name: "John", last_name: "Doe", email: "john.doe@example.com" },
            { first_name: "Jane", last_name: "Smith", email: "jane@example.com" },
          ],
          errors: [],
        });
      }
    });

    (inviteUser as Mock)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false });

    render(
      <Tabs defaultValue="import">
        <ImportUsers permissions={permissions} onClose={mockOnClose} />
      </Tabs>,
    );

    const fileInput = screen.getByTestId("upload-import-file");
    const file = new File(["any"], "users.csv", { type: "text/csv" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/2\s*users\s*found/i)).toBeInTheDocument();
    });

    const inviteButton = screen.getByTestId("invite-users-button");
    fireEvent.click(inviteButton);

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "Users partially invited",
        expect.any(Object),
      );
    });
  });
});
