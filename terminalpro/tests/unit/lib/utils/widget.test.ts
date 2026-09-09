import { describe, expect, it, vi } from "vitest";
import type { WidgetT } from "~/components/types";
import type { Widget } from "~/lib/state/app";

const mockWidgets = vi.hoisted(() => ({
  test_widget: {
    widgetId: "test_widget",
    name: "Test Widget",
    type: "table",
    description: "A test widget",
    category: "Test",
    subCategory: "Unit",
    source: ["test_source"],
    supportedAssetClasses: ["equity", "etf"],
    params: [
      { paramName: "symbol", type: "ticker", value: "AAPL" },
      { paramName: "period", type: "text", value: "annual" },
    ],
    data: {
      table: {
        columnsDefs: [
          { field: "date", headerName: "Date" },
          { field: "value", headerName: "Value" },
        ],
      },
    },
  },
  another_widget: {
    widgetId: "another_widget",
    name: "Another Widget",
    type: "chart",
    source: "single_source",
    supportedAssetClasses: ["crypto"],
  },
  analyst_estimates: {
    widgetId: "analyst_estimates",
    name: "Analyst Estimates",
    type: "table",
  },
  widget_with_storage: {
    widgetId: "widget_with_storage",
    name: "Widget With Storage",
    type: "table",
    data: {
      table: {
        columnsDefs: [{ field: "default", headerName: "Default" }],
      },
    },
  },
  per_widget_test: {
    widgetId: "per_widget_test",
    name: "Per Widget Test",
    type: "table",
  },
  copilot_table: {
    widgetId: "copilot_table",
    name: "Copilot Table",
    type: "table",
  },
  charting: {
    widgetId: "charting",
    name: "Charting",
    type: "chart",
  },
  navigation_bar: {
    widgetId: "navigation_bar",
    name: "Navigation Bar",
    type: "table",
  },
  ticker_information: {
    widgetId: "ticker_information",
    name: "Ticker Information",
    type: "table",
  },
  company_profile: {
    widgetId: "company_profile",
    name: "Company Profile",
    type: "table",
  },
}));

vi.mock("~/lib/widgets.json", () => ({
  default: mockWidgets,
}));

vi.mock("~/lib/widget_bundles.json", () => ({
  default: {
    openbb: {
      widgets: ["test_widget", "another_widget"],
    },
  },
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useFeatureFlagsStore: {
    getState: () => ({
      featureFlags: {
        tier: "pro",
        data_bundle_info: {
          providers: ["test_source", "single_source"],
        },
      },
    }),
  },
  isExcludedWidgetId: () => false,
}));

vi.mock("~/lib/templates", () => ({
  TEMPLATES: {},
}));

vi.mock("~/hooks/useAllTemplates", () => ({
  useAllTemplates: () => [],
}));

import {
  DEFAULT_TICKER_EXCHANGE,
  extractColumns,
  getCleanWidgetId,
  getJsonColDefs,
  getJsonWidget,
  getSupportedAssetClasses,
  getUUIDFromWidgetId,
  getWidgetInfo,
  getWidgetSourceInfo,
  getWidgetsWithSupportedAssetClass,
  groupParamOverride,
  isSSRMType,
  METADATA_WIDGETS,
  processWidgetId,
  US_EXCHANGES,
  WIDGETS_CONNECTION_TYPES,
} from "~/lib/utils/widget";

