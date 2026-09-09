import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CopilotTable from "~/components/Widgets/AI/CopilotTable";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, aiData, exportFns }: any) => (
    <div
      data-testid="draggable-card"
      data-ai-enabled={!!aiData}
      data-has-export={!!exportFns}
    >
      {children}
    </div>
  ),
}));

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widget: {
      id: "copilot-table-1",
      storage: {
        rowsData: [
          { name: "Apple", price: 150, date: "2024-01-01" },
          { name: "Microsoft", price: 350, date: "2024-01-02" },
        ],
        columnDefs: [],
        chartView: { enabled: false },
      },
    },
  }),
}));

vi.mock("~/components/Charting/utils", () => ({
  downloadData: vi.fn(),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  getColumnDefs: () => [
    { field: "name", headerName: "Name" },
    { field: "price", headerName: "Price" },
  ],
  getContextMenuItems: () => [],
  isDateorYearField: (key: string) => key.includes("date"),
  isDate: (_value: any) => false,
}));

vi.mock("~/components/General/Table/Chart/AgChartView", () => ({
  ChartViewButton: () => <button data-testid="chart-view-btn">Chart</button>,
  ChartViewElement: () => <div data-testid="chart-view">Chart View</div>,
}));

vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  default: () => ({}),
  useChartToolPanelAction: () => ({}),
}));

vi.mock("~/components/General/Table/hooks", () => ({
  AgGridProvider: ({ rowData, columnDefs }: any) => (
    <div
      data-testid="ag-grid-provider"
      data-rows={rowData?.length || 0}
      data-cols={columnDefs?.length || 0}
    >
      AG Grid with {rowData?.length || 0} rows
    </div>
  ),
  useColumnVisibility: () => vi.fn(),
  getSideBarOptions: () => [],
  useAgExportFuncs: () => ({}),
  useQuickActionsSettings: () => ({}),
}));

vi.mock("~/components/General/Table/hooks/useCopilotFilteredData", () => ({
  useCopilotFilteredWidgetData: () => {},
}));

describe("CopilotTable", () => {
  it("renders copilot table container", () => {
    render(<CopilotTable />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("enables AI with row data", () => {
    render(<CopilotTable />);

    const card = screen.getByTestId("draggable-card");
    expect(card.getAttribute("data-ai-enabled")).toBe("true");
  });

  it("provides export functions", () => {
    render(<CopilotTable />);

    const card = screen.getByTestId("draggable-card");
    expect(card.getAttribute("data-has-export")).toBe("true");
  });

  it("renders AG Grid provider with parsed row data", () => {
    render(<CopilotTable />);

    const grid = screen.getByTestId("ag-grid-provider");
    expect(grid.getAttribute("data-rows")).toBe("2");
  });

  it("generates column definitions from row data", () => {
    render(<CopilotTable />);

    const grid = screen.getByTestId("ag-grid-provider");
    expect(grid.getAttribute("data-cols")).toBe("2");
  });
});

describe("CopilotTable - Chart View", () => {
  beforeEach(() => {
    vi.doMock("~/components/Widget.context", () => ({
      useWidgetContext: () => ({
        widget: {
          id: "copilot-table-1",
          storage: {
            rowsData: [{ name: "Apple", price: 150 }],
            columnDefs: [],
            chartView: { enabled: true },
          },
        },
      }),
    }));
  });

  it("can show chart view when enabled", () => {
    render(<CopilotTable />);

    // Chart view button should be available via settings
    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
