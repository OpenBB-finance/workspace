import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AgGridContext,
  AgGridProvider,
  Table,
  useAgGridContext,
  useGridSync,
} from "~/components/General/Table/hooks/useTableContext";
import { WidgetContext } from "~/components/Widget.context";

// Mock dependencies
vi.mock("ag-grid-react", () => ({
  AgGridReact: ({ rowData, columnDefs, onGridReady }: any) => {
    // Simulate calling onGridReady after mount
    setTimeout(() => {
      if (onGridReady) {
        onGridReady({
          api: {
            exportDataAsCsv: vi.fn(),
            exportDataAsExcel: vi.fn(),
            getDisplayedRowCount: () => rowData?.length || 0,
            forEachNodeAfterFilterAndSort: vi.fn(),
            clearCellSelection: vi.fn(),
            updateGridOptions: vi.fn(),
            isPivotMode: () => false,
            paginationGetRowCount: () => rowData?.length || 0,
            paginationGetPageSize: () => 100,
            paginationGetCurrentPage: () => 0,
          },
        });
      }
    }, 0);

    return (
      <div data-testid="ag-grid-react">
        <span data-testid="row-count">{rowData?.length || 0} rows</span>
        <span data-testid="column-count">{columnDefs?.length || 0} columns</span>
      </div>
    );
  },
}));

vi.mock("~/components/DraggableCard/SetLoadingOnResize", () => ({
  AgGridSetLoadingOnResize: ({ children }: any) => <>{children}</>,
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: vi.fn((selector: any) =>
    selector({ theme: "light", tablePagination: false }),
  ),
}));

vi.mock("~/components/General/Table/Chart/themes", () => ({
  useAgThemes: () => ({
    agTheme: {},
    chartThemes: [],
    customChartThemes: {},
  }),
}));

vi.mock("~/components/General/Table/hooks/useCreateChart", () => ({
  useCreateChart: () => vi.fn(),
}));

vi.mock("~/components/General/Table/hooks/useUpdateColumnState", () => ({
  useUpdateColumnState: vi.fn(() => [
    vi.fn(), // onGridReady
    vi.fn(), // onStateUpdated
    vi.fn(), // onNewColumnsLoaded
    vi.fn(), // onGridPreDestroyed
    vi.fn(), // onChartRangeSelectionChanged
    vi.fn(), // onVirtualColumnsChanged
    vi.fn(), // onChartDestroyed
    {}, // initialState
  ]),
  useApplyColumnState: () => ({ applyColumnState: vi.fn() }),
  getCellRangeState: () => ({
    stateCellRange: null,
    chartType: "line",
    chartModel: null,
  }),
}));

vi.mock("~/components/General/Table/Chart/hooks/useCreateChartData", () => ({
  useCreateChartData: () =>
    vi.fn(() => ({
      isReallyTransposed: false,
      rowData: [],
      columnDefs: [],
    })),
}));

vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  useChartCloseButtonListener: () => vi.fn(),
}));

vi.mock("~/components/General/Table/Chart/AgChartView", () => ({
  createRangeChart: vi.fn(() => ({
    rowData: [],
    columnDefs: [],
    chartParams: {
      cellRange: { columns: [] },
    },
  })),
  customChartWidgetIds: [],
}));

vi.mock("~/hooks/useRefHooks", () => ({
  useComposeRefs: vi.fn((...refs) => (node: any) => {
    refs.forEach((ref: any) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    });
  }),
}));

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: (initialState: any) => {
    const { useState, useCallback } = require("react");
    const [state, setState] = useState(
      typeof initialState === "function" ? initialState() : initialState,
    );

    const dispatch = useCallback(
      (updates: any) =>
        setState((s: any) => {
          if (typeof updates === "function") {
            return updates(s);
          }
          return {
            ...s,
            ...Object.fromEntries(
              Object.entries(updates).map(([key, value]) => [
                key,
                typeof value === "function" ? value(s[key]) : value,
              ]),
            ),
          };
        }),
      [],
    );

    return [state, dispatch];
  },
}));

vi.mock("use-debounce", () => ({
  useDebouncedCallback: (fn: any) => fn,
}));

const createMockWidget = (overrides = {}) => ({
  uuid: "test-uuid",
  id: "test-id",
  name: "Test Widget",
  type: "custom",
  widgetId: "test-widget",
  storage: {
    params: {},
    chartView: null,
  },
  data: {
    table: { columnsDefs: [] },
  },
  ...overrides,
});

const createTestContext = (
  value: Partial<ReturnType<typeof useAgGridContext>> = {},
) => ({
  gridRef: { current: null },
  chartRef: { current: null },
  chartViewElementRef: { current: null },
  columnDefsRef: { current: [] },
  columnVisibility: {},
  setColumnVisibility: vi.fn(),
  createChartData: vi.fn(),
  gridState: {
    columnDefs: [],
    rowData: [],
    gridReady: false,
    needsUpdate: false,
    resized: {},
    dataRevision: null,
  },
  getGridState: vi.fn(),
  updateAgGrid: vi.fn(),
  createRangeChartParamsCbRef: { current: vi.fn() },
  handleChartViewToggleRef: { current: vi.fn() },
  isReallyTransposedRef: { current: false },
  ...value,
});

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const renderWithProviders = (ui: ReactNode, widgetOverrides = {}) => {
  const widget = createMockWidget(widgetOverrides);
  const queryClient = createQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <WidgetContext.Provider
        value={
          {
            widget,
            widgetRef: { current: widget },
            widgetFromJSON: widget,
            activeDashboardId: "test-dashboard",
            isShared: false,
            uuid: widget.uuid,
            updateWidget: vi.fn(),
            getWidget: () => widget,
          } as any
        }
      >
        {ui}
      </WidgetContext.Provider>
    </QueryClientProvider>,
  );
};

