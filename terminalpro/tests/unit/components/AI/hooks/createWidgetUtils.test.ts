import { describe, expect, it } from "vitest";
import {
  applyChartViewToWidget,
  buildChartColumnDefs,
  createConversationContextPayload,
  getFallbackName,
  isPieOrDonutChart,
  removeCitationsFromText,
  sanitizeTableContent,
  toAgGridChartType,
} from "~/components/AI/hooks/createWidgetUtils";
import type { WidgetT } from "~/components/types";
import type { ArtifactT, CopilotWidget, Message } from "~/lib/state/copilot";

describe("createWidgetUtils", () => {
  describe("getFallbackName", () => {
    it("returns correct name for text type", () => {
      expect(getFallbackName("text")).toBe("Text Artifact");
    });

    it("returns correct name for html type", () => {
      expect(getFallbackName("html")).toBe("HTML Artifact");
    });

    it("returns correct name for table type", () => {
      expect(getFallbackName("table")).toBe("Table Artifact");
    });

    it("returns correct name for chart type", () => {
      expect(getFallbackName("chart")).toBe("Chart Artifact");
    });

    it("returns generic Artifact for unknown type", () => {
      expect(getFallbackName("unknown")).toBe("Artifact");
      expect(getFallbackName("")).toBe("Artifact");
    });
  });

  describe("createConversationContextPayload", () => {
    const baseMessage: Message = {
      role: "human",
      content: "test message",
      copilotId: "openbb-copilot",
      timestamp: Date.now(),
    } as Message;

    const baseWidget: CopilotWidget = {
      origin: "copilot",
      widget_id: "widget-1",
      name: "Test Widget",
      description: "A test widget",
      params: [],
      metadata: {},
    };

    const baseArtifact: ArtifactT = {
      uuid: "artifact-1",
      type: "text",
      content: "Test artifact content",
      name: "Test Artifact",
      description: "A test artifact",
    };

    it("creates payload with correct user_prompt", () => {
      const payload = createConversationContextPayload("my prompt", [], [], []);
      expect(payload.user_prompt).toBe("my prompt");
    });

    it("limits recent_messages to last 5", () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        ...baseMessage,
        content: `message ${i}`,
      })) as Message[];

      const payload = createConversationContextPayload("prompt", messages, [], []);

      expect(payload.recent_messages).toHaveLength(5);
      expect((payload.recent_messages[0] as { content: string }).content).toBe(
        "message 5",
      );
      expect((payload.recent_messages[4] as { content: string }).content).toBe(
        "message 9",
      );
    });

    it("handles fewer than 5 messages", () => {
      const messages = [
        baseMessage,
        { ...baseMessage, content: "second" },
      ] as Message[];

      const payload = createConversationContextPayload("prompt", messages, [], []);

      expect(payload.recent_messages).toHaveLength(2);
    });

    it("limits related_artifacts to last 3", () => {
      const artifacts: ArtifactT[] = Array.from({ length: 6 }, (_, i) => ({
        ...baseArtifact,
        uuid: `artifact-${i}`,
        name: `Artifact ${i}`,
      }));

      const payload = createConversationContextPayload("prompt", [], [], artifacts);

      expect(payload.related_artifacts).toHaveLength(3);
      expect(payload.related_artifacts[0].name).toBe("Artifact 3");
      expect(payload.related_artifacts[2].name).toBe("Artifact 5");
    });

    it("strips widget metadata to only innerTabId and widgetCount", () => {
      const widgetWithFullMetadata: CopilotWidget = {
        ...baseWidget,
        metadata: {
          innerTabId: "tab-123",
          widgetCount: 5,
          someOtherField: "should be removed",
        } as any,
      };

      const payload = createConversationContextPayload(
        "prompt",
        [],
        [widgetWithFullMetadata],
        [],
      );

      expect(payload.selected_widgets[0].metadata).toEqual({
        innerTabId: "tab-123",
        widgetCount: 5,
      });
    });

    it("handles widgets without metadata", () => {
      const widgetWithoutMetadata: CopilotWidget = {
        ...baseWidget,
        metadata: undefined,
      };

      const payload = createConversationContextPayload(
        "prompt",
        [],
        [widgetWithoutMetadata],
        [],
      );

      expect(payload.selected_widgets[0].metadata).toBeUndefined();
    });
  });

  describe("sanitizeTableContent", () => {
    it("removes dots from object keys", () => {
      const content = [{ "foo.bar": "value1", "baz.qux.quux": "value2" }];

      const result = sanitizeTableContent(content);

      expect(result[0]).toEqual({ foobar: "value1", bazquxquux: "value2" });
    });

    it("preserves keys without dots", () => {
      const content = [{ normalKey: "value", anotherKey: 123 }];

      const result = sanitizeTableContent(content);

      expect(result[0]).toEqual({ normalKey: "value", anotherKey: 123 });
    });

    it("handles multiple rows", () => {
      const content = [
        { "a.b": 1, c: 2 },
        { "a.b": 3, c: 4 },
      ];

      const result = sanitizeTableContent(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ ab: 1, c: 2 });
      expect(result[1]).toEqual({ ab: 3, c: 4 });
    });

    it("handles empty content", () => {
      const result = sanitizeTableContent([]);
      expect(result).toEqual([]);
    });

    it("preserves various value types", () => {
      const content = [
        {
          "str.key": "string",
          "num.key": 42,
          "bool.key": true,
          "null.key": null,
          "arr.key": [1, 2, 3],
        },
      ];

      const result = sanitizeTableContent(content);

      expect(result[0]).toEqual({
        strkey: "string",
        numkey: 42,
        boolkey: true,
        nullkey: null,
        arrkey: [1, 2, 3],
      });
    });
  });

  describe("applyChartViewToWidget", () => {
    it("applies chart intent to both data and storage", () => {
      const widget = {
        type: "table",
        widgetId: "test-widget",
        data: {
          table: {
            showAll: true,
          },
        },
        storage: {
          rowsData: [{ date: "2024-01-01", value: 1 }],
        },
      } as WidgetT;

      const result = applyChartViewToWidget(widget, { chartType: "bar" });

      expect(result.data?.table).toEqual(
        expect.objectContaining({
          enableCharts: true,
          chartView: expect.objectContaining({
            enabled: true,
            chartType: "column",
          }),
        }),
      );
      expect(result.storage).toEqual(
        expect.objectContaining({
          rowsData: [{ date: "2024-01-01", value: 1 }],
          chartSettingsOpen: false,
          chartView: {
            enabled: true,
            chartType: "column",
          },
        }),
      );
    });

    it("preserves explicit disabled state when provided", () => {
      const widget = {
        type: "table",
        widgetId: "test-widget",
        data: { table: {} },
        storage: {},
      } as WidgetT;

      const result = applyChartViewToWidget(widget, {
        enabled: false,
        chartType: "line",
      });

      expect(result.data?.table?.chartView?.enabled).toBe(false);
      expect(result.storage?.chartView?.enabled).toBe(false);
      expect(result.storage?.chartView?.chartType).toBe("line");
    });
  });

  describe("removeCitationsFromText", () => {
    it("removes citation tags with preceding period and space", () => {
      const text = "Some text. <citation>ref1</citation>";
      expect(removeCitationsFromText(text)).toBe("Some text");
    });

    it("removes citation tags with trailing period", () => {
      const text = "Some text<citation>ref1</citation>.";
      expect(removeCitationsFromText(text)).toBe("Some text.");
    });

    it("removes multiple citations", () => {
      const text =
        "First point. <citation>ref1</citation> Second point. <citation>ref2</citation>";
      expect(removeCitationsFromText(text)).toBe("First point Second point");
    });

    it("preserves text without citations", () => {
      const text = "No citations here.";
      expect(removeCitationsFromText(text)).toBe("No citations here.");
    });

    it("handles empty string", () => {
      expect(removeCitationsFromText("")).toBe("");
    });

    it("handles citation at the start of text", () => {
      const text = "<citation>ref1</citation> Some text";
      expect(removeCitationsFromText(text)).toBe(" Some text");
    });
  });

  describe("toAgGridChartType", () => {
    it("converts bar to column", () => {
      expect(toAgGridChartType("bar")).toBe("column");
    });

    it("passes through line type", () => {
      expect(toAgGridChartType("line")).toBe("line");
    });

    it("passes through area type", () => {
      expect(toAgGridChartType("area")).toBe("area");
    });

    it("passes through scatter type", () => {
      expect(toAgGridChartType("scatter")).toBe("scatter");
    });

    it("defaults to line when undefined", () => {
      expect(toAgGridChartType(undefined)).toBe("line");
    });

    it("defaults to line when empty string", () => {
      expect(toAgGridChartType("")).toBe("line");
    });
  });

  describe("isPieOrDonutChart", () => {
    it("returns true for pie chart", () => {
      expect(isPieOrDonutChart("pie")).toBe(true);
    });

    it("returns true for donut chart", () => {
      expect(isPieOrDonutChart("donut")).toBe(true);
    });

    it("returns false for line chart", () => {
      expect(isPieOrDonutChart("line")).toBe(false);
    });

    it("returns false for bar chart", () => {
      expect(isPieOrDonutChart("bar")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isPieOrDonutChart(undefined)).toBe(false);
    });
  });

  describe("buildChartColumnDefs", () => {
    it("builds column defs for pie chart", () => {
      const chartMeta = {
        chartType: "pie",
        angleKey: "value",
        calloutLabelKey: "category",
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        field: "category",
        headerName: "Category",
        cellDataType: "text",
        chartDataType: "category",
      });
      expect(result[1]).toEqual({
        field: "value",
        headerName: "Value",
        cellDataType: "number",
        chartDataType: "series",
      });
    });

    it("builds column defs for donut chart", () => {
      const chartMeta = {
        chartType: "donut",
        angleKey: "amount",
        calloutLabelKey: "label",
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(2);
      expect(result[0].field).toBe("label");
      expect(result[1].field).toBe("amount");
    });

    it("builds column defs for line chart with single y key", () => {
      const chartMeta = {
        chartType: "line",
        xKey: "date",
        yKey: ["price"],
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        field: "date",
        headerName: "Date",
        cellDataType: "text",
        chartDataType: "category",
      });
      expect(result[1]).toEqual({
        field: "price",
        headerName: "Price",
        cellDataType: "number",
        chartDataType: "series",
      });
    });

    it("builds column defs for chart with multiple y keys", () => {
      const chartMeta = {
        chartType: "bar",
        xKey: "month",
        yKey: ["revenue", "expenses", "profit"],
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(4);
      expect(result[0].field).toBe("month");
      expect(result[1].field).toBe("revenue");
      expect(result[2].field).toBe("expenses");
      expect(result[3].field).toBe("profit");
    });

    it("handles missing keys gracefully", () => {
      const chartMeta = {
        chartType: "line",
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe("");
    });

    it("handles undefined yKey by treating as empty array", () => {
      const chartMeta = {
        chartType: "line",
        xKey: "date",
        yKey: undefined,
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result).toHaveLength(1);
      expect(result[0].field).toBe("date");
    });

    it("converts snake_case keys to readable headers", () => {
      const chartMeta = {
        chartType: "line",
        xKey: "created_at",
        yKey: ["total_revenue"],
      };

      const result = buildChartColumnDefs(chartMeta);

      expect(result[0].headerName).toBe("Created At");
      expect(result[1].headerName).toBe("Total Revenue");
    });
  });
});
