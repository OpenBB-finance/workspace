import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StockSplits from "~/components/Widgets/Equity/StockSplits";
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
      { date: "2020-08-31", ratio: "4:1" },
      { date: "2014-06-09", ratio: "7:1" },
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

describe("StockSplits Widget", () => {
  it("renders stock splits container", () => {
    renderWidget(<StockSplits />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/splits" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("StockSplits - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<StockSplits />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/splits" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
