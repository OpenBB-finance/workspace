import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/api/auth.api", () => ({
  isValidMainTicker: vi.fn(),
  migrateDefaultTicker: vi.fn(),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(),
}));

vi.mock("~/routes/settings", () => ({
  useSaveSettings: vi.fn(),
}));

import { isValidMainTicker, migrateDefaultTicker } from "~/api/auth.api";
import { useUpdateDefaultTicker } from "~/hooks/useUpdateDefaultTicker";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useSaveSettings } from "~/routes/settings";

describe("useUpdateDefaultTicker", () => {
  const mockSetDefaultTicker = vi.fn();
  const mockDefaultTicker = {
    symbol: "AAPL",
    name: "Apple Inc.",
    type: "stock",
    currency: "USD",
    has_options: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useShallowThemeStore as any).mockImplementation(
      (selector: (state: any) => any) =>
        selector({
          defaultTicker: mockDefaultTicker,
          setDefaultTicker: mockSetDefaultTicker,
        }),
    );

    (isValidMainTicker as any).mockReturnValue(true);
    (migrateDefaultTicker as any).mockResolvedValue(mockDefaultTicker);
    (useSaveSettings as any).mockReturnValue(undefined);
  });

  describe("valid ticker handling", () => {
    it("should not migrate when ticker is valid", async () => {
      (isValidMainTicker as any).mockReturnValue(true);

      renderHook(() => useUpdateDefaultTicker());

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(isValidMainTicker).toHaveBeenCalledWith(mockDefaultTicker);
      expect(migrateDefaultTicker).not.toHaveBeenCalled();
      expect(mockSetDefaultTicker).not.toHaveBeenCalled();
    });
  });

  describe("invalid ticker handling", () => {
    it("should migrate when ticker is invalid", async () => {
      const newTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: "stock",
        currency: "USD",
        has_options: true,
      };

      (isValidMainTicker as any).mockReturnValue(false);
      (migrateDefaultTicker as any).mockResolvedValue(newTicker);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(mockDefaultTicker);
      });

      await waitFor(() => {
        expect(mockSetDefaultTicker).toHaveBeenCalledWith(newTicker);
      });
    });

    it("should migrate when ticker is missing required fields", async () => {
      const incompleteTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
      };

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: incompleteTicker,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(false);

      const completeTicker = {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: "stock",
        currency: "USD",
        has_options: true,
      };

      (migrateDefaultTicker as any).mockResolvedValue(completeTicker);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(incompleteTicker);
        expect(mockSetDefaultTicker).toHaveBeenCalledWith(completeTicker);
      });
    });
  });

  describe("useSaveSettings integration", () => {
    it("should call useSaveSettings with false", () => {
      renderHook(() => useUpdateDefaultTicker());

      expect(useSaveSettings).toHaveBeenCalledWith(false);
    });
  });

  describe("effect behavior", () => {
    it("should only run effect once on mount", async () => {
      (isValidMainTicker as any).mockReturnValue(false);

      const { rerender } = renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledTimes(1);
      });

      rerender();

      expect(migrateDefaultTicker).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    it("should handle null defaultTicker", async () => {
      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: null,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(false);
      (migrateDefaultTicker as any).mockResolvedValue(mockDefaultTicker);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(null);
      });
    });

    it("should handle undefined defaultTicker", async () => {
      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: undefined,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(false);
      (migrateDefaultTicker as any).mockResolvedValue(mockDefaultTicker);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(undefined);
      });
    });

    it("should handle migration promise rejection gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      (isValidMainTicker as any).mockReturnValue(false);
      const rejectionError = new Error("Migration failed");
      (migrateDefaultTicker as any).mockRejectedValue(rejectionError);

      expect(() => {
        renderHook(() => useUpdateDefaultTicker());
      }).not.toThrow();

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to migrate default ticker:",
          rejectionError,
        );
      });

      expect(mockSetDefaultTicker).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("ticker validation scenarios", () => {
    it("should validate ticker with all required fields present", () => {
      const validTicker = {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        type: "stock",
        currency: "USD",
        has_options: true,
      };

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: validTicker,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(true);

      renderHook(() => useUpdateDefaultTicker());

      expect(isValidMainTicker).toHaveBeenCalledWith(validTicker);
    });

    it("should detect ticker missing currency field", async () => {
      const tickerMissingCurrency = {
        symbol: "GOOGL",
        name: "Alphabet Inc.",
        type: "stock",
        has_options: true,
      };

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: tickerMissingCurrency,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(false);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(tickerMissingCurrency);
      });
    });

    it("should detect ticker missing has_options field", async () => {
      const tickerMissingOptions = {
        symbol: "TSLA",
        name: "Tesla, Inc.",
        type: "stock",
        currency: "USD",
      };

      (useShallowThemeStore as any).mockImplementation(
        (selector: (state: any) => any) =>
          selector({
            defaultTicker: tickerMissingOptions,
            setDefaultTicker: mockSetDefaultTicker,
          }),
      );

      (isValidMainTicker as any).mockReturnValue(false);

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(migrateDefaultTicker).toHaveBeenCalledWith(tickerMissingOptions);
      });
    });
  });

  describe("async migration flow", () => {
    it("should wait for migration to complete before setting ticker", async () => {
      const callOrder: string[] = [];

      (isValidMainTicker as any).mockReturnValue(false);
      (migrateDefaultTicker as any).mockImplementation(() => {
        callOrder.push("migrate");
        return Promise.resolve(mockDefaultTicker);
      });

      mockSetDefaultTicker.mockImplementation(() => {
        callOrder.push("setTicker");
      });

      renderHook(() => useUpdateDefaultTicker());

      await waitFor(() => {
        expect(callOrder).toEqual(["migrate", "setTicker"]);
      });
    });
  });
});
