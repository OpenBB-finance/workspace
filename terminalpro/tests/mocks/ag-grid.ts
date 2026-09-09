/**
 * AG Grid Mocks
 *
 * Mocks for AG Grid components and hooks used across widget tests.
 * AG Grid is a complex library that requires extensive mocking in JSDOM.
 */
import { vi } from "vitest";

// AG Grid Table hooks - commonly used across widget tests
vi.mock("~/components/General/Table/hooks", () => ({
  AgGridProvider: ({ children }: any) => children,
  ensureAgGrid: () => false,
  useAgGridContext: () => ({
    gridRef: { current: null },
    setGridRef: vi.fn(),
  }),
  useColumnVisibility: () => ({
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
    hiddenColumns: [],
    toggleColumnVisibility: vi.fn(),
  }),
  getSideBarOptions: () => [],
  useAgExportFuncs: () => ({}),
  useQuickActionsSettings: () => ({}),
}));

// AG Grid Chart Options hooks
vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  default: () => ({
    chartViewProps: {},
    ChartToolPanelAction: () => null,
    quickActions: [],
  }),
  useChartToolPanelAction: () => ({
    chartToolPanelAction: null,
    setChartToolPanelAction: vi.fn(),
  }),
}));

// QueryParams for table navigation
vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
  PeriodParams: () => null,
}));

// ag-grid-community theming
vi.mock("ag-grid-community", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ag-grid-community")>();
  return {
    ...actual,
    createPart: vi.fn(() => ({})),
    themeAlpine: {
      withPart: vi.fn().mockReturnThis(),
      withParams: vi.fn().mockReturnThis(),
    },
    themeQuartz: {
      withPart: vi.fn().mockReturnThis(),
      withParams: vi.fn().mockReturnThis(),
    },
    colorSchemeDark: {},
    colorSchemeLight: {},
  };
});