describe("Widget Utility Functions", () => {
  describe("getJsonWidget", () => {
    it("should return widget data when passed a valid widget ID string", () => {
      const result = getJsonWidget("test_widget" as any);
      expect(result).not.toBeNull();
      expect(result?.widgetId).toBe("test_widget");
      expect(result?.name).toBe("Test Widget");
    });

    it("should return null for non-existent widget ID", () => {
      const result = getJsonWidget("non_existent_widget" as any);
      expect(result).toBeNull();
    });

    it("should return widget data when passed a widget object with widgetId", () => {
      // @ts-expect-error - ignored for now
      const widgetObj = { widgetId: "test_widget" } as Partial<Widget>;
      const result = getJsonWidget(widgetObj as any);
      expect(result).not.toBeNull();
      expect(result?.widgetId).toBe("test_widget");
    });

    it("should return the widget object itself if widgetId not found in WIDGETS", () => {
      // @ts-expect-error - ignored for now
      const customWidget = {
        widgetId: "custom_external",
        name: "Custom External Widget",
        external: true,
      } as Partial<Widget>;
      const result = getJsonWidget(customWidget as any);
      expect(result?.widgetId).toBe("custom_external");
      expect(result?.name).toBe("Custom External Widget");
    });

    it("should return a deep clone, not the original object", () => {
      const result1 = getJsonWidget("test_widget" as any);
      const result2 = getJsonWidget("test_widget" as any);
      expect(result1).not.toBe(result2);
      if (result1 && result2) {
        result1.name = "Modified";
        expect(result2.name).toBe("Test Widget");
      }
    });
  });

  describe("getSupportedAssetClasses", () => {
    it("should return supported asset classes for a valid widget", () => {
      const result = getSupportedAssetClasses("test_widget");
      expect(result).toEqual(["equity", "etf"]);
    });

    it("should return empty array for widget without supported asset classes", () => {
      const result = getSupportedAssetClasses("non_existent" as any);
      expect(result).toEqual([]);
    });

    it("should return a deep clone of the array", () => {
      const result1 = getSupportedAssetClasses("test_widget");
      const result2 = getSupportedAssetClasses("test_widget");
      expect(result1).not.toBe(result2);
      result1.push("new_class");
      expect(result2).not.toContain("new_class");
    });
  });

  describe("getWidgetsWithSupportedAssetClass", () => {
    it("should return widgets that support a given asset class", () => {
      const result = getWidgetsWithSupportedAssetClass("equity");
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((w: any) => w.widgetId === "test_widget")).toBe(true);
    });

    it("should return only widget IDs when onlyIds is true", () => {
      const result = getWidgetsWithSupportedAssetClass("equity", true);
      expect(result).toContain("test_widget");
      expect(typeof result[0]).toBe("string");
    });

    it("should return empty array for unsupported asset class", () => {
      const result = getWidgetsWithSupportedAssetClass("forex");
      expect(result).toEqual([]);
    });
  });

  describe("getJsonColDefs", () => {
    it("should return column definitions for a valid widget ID", () => {
      const result = getJsonColDefs("test_widget" as any);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ field: "date", headerName: "Date" });
    });

    it("should return empty array for non-existent widget", () => {
      const result = getJsonColDefs("non_existent" as any);
      expect(result).toEqual([]);
    });

    it("should prioritize storage.columnDefs over widget.data.table.columnsDefs", () => {
      // @ts-expect-error - ignored for now
      const widgetWithStorage = {
        widgetId: "widget_with_storage",
        storage: {
          columnDefs: [{ field: "custom", headerName: "Custom" }],
        },
      } as Partial<Widget>;
      const result = getJsonColDefs(widgetWithStorage as any);
      expect(result).toEqual([{ field: "custom", headerName: "Custom" }]);
    });

    it("should use external widget data for external widgets", () => {
      const externalWidget = {
        widgetId: "external_widget",
        external: true,
        data: {
          table: {
            columnsDefs: [{ field: "external_col", headerName: "External" }],
          },
        },
      } as unknown as Partial<Widget>;
      const result = getJsonColDefs(externalWidget as any);
      expect(result).toEqual([{ field: "external_col", headerName: "External" }]);
    });

    it("should return empty array for null widget", () => {
      const result = getJsonColDefs(null as any);
      expect(result).toEqual([]);
    });
  });

  describe("isSSRMType", () => {
    it("should return true for ssrm_table type", () => {
      expect(isSSRMType("ssrm_table" as any)).toBe(true);
    });

    it("should return true for ssrm_advanced type", () => {
      expect(isSSRMType("ssrm_advanced" as any)).toBe(true);
    });

    it("should return false for regular table type", () => {
      expect(isSSRMType("table")).toBe(false);
    });

    it("should return false for chart type", () => {
      expect(isSSRMType("chart")).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isSSRMType(undefined)).toBe(false);
    });
  });

  describe("getWidgetSourceInfo", () => {
    it("should return source info for a widget", () => {
      const widget = {
        widgetId: "test_widget",
        sourceName: "Test Source",
        source: ["provider1"],
      } as unknown as Widget;
      const result = getWidgetSourceInfo(widget);
      expect(result.sourceName).toBe("Test Source");
    });

    it("should handle array source names", () => {
      const widget = {
        widgetId: "test_widget",
        sourceName: ["Source 1", "Source 2"],
        source: ["provider1"],
      } as unknown as Widget;
      const result = getWidgetSourceInfo(widget);
      expect(result.sourceName).toBe("Source 1, Source 2");
    });

    it("should handle null widget", () => {
      const result = getWidgetSourceInfo(null);
      expect(result.source).toBe("");
      expect(result.sourceName).toBe("");
    });
  });

  describe("getWidgetInfo", () => {
    it("should extract widget info fields", () => {
      const widget = {
        type: "table",
        name: "Test Widget",
        description: "A test",
        category: "Category",
        subCategory: "SubCategory",
        source: ["source1"],
      } as Partial<WidgetT>;
      const result = getWidgetInfo(widget);
      expect(result).toEqual({
        type: "table",
        name: "Test Widget",
        description: "A test",
        category: "Category",
        subCategory: "SubCategory",
        source: ["source1"],
      });
    });

    it("should handle partial widget with missing fields", () => {
      const widget = { type: "chart" } as Partial<WidgetT>;
      const result = getWidgetInfo(widget);
      expect(result.type).toBe("chart");
      expect(result.name).toBeUndefined();
    });
  });

  describe("extractColumns", () => {
    it("should extract column names from array of objects", () => {
      const data = [
        { name: "John", age: 30, city: "NYC" },
        { name: "Jane", age: 25, city: "LA" },
      ];
      const result = extractColumns(data);
      expect(result).toEqual(["name", "age", "city"]);
    });

    it("should return null for empty array", () => {
      expect(extractColumns([])).toBeNull();
    });

    it("should return null for non-array data", () => {
      expect(extractColumns({ key: "value" })).toBeNull();
      expect(extractColumns("string")).toBeNull();
      expect(extractColumns(123)).toBeNull();
    });

    it("should return null for null/undefined", () => {
      expect(extractColumns(null)).toBeNull();
      expect(extractColumns(undefined)).toBeNull();
    });

    it("should return null for array of primitives", () => {
      expect(extractColumns([1, 2, 3])).toBeNull();
      expect(extractColumns(["a", "b", "c"])).toBeNull();
    });

    it("should return null for array of arrays", () => {
      expect(
        extractColumns([
          [1, 2],
          [3, 4],
        ]),
      ).toBeNull();
    });

    it("should return null for object with no keys", () => {
      expect(extractColumns([{}])).toBeNull();
    });

    it("should use first row to determine columns", () => {
      const data = [
        { a: 1, b: 2 },
        { a: 3, b: 4, c: 5 },
      ];
      const result = extractColumns(data);
      expect(result).toEqual(["a", "b"]);
    });
  });

  describe("groupParamOverride", () => {
    it("should override period to fiscal_period for analyst_estimates", () => {
      const result = groupParamOverride("period", "analyst_estimates" as any);
      expect(result).toBe("fiscal_period");
    });

    it("should override fiscal_period to period when inverted", () => {
      const result = groupParamOverride(
        "fiscal_period",
        "analyst_estimates" as any,
        true,
      );
      expect(result).toBe("period");
    });

    it("should return original paramName for non-matching conditions", () => {
      expect(groupParamOverride("symbol", "analyst_estimates" as any)).toBe("symbol");
      expect(groupParamOverride("period", "other_widget" as any)).toBe("period");
    });
  });

  describe("getCleanWidgetId", () => {
    it("should clean file prefix", () => {
      expect(getCleanWidgetId("file-789")).toBe("ag_grid_file");
      expect(getCleanWidgetId("shared_file-abc")).toBe("ag_grid_file");
    });

    it("should clean iframe prefix", () => {
      expect(getCleanWidgetId("iframe-abc123")).toBe("iframe");
    });

    it("should clean rss_viewer prefix", () => {
      expect(getCleanWidgetId("rss_viewer-feed123")).toBe("rss_viewer");
    });

    it("should clean rich_note prefix", () => {
      expect(getCleanWidgetId("rich_note-note123")).toBe("rich_note");
    });

    it("should clean copilot_table prefix", () => {
      expect(getCleanWidgetId("copilot_table-table123")).toBe("copilot_table");
    });

    it("should normalize news widgets", () => {
      expect(getCleanWidgetId("company_news")).toBe("news");
      expect(getCleanWidgetId("global_news")).toBe("news");
    });

    it("should clean _per_ suffix variations", () => {
      expect(getCleanWidgetId("widget_per_share")).toBe("widget_per");
      expect(getCleanWidgetId("metric_per_employee")).toBe("metric_per");
    });

    it("should return original widgetId for advanced-backend connectionType", () => {
      expect(getCleanWidgetId("custom-widget-id", "advanced-backend")).toBe(
        "custom-widget-id",
      );
    });

    it("should return widgetId unchanged if no pattern matches", () => {
      expect(getCleanWidgetId("regular_widget")).toBe("regular_widget");
    });
  });

  describe("getUUIDFromWidgetId", () => {
    it("should extract UUID from iframe widget ID", () => {
      expect(getUUIDFromWidgetId("iframe-abc123")).toBe("abc123");
    });

    it("should extract UUID from file widget ID", () => {
      expect(getUUIDFromWidgetId("file-file123")).toBe("file123");
      expect(getUUIDFromWidgetId("shared_file-shared123")).toBe("shared123");
    });

    it("should extract UUID from rss_viewer widget ID", () => {
      expect(getUUIDFromWidgetId("rss_viewer-feed123")).toBe("feed123");
    });

    it("should extract UUID from rich_note widget ID", () => {
      expect(getUUIDFromWidgetId("rich_note-note123")).toBe("note123");
    });

    it("should extract UUID from copilot_table widget ID", () => {
      expect(getUUIDFromWidgetId("copilot_table-table123")).toBe("table123");
    });

    it("should extract UUID from company_news widget ID", () => {
      expect(getUUIDFromWidgetId("company_news-news123")).toBe("news123");
    });

    it("should extract UUID from global_news widget ID", () => {
      expect(getUUIDFromWidgetId("global_news-gn123")).toBe("gn123");
    });

    it("should return original ID if no prefix matches", () => {
      expect(getUUIDFromWidgetId("regular_widget")).toBe("regular_widget");
      expect(getUUIDFromWidgetId("custom-id")).toBe("custom-id");
    });
  });

  describe("processWidgetId", () => {
    it("should return both UUID and cleanWidgetId", () => {
      const result = processWidgetId("iframe-abc123");
      expect(result.uuid).toBe("abc123");
      expect(result.cleanWidgetId).toBe("iframe");
    });

    it("should process file widget ID", () => {
      const result = processWidgetId("file-file123");
      expect(result.uuid).toBe("file123");
      expect(result.cleanWidgetId).toBe("ag_grid_file");
    });

    it("should process copilot_table widget ID", () => {
      const result = processWidgetId("copilot_table-ct123");
      expect(result.uuid).toBe("ct123");
      expect(result.cleanWidgetId).toBe("copilot_table");
    });

    it("should handle regular widget ID without prefix", () => {
      const result = processWidgetId("regular_widget");
      expect(result.uuid).toBe("regular_widget");
      expect(result.cleanWidgetId).toBe("regular_widget");
    });

    it("should respect connectionType for cleanWidgetId", () => {
      const result = processWidgetId("custom-widget", "advanced-backend");
      expect(result.uuid).toBe("custom-widget");
      expect(result.cleanWidgetId).toBe("custom-widget");
    });

    it("should process news widget IDs", () => {
      const companyNews = processWidgetId("company_news");
      expect(companyNews.cleanWidgetId).toBe("news");

      const globalNews = processWidgetId("global_news");
      expect(globalNews.cleanWidgetId).toBe("news");
    });
  });

  describe("Constants", () => {
    describe("US_EXCHANGES", () => {
      it("should contain major US exchanges", () => {
        expect(US_EXCHANGES).toContain("NYSE");
        expect(US_EXCHANGES).toContain("NASDAQ");
        expect(US_EXCHANGES).toContain("AMEX");
        expect(US_EXCHANGES).toContain("CBOE");
      });

      it("should have the expected length", () => {
        expect(US_EXCHANGES.length).toBe(10);
      });
    });

    describe("DEFAULT_TICKER_EXCHANGE", () => {
      it("should be NASDAQ", () => {
        expect(DEFAULT_TICKER_EXCHANGE).toBe("NASDAQ");
      });
    });

    describe("METADATA_WIDGETS", () => {
      it("should contain expected widget types", () => {
        expect(METADATA_WIDGETS).toContain("websites");
        expect(METADATA_WIDGETS).toContain("rss_feeds");
        expect(METADATA_WIDGETS).toContain("notes");
        expect(METADATA_WIDGETS).toContain("copilot_table");
      });

      it("should include legacy widget names", () => {
        expect(METADATA_WIDGETS).toContain("note");
        expect(METADATA_WIDGETS).toContain("website");
        expect(METADATA_WIDGETS).toContain("rss");
      });
    });

    describe("WIDGETS_CONNECTION_TYPES", () => {
      it("should contain all connection types", () => {
        expect(WIDGETS_CONNECTION_TYPES).toContain("individual");
        expect(WIDGETS_CONNECTION_TYPES).toContain("single");
        expect(WIDGETS_CONNECTION_TYPES).toContain("backend");
        expect(WIDGETS_CONNECTION_TYPES).toContain("file");
        expect(WIDGETS_CONNECTION_TYPES).toContain("widgetMetadata");
      });

      it("should have exactly 5 connection types", () => {
        expect(WIDGETS_CONNECTION_TYPES.length).toBe(5);
      });
    });
  });

  describe("Edge Cases", () => {
    describe("getJsonWidget edge cases", () => {
      it("should handle empty string widget ID", () => {
        const result = getJsonWidget("" as any);
        expect(result).toBeNull();
      });

      it("should handle widget object with undefined widgetId", () => {
        const result = getJsonWidget({ widgetId: undefined } as any);
        expect(result).not.toBeNull();
      });
    });

    describe("extractColumns edge cases", () => {
      it("should handle object with Symbol keys", () => {
        const symbolKey = Symbol("test");
        const data = [{ [symbolKey]: "value", normalKey: "normal" }];
        const result = extractColumns(data);
        expect(result).toContain("normalKey");
      });

      it("should handle deeply nested objects as first element", () => {
        const data = [{ nested: { deep: { value: 1 } }, flat: "test" }];
        const result = extractColumns(data);
        expect(result).toEqual(["nested", "flat"]);
      });
    });

    describe("processWidgetId edge cases", () => {
      it("should handle hyphenated UUIDs", () => {
        const result = processWidgetId("iframe-550e8400-e29b-41d4-a716-446655440000");
        expect(result.uuid).toBe("550e8400-e29b-41d4-a716-446655440000");
        expect(result.cleanWidgetId).toBe("iframe");
      });
    });

    describe("getCleanWidgetId edge cases", () => {
      it("should handle widget ID that is exactly the prefix", () => {
        expect(getCleanWidgetId("file-")).toBe("ag_grid_file");
      });

      it("should handle widget ID with special characters after prefix", () => {
        expect(getCleanWidgetId("iframe-!@#$%")).toBe("iframe");
      });
    });
  });

  describe("Type Guards and Validation", () => {
    describe("isSSRMType type checking", () => {
      it("should correctly identify SSRM types as boolean", () => {
        const result: boolean = isSSRMType("ssrm_table" as any);
        expect(typeof result).toBe("boolean");
      });
    });
  });
});
