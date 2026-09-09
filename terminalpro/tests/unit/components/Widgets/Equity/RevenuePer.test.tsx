import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevenuePer from "~/components/Widgets/Equity/RevenuePer";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(() => ({
    data: [
      { segment: "iPhone", revenue: 200000000000, percent: 52 },
      { segment: "Services", revenue: 85000000000, percent: 22 },
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
  PeriodParams: () => null,
}));

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

vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  default: () => <div data-testid="ticker-selector">Ticker</div>,
}));

vi.mock("ag-charts-react", () => ({
  AgCharts: () => <div data-testid="ag-chart">Chart</div>,
}));

describe("RevenuePer Widget", () => {
  it("renders revenue per container", () => {
    renderWidget(<RevenuePer />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/revenue" },
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("RevenuePer - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    (useJsonData as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<RevenuePer />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/revenue" },
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
