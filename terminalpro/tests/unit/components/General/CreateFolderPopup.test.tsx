import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import CreateFolderPopup from "~/components/General/CreateFolderPopup";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { validateFolderName } from "~/utils/validators";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/lib/utils/toast", () => ({
  showNotificationWithRememberMe: vi.fn(),
  NotificationId: {
    FolderCreated: "folder-created",
  },
}));

vi.mock("~/utils/validators", () => ({
  validateFolderName: vi.fn(),
}));

describe("CreateFolderPopup Component", () => {
  const mockSetCreateFolderPopup = vi.fn();
  const mockCreateFolder = vi.fn();

  beforeEach(() => {
    (useShallowThemeStore as any).mockImplementation(() => ({
      createFolderPopup: true,
      createFolderParentId: "parentId",
      setCreateFolderPopup: mockSetCreateFolderPopup,
    }));

    (useShallowAppStore as any).mockImplementation(() => ({
      createFolder: mockCreateFolder,
    }));

    (validateFolderName as any).mockImplementation(() => true);
  });

  it("renders with default props", () => {
    render(<CreateFolderPopup />);

    expect(screen.getByText("Create Folder")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter folder name")).toBeInTheDocument();
  });

  it("handles folder creation", async () => {
    render(<CreateFolderPopup />);

    await userEvent.type(
      screen.getByPlaceholderText("Enter folder name"),
      "New Folder{enter}",
    );

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalled();
      expect(mockSetCreateFolderPopup).toHaveBeenCalledWith(false);
    });
  });

  it("handles invalid folder name", async () => {
    (validateFolderName as any).mockImplementation(() => false);

    render(<CreateFolderPopup />);

    await userEvent.type(
      screen.getByPlaceholderText("Enter folder name"),
      "asdfasdf62626ghxhcvbcvx!#!)@*%!^)*!)_!()*!)$*%^_!^_&)()(_++'][[\\l;{enter}",
    );

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalled();
      expect(mockSetCreateFolderPopup).toHaveBeenCalledWith(false);
    });

    // this will actually make a toast show up, so we need to wait for that - not sure how to do that for now
  });

  it("closes the dialog when cancel button is clicked", async () => {
    render(<CreateFolderPopup />);

    await userEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(mockSetCreateFolderPopup).toHaveBeenCalledWith(false);
    });
  });
});
