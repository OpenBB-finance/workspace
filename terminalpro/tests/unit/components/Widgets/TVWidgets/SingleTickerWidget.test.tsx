import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SingleTickerWidget from "~/components/Widgets/TVWidgets/SingleTickerWidget";
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
  SingleTicker: () => <div data-testid="single-ticker">SingleTicker Widget</div>,
}));

vi.mock("~/components/NewAdvancedSelectAddEdit", () => ({
  default: () => <div data-testid="select-add-edit">Select</div>,
}));

describe("SingleTickerWidget", () => {
  it("renders single ticker widget container", () => {
    renderWidget(<SingleTickerWidget />, {
      widgetOverrides: {
        storage: {
          availableSymbols: [{ label: "AAPL", value: "AAPL" }],
          selectedSymbol: "AAPL",
        },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