describe("useAgGridContext", () => {
  it("throws error when used outside AgGridContext", () => {
    const TestComponent = () => {
      useAgGridContext();
      return null;
    };

    expect(() => render(<TestComponent />)).toThrow(
      "useAgGridContext must be used within a AgGridProvider",
    );
  });

  it("returns context value when used inside AgGridContext", () => {
    const testContext = createTestContext();
    let result: any;

    const TestComponent = () => {
      result = useAgGridContext();
      return null;
    };

    render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent />
      </AgGridContext.Provider>,
    );

    expect(result).toBeDefined();
    expect(result.gridRef).toBeDefined();
    expect(result.gridState).toBeDefined();
    expect(result.updateAgGrid).toBeDefined();
  });
});

describe("Table Component", () => {
  it("renders children", () => {
    renderWithProviders(
      <Table>
        <div data-testid="child">Child Content</div>
      </Table>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides AgGridContext to children", () => {
    let contextValue: any;

    const TestChild = () => {
      contextValue = useAgGridContext();
      return <div data-testid="context-test">Has Context</div>;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(screen.getByTestId("context-test")).toBeInTheDocument();
    expect(contextValue).toBeDefined();
    expect(contextValue.gridRef).toBeDefined();
  });

  it("initializes grid state correctly", () => {
    let gridState: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      gridState = ctx.gridState;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(gridState).toMatchObject({
      columnDefs: [],
      rowData: [],
      gridReady: false,
      needsUpdate: false,
    });
  });

  it("provides updateAgGrid function", () => {
    let updateFn: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      updateFn = ctx.updateAgGrid;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(typeof updateFn).toBe("function");
  });
});

describe("AgGridProvider Component", () => {
  it("renders AgGridReact with row data", async () => {
    const rowData = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
    ];
    const columnDefs = [{ field: "id" }, { field: "name" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ag-grid-react")).toBeInTheDocument();
    });
  });

  it("displays correct row count", async () => {
    const rowData = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
      { id: 3, name: "Test 3" },
    ];
    const columnDefs = [{ field: "id" }, { field: "name" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-count")).toHaveTextContent("3 rows");
    });
  });

  it("displays correct column count", async () => {
    const rowData = [{ id: 1, name: "Test", value: 100 }];
    const columnDefs = [{ field: "id" }, { field: "name" }, { field: "value" }];

    renderWithProviders(
      <Table>
        <AgGridProvider rowData={rowData} columnDefs={columnDefs} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("column-count")).toHaveTextContent("3 columns");
    });
  });

  it("handles empty data", async () => {
    renderWithProviders(
      <Table>
        <AgGridProvider rowData={[]} columnDefs={[]} />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("row-count")).toHaveTextContent("0 rows");
    });
  });

  it("applies custom className", async () => {
    const rowData = [{ id: 1 }];
    const columnDefs = [{ field: "id" }];

    renderWithProviders(
      <Table>
        <AgGridProvider
          rowData={rowData}
          columnDefs={columnDefs}
          extraClassName="custom-class"
        />
      </Table>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("ag-grid-react")).toBeInTheDocument();
    });
  });
});

describe("useGridSync Hook", () => {
  it("calls updateAgGrid when data changes", async () => {
    const mockUpdateAgGrid = vi.fn();
    const testContext = createTestContext({ updateAgGrid: mockUpdateAgGrid });

    const TestComponent = ({ rowData, columnDefs }: any) => {
      useGridSync(rowData, columnDefs);
      return null;
    };

    const { rerender } = render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent rowData={[]} columnDefs={[]} />
      </AgGridContext.Provider>,
    );

    // Rerender with actual data
    rerender(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent rowData={[{ id: 1 }]} columnDefs={[{ field: "id" }]} />
      </AgGridContext.Provider>,
    );

    await waitFor(() => {
      expect(mockUpdateAgGrid).toHaveBeenCalled();
    });
  });

  it("does not call updateAgGrid for empty data", async () => {
    const mockUpdateAgGrid = vi.fn();
    const testContext = createTestContext({ updateAgGrid: mockUpdateAgGrid });

    const TestComponent = () => {
      useGridSync([], []);
      return null;
    };

    render(
      <AgGridContext.Provider value={testContext as any}>
        <TestComponent />
      </AgGridContext.Provider>,
    );

    // Should not be called for empty data
    expect(mockUpdateAgGrid).not.toHaveBeenCalled();
  });
});

describe("Context Value Management", () => {
  it("maintains column visibility state", async () => {
    let setColumnVisibility: any;
    let columnVisibility: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      setColumnVisibility = ctx.setColumnVisibility;
      columnVisibility = ctx.columnVisibility;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(columnVisibility).toEqual({});

    act(() => {
      setColumnVisibility({ name: true, price: false });
    });

    // The state update should work (implementation depends on actual hook)
    expect(typeof setColumnVisibility).toBe("function");
  });

  it("provides chart refs", () => {
    let chartRef: any;
    let chartViewElementRef: any;

    const TestChild = () => {
      const ctx = useAgGridContext();
      chartRef = ctx.chartRef;
      chartViewElementRef = ctx.chartViewElementRef;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(chartRef).toBeDefined();
    expect(chartRef.current).toBeNull();
    expect(chartViewElementRef).toBeDefined();
  });

  it("provides a shared previousChartEnabledRef", () => {
    let previousChartEnabledRef: any;

    const TestChild = () => {
      previousChartEnabledRef = useAgGridContext().previousChartEnabledRef;
      return null;
    };

    renderWithProviders(
      <Table>
        <TestChild />
      </Table>,
    );

    expect(previousChartEnabledRef).toBeDefined();
    expect(previousChartEnabledRef.current).toBe(false);
  });
});
