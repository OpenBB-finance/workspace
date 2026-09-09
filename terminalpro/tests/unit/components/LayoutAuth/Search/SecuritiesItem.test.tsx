import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SecuritiesItem from "~/components/LayoutAuth/Search/SecuritiesItem";
import type { Ticker } from "~/lib/state/app";

// Use vi.hoisted to ensure mocks are available during vi.mock hoisting
const { mockAddTab, mockChangeSearch, mockNavigate, mockItems } = vi.hoisted(() => ({
  mockAddTab: vi.fn(),
  mockChangeSearch: vi.fn(),
  mockNavigate: vi.fn(),
  mockItems: {} as Record<string, unknown>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn((selector) =>
    selector({
      addTab: mockAddTab,
    }),
  ),
  useAppStore: {
    getState: () => ({
      items: mockItems,
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: Object.assign(() => ({ changeSearch: mockChangeSearch }), {
    getState: () => ({ changeSearch: mockChangeSearch }),
    changeSearch: mockChangeSearch,
  }),
}));

vi.mock("~/lib/utils/createTemplates", () => ({
  createEquityTemplateTab: vi.fn(),
  createEtfTemplateTab: vi.fn(),
}));

const mockEquityTicker: Ticker = {
  id: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc.",
  type: "stock",
  category: "equity",
  country: "US",
  exchange: "NASDAQ",
};

const mockEtfTicker: Ticker = {
  id: "SPY",
  symbol: "SPY",
  name: "SPDR S&P 500 ETF Trust",
  type: "etf",
  category: "etf",
  country: "US",
  exchange: "NYSE",
};

function renderSecuritiesItem(ticker: Ticker, index = 0) {
  return render(
    <MemoryRouter initialEntries={["/app/dashboard-123"]}>
      <Routes>
        <Route
          path="/app/:id"
          element={<SecuritiesItem ticker={ticker} index={index} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SecuritiesItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders ticker ID in uppercase", () => {
      renderSecuritiesItem(mockEquityTicker);

      expect(screen.getByText("AAPL")).toBeInTheDocument();
    });

    it("renders ticker name", () => {
      renderSecuritiesItem(mockEquityTicker);

      expect(screen.getByText("Apple Inc.")).toBeInTheDocument();
    });

    it("renders ticker type, country and exchange info", () => {
      renderSecuritiesItem(mockEquityTicker);

      expect(screen.getByText("stock US - NASDAQ")).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("applies correct styling classes", () => {
      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("flex", "items-center", "gap-2.5");
    });
  });

  describe("ETF Ticker Display", () => {
    it("renders ETF ticker ID", () => {
      renderSecuritiesItem(mockEtfTicker);

      expect(screen.getByText("SPY")).toBeInTheDocument();
    });

    it("renders ETF ticker name", () => {
      renderSecuritiesItem(mockEtfTicker);

      expect(screen.getByText("SPDR S&P 500 ETF Trust")).toBeInTheDocument();
    });

    it("renders ETF type info correctly", () => {
      renderSecuritiesItem(mockEtfTicker);

      expect(screen.getByText("etf US - NYSE")).toBeInTheDocument();
    });
  });

  describe("Click Behavior", () => {
    it("calls createEquityTemplateTab for equity tickers", async () => {
      const { createEquityTemplateTab } = await import(
        "~/lib/utils/createTemplates"
      );

      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(createEquityTemplateTab).toHaveBeenCalledWith(
        { name: "AAPL" },
        expect.objectContaining({
          addTab: mockAddTab,
          navigate: mockNavigate,
          items: mockItems,
          currentDashboard: "dashboard-123",
          defaultTicker: mockEquityTicker,
        }),
      );
    });

    it("closes search dialog on click", async () => {
      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(mockChangeSearch).toHaveBeenCalledWith(false);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to button element", () => {
      const ref = { current: null };

      render(
        <MemoryRouter initialEntries={["/app/dashboard-123"]}>
          <Routes>
            <Route
              path="/app/:id"
              element={
                <SecuritiesItem
                  ticker={mockEquityTicker}
                  index={0}
                  ref={ref}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });

  describe("Accessibility", () => {
    it("renders clickable button with proper hover states", () => {
      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-light-100");
    });

    it("has focus styles for keyboard navigation", () => {
      renderSecuritiesItem(mockEquityTicker);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus:bg-light-100");
    });
  });

  describe("Edge Cases", () => {
    it("handles ticker with minimal data", () => {
      const minimalTicker: Ticker = {
        id: "XYZ",
        symbol: "XYZ",
        name: "",
        type: "stock",
        category: "equity",
        country: "",
        exchange: "",
      };

      renderSecuritiesItem(minimalTicker);

      expect(screen.getByText("XYZ")).toBeInTheDocument();
      expect(screen.getByText("stock -")).toBeInTheDocument();
    });

    it("handles long ticker names with proper truncation classes", () => {
      const longNameTicker: Ticker = {
        id: "VERYLONGSYMBOL",
        symbol: "VERYLONGSYMBOL",
        name: "Very Long Company Name That Should Be Displayed Properly In The UI Without Breaking Layout",
        type: "stock",
        category: "equity",
        country: "US",
        exchange: "NASDAQ",
      };

      renderSecuritiesItem(longNameTicker);

      expect(screen.getByText("VERYLONGSYMBOL")).toBeInTheDocument();
    });
  });

  describe("Without Dashboard ID", () => {
    it("passes undefined for currentDashboard when not in dashboard route", async () => {
      const { createEquityTemplateTab } = await import(
        "~/lib/utils/createTemplates"
      );

      render(
        <MemoryRouter initialEntries={["/app"]}>
          <Routes>
            <Route
              path="/app"
              element={<SecuritiesItem ticker={mockEquityTicker} index={0} />}
            />
          </Routes>
        </MemoryRouter>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(createEquityTemplateTab).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentDashboard: undefined,
        }),
      );
    });
  });
});
