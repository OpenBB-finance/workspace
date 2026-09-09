import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgGridTable from "~/components/General/Table/AgGridTable";

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
    data: { results: [{ name: "Apple", price: 150 }] },
    isLoading: false,
    isError: false,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock("~/lib/api/sdkComponents", () => ({}));

const mockWidget = {
  widgetId: "test-table",
  endpoint: { url: "http://example.com/data" },
  storage: { params: {} },
  data: {
    table: { columnsDefs: [], transpose: false },
  },
};

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: mockWidget,
    getWidget: () => mockWidget,
    updateWidget: vi.fn(),
    widgetFromJSON: mockWidget,
  }),
}));

vi.mock("~/components/General/Table/hooks", () => ({
  AgGridProvider: ({ children, rowData }: any) => (
    <div data-testid="ag-grid-provider" data-rows={rowData?.length || 0}>
      {children}
    </div>
  ),
  getWidgetStorage: () => ({}),
  useAgGridContext: () => ({ gridRef: { current: null } }),
  useColumnVisibility: () => ({
    columnVisibility: {},
    toggleColumnVisibility: vi.fn(),
  }),
  getSideBarOptions: () => [],
  useAgExportFuncs: () => ({}),
  useQuickActionsSettings: () => ({}),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
  PeriodParams: () => null,
}));

vi.mock("~/components/General/Table/Chart/AgChartView", () => ({
  ChartViewButton: () => <button data-testid="chart-view-btn">Chart</button>,
  ChartViewElement: () => <div data-testid="chart-view">Chart View</div>,
}));

vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  default: () => ({}),
  useChartToolPanelAction: () => ({}),
}));

vi.mock("~/components/General/Table/SubMenus/TableSettings", () => ({
  default: () => <div data-testid="table-settings">Settings</div>,
}));

vi.mock("~/components/General/Table/hooks/useCopilotFilteredData", () => ({
  useCopilotFilteredWidgetData: () => {},
}));

vi.mock("@radix-ui/react-toggle-group", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Item: ({ children }: any) => <div>{children}</div>,
}));

describe("AgGridTable", () => {
  it("renders table container", () => {
    render(<AgGridTable />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders AG Grid provider", () => {
    render(<AgGridTable />);

    expect(screen.getByTestId("ag-grid-provider")).toBeInTheDocument();
  });

  it("renders grid within the wrapper div", () => {
    render(<AgGridTable />);

    // Check that grid is inside a flex wrapper
    const card = screen.getByTestId("draggable-card");
    expect(card.querySelector(".flex.grow")).toBeInTheDocument();
  });
});

describe("AgGridTable - Loading State", () => {
  beforeEach(() => {
    vi.doMock("~/lib/api", () => ({
      useJsonData: () => ({
        data: null,
        isLoading: true,
        isError: false,
        dataUpdatedAt: null,
      }),
    }));
  });

  it("shows loading state", () => {
    render(<AgGridTable />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
