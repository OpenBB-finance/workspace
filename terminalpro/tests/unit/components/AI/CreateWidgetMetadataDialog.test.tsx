import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReactDOM from "react-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateWidgetMetadataDialog } from "~/components/AI/CreateWidgetMetadataDialog";
import { useCopilotStore } from "~/lib/state/copilot";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
  },
}));

// Mock react-router-dom
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "dashboard-123" }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

// Mock the API
const mockPatchWidgetMetadata = vi.fn();
vi.mock("~/api/auth.api", () => ({
  patchWidgetMetadata: (...args: unknown[]) => mockPatchWidgetMetadata(...args),
  createMetaDataWidget: vi.fn().mockResolvedValue("widget-id-123"),
}));

// Mock processWidgetId
vi.mock("~/lib/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/lib/utils")>();
  return {
    ...actual,
    processWidgetId: vi.fn().mockReturnValue({
      uuid: "widget-uuid-123",
      cleanWidgetId: "copilot_table",
    }),
    dispatchUpdateWidget: vi.fn(),
  };
});

// Mock useCreateWidgetFromArtifact hook
const mockCreateWidgetWithMetadata = vi.fn();
vi.mock("~/components/AI/hooks/useCreateWidgetFromArtifact", () => ({
  useCreateWidgetFromArtifact: () => ({
    createWidget: vi.fn(),
    createWidgetWithMetadata: mockCreateWidgetWithMetadata,
  }),
}));

// Mock createPortal for dialog rendering
vi.spyOn(ReactDOM, "createPortal").mockImplementation((element) => {
  return element as React.ReactPortal;
});

