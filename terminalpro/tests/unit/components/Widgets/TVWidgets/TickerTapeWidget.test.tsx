import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TickerTapeWidget from "~/components/Widgets/TVWidgets/TickerTapeWidget";
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
  TickerTape: () => <div data-testid="ticker-tape">TickerTape Widget</div>,
}));

vi.mock("~/components/NewAdvancedSelectAddEdit", () => ({
  default: () => <div data-testid="select-add-edit">Select</div>,
}));

describe("TickerTapeWidget", () => {
  it("renders ticker tape widget container", () => {
    renderWidget(<TickerTapeWidget />, {
      widgetOverrides: {
        storage: {
          availableSymbols: [{ label: "SP500", value: "SP500" }],
          selectedSymbol: "SP500",
        },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
