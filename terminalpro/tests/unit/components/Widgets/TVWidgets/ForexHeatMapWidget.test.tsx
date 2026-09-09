import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForexHeatMapWidget from "~/components/Widgets/TVWidgets/ForexHeatMapWidget";
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
  ForexHeatMap: () => <div data-testid="forex-heat-map">ForexHeatMap Widget</div>,
}));

describe("ForexHeatMapWidget", () => {
  it("renders forex heat map widget container", () => {
    renderWidget(<ForexHeatMapWidget />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
