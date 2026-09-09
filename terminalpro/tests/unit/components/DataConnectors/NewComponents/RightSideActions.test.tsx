import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mockSetOpen = vi.fn();
const mockRemoveWidget = vi.fn();
const mockGetWidgetsByAttribute = vi.fn(() => ({}));
const mockSetDatabases = vi.fn();
const mockUpdateApiSource = vi.fn();
const mockHandleWidgetDeletion = vi.fn();
const mockUpdateWidgetEndpoints = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockGetStoredFileBlob = vi.fn();

vi.mock("~/api/auth.api", () => ({
  getStoredFileBlob: (...args: unknown[]) => mockGetStoredFileBlob(...args),
}));

vi.mock("~/components/DataConnectors/Providers/DataConnectorContext", () => ({
  useDataConnectorContext: () => ({ setOpen: mockSetOpen }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: () => ({
    removeWidget: mockRemoveWidget,
    getWidgetsByAttribute: mockGetWidgetsByAttribute,
  }),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: () => ({
    getApiSourceById: (id: string) =>
      id === "backend-1"
        ? { id: "backend-1", name: "My Backend", url: "http://localhost:8000" }
        : null,
    updateApiSource: mockUpdateApiSource,
  }),
}));

vi.mock("~/lib/utils", () => ({
  handleWidgetDeletion: (...args: unknown[]) => mockHandleWidgetDeletion(...args),
}));

vi.mock("~/components/DataConnectors/common/helpers", () => ({
  updateWidgetEndpoints: (...args: unknown[]) => mockUpdateWidgetEndpoints(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("~/components/DataConnectors/NewComponents/ConfirmDeleteBackendDialog", () => ({
  default: ({
    open,
    onClose,
    name,
    onConfirm,
  }: {
    open: boolean;
    onClose: () => void;
    name: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="delete-backend-dialog">
        <span>{name}</span>
        <button data-testid="backend-confirm-delete" onClick={onConfirm}>
          Delete
        </button>
        <button data-testid="backend-cancel-delete" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

import { RightSideActions } from "~/components/DataConnectors/NewComponents/RightSideActions";

/** Helper to click a button that wraps a specific icon. */
function clickIconButton(iconTestId: string) {
  const icon = screen.getByTestId(iconTestId);
  const button = icon.closest("button");
  if (!button) throw new Error(`No button found wrapping icon ${iconTestId}`);
  return userEvent.setup().click(button);
}

describe("RightSideActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleWidgetDeletion.mockResolvedValue(undefined);
  });

  describe("button visibility", () => {
    it("renders delete button for all types", () => {
      render(<RightSideActions id="test-id" type="single" />);

      expect(screen.getByTestId("icon-trash-04")).toBeInTheDocument();
    });

    it("does not render add widget button for non-connection types", () => {
      render(<RightSideActions id="test-id" type="single" />);

      expect(screen.queryByTestId("icon-plus-icon")).not.toBeInTheDocument();
    });

    it("renders edit button for editable types", () => {
      render(<RightSideActions id="test-id" type="single" />);

      expect(screen.getByTestId("icon-pencil-02")).toBeInTheDocument();
    });

    it("does not render edit button for types with showEdit=false", () => {
      render(<RightSideActions id="test-id" type="widget_studio" />);

      expect(screen.queryByTestId("icon-pencil-02")).not.toBeInTheDocument();
    });

    it("renders refresh button for backend type", () => {
      render(<RightSideActions id="backend-1" type="backend" />);

      expect(screen.getByTestId("icon-refresh-right")).toBeInTheDocument();
    });

    it("does not render refresh button for non-backend types", () => {
      render(<RightSideActions id="test-id" type="single" />);

      expect(screen.queryByTestId("icon-refresh-right")).not.toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("disables all buttons when disabled prop is true", () => {
      render(<RightSideActions id="backend-1" type="backend" disabled={true} />);

      const buttons = screen.getAllByRole("button");
      for (const button of buttons) {
        expect(button).toBeDisabled();
      }
    });
  });

  describe("data-testid", () => {
    it("sets delete data-testid when name is provided", () => {
      render(<RightSideActions id="test-id" type="single" name="my-widget" />);

      expect(screen.getByTestId("delete-my-widget")).toBeInTheDocument();
    });

    it("does not set delete data-testid when name is not provided", () => {
      render(<RightSideActions id="test-id" type="single" />);

      expect(screen.queryByTestId("delete-undefined")).not.toBeInTheDocument();
    });
  });

  describe("download action", () => {
    it("renders download button only for file type", () => {
      const { unmount } = render(<RightSideActions id="file-1" type="file" />);
      expect(screen.getByTestId("icon-download")).toBeInTheDocument();
      unmount();

      render(<RightSideActions id="test-id" type="single" />);
      expect(screen.queryByTestId("icon-download")).not.toBeInTheDocument();
    });

    const FILE_URL = "https://api.example.com/pro/files/0221d26e-0b5c.csv";

    it("fetches the file blob and saves it under the original file name", async () => {
      const blob = new Blob(["a,b,c"], { type: "text/csv" });
      mockGetStoredFileBlob.mockResolvedValue(blob);
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => "blob:fake"),
        revokeObjectURL: vi.fn(),
      });
      const click = vi.fn();
      const anchor = {
        href: "",
        download: "",
        click,
        remove: vi.fn(),
      } as unknown as HTMLAnchorElement;

      render(
        <RightSideActions
          id="file-1"
          type="file"
          name="PGA Field Performance Trends"
          fileUrl={FILE_URL}
          originalFileName="pga_field_trending_table.csv"
        />,
      );

      // Only intercept anchor creation; delegate everything else to jsdom.
      const realCreateElement = document.createElement.bind(document);
      const createElement = vi
        .spyOn(document, "createElement")
        .mockImplementation((tag: string) =>
          tag === "a" ? anchor : realCreateElement(tag),
        );

      try {
        await clickIconButton("icon-download");
      } finally {
        createElement.mockRestore();
        vi.unstubAllGlobals();
      }

      // Fetched from the authed API endpoint, not the S3 presigned URL.
      expect(mockGetStoredFileBlob).toHaveBeenCalledWith(FILE_URL);
      expect(anchor.href).toBe("blob:fake");
      // Saved under the original upload name, not the uuid S3 key.
      expect(anchor.download).toBe("pga_field_trending_table.csv");
      expect(click).toHaveBeenCalledOnce();
    });

    it("shows an error toast when there is no file URL", async () => {
      render(<RightSideActions id="file-1" type="file" />);
      await clickIconButton("icon-download");

      expect(mockGetStoredFileBlob).not.toHaveBeenCalled();
      expect(mockToastError).toHaveBeenCalledWith("Failed to download file");
    });

    it("shows an error toast when the download request fails", async () => {
      mockGetStoredFileBlob.mockRejectedValue(new Error("network"));

      render(<RightSideActions id="file-1" type="file" fileUrl={FILE_URL} />);
      await clickIconButton("icon-download");

      expect(mockToastError).toHaveBeenCalledWith("Failed to download file");
    });
  });

  describe("edit action", () => {
    it("calls setOpen with edit mode when edit button is clicked", async () => {
      render(<RightSideActions id="test-id" type="single" />);

      await clickIconButton("icon-pencil-02");

      expect(mockSetOpen).toHaveBeenCalledWith(true, {
        mode: "edit",
        dcTab: "single",
        id: "test-id",
      });
    });

    it("maps websites type to website dcTab", async () => {
      render(<RightSideActions id="test-id" type="others" parentType="websites" />);

      await clickIconButton("icon-pencil-02");

      expect(mockSetOpen).toHaveBeenCalledWith(true, {
        mode: "edit",
        dcTab: "website",
        id: "test-id",
      });
    });

    it("maps rss_feeds type to rss dcTab", async () => {
      render(<RightSideActions id="test-id" type="others" parentType="rss_feeds" />);

      await clickIconButton("icon-pencil-02");

      expect(mockSetOpen).toHaveBeenCalledWith(true, {
        mode: "edit",
        dcTab: "rss",
        id: "test-id",
      });
    });
  });

  describe("delete action", () => {
    it("opens confirm dialog for non-backend types", async () => {
      render(<RightSideActions id="test-id" type="single" />);

      await clickIconButton("icon-trash-04");

      expect(screen.getByText("Delete Widget")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete this widget/),
      ).toBeInTheDocument();
    });

    it("opens backend-specific dialog for backend type", async () => {
      render(<RightSideActions id="backend-1" type="backend" />);

      await clickIconButton("icon-trash-04");

      expect(screen.getByTestId("delete-backend-dialog")).toBeInTheDocument();
      expect(screen.getByText("My Backend")).toBeInTheDocument();
    });

    it("opens backend-specific dialog for others with backend parentType", async () => {
      render(<RightSideActions id="test-id" type="others" parentType="backend" />);

      await clickIconButton("icon-trash-04");

      expect(screen.getByTestId("delete-backend-dialog")).toBeInTheDocument();
    });

    it("calls handleWidgetDeletion on confirm and shows success toast", async () => {
      render(<RightSideActions id="test-id" type="single" />);

      await clickIconButton("icon-trash-04");
      await userEvent.setup().click(screen.getByText("Yes, Delete"));

      expect(mockHandleWidgetDeletion).toHaveBeenCalledWith(
        expect.objectContaining({ type: "single", id: "test-id" }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("calls handleWidgetDeletion for ag_chart_from_table and shows success toast", async () => {
      render(<RightSideActions id="test-id" type="ag_chart_from_table" />);

      await clickIconButton("icon-trash-04");
      await userEvent.setup().click(screen.getByText("Yes, Delete"));

      expect(mockHandleWidgetDeletion).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ag_chart_from_table", id: "test-id" }),
      );
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("shows error toast when deletion fails", async () => {
      mockHandleWidgetDeletion.mockRejectedValueOnce(new Error("Failed"));
      render(<RightSideActions id="test-id" type="file" />);

      await clickIconButton("icon-trash-04");
      await userEvent.setup().click(screen.getByText("Yes, Delete"));

      expect(mockToastError).toHaveBeenCalledWith("Failed to delete file");
    });
  });

  describe("refresh action", () => {
    it("refreshes backend and shows success toast", async () => {
      mockUpdateApiSource.mockResolvedValueOnce({
        widgets: { w1: {} },
        errorMessage: null,
      });
      render(<RightSideActions id="backend-1" type="backend" />);

      await clickIconButton("icon-refresh-right");

      expect(mockUpdateApiSource).toHaveBeenCalledWith(
        expect.objectContaining({ id: "backend-1", name: "My Backend" }),
      );
      expect(mockUpdateWidgetEndpoints).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Widgets updated");
    });

    it("shows error toast when refresh returns errorMessage", async () => {
      mockUpdateApiSource.mockResolvedValueOnce({
        widgets: {},
        errorMessage: "Connection refused",
      });
      render(<RightSideActions id="backend-1" type="backend" />);

      await clickIconButton("icon-refresh-right");

      expect(mockToastError).toHaveBeenCalledWith("Error: My Backend", {
        description: "Connection refused",
      });
      expect(mockUpdateWidgetEndpoints).not.toHaveBeenCalled();
    });
  });

  describe("type title mapping", () => {
    it("uses File title for file type", async () => {
      render(<RightSideActions id="test-id" type="file" />);

      await clickIconButton("icon-trash-04");

      expect(screen.getByText("Delete File")).toBeInTheDocument();
    });

    it("uses Widget title for other types", async () => {
      render(<RightSideActions id="test-id" type="single" />);

      await clickIconButton("icon-trash-04");

      expect(screen.getByText("Delete Widget")).toBeInTheDocument();
    });
  });
});
