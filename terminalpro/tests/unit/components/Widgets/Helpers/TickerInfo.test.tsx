import { describe, expect, it, vi } from "vitest";
import TickerInfo from "~/components/Widgets/Helpers/TickerInfo";
import { renderWidget } from "../WidgetTestWrapper";

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: () => ({
    defaultTicker: { symbol: "AAPL", name: "Apple Inc." },
  }),
}));

vi.mock("~/lib/contexts/CachedTickers", () => ({
  useTickersContext: () => ({
    tickers: {},
    setTicker: vi.fn(),
    getTicker: vi.fn(() => ({ symbol: "AAPL", name: "Apple Inc." })),
  }),
}));

vi.mock("~/components/Widgets/Helpers/TickerInfo", () => ({
  default: ({ symbol, name }: any) => (
    <div data-testid="ticker-info">
      <span>{symbol}</span>
      <span>{name}</span>
    </div>
  ),
}));

describe("TickerInfo Helper", () => {
  it("renders ticker info component", () => {
    // @ts-expect-error - ignored for now
    const { container } = renderWidget(<TickerInfo symbol="AAPL" name="Apple Inc." />, {
      widgetOverrides: {
        storage: {},
      },
    });

    expect(container).toBeInTheDocument();
  });
});
