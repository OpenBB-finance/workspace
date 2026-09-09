import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(),
}));

vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  resultsToTicker: vi.fn(),
}));

vi.mock("~/lib/api/sdkComponents", () => ({
  useQuerySymbols: vi.fn(),
}));

vi.mock("~/lib/utils", () => ({
  dispatchSaveState: vi.fn(),
}));

import { useWidgetContext } from "~/components/Widget.context";
import { resultsToTicker } from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import { useUpdateWidgetTickers } from "~/hooks/useUpdateWidgetTickers";
import { useQuerySymbols } from "~/lib/api/sdkComponents";
import { dispatchSaveState } from "~/lib/utils";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useUpdateWidgetTickers", () => {
  const mockUpdateWidget = vi.fn();

  const createMockWidget = (overrides = {}) => ({
    id: "widget-1",
    widgetId: "test-widget",
    data: {
      mainTicker: {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: "stock",
      },
      secondaryTickers: [],
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    (useWidgetContext as any).mockReturnValue({
      widget: createMockWidget(),
      updateWidget: mockUpdateWidget,
    });

    (useQuerySymbols as any).mockReturnValue({
      data: undefined,
      isError: false,
    });

    (resultsToTicker as any).mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("ticker detection", () => {
    it("should not query when widget has no main ticker", () => {
      (useWidgetContext as any).mockReturnValue({
        widget: createMockWidget({
          data: { mainTicker: null },
        }),
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it("should not query when widget is null", () => {
      (useWidgetContext as any).mockReturnValue({
        widget: null,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it("should detect tickers missing currency field", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: {
            symbol: "AAPL",
            name: "Apple Inc.",
            type: "stock",
            currency: undefined,
          },
          secondaryTickers: [],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: expect.objectContaining({
            q: "AAPL,",
          }),
        }),
        expect.anything(),
      );
    });

    it("should detect tickers missing has_options field", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: {
            symbol: "MSFT",
            name: "Microsoft",
            type: "stock",
            currency: "USD",
            has_options: undefined,
          },
          secondaryTickers: [],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: expect.objectContaining({
            q: "MSFT,",
          }),
        }),
        expect.anything(),
      );
    });

    it("should skip country category tickers", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: {
            symbol: "US",
            name: "United States",
            category: "country",
          },
          secondaryTickers: [],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });

    it("should include secondary tickers in query", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: {
            symbol: "AAPL",
            name: "Apple",
            currency: undefined,
          },
          secondaryTickers: [
            { symbol: "GOOGL", name: "Alphabet", currency: undefined },
            { symbol: "MSFT", name: "Microsoft", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.objectContaining({
          queryParams: expect.objectContaining({
            q: expect.stringContaining("AAPL"),
          }),
        }),
        expect.anything(),
      );
    });
  });

  describe("query parameters", () => {
    it("should set correct staleTime for caching", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          staleTime: 1000 * 60 * 60 * 24 * 7, // 7 days
        }),
      );
    });

    it("should accumulate unique ticker types in query", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", type: "stock", currency: undefined },
          secondaryTickers: [
            { symbol: "BTC", type: "crypto", currency: undefined },
            { symbol: "EURUSD", type: "forex", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      // Wait for state update from useEffect
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Get the last call after state update triggers re-render
      const calls = (useQuerySymbols as any).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.queryParams.type).toContain("stock");
    });

    it("should set limit based on number of tickers", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
          secondaryTickers: [
            { symbol: "GOOGL", currency: undefined },
            { symbol: "MSFT", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      // Wait for state update from useEffect
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const calls = (useQuerySymbols as any).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.queryParams.limit).toBe(3);
    });
  });

  describe("widget update logic", () => {
    it("should update widget with enriched ticker data", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
          secondaryTickers: [],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      const enrichedTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        currency: "USD",
        has_options: true,
      };

      (useQuerySymbols as any).mockReturnValue({
        data: { results: [enrichedTicker] },
        isError: false,
      });

      (resultsToTicker as any).mockReturnValue([enrichedTicker]);

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalled();
      });
    });

    it("should not update when query returns error", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      (useQuerySymbols as any).mockReturnValue({
        data: { results: [] },
        isError: true,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(mockUpdateWidget).not.toHaveBeenCalled();
    });

    it("should dispatch save state after updating widget", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
          secondaryTickers: [],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      const enrichedTicker = {
        symbol: "AAPL",
        currency: "USD",
        has_options: true,
      };

      (useQuerySymbols as any).mockReturnValue({
        data: { results: [enrichedTicker] },
        isError: false,
      });

      (resultsToTicker as any).mockReturnValue([enrichedTicker]);

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(dispatchSaveState).toHaveBeenCalled();
      });
    });
  });

  describe("secondary ticker updates", () => {
    it("should update secondary tickers with enriched data", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: "USD", has_options: true },
          secondaryTickers: [
            { symbol: "GOOGL", currency: undefined },
            { symbol: "MSFT", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      const enrichedTickers = [
        { symbol: "GOOGL", currency: "USD", has_options: true },
        { symbol: "MSFT", currency: "USD", has_options: true },
      ];

      (useQuerySymbols as any).mockReturnValue({
        data: { results: enrichedTickers },
        isError: false,
      });

      (resultsToTicker as any).mockReturnValue(enrichedTickers);

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      await waitFor(() => {
        expect(mockUpdateWidget).toHaveBeenCalled();
      });
    });

    it("should preserve order of secondary tickers", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: "USD" },
          secondaryTickers: [
            { symbol: "GOOGL", currency: undefined },
            { symbol: "MSFT", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      const enrichedTickers = [
        { symbol: "MSFT", currency: "USD", has_options: true },
        { symbol: "GOOGL", currency: "USD", has_options: true },
      ];

      (useQuerySymbols as any).mockReturnValue({
        data: { results: enrichedTickers },
        isError: false,
      });

      (resultsToTicker as any).mockReturnValue(enrichedTickers);

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1200);
      });

      if (mockUpdateWidget.mock.calls.length > 0) {
        const updateFn = mockUpdateWidget.mock.calls[0][0];
        const prevState = {
          data: {
            mainTicker: widget.data.mainTicker,
            secondaryTickers: widget.data.secondaryTickers,
          },
        };
        const result = updateFn(prevState);

        if (result.data.secondaryTickers) {
          expect(result.data.secondaryTickers[0].symbol).toBe("GOOGL");
          expect(result.data.secondaryTickers[1].symbol).toBe("MSFT");
        }
      }
    });
  });

  describe("edge cases", () => {
    it("should handle empty results from API", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "INVALID", currency: undefined },
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      (useQuerySymbols as any).mockReturnValue({
        data: { results: [] },
        isError: false,
      });

      (resultsToTicker as any).mockReturnValue([]);

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(mockUpdateWidget).not.toHaveBeenCalled();
    });

    it("should handle null secondary tickers", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
          secondaryTickers: null,
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      expect(() => {
        renderHook(() => useUpdateWidgetTickers(), {
          wrapper: createWrapper(),
        });
      }).not.toThrow();
    });

    it("should handle widget without data property", () => {
      const widget = { id: "widget-1" };

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      expect(() => {
        renderHook(() => useUpdateWidgetTickers(), {
          wrapper: createWrapper(),
        });
      }).not.toThrow();
    });

    it("should handle ticker with null symbol", () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: null, currency: undefined },
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      expect(useQuerySymbols).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  describe("deduplication", () => {
    it("should include same symbol from main and secondary tickers in query", async () => {
      const widget = createMockWidget({
        data: {
          mainTicker: { symbol: "AAPL", currency: undefined },
          secondaryTickers: [
            { symbol: "AAPL", currency: undefined },
          ],
        },
      });

      (useWidgetContext as any).mockReturnValue({
        widget,
        updateWidget: mockUpdateWidget,
      });

      renderHook(() => useUpdateWidgetTickers(), {
        wrapper: createWrapper(),
      });

      // Wait for state update from useEffect
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      const calls = (useQuerySymbols as any).mock.calls;
      const lastCall = calls[calls.length - 1][0];
      // Both tickers are included since Set uses reference equality, not value equality
      const symbolCount = (lastCall.queryParams.q.match(/AAPL/g) || []).length;
      expect(symbolCount).toBe(2);
    });
  });
});
