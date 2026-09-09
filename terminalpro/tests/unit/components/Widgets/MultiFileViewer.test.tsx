import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MultiFileViewer from "~/components/Widgets/MultiFileViewer";

const mocks = vi.hoisted(() => ({
  fileOptions: [
    { label: "File 1", value: "file1.pdf" },
    { label: "File 2", value: "file2.pdf" },
  ],
  fileData: {
    "file1.pdf": {
      objectUrl: "http://example.com/file.pdf",
      aiData: { content: "test" },
    },
  },
  setWidgetRuntimeState: vi.fn(),
  toggleSelectedWidget: vi.fn(),
  updateWidget: vi.fn(),
  widget: {
    id: "multi-file-viewer-1",
    widgetId: "multi-file-viewer-1",
    endpoint: { url: "http://example.com/files" },
    params: [
      {
        paramName: "file",
        name: "file",
        roles: ["fileSelector"],
        optionsEndpoint: "http://example.com/files",
      },
    ],
    storage: {
      params: { file: ["file1.pdf"] },
      selectedFiles: ["file1.pdf"],
      currentFileName: "file1.pdf",
    },
    data: {
      selectorParamValue: ["file1.pdf", "file2.pdf"],
      selectorParamName: "file",
    },
  },
}));

beforeEach(() => {
  mocks.setWidgetRuntimeState.mockClear();
  mocks.toggleSelectedWidget.mockClear();
  mocks.updateWidget.mockClear();
});

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
  useStateReducer: (initialState: any) => {
    const [state, setState] = React.useState(initialState);
    return [state, (updates: any) => setState((s: any) => ({ ...s, ...updates }))];
  },
}));

vi.mock("~/lib/api", () => ({
  useJsonData: (options: any) => {
    // If it's the options request (asking for file list)
    if (options.url === "http://example.com/files") {
      return {
        data: mocks.fileOptions,
        isLoading: false,
        isError: false,
        dataUpdatedAt: Date.now(),
        refetch: vi.fn(),
      };
    }
    // If it's the data request (fetching specific file)
    return {
      data: mocks.fileData,
      isLoading: false,
      isError: false,
      dataUpdatedAt: Date.now(),
      refetch: vi.fn(),
    };
  },
  useMultipleQueries: () => [],
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: (selector: any) =>
    selector({
      isWidgetSelected: () => true,
      setWidgetRuntimeState: mocks.setWidgetRuntimeState,
      toggleSelectedWidget: mocks.toggleSelectedWidget,
    }),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: mocks.widget,
    updateWidget: mocks.updateWidget,
  }),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

vi.mock("~/components/ui/Resizable", () => ({
  ResizablePanelGroup: ({ children, direction }: any) => (
    <div data-testid="resizable-panel-group" data-direction={direction}>
      {children}
    </div>
  ),
  ResizablePanel: ({ children, defaultSize, minSize, maxSize }: any) => (
    <div
      data-testid="resizable-panel"
      data-default-size={defaultSize}
      data-min-size={minSize}
      data-max-size={maxSize}
    >
      {children}
    </div>
  ),
}));

vi.mock("react-resizable-panels", () => ({
  PanelResizeHandle: ({ children, hitAreaMargins, onDragging, ...props }: any) => (
    <div data-testid="file-sidebar-resize-handle" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("~/components/Widgets/Helpers/PdfViewerCore", () => ({
  PdfViewerCore: ({ file }: any) => (
    <div data-testid="pdf-viewer-core" data-file={file}>
      PDF Viewer
    </div>
  ),
}));

vi.mock("~/components/Widgets/Helpers/useCopilotDataWidget", () => ({
  default: () => {},
}));

describe("MultiFileViewer Widget", () => {
  it("renders multi file viewer container and keeps file checkboxes clickable", async () => {
    render(<MultiFileViewer />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
    expect(
      screen.queryByText("Select checkboxes to add the files to OpenBB Copilot."),
    ).not.toBeInTheDocument();
    const [sidebarPanel, pdfPanel] = screen.getAllByTestId("resizable-panel");
    expect(sidebarPanel).toHaveAttribute("data-min-size", "10");
    expect(sidebarPanel).toHaveAttribute("data-max-size", "60");
    expect(pdfPanel).toHaveAttribute("data-min-size", "40");
    const checkboxes = screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[2]);

    await waitFor(() =>
      expect(mocks.updateWidget).toHaveBeenCalledWith(expect.any(Function)),
    );
  });

  it("passes loading state to DraggableCard", () => {
    render(<MultiFileViewer />);

    const card = screen.getByTestId("draggable-card");
    expect(card.getAttribute("data-loading")).toBe("false");
  });
});
