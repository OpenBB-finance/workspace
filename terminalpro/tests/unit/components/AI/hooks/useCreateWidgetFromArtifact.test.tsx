import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CreateWidgetParams,
  useCreateWidgetFromArtifact,
} from "~/components/AI/hooks/useCreateWidgetFromArtifact";
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
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "dashboard-123" }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}));

// Mock PostHog
vi.mock("posthog-js/react", () => ({
  usePostHog: () => ({
    capture: vi.fn(),
  }),
}));

// Mock API
const mockCreateMetaDataWidget = vi.fn();
vi.mock("~/api/auth.api", () => ({
  createMetaDataWidget: (...args: unknown[]) => mockCreateMetaDataWidget(...args),
}));

// Mock app store
const mockAddWidget = vi.fn();
const mockAddTab = vi.fn();
const mockGetLastInnerTab = vi.fn().mockReturnValue("");
vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: (state: any) => any) =>
    selector({
      addWidget: mockAddWidget,
      addTab: mockAddTab,
      getLastInnerTab: mockGetLastInnerTab,
    }),
}));

// Mock auth store
vi.mock("~/lib/state/auth", () => ({
  useShallowAuthStore: (selector: (state: any) => any) =>
    selector({
      user: { token: "test-token" },
    }),
  useAuthStore: () => ({ getState: () => ({}) }),
}));

// Mock theme store
vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: (state: any) => any) =>
    selector({ aiEnhancements: true }),
}));

// Mock copilotData store
vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: (state: any) => any) =>
    selector({
      copilotWidgets: { selectedWidgets: [] },
    }),
}));

// Mock fetch for AI widget info
global.fetch = vi.fn();

