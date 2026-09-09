import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FileViewerWidget from "~/components/Widgets/FileView";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
  LoadingElement: ({ loading, errorMessage }: any) => (
    <div>
      {loading && <span>Loading...</span>}
      {errorMessage && <span>{errorMessage}</span>}
    </div>
  ),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(() => ({
    data: [
      { title: "File 1", description: "Description 1", link: "/files/test.md" },
      { title: "File 2", description: "Description 2", link: "/files/doc.pdf" },
    ],
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

describe("FileViewerWidget", () => {
  it("renders file list", async () => {
    renderWidget(<FileViewerWidget />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/files" },
        storage: { params: {} },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("File 1")).toBeInTheDocument();
      expect(screen.getByText("File 2")).toBeInTheDocument();
    });
  });

  it("renders file descriptions", async () => {
    renderWidget(<FileViewerWidget />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/files" },
        storage: { params: {} },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Description 1")).toBeInTheDocument();
      expect(screen.getByText("Description 2")).toBeInTheDocument();
    });
  });
});

describe("FileViewerWidget - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<FileViewerWidget />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/files" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

describe("FileViewerWidget - Empty State", () => {
  it("shows empty state message", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<FileViewerWidget />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/files" },
        storage: { params: {} },
      },
    });

    expect(screen.getByText("No files available.")).toBeInTheDocument();
  });
});
