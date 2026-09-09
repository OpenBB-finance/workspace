import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TvChart from "~/components/Widgets/TvChart";
import { renderWidget } from "./WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children }: any) => <div data-testid="draggable-card">{children}</div>,
}));

vi.mock("~/components/Widgets/TVChartContainer/TVChartContainerFunc", () => ({
  default: ({ ticker }: any) => (
    <div data-testid="tv-chart-container">TradingView Chart: {ticker}</div>
  ),
}));

describe("TvChart Widget", () => {
  it("renders TradingView chart container", () => {
    renderWidget(<TvChart ticker="AAPL" />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByTestId("tv-chart-container")).toBeInTheDocument();
  });

  it("displays the ticker symbol", () => {
    renderWidget(<TvChart ticker="MSFT" />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByText(/MSFT/)).toBeInTheDocument();
  });

  it("handles undefined ticker", () => {
    renderWidget(<TvChart ticker="" />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByTestId("tv-chart-container")).toBeInTheDocument();
  });
});
