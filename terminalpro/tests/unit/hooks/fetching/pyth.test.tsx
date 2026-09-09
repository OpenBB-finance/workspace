import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoricalPrices } from "~/hooks/fetching/pyth/useHistoricalPrices";
import { usePythPriceMetadata } from "~/hooks/fetching/pyth/usePythPriceMetadata";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("Pyth Fetching Hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useHistoricalPrices", () => {
    it("fetches historical prices successfully", async () => {
      const mockData = [
        {
          symbol: "BTC/USD",
          hour_price_diff_decimal: 0.01,
          day_price_diff_decimal: 0.05,
          week_price_diff_decimal: 0.1,
          sparkline: [100, 101, 102],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const { result } = renderHook(() => useHistoricalPrices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockData);
    });

    it("handles fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useHistoricalPrices(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Network response was not ok");
    });
  });

  describe("usePythPriceMetadata", () => {
    it("fetches and transforms price metadata successfully", async () => {
      const mockApiResponse = {
        category1: {
          product1: {
            attrs: {
              symbol: "BTC/USD",
              asset_type: "Crypto",
              base: "BTC",
              description: "Bitcoin",
              display_symbol: "BTC/USD",
              quote_currency: "USD",
              schedule: "24/7",
            },
            price_account_keys: ["feedId123"],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockApiResponse),
      });

      const { result } = renderHook(() => usePythPriceMetadata(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual({
        "BTC/USD": { feedId: "feedId123" },
      });
    });

    it("handles fetch error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => usePythPriceMetadata(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Failed to fetch Pyth price metadata");
    });
  });
});
