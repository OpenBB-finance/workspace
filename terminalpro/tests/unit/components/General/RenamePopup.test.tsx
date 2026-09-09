import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import RenamePopup from "~/components/General/RenamePopup";
import { useAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useThemeStore } from "~/lib/state/theme";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: vi.fn(),
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: vi.fn(),
  useShallowThemeStore: vi.fn(),
}));

describe("RenamePopup Component", () => {
  const mockUpdateItemName = vi.fn();
  const mockSetRenamePopup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useThemeStore).mockReturnValue({
      renamePopup: true,
      setRenamePopup: mockSetRenamePopup,
      defaultRename: "Default Name",
      tabEditingId: "tab1",
      editingType: "folder",
    });

    vi.mocked(useAppStore).mockReturnValue({
      updateItemName: mockUpdateItemName,
      getAllFoldersFlat: () => [],
    });

    vi.mocked(useShallowAuthStore).mockReturnValue({
      user: { token: "test-token" },
    });

    vi.mocked(useShallowThemeStore).mockReturnValue({
      aiEnhancements: true,
    });
  });

  it("renders with default props", () => {
    render(<RenamePopup />);

    expect(screen.getByText("Rename folder")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Default Name")).toBeInTheDocument();
  });

  it("handles submit with valid name", async () => {
    render(<RenamePopup />);

    const input = screen.getByDisplayValue("Default Name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    userEvent.click(screen.getByText("Rename"));

    await waitFor(() => {
      expect(mockUpdateItemName).toHaveBeenCalledWith("tab1", "New Name");
      expect(mockSetRenamePopup).toHaveBeenCalledWith(false, "", "", "folder");
    });
  });

  it("shows error toast with invalid folder name", async () => {
    const mockToastError = vi.fn();
    vi.mocked(toast).error = mockToastError;

    render(<RenamePopup />);

    await userEvent.type(
      screen.getByDisplayValue("Default Name"),
      "Invalid/Name)()(--%@%@#%^!%(*%",
    );
    userEvent.click(screen.getByText("Rename"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Invalid folder name", {
        description: "Please enter a valid folder name",
      });
    });
  });

  it("shows error toast with duplicate folder name", async () => {
    const mockToastError = vi.fn();
    vi.mocked(toast).error = mockToastError;

    vi.mocked(useAppStore).mockReturnValue({
      updateItemName: mockUpdateItemName,
      getAllFoldersFlat: () => [{ data: { name: "Duplicate Name" } }],
    });

    render(<RenamePopup />);

    const input = screen.getByDisplayValue("Default Name");
    await userEvent.clear(input);
    await userEvent.type(input, "Duplicate Name");
    userEvent.click(screen.getByText("Rename"));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Folder already exists", {
        description: "Please enter a different folder name",
      });
    });
  });
});
