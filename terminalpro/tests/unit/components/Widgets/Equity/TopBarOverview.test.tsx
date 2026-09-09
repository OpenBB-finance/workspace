import { screen } from "@testing-library/react";
import { forwardRef } from "react";
import { describe, expect, it, vi } from "vitest";
import TopBarOverview from "~/components/Widgets/Equity/TopBarOverview";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
  SetLoadingOnResize: forwardRef(({ children }: any, _ref) => <>{children}</>),
  LoadingElement: () => <span data-testid="loading-element">Loading...</span>,
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: () => ({ defaultTicker: { symbol: "AAPL" } }),
}));

describe("TopBarOverview Widget", () => {
  it("renders top bar overview container", () => {
    renderWidget(<TopBarOverview />, {
      widgetOverrides: {
        storage: { securities: ["^SPX", "^DJI", "^IXIC"] },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});
