import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Characteristics from "~/components/Widgets/ETF/Characteristics";
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
      expense_ratio: 0.03,
      aum: 500000000000,
      inception_date: "1993-01-22",
      category: "Large Cap Blend",
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

describe("ETF Characteristics Widget", () => {
  it("renders ETF characteristics container", () => {
    renderWidget(<Characteristics />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/characteristics" },
        storage: { params: { symbol: "SPY" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("ETF Characteristics - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<Characteristics />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/characteristics" },
        storage: { params: { symbol: "SPY" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
