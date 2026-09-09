import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PricePerformance from "~/components/Widgets/Equity/PricePerformance";
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

vi.mock("~/lib/api/sdkComponents", () => ({
  useEquityFundamentalOverview: vi.fn(() => ({
    data: { results: { mkt_cap: 3000000000000 } },
    dataUpdatedAt: Date.now(),
    isLoading: false,
  })),
  useEquityOwnershipShareStatistics: vi.fn(() => ({
    data: { results: [{ outstanding_shares: 15000000000 }] },
    isLoading: false,
  })),
}));

vi.mock("~/components/Widgets/TvChart", () => ({
  default: () => <div data-testid="tv-chart">TradingView Chart</div>,
}));

vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  default: () => <div data-testid="ticker-selector">Ticker</div>,
}));

vi.mock("~/components/Widgets/Helpers/useCopilotDataWidget", () => ({
  default: () => null,
}));

describe("PricePerformance Widget", () => {
  it("renders price performance container", () => {
    renderWidget(<PricePerformance />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("PricePerformance - Loading State", () => {
  it("shows loading state", async () => {
    const { useEquityFundamentalOverview } = vi.mocked(
      await import("~/lib/api/sdkComponents"),
    );
    (useEquityFundamentalOverview as any).mockReturnValue({
      data: undefined,
      dataUpdatedAt: Date.now(),
      isLoading: true,
    });

    renderWidget(<PricePerformance />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