describe("useCreateWidgetFromArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMetaDataWidget.mockResolvedValue("new-widget-id");
    mockAddWidget.mockResolvedValue(undefined);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: "AI Title", description: "AI Description" }),
    });
    useCopilotStore.setState({ createWidgetMetadataDialog: null });
  });

  describe("createWidget", () => {
    it("shows loading toast when creating widget", async () => {
      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      expect(toast.loading).toHaveBeenCalledWith(
        "Creating table widget...",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Edit metadata",
          }),
        }),
      );
    });

    it("shows success toast with Edit metadata button after creation", async () => {
      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            cancel: expect.objectContaining({
              label: "Edit metadata",
            }),
          }),
        );
      });
    });

    it("shows error toast when creation fails", async () => {
      mockAddWidget.mockRejectedValue(new Error("Failed to add widget"));

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to create widget",
          expect.objectContaining({
            description: "Failed to add widget",
          }),
        );
      });
    });

    it("uses fallback name when AI fetch fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      await waitFor(() => {
        expect(mockAddWidget).toHaveBeenCalled();
      });
    });

    it("uses existing metadata name when provided", async () => {
      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidget({
          widgetType: "text",
          content: "Test content",
          metadata: {
            name: "Custom Name",
            description: "Custom Description",
          },
        });
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });
  });

  describe("Edit metadata button on loading toast", () => {
    it("opens dialog when Edit metadata is clicked on loading toast", async () => {
      let cancelCallback: (() => void) | undefined;

      (toast.loading as ReturnType<typeof vi.fn>).mockImplementation(
        (_message, options) => {
          cancelCallback = options?.cancel?.onClick;
          return "toast-id";
        },
      );

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      const params: CreateWidgetParams = {
        widgetType: "table",
        content: [{ col1: "data" }],
        metadata: null,
      };

      // Start widget creation but don't await - we want to click cancel during loading
      act(() => {
        result.current.createWidget(params);
      });

      // Simulate clicking Edit metadata
      if (cancelCallback) {
        act(() => {
          cancelCallback!();
        });
      }

      // Dialog should be opened in create mode
      await waitFor(() => {
        const dialogState = useCopilotStore.getState().createWidgetMetadataDialog;
        expect(dialogState).not.toBeNull();
        expect(dialogState?.mode).toBe("create");
        expect(dialogState?.pendingParams).toBeDefined();
      });

      // Toast should be dismissed
      expect(toast.dismiss).toHaveBeenCalledWith("toast-id");
    });
  });

  describe("Edit metadata button on success toast", () => {
    it("opens dialog when Edit metadata is clicked on success toast", async () => {
      mockAddWidget.mockImplementation(() => {
        return new Promise((resolve) => resolve("widget-uuid"));
      });
      let cancelCallback: (() => void) | undefined;

      (toast.success as ReturnType<typeof vi.fn>).mockImplementation(
        (_message, options) => {
          cancelCallback = options?.cancel?.onClick;
          return "toast-id";
        },
      );

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      // Simulate clicking Edit metadata on success toast
      if (cancelCallback) {
        act(() => {
          cancelCallback!();
        });
      }

      // Dialog should be opened in update mode
      await waitFor(() => {
        const dialogState = useCopilotStore.getState().createWidgetMetadataDialog;
        expect(dialogState).not.toBeNull();
        expect(dialogState?.mode).toBe("update");
        expect(dialogState?.widgetUuid).toBeDefined();
        expect(dialogState?.widgetId).toBeDefined();
      });
    });
  });

  describe("createWidgetWithMetadata", () => {
    it("creates widget with provided metadata and shows Edit metadata button", async () => {
      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidgetWithMetadata(
          {
            widgetType: "table",
            content: [{ col1: "data" }],
            metadata: null,
          },
          {
            name: "Manual Name",
            description: "Manual Description",
          },
        );
      });

      expect(mockAddWidget).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        "Created: Manual Name",
        expect.objectContaining({
          cancel: expect.objectContaining({
            label: "Edit metadata",
          }),
        }),
      );
    });

    it("opens dialog when Edit metadata is clicked on success toast", async () => {
      mockAddWidget.mockImplementation(() => {
        return new Promise((resolve) => resolve("widget-uuid"));
      });
      let cancelCallback: (() => void) | undefined;

      (toast.success as ReturnType<typeof vi.fn>).mockImplementation(
        (_message, options) => {
          cancelCallback = options?.cancel?.onClick;
          return "toast-id";
        },
      );

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidgetWithMetadata(
          {
            widgetType: "table",
            content: [{ col1: "data" }],
            metadata: null,
          },
          {
            name: "Manual Name",
            description: "Manual Description",
          },
        );
      });

      // Simulate clicking Edit metadata on success toast
      if (cancelCallback) {
        act(() => {
          cancelCallback!();
        });
      }

      // Dialog should be opened in update mode
      await waitFor(() => {
        const dialogState = useCopilotStore.getState().createWidgetMetadataDialog;
        expect(dialogState).not.toBeNull();
        expect(dialogState?.mode).toBe("update");
        expect(dialogState?.initialValues.name).toBe("Manual Name");
        expect(dialogState?.initialValues.description).toBe("Manual Description");
      });
    });

    it("shows loading toast during creation", async () => {
      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      await act(async () => {
        await result.current.createWidgetWithMetadata(
          {
            widgetType: "table",
            content: [{ col1: "data" }],
            metadata: null,
          },
          { name: "Test", description: "Test" },
        );
      });

      expect(toast.loading).toHaveBeenCalledWith("Creating widget...");
    });

    it("shows error toast on failure", async () => {
      mockAddWidget.mockRejectedValue(new Error("Creation failed"));

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      let thrownError: Error | null = null;
      await act(async () => {
        try {
          await result.current.createWidgetWithMetadata(
            {
              widgetType: "table",
              content: [{ col1: "data" }],
              metadata: null,
            },
            { name: "Test", description: "Test" },
          );
        } catch (error) {
          thrownError = error as Error;
        }
      });

      expect(thrownError?.message).toBe("Creation failed");
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create widget",
        expect.objectContaining({
          description: "Creation failed",
        }),
      );
    });
  });

  describe("AbortController behavior", () => {
    it("does not show error toast when request is aborted", async () => {
      // Make fetch hang so we can abort it
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 100);
          }),
      );

      let cancelCallback: (() => void) | undefined;

      (toast.loading as ReturnType<typeof vi.fn>).mockImplementation(
        (_message, options) => {
          cancelCallback = options?.cancel?.onClick;
          return "toast-id";
        },
      );

      const { result } = renderHook(() => useCreateWidgetFromArtifact());

      // Start widget creation
      act(() => {
        result.current.createWidget({
          widgetType: "table",
          content: [{ col1: "data" }],
          metadata: null,
        });
      });

      // Abort immediately
      if (cancelCallback) {
        act(() => {
          cancelCallback!();
        });
      }

      // Wait a bit for any potential error handling
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Error toast should NOT be called because it was aborted
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
