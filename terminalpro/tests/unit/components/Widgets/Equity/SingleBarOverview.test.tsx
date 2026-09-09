import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SingleBarOverview from "~/components/Widgets/Equity/SingleBarOverview";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
  SetLoadingOnResize: ({ children }: any) => <>{children}</>,
  LoadingElement: () => <span data-testid="loading-element">Loading...</span>,
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(() => ({
    data: {
      symbol: "AAPL",
      price: 185.5,
      change: 2.5,
      changePercent: 1.37,
    },
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

describe("SingleBarOverview Widget", () => {
  it("renders single bar overview container", () => {
    renderWidget(<SingleBarOverview />, {
      widgetOverrides: {
        storage: { params: { symbol: "AAPL" } },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
