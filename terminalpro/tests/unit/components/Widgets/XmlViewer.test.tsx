import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import XmlViewer from "~/components/Widgets/XmlViewer";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card" data-loading={loading} data-error={error}>
      {children}
    </div>
  ),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: () => ({
    data: `<?xml version="1.0"?>
    <rss>
      <channel>
        <item>
          <title>Test Item 1</title>
          <description>Description 1</description>
        </item>
        <item>
          <title>Test Item 2</title>
          <description>Description 2</description>
        </item>
      </channel>
    </rss>`,
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: {
      data: { html: "http://example.com/feed.xml" },
    },
  }),
}));

vi.mock("~/components/General/Table/hooks", () => ({
  AgGridProvider: ({ rowData, columnDefs }: any) => (
    <div
      data-testid="ag-grid-provider"
      data-rows={rowData.length}
      data-columns={columnDefs.length}
    >
      {rowData.map((row: any, i: number) => (
        <div key={i} data-testid="grid-row">
          {row.title} - {row.content}
        </div>
      ))}
    </div>
  ),
}));

describe("XmlViewer Widget", () => {
  it("renders XML viewer container", () => {
    render(<XmlViewer />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("parses XML and displays structured content", () => {
    render(<XmlViewer />);

    expect(screen.getByTestId("ag-grid-provider")).toBeInTheDocument();
  });

  it("displays correct number of items from XML", () => {
    render(<XmlViewer />);

    const rows = screen.getAllByTestId("grid-row");
    expect(rows).toHaveLength(2);
  });

  it("displays parsed item content", () => {
    render(<XmlViewer />);

    expect(screen.getByText(/Test Item 1/)).toBeInTheDocument();
    expect(screen.getByText(/Test Item 2/)).toBeInTheDocument();
  });
});

describe("XmlViewer - Loading State", () => {
  beforeEach(() => {
    vi.doMock("~/lib/api", () => ({
      useJsonData: () => ({
        data: null,
        isLoading: true,
        error: null,
        dataUpdatedAt: null,
      }),
    }));
  });

  it("shows loading state", () => {
    render(<XmlViewer />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
