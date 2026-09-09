import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Classification from "~/components/Widgets/ETF/Classification";
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
      category: "Large Cap Blend",
      investment_style: "Passive",
      asset_class: "Equity",
      geographic_focus: "United States",
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

describe("ETF Classification Widget", () => {
  it("renders ETF classification container", () => {
    renderWidget(<Classification />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/classification" },
        storage: { params: { symbol: "SPY" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("ETF Classification - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<Classification />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/classification" },
        storage: { params: { symbol: "SPY" } },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});
