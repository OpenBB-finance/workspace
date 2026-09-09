import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/utils/sanitize", () => ({
  sanitizeHtml: (html: string) => html,
  HTML_SANITIZE_CONFIG: {},
}));

vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => html,
  },
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid"),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  convertToReadableLabel: (label: string) =>
    label.charAt(0).toUpperCase() + label.slice(1).replace(/_/g, " "),
  isDate: (_value: any) => false,
}));

import {
  buildChartWidget,
  buildHtmlWidget,
  buildNoteWidget,
  buildTableWidget,
  sanitizeContent,
} from "~/components/AI/hooks/buildWidget";

describe("sanitizeContent", () => {
  it("removes dots from keys", () => {
    const input = [{ "price.close": 100, "price.open": 95 }];
    const result = sanitizeContent(input);
    expect(result).toEqual([{ priceclose: 100, priceopen: 95 }]);
  });

  it("handles empty array", () => {
    expect(sanitizeContent([])).toEqual([]);
  });

  it("leaves keys without dots unchanged", () => {
    const input = [{ price: 100, volume: 500 }];
    const result = sanitizeContent(input);
    expect(result).toEqual([{ price: 100, volume: 500 }]);
  });
});

describe("buildChartWidget", () => {
  it("builds a line chart widget", () => {
    const data = [{ date: "2024-01-01", value: 100 }];
    const widget = buildChartWidget(data, {
      uuid: "chart-uuid",
      name: "Line Chart",
      description: "A line chart",
      chartType: "line",
      xKey: "date",
      yKey: ["value"],
    });

    expect(widget.id).toBe("chart-uuid");
    expect(widget.name).toBe("Line Chart");
    expect(widget.widgetId).toBe("copilot_table-chart-uuid");
    expect(widget.storage?.chartView?.chartType).toBe("line");
    expect(widget.data?.table?.chartView?.enabled).toBe(true);
    expect(widget.storage?.columnDefs).toEqual([
      expect.objectContaining({ field: "date", chartDataType: "category" }),
      expect.objectContaining({ field: "value", chartDataType: "series" }),
    ]);
  });

  it("remaps bar to column chart type", () => {
    const data = [{ x: 1, y: 2 }];
    const widget = buildChartWidget(data, {
      uuid: "bar-uuid",
      name: "Bar Chart",
      chartType: "bar",
      xKey: "x",
      yKey: ["y"],
    });

    expect(widget.storage?.chartView?.chartType).toBe("column");
    expect(widget.data?.table?.chartView?.chartType).toBe("column");
  });

  it("builds pie chart with angleKey and calloutLabelKey columnDefs", () => {
    const data = [{ category: "A", amount: 10 }];
    const widget = buildChartWidget(data, {
      uuid: "pie-uuid",
      name: "Pie Chart",
      chartType: "pie",
      xKey: "category",
      yKey: [],
      angleKey: "amount",
      calloutLabelKey: "category",
    });

    expect(widget.storage?.columnDefs).toEqual([
      expect.objectContaining({
        field: "category",
        chartDataType: "category",
      }),
      expect.objectContaining({
        field: "amount",
        chartDataType: "series",
      }),
    ]);
  });

  it("builds donut chart with angleKey and calloutLabelKey columnDefs", () => {
    const data = [{ label: "X", val: 5 }];
    const widget = buildChartWidget(data, {
      uuid: "donut-uuid",
      name: "Donut Chart",
      chartType: "donut",
      xKey: "label",
      yKey: [],
      angleKey: "val",
      calloutLabelKey: "label",
    });

    expect(widget.storage?.columnDefs).toHaveLength(2);
    expect(widget.storage?.columnDefs?.[0]).toEqual(
      expect.objectContaining({ field: "label", chartDataType: "category" }),
    );
    expect(widget.storage?.columnDefs?.[1]).toEqual(
      expect.objectContaining({ field: "val", chartDataType: "series" }),
    );
  });
});

