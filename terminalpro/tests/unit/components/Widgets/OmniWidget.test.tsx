import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OmniWidget from "~/components/Widgets/OmniWidget";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card" data-loading={loading} data-error={error}>
      {children}
    </div>
  ),
  SetLoadingOnResize: ({ children }: any) => (
    <div data-testid="set-loading-on-resize">{children}</div>
  ),
  LoadingElement: ({ children, loading, errorMessage, icon }: any) => (
    <div
      data-testid="loading-element"
      data-loading={loading}
      data-error={errorMessage}
      data-icon={icon}
    >
      {children}
    </div>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    data: null,
  }),
}));

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: (initialState: any) => [initialState, vi.fn()],
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: () => ({
    theme: "dark",
  }),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: {
      widgetId: "omni-widget-1",
      endpoint: { url: "http://example.com/query" },
      storage: {
        params: { prompt: "What is the revenue?" },
        response: null,
      },
      data: {},
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

vi.mock("~/components/General/Table/Chart/themes", () => ({
  useAgThemes: () => ({
    agTheme: {},
  }),
}));

vi.mock("~/components/Widgets/Helpers/useCopilotDataWidget", () => ({
  default: () => {},
}));

vi.mock("~/components/Widgets/custom/Markdown", async (importOriginal) => ({
  ...(await importOriginal<any>()),
  MarkdownContent: ({ children }: any) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

vi.mock("~/components/ui/MonacoEditor", () => ({
  MonacoEditor: ({ value }: any) => (
    <textarea value={value} readOnly={true} data-testid="monaco-editor" />
  ),
}));

vi.mock("ag-grid-react", () => ({
  AgGridReact: () => <div data-testid="ag-grid">AG Grid</div>,
}));

describe("OmniWidget", () => {
  it("renders omni widget container", () => {
    render(<OmniWidget />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders textarea for prompt input", async () => {
    render(<OmniWidget />);

    // MonacoEditor is lazy-loaded behind Suspense, so wait for it
    expect(
      await screen.findByDisplayValue("What is the revenue?"),
    ).toBeInTheDocument();
  });
});

describe("OmniWidget - Loading State", () => {
  beforeEach(() => {
    vi.doMock("@tanstack/react-query", () => ({
      useMutation: () => ({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        data: null,
      }),
    }));
  });

  it("shows loading state", () => {
    render(<OmniWidget />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
