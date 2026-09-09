import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShareStatistics from "~/components/Widgets/Equity/ShareStatistics";
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

vi.mock("~/components/General/Table/hooks", () => ({
  AgGridProvider: ({ children }: any) => (
    <div data-testid="ag-grid-provider">{children}</div>
  ),
  ensureAgGrid: () => false,
  useAgGridContext: () => ({
    gridRef: { current: null },
  }),
}));

vi.mock("~/lib/api/sdkComponents", () => ({
  useEquityOwnershipShareStatistics: vi.fn(() => ({
    data: {
      results: [
        {
          shares_outstanding: 15500000000,
          float_shares: 15400000000,
          shares_short: 100000000,
          short_ratio: 1.5,
        },
      ],
    },
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
    isSuccess: true,
  })),
}));

vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  default: () => <div data-testid="advanced-select-ticker">Ticker</div>,
}));

describe("ShareStatistics Widget", () => {
  it("renders share statistics container", () => {
    renderWidget(<ShareStatistics />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("ShareStatistics - Loading State", () => {
  it("shows loading state", async () => {
    const { useEquityOwnershipShareStatistics } = vi.mocked(
      await import("~/lib/api/sdkComponents"),
    );
    (useEquityOwnershipShareStatistics as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
      isSuccess: false,
    });

    renderWidget(<ShareStatistics />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