describe("CreateWidgetMetadataDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset copilot store dialog state
    useCopilotStore.setState({ createWidgetMetadataDialog: null });
  });

  describe("when dialog is closed", () => {
    it("renders nothing when dialog state is null", () => {
      const { container } = render(<CreateWidgetMetadataDialog />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("when in create mode", () => {
    beforeEach(() => {
      useCopilotStore.setState({
        createWidgetMetadataDialog: {
          mode: "create",
          initialValues: {
            name: "Initial Name",
            description: "Initial Description",
          },
          pendingParams: {
            widgetType: "table",
            content: [{ col1: "data1" }],
            metadata: {},
          },
        },
      });
    });

    it("renders with create mode title", () => {
      render(<CreateWidgetMetadataDialog />);

      expect(screen.getByText("Create widget")).toBeInTheDocument();
      expect(
        screen.getByText("Enter the metadata for your new widget."),
      ).toBeInTheDocument();
    });

    it("pre-fills form with initial values", () => {
      render(<CreateWidgetMetadataDialog />);

      const nameInput = screen.getByLabelText("Name");
      expect(nameInput).toHaveValue("Initial Name");
    });

    it("shows Create button", () => {
      render(<CreateWidgetMetadataDialog />);

      expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    });

    it("calls createWidgetWithMetadata on submit", async () => {
      mockCreateWidgetWithMetadata.mockResolvedValue(undefined);
      render(<CreateWidgetMetadataDialog />);

      const nameInput = screen.getByLabelText("Name");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "My Widget Name");

      const createButton = screen.getByRole("button", { name: "Create" });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateWidgetWithMetadata).toHaveBeenCalledWith(
          expect.objectContaining({
            widgetType: "table",
            content: [{ col1: "data1" }],
          }),
          expect.objectContaining({
            name: "My Widget Name",
          }),
        );
      });
    });

    it("closes dialog on successful creation", async () => {
      mockCreateWidgetWithMetadata.mockResolvedValue(undefined);
      render(<CreateWidgetMetadataDialog />);

      const createButton = screen.getByRole("button", { name: "Create" });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(useCopilotStore.getState().createWidgetMetadataDialog).toBeNull();
      });
    });

    it("shows error toast on failure", async () => {
      mockCreateWidgetWithMetadata.mockRejectedValue(new Error("API Error"));
      render(<CreateWidgetMetadataDialog />);

      const createButton = screen.getByRole("button", { name: "Create" });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to create widget");
      });
    });

    it("closes dialog when Cancel is clicked", async () => {
      render(<CreateWidgetMetadataDialog />);

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await userEvent.click(cancelButton);

      expect(useCopilotStore.getState().createWidgetMetadataDialog).toBeNull();
    });
  });

  describe("when in update mode", () => {
    beforeEach(() => {
      useCopilotStore.setState({
        createWidgetMetadataDialog: {
          mode: "update",
          initialValues: {
            name: "Widget Name",
            description: "Widget Description",
            category: "Economy",
          },
          widgetId: "copilot_table-widget-uuid-123",
          widgetUuid: "widget-uuid-123",
          dashboardId: "dashboard-123",
        },
      });
    });

    it("renders with update mode title", () => {
      render(<CreateWidgetMetadataDialog />);

      expect(screen.getByText("Edit widget metadata")).toBeInTheDocument();
      expect(
        screen.getByText(
          "By editing the metadata, you will help OpenBB Copilot better understand your widget.",
        ),
      ).toBeInTheDocument();
    });

    it("pre-fills form with current widget values", () => {
      render(<CreateWidgetMetadataDialog />);

      const nameInput = screen.getByLabelText("Name");
      expect(nameInput).toHaveValue("Widget Name");
    });

    it("shows Save button", () => {
      render(<CreateWidgetMetadataDialog />);

      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    });

    it("calls patchWidgetMetadata on submit", async () => {
      mockPatchWidgetMetadata.mockResolvedValue({ success: true });
      render(<CreateWidgetMetadataDialog />);

      const nameInput = screen.getByLabelText("Name");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Updated Name");

      const saveButton = screen.getByRole("button", { name: "Save" });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(mockPatchWidgetMetadata).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Updated Name",
          }),
          "widget-uuid-123",
        );
      });
    });

    it("shows success toast on successful update", async () => {
      mockPatchWidgetMetadata.mockResolvedValue({ success: true });
      render(<CreateWidgetMetadataDialog />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Widget metadata updated");
      });
    });

    it("shows error toast when API returns failure", async () => {
      mockPatchWidgetMetadata.mockResolvedValue({ success: false });
      render(<CreateWidgetMetadataDialog />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update metadata");
      });
    });

    it("shows error toast when update throws", async () => {
      mockPatchWidgetMetadata.mockRejectedValue(new Error("Network error"));
      render(<CreateWidgetMetadataDialog />);

      const saveButton = screen.getByRole("button", { name: "Save" });
      await userEvent.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to update metadata");
      });
    });
  });

  describe("form validation", () => {
    beforeEach(() => {
      useCopilotStore.setState({
        createWidgetMetadataDialog: {
          mode: "create",
          initialValues: {
            name: "",
            description: "",
          },
          pendingParams: {
            widgetType: "table",
            content: [],
            metadata: {},
          },
        },
      });
    });

    it("requires name field", async () => {
      render(<CreateWidgetMetadataDialog />);

      const createButton = screen.getByRole("button", { name: "Create" });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("This field is required")).toBeInTheDocument();
      });

      expect(mockCreateWidgetWithMetadata).not.toHaveBeenCalled();
    });

    it("allows empty optional fields", async () => {
      mockCreateWidgetWithMetadata.mockResolvedValue(undefined);
      render(<CreateWidgetMetadataDialog />);

      const nameInput = screen.getByLabelText("Name");
      await userEvent.type(nameInput, "Widget Name");

      const createButton = screen.getByRole("button", { name: "Create" });
      await userEvent.click(createButton);

      await waitFor(() => {
        expect(mockCreateWidgetWithMetadata).toHaveBeenCalled();
      });
    });
  });

  describe("form fields", () => {
    beforeEach(() => {
      useCopilotStore.setState({
        createWidgetMetadataDialog: {
          mode: "create",
          initialValues: {
            name: "Test",
            description: "",
            category: "",
            subCategory: "",
            source: "",
          },
          pendingParams: {
            widgetType: "table",
            content: [],
            metadata: {},
          },
        },
      });
    });

    it("renders all form fields", () => {
      render(<CreateWidgetMetadataDialog />);

      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Category")).toBeInTheDocument();
      expect(screen.getByText("Sub Category")).toBeInTheDocument();
      expect(screen.getByText("Source")).toBeInTheDocument();
    });

    it("shows optional labels for non-required fields", () => {
      render(<CreateWidgetMetadataDialog />);

      const optionalLabels = screen.getAllByText("(optional)");
      expect(optionalLabels).toHaveLength(4); // description, category, subCategory, source
    });
  });
});
