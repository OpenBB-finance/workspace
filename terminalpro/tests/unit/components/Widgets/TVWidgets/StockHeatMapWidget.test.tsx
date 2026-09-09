import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StockHeatMapWidget from "~/components/Widgets/TVWidgets/StockHeatMapWidget";
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
  StockHeatmap: () => <div data-testid="stock-heat-map">StockHeatmap Widget</div>,
}));

describe("StockHeatMapWidget", () => {
  it("renders stock heat map widget container", () => {
    renderWidget(<StockHeatMapWidget />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
