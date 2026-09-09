import { describe, expect, it } from "vitest";
import type { WidgetId } from "~/components/Widgets";
import type { WidgetT } from "~/components/types";
import { findMatchingWidget } from "~/lib/utils/copilot";

describe("copilot utils - Additional Tests", () => {
  describe("findMatchingWidget", () => {
    describe("returns undefined for non-widget citations", () => {
      it("returns undefined when source_info.type is not widget", () => {
        const citation = {
          source_info: {
            type: "file",
            name: "test.pdf",
          },
        } as any;

        const result = findMatchingWidget(
          citation,
          [],
          new Map() as Map<WidgetId, WidgetT>,
        );

        expect(result).toBeUndefined();
      });

      it("returns undefined when source_info.type is artifact", () => {
        const citation = {
          source_info: {
            type: "artifact",
            name: "chart-1",
          },
        } as any;

        const result = findMatchingWidget(
          citation,
          [],
          new Map() as Map<WidgetId, WidgetT>,
        );

        expect(result).toBeUndefined();
      });
    });

    describe("returns undefined when input_args are missing", () => {
      it("returns undefined when metadata is missing", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "test-widget",
          },
        } as any;

        const result = findMatchingWidget(
          citation,
          [],
          new Map() as Map<WidgetId, WidgetT>,
        );

        expect(result).toBeUndefined();
      });

      it("returns undefined when input_args is null", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "test-widget",
            metadata: {
              input_args: null,
            },
          },
        } as any;

        const result = findMatchingWidget(
          citation,
          [],
          new Map() as Map<WidgetId, WidgetT>,
        );

        expect(result).toBeUndefined();
      });
    });

    describe("returns undefined when widget definition not found", () => {
      it("returns undefined when widgetId not in allAppWidgets", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "unknown-widget",
            metadata: {
              input_args: { symbol: "AAPL" },
            },
          },
        } as any;

        const result = findMatchingWidget(
          citation,
          [],
          new Map() as Map<WidgetId, WidgetT>,
        );

        expect(result).toBeUndefined();
      });
    });

    describe("financial statements special cases", () => {
      const fsAllAppWidgets = new Map([
        ["financial_statements", { params: [{ paramName: "symbol" }] }],
      ]) as any;

      it("handles balance_sheet mapping to financial_statements", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "balance_sheet",
            metadata: { input_args: { symbol: "TSLA" } },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "financial_statements",
            storage: {
              selectedGroup: "balance_sheet",
              params: { symbol: "TSLA" },
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, fsAllAppWidgets);
        expect(result).toBeDefined();
        expect(result?.widgetId).toBe("financial_statements");
      });

      it("handles cash_flow_statement mapping", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "cash_flow_statement",
            metadata: { input_args: { symbol: "GOOG" } },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "financial_statements",
            storage: {
              selectedGroup: "cash_flow_statement",
              params: { symbol: "GOOG" },
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, fsAllAppWidgets);
        expect(result).toBeDefined();
      });

      it("returns undefined when selectedGroup does not match originalWidgetId", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "income_statement",
            metadata: { input_args: { symbol: "AAPL" } },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "financial_statements",
            storage: {
              selectedGroup: "balance_sheet", // Different from income_statement
              params: { symbol: "AAPL" },
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, fsAllAppWidgets);
        expect(result).toBeUndefined();
      });
    });

    describe("parameter matching edge cases", () => {
      const allAppWidgets = new Map([
        [
          "multi-param-widget",
          {
            params: [
              { paramName: "symbol" },
              { paramName: "period" },
              { paramName: "limit" },
            ],
          },
        ],
      ]) as any;

      it("matches when all params match", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "multi-param-widget",
            metadata: {
              input_args: { symbol: "AAPL", period: "annual", limit: "10" },
            },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "multi-param-widget",
            storage: {
              params: { symbol: "AAPL", period: "annual", limit: "10" },
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
        expect(result).toBeDefined();
      });

      it("ignores null citation values", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "multi-param-widget",
            metadata: {
              input_args: { symbol: "AAPL", period: null, limit: "null" },
            },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "multi-param-widget",
            storage: {
              params: { symbol: "AAPL", period: "quarterly", limit: "5" },
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
        expect(result).toBeDefined();
      });

      it("handles numeric vs string comparison", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "multi-param-widget",
            metadata: {
              input_args: { symbol: "AAPL", limit: 10 }, // Number
            },
          },
        } as any;

        const dashboardWidgets = [
          {
            widgetId: "multi-param-widget",
            storage: {
              params: { symbol: "AAPL", limit: "10" }, // String
            },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
        expect(result).toBeDefined();
      });
    });

    describe("uses name as fallback for widget_id", () => {
      it("uses source_info.name when widget_id is not present", () => {
        const citation = {
          source_info: {
            type: "widget",
            name: "equity_profile",
            metadata: { input_args: { symbol: "AAPL" } },
          },
        } as any;

        const allAppWidgets = new Map([
          ["equity_profile", { params: [{ paramName: "symbol" }] }],
        ]) as any;

        const dashboardWidgets = [
          {
            widgetId: "equity_profile",
            storage: { params: { symbol: "AAPL" } },
          },
        ] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
        expect(result).toBeDefined();
      });
    });

    describe("widgets without params", () => {
      it("matches widget when definition has no params", () => {
        const citation = {
          source_info: {
            type: "widget",
            widget_id: "static-widget",
            metadata: { input_args: {} },
          },
        } as any;

        const allAppWidgets = new Map([
          ["static-widget", { params: undefined }],
        ]) as any;

        const dashboardWidgets = [{ widgetId: "static-widget", storage: {} }] as any;

        const result = findMatchingWidget(citation, dashboardWidgets, allAppWidgets);
        expect(result).toBeDefined();
      });
    });
  });
});
