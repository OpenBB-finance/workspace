import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PdfViewer from "~/components/Widgets/PdfViewer";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card" data-loading={loading} data-error={error}>
      {children}
    </div>
  ),
  SetLoadingOnResize: ({ children }: any) => (
    <div data-testid="set-loading-on-resize">{children}</div>
  ),
}));

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: (initialState: any) => [initialState, vi.fn()],
}));

vi.mock("~/lib/api", () => ({
  useJsonData: () => ({
    data: { objectUrl: "http://example.com/test.pdf", aiData: {} },
    isLoading: false,
    isError: false,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: () => "chat-1",
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: {
      endpoint: { url: "http://example.com/test.pdf", method: "GET" },
      storage: { page: 1, scale: 1, params: {} },
      name: "Test PDF",
      connectionType: "file",
    },
    updateWidget: vi.fn(),
  }),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

vi.mock("~/components/Widgets/Helpers/PdfViewerCore", () => ({
  PdfViewerCore: ({ file }: any) => (
    <div data-testid="pdf-viewer-core" data-file={file}>
      PDF Viewer Core
    </div>
  ),
}));

describe("PdfViewer Widget", () => {
  it("renders PDF viewer container", () => {
    render(<PdfViewer />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders PDF core component", () => {
    render(<PdfViewer />);

    expect(screen.getByTestId("pdf-viewer-core")).toBeInTheDocument();
  });

  it("passes file URL to PDF core", () => {
    render(<PdfViewer />);

    const pdfCore = screen.getByTestId("pdf-viewer-core");
    expect(pdfCore.getAttribute("data-file")).toBe("http://example.com/test.pdf");
  });

  it("wraps content in SetLoadingOnResize", () => {
    render(<PdfViewer />);

    expect(screen.getByTestId("set-loading-on-resize")).toBeInTheDocument();
  });

  it("passes loading state to DraggableCard", () => {
    render(<PdfViewer />);

    const card = screen.getByTestId("draggable-card");
    // With our mock returning isLoading: false, this should be false
    expect(card.getAttribute("data-loading")).toBe("false");
  });
});
