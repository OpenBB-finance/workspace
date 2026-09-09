import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TickerSummary from "~/components/Widgets/Equity/TickerSummary";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children }: any) => <div data-testid="draggable-card">{children}</div>,
}));

vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  default: () => <div data-testid="ticker-selector">Ticker</div>,
}));

describe("TickerSummary Widget", () => {
  it("renders ticker summary container", () => {
    renderWidget(<TickerSummary />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: {},
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("displays price information", () => {
    renderWidget(<TickerSummary />, {
      widgetOverrides: {
        data: { mainTicker: { symbol: "AAPL" } },
        storage: {},
      },
    });

    expect(screen.getByText(/price has changed/)).toBeInTheDocument();
    expect(screen.getByText(/RSI is greater than/)).toBeInTheDocument();
    expect(screen.getByText(/MACD is in the/)).toBeInTheDocument();
  });
});
