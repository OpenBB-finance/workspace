/**
 * Context Mocks
 *
 * Mocks for React contexts used throughout the application.
 * These provide sensible defaults for tests that don't need to test context behavior.
 */
import { vi } from "vitest";

// CachedTickers context - provides ticker data caching
vi.mock("~/lib/contexts/CachedTickers", () => ({
  useTickersContext: () => ({
    tickers: {},
    setTicker: vi.fn(),
    getTicker: vi.fn(() => ({ symbol: "AAPL", name: "Apple Inc." })),
  }),
  TickersProvider: ({ children }: any) => children,
}));