describe("buildTableWidget", () => {
  it("auto-generates columns from data keys", () => {
    const data = [{ name: "Alice", age: 30 }];
    const widget = buildTableWidget(data, {
      uuid: "table-uuid",
      name: "Table",
    });

    expect(widget.widgetId).toBe("copilot_table-table-uuid");
    expect(widget.storage?.columns).toEqual(["name", "age"]);
    expect(widget.storage?.rowsData).toEqual(data);
  });

  it("handles empty data", () => {
    const widget = buildTableWidget([], {
      uuid: "empty-uuid",
      name: "Empty Table",
    });

    expect(widget.storage?.columns).toEqual([]);
    expect(widget.storage?.rowsData).toEqual([]);
  });
});

describe("buildHtmlWidget", () => {
  it("sets widgetId prefix to html-", () => {
    const widget = buildHtmlWidget("<h1>Hello</h1>", {
      uuid: "html-uuid",
      name: "HTML Widget",
    });

    expect(widget.widgetId).toBe("html-html-uuid");
    expect(widget.storage?.html).toBe("<h1>Hello</h1>");
  });

  it("sanitizes HTML content", () => {
    const widget = buildHtmlWidget("<div>safe</div>", {
      uuid: "safe-uuid",
      name: "Safe HTML",
      description: "desc",
    });

    expect(widget.storage?.html).toBe("<div>safe</div>");
    expect(widget.name).toBe("Safe HTML");
    expect(widget.description).toBe("desc");
  });
});

describe("buildNoteWidget", () => {
  it("converts markdown to HTML", () => {
    const widget = buildNoteWidget("Hello World", {
      uuid: "note-uuid",
      name: "Note",
    });

    expect(widget.widgetId).toBe("rich_note-note-uuid");
    expect(widget.storage?.html).toBe("Hello World");
  });

  it("strips citation tags before conversion", () => {
    const content = "Some text. <citation>ref1</citation>";
    const widget = buildNoteWidget(content, {
      uuid: "cite-uuid",
      name: "Citation Note",
    });

    expect(widget.storage?.html).not.toContain("<citation>");
  });

  it("uses sanitizeHtml on converted content", () => {
    const widget = buildNoteWidget("# Title", {
      uuid: "sanitize-uuid",
      name: "Sanitized Note",
    });

    expect(widget.storage?.html).toBeDefined();
    expect(typeof widget.storage?.html).toBe("string");
  });

  it("builds a markdown widget when note citations are provided", () => {
    const content = "News summary <|start_citation_id|>cite-1<|end_citation_id|>";
    const citations = [
      {
        id: "cite-1",
        signature: "web|example",
        source_info: { type: "web", name: "https://example.com" },
      },
    ];

    const widget = buildNoteWidget(content, {
      uuid: "citation-note-uuid",
      name: "Citation Note",
      citations,
    });

    expect(widget.widgetId).toBe("markdown");
    expect(widget.storage?.text).toBe(content);
    expect(widget.storage?.citations).toEqual(citations);
    expect(widget.storage?.artifacts).toEqual([]);
  });

  it("builds a markdown widget when note artifacts are provided", () => {
    const content =
      "See table <|start_artifact_id|>table_artifact_6725b<|end_artifact_id|>";
    const artifacts = [
      {
        uuid: "table_artifact_6725b",
        name: "table_artifact_6725b",
        type: "table" as const,
        content: [{ country: "United States", weight: 67.61 }],
      },
    ];

    const widget = buildNoteWidget(content, {
      uuid: "artifact-note-uuid",
      name: "Artifact Note",
      artifacts,
    });

    expect(widget.widgetId).toBe("markdown");
    expect(widget.storage?.text).toBe(content);
    expect(widget.storage?.citations).toEqual([]);
    expect(widget.storage?.artifacts).toEqual(artifacts);
  });

  it("defaults the name when none is provided so it never leaks as null", () => {
    const widget = buildNoteWidget("body", {
      uuid: "no-name-uuid",
      name: null as unknown as string,
    });

    expect(widget.name).toBe("Note");
  });
});
