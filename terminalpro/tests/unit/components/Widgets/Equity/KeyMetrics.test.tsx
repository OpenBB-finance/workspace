import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import KeyMetrics from "~/components/Widgets/Equity/KeyMetrics";
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
    data: {
      market_cap: 3000000000000,
      pe_ratio: 28.5,
      dividend_yield: 0.5,
    },
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

describe("KeyMetrics Widget", () => {
  it("renders key metrics container", () => {
    renderWidget(<KeyMetrics />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/metrics" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("KeyMetrics - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<KeyMetrics />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/metrics" },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
