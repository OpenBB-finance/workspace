import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EconomicCalendarWidget from "~/components/Widgets/TVWidgets/EconomicCalendarWidget";
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
  EconomicCalendar: () => (
    <div data-testid="economic-calendar">EconomicCalendar Widget</div>
  ),
}));

describe("EconomicCalendarWidget", () => {
  it("renders economic calendar widget container", () => {
    renderWidget(<EconomicCalendarWidget />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
