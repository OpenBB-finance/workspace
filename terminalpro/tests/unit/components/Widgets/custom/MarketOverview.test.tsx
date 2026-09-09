import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketOverview from "~/components/Widgets/custom/MarketOverview";
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
      {
        symbol: "SPY",
        name: "S&P 500 ETF",
        assetType: "stock",
        lastPrice: 450.25,
        prevClose: 448.0,
        change: 2.25,
        changePercent: 0.005,
        historicalData: [
          {
            date: "2024-01-15T09:30:00",
            open: 448,
            high: 451,
            low: 447,
            close: 450.25,
          },
        ],
        prevDayPattern: "2024-01-14",
        currentDayPattern: "2024-01-15",
      },
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

vi.mock("~/components/Charting/TopMarketOverviewItem", () => ({
  default: ({ market }: any) => <div data-testid="market-item">{market.symbol}</div>,
}));

describe("MarketOverview Widget", () => {
  it("renders market overview container", () => {
    renderWidget(<MarketOverview />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/market" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("MarketOverview - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    (useJsonData as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<MarketOverview />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/market" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
