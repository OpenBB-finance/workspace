import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketOverviewWidget from "~/components/Widgets/TVWidgets/MarketOverviewWidget";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: (selector: any) => selector({ theme: "light" }),
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children }: any) => <div data-testid="draggable-card">{children}</div>,
  SetLoadingOnResize: ({ children }: any) => <>{children}</>,
}));

vi.mock("~/components/DraggableCard/SetLoadingOnResize", () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock("react-ts-tradingview-widgets", () => ({
  MarketOverview: () => <div data-testid="market-overview">MarketOverview Widget</div>,
}));

vi.mock("~/components/NewAdvancedSelectAddEdit", () => ({
  default: () => <div data-testid="select-add-edit">Select</div>,
}));

describe("MarketOverviewWidget", () => {
  it("renders market overview widget container", () => {
    renderWidget(<MarketOverviewWidget />, {
      widgetOverrides: {
        storage: {
          selectedMarket: "Indices",
          availableSymbols: {
            Indices: [
              { label: "S&P 500", value: "FOREXCOM:SPXUSD" },
              { label: "Nasdaq 100", value: "FOREXCOM:NSXUSD" },
            ],
            Forex: [{ label: "EURUSD", value: "FX:EURUSD" }],
          },
        },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
