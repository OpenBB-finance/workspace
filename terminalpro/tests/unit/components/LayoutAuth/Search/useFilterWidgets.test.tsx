import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFilterWidgets } from "~/components/LayoutAuth/Search/hooks/useFilterWidgets";
import type { SearchDialogState } from "~/components/LayoutAuth/Search/SearchDialog";

vi.mock("~/lib/onPremFeatureFlags", () => ({
  getAllowedDataVendors: () => ["openbb", "fmp", "intrinio"],
}));

vi.mock("~/lib/widget_bundles.json", () => ({
  default: {
    openbb: {
      widgets: ["stock_chart", "earnings_calendar", "price_target"],
    },
    premium: {
      widgets: ["advanced_analytics", "portfolio_optimizer"],
    },
  },
}));

const createMockWidget = (overrides = {}) => ({
  widgetId: `widget-${Math.random().toString(36).substr(2, 9)}`,
  uniqueId: `unique-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Widget",
  category: "Equity",
  subCategory: "Charts",
  description: "A test widget",
  source: "openbb",
  external: false,
  supportedAssetClasses: [],
  ...overrides,
});

const defaultState: SearchDialogState = {
  selectedWidgets: [],
  selectedCategory: "All",
  selectedOption: "all",
  isShiftPressed: false,
  anchorWidgetId: null,
};

describe("useFilterWidgets", () => {
  describe("Basic Filtering", () => {
    it("returns all widgets when category is All and no options selected", () => {
      const widgets = [
        createMockWidget({ widgetId: "stock_chart", name: "Stock Chart" }),
        createMockWidget({
          widgetId: "earnings_calendar",
          name: "Earnings Calendar",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current.length).toBe(2);
    });

    it("filters widgets by selected category", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Equity",
          name: "Stock Chart",
        }),
        createMockWidget({
          widgetId: "bond_tracker",
          category: "Economy",
          name: "Bond Tracker",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedCategory: "Equity",
        }),
      );

      expect(result.current.length).toBe(1);
      expect(result.current[0].name).toBe("Stock Chart");
    });

    it("returns empty array when no widgets match category", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Equity",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedCategory: "Currency",
        }),
      );

      expect(result.current.length).toBe(0);
    });
  });

  describe("External Widget Filtering", () => {
    it("includes external widgets when external option is selected", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          external: false,
        }),
        createMockWidget({
          widgetId: "custom_widget",
          external: true,
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedOption: "external",
        }),
      );

      expect(result.current.some((w) => w.external === true)).toBe(true);
    });

    it("includes external widgets when no options are selected", () => {
      const widgets = [
        createMockWidget({
          widgetId: "custom_widget",
          external: true,
          category: "Others",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current.some((w) => w.external === true)).toBe(true);
    });
  });

  describe("Shared Widget Filtering", () => {
    it("includes shared files when shared option is selected", () => {
      const widgets = [
        createMockWidget({
          widgetId: "shared_file_1",
          category: "shared files",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedOption: "shared",
        }),
      );

      expect(
        result.current.some(
          (w) => w.category?.toLowerCase() === "shared files",
        ),
      ).toBe(true);
    });

    it("includes shared backends when shared option is selected", () => {
      const widgets = [
        createMockWidget({
          widgetId: "shared_backend_1",
          category: "shared backends",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedOption: "shared",
        }),
      );

      expect(
        result.current.some(
          (w) => w.category?.toLowerCase() === "shared backends",
        ),
      ).toBe(true);
    });
  });

  describe("Asset Class Handling", () => {
    it("creates multiple entries for widgets with multiple supported asset classes", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          name: "Multi-Asset Chart",
          supportedAssetClasses: ["equity", "etf"],
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current.some((w) => w.category === "equity")).toBe(true);
      expect(result.current.some((w) => w.category === "etf")).toBe(true);
    });

    it("uses original category for widgets with only all asset class", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          name: "Universal Chart",
          category: "Equity",
          supportedAssetClasses: ["all"],
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].category.toLowerCase()).toBe("equity");
    });
  });

  describe("Category Normalization", () => {
    it("normalizes Others category to my data for external widgets", () => {
      const widgets = [
        createMockWidget({
          widgetId: "custom_widget",
          category: "Others",
          external: true,
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].category).toBe("my data");
    });

    it("keeps Others category for non-external widgets", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Others",
          external: false,
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].category.toLowerCase()).toBe("others");
    });
  });

  describe("Sorting", () => {
    it("sorts widgets by category first", () => {
      const widgets = [
        createMockWidget({
          widgetId: "price_target",
          category: "Equity",
          name: "Widget A",
        }),
        createMockWidget({
          widgetId: "stock_chart",
          category: "Currency",
          name: "Widget B",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].category.toLowerCase()).toBe("currency");
      expect(result.current[1].category.toLowerCase()).toBe("equity");
    });

    it("sorts by subcategory within same category", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Equity",
          subCategory: "Zebra",
          name: "Widget A",
        }),
        createMockWidget({
          widgetId: "earnings_calendar",
          category: "Equity",
          subCategory: "Alpha",
          name: "Widget B",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].subCategory).toBe("Alpha");
      expect(result.current[1].subCategory).toBe("Zebra");
    });

    it("sorts alphabetically by name within same subcategory", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Equity",
          subCategory: "Charts",
          name: "Zebra Widget",
        }),
        createMockWidget({
          widgetId: "earnings_calendar",
          category: "Equity",
          subCategory: "Charts",
          name: "Alpha Widget",
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      expect(result.current[0].name).toBe("Alpha Widget");
      expect(result.current[1].name).toBe("Zebra Widget");
    });
  });

  describe("Others Category Special Handling", () => {
    it("includes my data widgets when Others category is selected", () => {
      const widgets = [
        createMockWidget({
          widgetId: "custom_widget",
          category: "Others",
          external: true,
        }),
      ];

      const { result } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, {
          ...defaultState,
          selectedCategory: "Others",
        }),
      );

      expect(result.current.length).toBe(1);
    });
  });

  describe("Memoization", () => {
    it("returns same reference when inputs do not change", () => {
      const widgets = [
        createMockWidget({ widgetId: "stock_chart" }),
      ];

      const { result, rerender } = renderHook(() =>
        // @ts-expect-error - ignored for now
        useFilterWidgets(widgets, defaultState),
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
    });

    it("returns new reference when selectedCategory changes", () => {
      const widgets = [
        createMockWidget({
          widgetId: "stock_chart",
          category: "Equity",
        }),
      ];

      const { result, rerender } = renderHook(
        // @ts-expect-error - ignored for now
        ({ state }) => useFilterWidgets(widgets, state),
        { initialProps: { state: defaultState } },
      );

      const firstResult = result.current;

      rerender({
        state: { ...defaultState, selectedCategory: "Equity" },
      });

      const secondResult = result.current;

      expect(firstResult).not.toBe(secondResult);
    });
  });
});
