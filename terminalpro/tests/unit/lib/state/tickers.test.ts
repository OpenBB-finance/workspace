/**
 * Tests for tickers Zustand store
 *
 * Tests the tickers state management including:
 * - Ticker caching
 * - Query ticker functionality
 * - Cache retrieval
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTickersStore, type TickersState } from "~/lib/state/tickers";

// Mock the API call
vi.mock("~/lib/api/sdkComponents", () => ({
  fetchPostSymbols: vi.fn().mockResolvedValue({
    results: [
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      },
    ],
  }),
}));

// Mock the resultsToTicker helper
vi.mock("~/components/Widgets/Helpers/AdvancedSelectTicker", () => ({
  resultsToTicker: (results: any[]) =>
    results.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      exchangeShortName: r.exchangeShortName,
      type: r.type,
    })),
}));

describe("createTickersStore", () => {
  let tickersStore: ReturnType<typeof createTickersStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    tickersStore = createTickersStore();
  });

  describe("initial state", () => {
    it("should have empty cached tickers initially", () => {
      const state = tickersStore.getState();
      expect(state.cachedTickers).toEqual({});
    });
  });

  describe("getCachedTickers", () => {
    it("should return empty object when no cached tickers exist", () => {
      const result = tickersStore.getState().getCachedTickers("AAPL");
      expect(result).toEqual({});
    });

    it("should return cached ticker when it exists", () => {
      const mockTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { AAPL: mockTicker as any },
        });
      });

      const result = tickersStore.getState().getCachedTickers("AAPL");
      expect(result).toEqual({ AAPL: mockTicker });
    });

    it("should return multiple cached tickers", () => {
      const mockTickers = {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
        MSFT: {
          symbol: "MSFT",
          name: "Microsoft Corporation",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: mockTickers as any,
        });
      });

      const result = tickersStore.getState().getCachedTickers(["AAPL", "MSFT"]);
      expect(result).toEqual(mockTickers);
    });

    it("should only return cached tickers that exist", () => {
      const mockTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { AAPL: mockTicker as any },
        });
      });

      const result = tickersStore.getState().getCachedTickers(["AAPL", "MSFT"]);
      expect(result).toEqual({ AAPL: mockTicker });
    });

    it("should handle string input for single ticker", () => {
      const mockTicker = {
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { GOOGL: mockTicker as any },
        });
      });

      const result = tickersStore.getState().getCachedTickers("GOOGL");
      expect(result).toEqual({ GOOGL: mockTicker });
    });
  });

  describe("queryTickers", () => {
    it("should return cached tickers without making API call when all tickers are cached", async () => {
      const mockTickers = {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: mockTickers as any,
        });
      });

      const result = await tickersStore.getState().queryTickers({
        tickers: ["AAPL"],
      });

      expect(result).toEqual(mockTickers);
    });

    it("should call setCallback with all tickers when provided", async () => {
      const mockCallback = vi.fn();
      const mockTickers = {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: mockTickers as any,
        });
      });

      await tickersStore.getState().queryTickers({
        tickers: ["AAPL"],
        setCallback: mockCallback,
      });

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe("getOrQueryTickers", () => {
    it("should return cached tickers without making API call", async () => {
      const mockTickers = {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
        MSFT: {
          symbol: "MSFT",
          name: "Microsoft Corporation",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: mockTickers as any,
        });
      });

      const result = await tickersStore.getState().getOrQueryTickers(["AAPL", "MSFT"]);

      expect(result).toEqual(mockTickers);
    });

    it("should handle string input for single ticker", async () => {
      const mockTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { AAPL: mockTicker as any },
        });
      });

      const result = await tickersStore.getState().getOrQueryTickers("AAPL");

      expect(result).toEqual({ AAPL: mockTicker });
    });

    it("should call setCallback with all tickers", async () => {
      const mockCallback = vi.fn();
      const mockTickers = {
        AAPL: {
          symbol: "AAPL",
          name: "Apple Inc.",
          exchange: "NASDAQ",
          exchangeShortName: "NASDAQ",
          type: "stock",
        },
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: mockTickers as any,
        });
      });

      await tickersStore.getState().getOrQueryTickers(["AAPL"], {
        setCallback: mockCallback,
      });

      expect(mockCallback).toHaveBeenCalledWith([mockTickers.AAPL]);
    });

    it("should merge cached and fetched tickers", async () => {
      const cachedTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { AAPL: cachedTicker as any },
        });
      });

      const result = await tickersStore.getState().getOrQueryTickers(["AAPL", "MSFT"]);

      // AAPL should come from cache, MSFT from API
      expect(result.AAPL).toEqual(cachedTicker);
      expect(result.MSFT).toBeDefined();
    });
  });

  describe("cache behavior", () => {
    it("should not duplicate cached tickers when querying same ticker multiple times", async () => {
      const mockTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        exchangeShortName: "NASDAQ",
        type: "stock",
      };

      act(() => {
        tickersStore.setState({
          cachedTickers: { AAPL: mockTicker as any },
        });
      });

      // Query multiple times
      await tickersStore.getState().getOrQueryTickers(["AAPL"]);
      await tickersStore.getState().getOrQueryTickers(["AAPL"]);
      await tickersStore.getState().getOrQueryTickers(["AAPL"]);

      const cached = tickersStore.getState().cachedTickers;
      expect(Object.keys(cached)).toHaveLength(1);
      expect(cached.AAPL).toEqual(mockTicker);
    });

    it("should update cache after fetching new tickers", async () => {
      expect(tickersStore.getState().cachedTickers).toEqual({});

      await tickersStore.getState().getOrQueryTickers(["AAPL", "MSFT"]);

      const cached = tickersStore.getState().cachedTickers;
      expect(cached.AAPL).toBeDefined();
      expect(cached.MSFT).toBeDefined();
    });
  });
});
