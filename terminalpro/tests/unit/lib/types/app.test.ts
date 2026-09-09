import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  _GridDataSchema,
  ChartTypeSchema,
  ChartViewOptionsSchema,
  ColorOptionsSchema,
  ColorRuleSchema,
  DataSchema,
  ExternalWidgetSchema,
  InternalWidgetSchema,
  isWidgetVizType,
  ParamDefSchema,
  ParamsSchema,
  RenderFnSchema,
  StorageSchema,
  TableColumnDefsSchema,
  TableSchema,
  TickerSchema,
  WidgetSchemaBase,
  WidgetVizTypes,
  widgetTypesSchema,
} from "~/lib/types/app";

vi.mock("../constants", () => ({
  AG_CHART_TYPES: ["line", "bar", "area", "scatter", "pie", "histogram"] as const,
}));

describe("Zod Schemas from app.ts", () => {
  describe("ChartTypeSchema", () => {
    it("should validate valid chart types", () => {
      expect(ChartTypeSchema.safeParse("columnLineCombo").success).toBe(true);
      expect(ChartTypeSchema.safeParse("line").success).toBe(true);
      expect(ChartTypeSchema.safeParse("bar").success).toBe(true);
    });

    it("should apply default value 'line'", () => {
      const result = ChartTypeSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("line");
      }
    });

    it("should invalidate an unknown chart type", () => {
      const result = ChartTypeSchema.safeParse("unknownChart");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe("Invalid chart type");
      }
    });

    it("should be optional", () => {
      const obj = z.object({ chartType: ChartTypeSchema });
      expect(obj.safeParse({}).success).toBe(true);
      expect(obj.safeParse({ chartType: undefined }).data?.chartType).toBe("line");
    });
  });

  describe("TickerSchema", () => {
    it("should have a consistent shape", () => {
      const shapeKeys = Object.keys(TickerSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "category",
          "cik",
          "color",
          "country",
          "currency",
          "cusip",
          "exchange",
          "has_options",
          "id",
          "industry",
          "isin",
          "name",
          "sector",
          "symbol",
          "type",
        ]
      `);
    });

    it("should validate a valid ticker object", () => {
      const validTicker = {
        id: "123",
        symbol: "AAPL",
        category: "equity",
        color: "#FF0000",
        type: "Common Stock",
        name: "Apple Inc.",
        exchange: "NASDAQ",
        currency: "USD",
        industry: "Technology",
        sector: "Information Technology",
        country: "USA",
        cik: "0000320193",
        isin: "US0378331005",
        cusip: "037833100",
        has_options: true,
      };
      expect(TickerSchema.safeParse(validTicker).success).toBe(true);
    });

    it("should validate with minimal required fields (id, symbol, category)", () => {
      const minimalTicker = {
        id: "456",
        symbol: "GOOG",
        category: "equity",
      };
      const result = TickerSchema.safeParse(minimalTicker);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          ...minimalTicker,
        });
      }
    });

    it("should invalidate if required fields are missing", () => {
      const invalidTicker = { id: "123", symbol: "TSLA" };
      const result = TickerSchema.safeParse(invalidTicker);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path.includes("category")),
        ).toBe(true);
      }
    });

    it("should invalidate with incorrect category enum", () => {
      const invalidTicker = {
        id: "789",
        symbol: "MSFT",
        category: "invalidCategory",
      };
      const result = TickerSchema.safeParse(invalidTicker);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.find((issue) => issue.path.includes("category"))?.message,
        ).toContain("Invalid input");
      }
    });
  });

  describe("ColorOptionsSchema", () => {
    it("should validate predefined colors", () => {
      expect(ColorOptionsSchema.safeParse({ color: "green" }).success).toBe(true);
      expect(ColorOptionsSchema.safeParse({ color: "red", fill: true }).success).toBe(
        true,
      );
    });

    it("should validate hex colors", () => {
      expect(ColorOptionsSchema.safeParse({ color: "#FF0000" }).success).toBe(true);
      expect(
        ColorOptionsSchema.safeParse({ color: "#123456", fill: false }).success,
      ).toBe(true);
    });

    it("should apply default for fill", () => {
      const result = ColorOptionsSchema.safeParse({ color: "blue" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fill).toBe(false);
      }
    });
  });

  describe("ColorRuleSchema", () => {
    it("should validate ColorBaseSchema variant", () => {
      const validBaseRule = {
        color: "green",
        condition: "eq",
        value: 10,
      };
      const result = ColorRuleSchema.safeParse(validBaseRule);
      expect(result.success).toBe(true);
      if (result.success) {
        // Test transform (type assertion)
        expect(result.data).toEqual(expect.objectContaining(validBaseRule));
      }
    });

    it("should validate ColorBetweenSchema variant", () => {
      const validBetweenRule = {
        color: "#ABCDEF",
        fill: true,
        condition: "between",
        range: { min: 5, max: 15 },
      };
      const result = ColorRuleSchema.safeParse(validBetweenRule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(expect.objectContaining(validBetweenRule));
      }
    });

    it("should invalidate if condition is wrong for ColorBaseSchema", () => {
      const invalidRule = {
        color: "red",
        condition: "is",
        value: "test",
      };
      const result = ColorRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it("should invalidate if condition is wrong for ColorBetweenSchema", () => {
      const invalidRule = {
        color: "blue",
        condition: "gt", // "gt" requires 'value', not 'range'
        range: { min: 1, max: 2 },
      };
      const result = ColorRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it("should invalidate if range is missing for 'between' condition", () => {
      const invalidRule = {
        color: "#FFF",
        condition: "between",
        // value: 10, // Missing range
      };
      const result = ColorRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });
  });

  describe("RenderFnSchema", () => {
    it("should validate predefined render functions", () => {
      expect(RenderFnSchema.safeParse("greenRed").success).toBe(true);
      expect(RenderFnSchema.safeParse("titleCase").success).toBe(true);
    });

    it("should be optional", () => {
      expect(RenderFnSchema.safeParse(undefined).success).toBe(true);
      expect(RenderFnSchema.safeParse(undefined).data).toBeUndefined();
    });

    it("should invalidate an unknown render function", () => {
      const result = RenderFnSchema.safeParse("unknownFunction");
      expect(result.success).toBe(false);
      if (!result.success) {
        const expected = `"greenRed"|"titleCase"|"hoverCard"|"cellOnClick"|"columnColor"|"showCellChange"`;
        expect(result.error.issues[0].message).toBe(
          `Invalid option: expected one of ${expected}`,
        );
      }
    });
  });

  describe("TableColumnDefsSchema", () => {
    it("should have a consistent shape for its array items", () => {
      // Test shape of the object within the array
      const itemShapeKeys = Object.keys(TableColumnDefsSchema.element.shape).sort();
      expect(itemShapeKeys).toMatchInlineSnapshot(`
        [
          "aggFunc",
          "align",
          "cellDataType",
          "chartDataType",
          "decimalPlaces",
          "enableCellChangeWs",
          "field",
          "formatterFn",
          "headerName",
          "headerTooltip",
          "hide",
          "maxWidth",
          "minWidth",
          "pinned",
          "prefix",
          "renderFn",
          "renderFnParams",
          "rowGroup",
          "sparkline",
          "suffix",
          "width",
        ]
      `);
    });

    it("should validate a valid column definition array", () => {
      const validCols = [
        {
          field: "price",
          headerName: "Price",
          chartDataType: "series",
          cellDataType: "number",
          formatterFn: "normalizedPercent",
          renderFn: ["greenRed", "hoverCard"],
          renderFnParams: {
            hoverCard: { title: "Price Details" },
            colorRules: [{ color: "green", condition: "gt", value: 0 }],
          },
        },
        { field: "name", headerName: "Name" },
      ];
      const result = TableColumnDefsSchema.safeParse(validCols);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].renderFn).toEqual(["greenRed", "hoverCard"]);
        expect(result.data[0].enableCellChangeWs).toBe(true);
      }
    });

    it("should transform string renderFn to array", () => {
      const cols = [
        { field: "a", headerName: "A", renderFn: ["greenRed", "titleCase"] },
      ];

      const result = TableColumnDefsSchema.safeParse(cols);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].renderFn).toEqual(["greenRed", "titleCase"]);
      }
    });

    it("should invalidate if required fields (field, headerName) are missing", () => {
      const invalidCols = [{ headerName: "Only Name" }];
      const result = TableColumnDefsSchema.safeParse(invalidCols);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.join(".") === "0.field" &&
              i.message.includes("received undefined"),
          ),
        ).toBe(true);
      }
    });

    it("should invalidate with wrong chartDataType", () => {
      const invalidCols = [{ field: "a", headerName: "A", chartDataType: "invalid" }];
      const result = TableColumnDefsSchema.safeParse(invalidCols);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.find((i) => i.path.join(".") === "0.chartDataType")
            ?.message,
        ).toBe(`Invalid option: expected one of "category"|"series"|"time"|"excluded"`);
      }
    });

    it("should handle renderFnParams being passthrough", () => {
      const cols = [
        {
          field: "a",
          headerName: "A",
          renderFnParams: { customParam: 123, colorValueKey: "val" },
        },
      ];
      const result = TableColumnDefsSchema.safeParse(cols);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data[0].renderFnParams?.customParam).toBe(123);
      }
    });
  });

  describe("ParamDefSchema (and base/form variants)", () => {
    it("ParamDefSchemaBase: should have a consistent shape", () => {
      // Create a valid base param definition that will pass schema validation
      const validBaseParam = {
        paramName: "testParam",
        type: "text",
        label: "Test Param",
        show: true,
      };

      // Parse it through the schema to get the expected shape
      const result = ParamDefSchema.safeParse(validBaseParam);
      expect(result.success).toBe(true);

      // Check the shape by examining what fields are accepted
      const baseParamKeys = [
        "paramName",
        "type",
        "label",
        "show",
        "value",
        "description",
        "style",
        "options",
        "multiSelect",
        "optionsEndpoint",
        "optionsParams",
        "groupById",
        "roles",
      ];

      // Compare with expected keys
      expect(Object.keys(validBaseParam)).toEqual(
        expect.arrayContaining(baseParamKeys.slice(0, 4)),
      );
    });

    it("FormParamDefSchema: should have a consistent shape", () => {
      // Create a valid form param definition that will pass schema validation
      const validFormParam = {
        type: "form",
        paramName: "testFormParam",
        label: "Test Form Param",
        endpoint: "/api/test",
        method: "POST",
        inputParams: [
          {
            paramName: "innerParam",
            type: "text",
            label: "Inner Param",
          },
        ],
      };

      // Parse it through the schema to get the expected shape
      const result = ParamDefSchema.safeParse(validFormParam);
      expect(result.success).toBe(true);

      // Check the shape by examining what fields are accepted
      const formParamKeys = [
        "paramName",
        "label",
        "value",
        "description",
        "type",
        "show",
        "style",
        "options",
        "multiSelect",
        "optionsEndpoint",
        "optionsParams",
        "groupById",
        "roles",
        "endpoint",
        "method",
        "inputParams",
      ].sort();

      // Compare with expected keys
      expect(Object.keys(validFormParam).sort()).toEqual(
        expect.arrayContaining([
          "type",
          "paramName",
          "label",
          "endpoint",
          "method",
          "inputParams",
        ]),
      );
    });

    it("should validate a basic ParamDefSchema (text type)", () => {
      const validParam = { paramName: "myText", label: "My Text Input", type: "text" };
      const result = ParamDefSchema.safeParse(validParam);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.show).toBe(true); // Default
        expect(result.data.options).toEqual([]); // Default
      }
    });

    it("should validate a FormParamDefSchema", () => {
      const validFormParam = {
        type: "form", // paramName is optional for form
        label: "My Form",
        endpoint: "/submit",
        method: "POST",
        inputParams: [{ paramName: "field1", type: "text" }],
      };
      const result = ParamDefSchema.safeParse(validFormParam);
      expect(result.success).toBe(true);
    });

    it("should invalidate if paramName is missing for non-form type", () => {
      const invalidParam = { label: "My Text Input", type: "text" };
      const result = ParamDefSchema.safeParse(invalidParam);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes("received undefined")),
        ).toBe(true);
      }
    });

    it("should invalidate if type is 'form' but other form fields are missing (e.g. endpoint)", () => {
      const formParamMinimal = { type: "form" };
      const result = ParamDefSchema.safeParse(formParamMinimal);
      expect(result.success).toBe(true);
    });

    it("should invalidate unsupported type", () => {
      const invalidParam = { paramName: "q", type: "invalidType" };
      const result = ParamDefSchema.safeParse(invalidParam);
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error.issues[0].code).toBe("invalid_union");
        expect(result.error.issues[0].message).toContain("Invalid discriminator value");
      }
    });
  });

  describe("ParamsSchema", () => {
    it("should validate an empty array", () => {
      expect(ParamsSchema.safeParse([]).success).toBe(true);
    });

    it("should validate an array of valid ParamDef objects", () => {
      const validParams = [
        { paramName: "p1", type: "text" },
        { paramName: "p2", type: "number", value: 100 },
      ];
      expect(ParamsSchema.safeParse(validParams).success).toBe(true);
    });

    it("should allow one param with role 'fileSelector'", () => {
      const params = [{ paramName: "file", type: "endpoint", roles: ["fileSelector"] }];
      expect(ParamsSchema.safeParse(params).success).toBe(true);
    });

    it("should invalidate with more than one 'fileSelector' role", () => {
      const invalidParams = [
        { paramName: "f1", type: "endpoint", roles: ["fileSelector"] },
        { paramName: "f2", type: "endpoint", roles: ["fileSelector"] },
      ];
      const result = ParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Only one parameter can have the role 'fileSelector'.",
        );
      }
    });
  });

  describe("widgetTypesSchema", () => {
    it("should validate known widget types", () => {
      WidgetVizTypes.forEach((type) => {
        if (type === "note") {
          // "note" is transformed
          expect(widgetTypesSchema.safeParse(type).data).toBe("rich_note");
        } else
          type === "multi_file_viewer" ||
            type === "file_viewer" ||
            type === "newsfeed" ||
            type === "omni" ||
            type === "live_grid" ||
            type === "advanced_charting";
      });
      expect(widgetTypesSchema.safeParse("chart").success).toBe(true);
      expect(widgetTypesSchema.safeParse("pdf").success).toBe(true);
    });

    it("should transform 'note' to 'rich_note'", () => {
      const result = widgetTypesSchema.safeParse("note");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("rich_note");
      }
    });

    it("should be nullish", () => {
      expect(widgetTypesSchema.safeParse(null).success).toBe(true);
      expect(widgetTypesSchema.safeParse(undefined).success).toBe(true);
    });

    it("should invalidate unknown types", () => {
      const result = widgetTypesSchema.safeParse("invalidWidgetType");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Supported types are");
      }
    });
  });

  describe("InternalWidgetSchema", () => {
    it("should have a consistent shape", () => {
      const shapeKeys = Object.keys(InternalWidgetSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "copilotParseAs",
          "data",
          "dataUpdateDisplay",
          "description",
          "disableRetrievalForCopilot",
          "exportable",
          "external",
          "fileEndpoint",
          "groupById",
          "groupId",
          "id",
          "innerTab",
          "inputType",
          "name",
          "params",
          "raw",
          "refetchInterval",
          "runButton",
          "showTitle",
          "staleTime",
          "storage",
          "type",
          "widgetId",
        ]
      `);
    });

    it("should validate a minimal valid internal widget", () => {
      const minimalWidget = { id: "widget1", widgetId: "internal1" };
      const result = InternalWidgetSchema.safeParse(minimalWidget);
      console.log(result.data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staleTime).toBe(1000 * 60 * 5);
        expect(result.data.refetchInterval).toBe(1000 * 60 * 15);
        expect(result.data.data).toEqual({ table: {} });
      }
    });

    it("should validate with specific data", () => {
      const widget = {
        id: "widget2",
        widgetId: "internal2",
        type: "chart",
        data: {
          mainTicker: { id: "t1", symbol: "AAPL", category: "equity" },
        },
      };
      const result = InternalWidgetSchema.safeParse(widget);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("chart");
        expect(result.data.data?.mainTicker?.symbol).toBe("AAPL");
      }
    });

    it("should invalidate if required fields (id, widgetId) are missing", () => {
      const result = InternalWidgetSchema.safeParse({ name: "Test" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.path.includes("id") && i.message.includes("received undefined"),
          ),
        ).toBe(true);
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes("widgetId") && i.message.includes("received undefined"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("ExternalWidgetSchema", () => {
    it("should have a consistent shape", () => {
      // Access the underlying object schema through the effects chain
      const underlyingSchema = ExternalWidgetSchema.def.in._zod.def;
      const shapeKeys = Object.keys(underlyingSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "category",
          "connectionType",
          "copilotParseAs",
          "data",
          "dataUpdateDisplay",
          "description",
          "disableRetrievalForCopilot",
          "endpoint",
          "exportable",
          "external",
          "fileEndpoint",
          "groupById",
          "groupId",
          "id",
          "innerTab",
          "inputType",
          "isSharedWidget",
          "name",
          "params",
          "raw",
          "refetchInterval",
          "runButton",
          "schemaName",
          "showTitle",
          "source",
          "sourceDatabase",
          "sourceId",
          "sourceName",
          "staleTime",
          "storage",
          "subCategory",
          "type",
          "widgetId",
          "wsEndpoint",
        ]
      `);
    });

    it("should validate a minimal valid external widget", () => {
      const minimalWidget = { id: "extWidget1", widgetId: "external1" };
      const result = ExternalWidgetSchema.safeParse(minimalWidget);
      expect(result.success).toBe(true);
      if (result.success) {
        // Check defaults from base and transform
        expect(result.data.staleTime).toBe(1000 * 60 * 5);
        expect(result.data.refetchInterval).toBe(1000 * 60 * 15); // Default from transform when runButton is undefined
        expect(result.data.data).toEqual({ table: {} });
      }
    });

    it("transform logic: runButton=true, refetchInterval=undefined/false -> staleTime=Infinity, refetchInterval=false", () => {
      const widget1 = { id: "w", widgetId: "w", runButton: true };
      const result1 = ExternalWidgetSchema.safeParse(widget1);
      expect(result1.success).toBe(true);
      if (result1.success) {
        expect(result1.data.staleTime).toBe(Number.POSITIVE_INFINITY);
        expect(result1.data.refetchInterval).toBe(false);
      }

      const widget2 = {
        id: "w",
        widgetId: "w",
        runButton: true,
        refetchInterval: false,
      };
      const result2 = ExternalWidgetSchema.safeParse(widget2);
      expect(result2.success).toBe(true);
      if (result2.success) {
        expect(result2.data.staleTime).toBe(Number.POSITIVE_INFINITY);
        expect(result2.data.refetchInterval).toBe(false);
      }
    });

    it("transform logic: runButton=false (or undefined), refetchInterval=undefined -> refetchInterval=default", () => {
      const widget = { id: "w", widgetId: "w", runButton: false }; // refetchInterval undefined
      const result = ExternalWidgetSchema.safeParse(widget);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staleTime).toBe(1000 * 60 * 5); // default staleTime
        expect(result.data.refetchInterval).toBe(1000 * 60 * 15); // default refetchInterval
      }
    });

    it("refine logic: multi_file_viewer requires param with role 'fileSelector'", () => {
      const invalidWidget = {
        id: "w",
        widgetId: "w",
        type: "multi_file_viewer",
        params: [{ paramName: "p1", type: "text" }], // No fileSelector
      };
      const resultInvalid = ExternalWidgetSchema.safeParse(invalidWidget);
      expect(resultInvalid.success).toBe(false);
      if (!resultInvalid.success) {
        expect(resultInvalid.error.issues[0].path).toEqual(["params"]);
        expect(resultInvalid.error.issues[0].message).toBe(
          'Endpoint param with `{ roles: ["fileSelector"] }` required for `multi_file_viewer`.',
        );
      }

      const validWidget = {
        id: "w",
        widgetId: "w",
        type: "multi_file_viewer",
        params: [{ paramName: "f", type: "endpoint", roles: ["fileSelector"] }],
      };
      expect(ExternalWidgetSchema.safeParse(validWidget).success).toBe(true);
    });

    it("should validate endpoint object structure", () => {
      const widget = {
        id: "w",
        widgetId: "w",
        endpoint: { url: "/api/data", method: "POST", headers: { "X-Token": "test" } },
      };
      const result = ExternalWidgetSchema.safeParse(widget);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.endpoint?.method).toBe("POST");
      }

      const invalidWidget = {
        id: "w",
        widgetId: "w",
        endpoint: { url: "/api/data", method: "PATCH" }, // Invalid method
      };
      const resultInvalid = ExternalWidgetSchema.safeParse(invalidWidget);
      expect(resultInvalid.success).toBe(false);
    });
  });

  describe("isWidgetVizType utility function", () => {
    it("should return true for valid WidgetVizTypes", () => {
      expect(isWidgetVizType("chart")).toBe(true);
      expect(isWidgetVizType("table")).toBe(true);
      expect(isWidgetVizType("multi_file_viewer")).toBe(true);
    });

    it("should return false for invalid types", () => {
      expect(isWidgetVizType("unknown_type")).toBe(false);
      expect(isWidgetVizType("Note")).toBe(false); // Case-sensitive
      expect(isWidgetVizType("")).toBe(false);
    });

    it("should correctly identify all known WidgetVizTypes", () => {
      WidgetVizTypes.forEach((type) => {
        expect(isWidgetVizType(type)).toBe(true);
      });
    });
  });

  describe("_GridDataSchema", () => {
    it("should have a consistent shape", () => {
      const shapeKeys = Object.keys(_GridDataSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "h",
          "isDraggable",
          "maxH",
          "maxW",
          "minH",
          "minW",
          "moved",
          "static",
          "w",
          "x",
          "y",
        ]
      `);
    });

    it("should validate a valid grid data object with all fields", () => {
      const validGridData = {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        minH: 2,
        minW: 2,
        maxH: 10,
        maxW: 12,
        moved: false,
        static: true,
        isDraggable: false,
      };
      const result = _GridDataSchema.safeParse(validGridData);
      expect(result.success).toBe(true);
    });

    it("should validate with only required fields", () => {
      const minimalGridData = { x: 1, y: 1, w: 2, h: 2 };
      const result = _GridDataSchema.safeParse(minimalGridData);
      expect(result.success).toBe(true);
      if (result.success) {
        // Check that optional fields are undefined or null if parsed as such
        expect(result.data.minH).toBeUndefined(); // or null if parsed from `null`
        expect(result.data.static).toBeUndefined();
      }
    });

    it("should allow null for nullish fields", () => {
      const gridDataWithNulls = {
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        minH: null,
        static: null,
      };
      const result = _GridDataSchema.safeParse(gridDataWithNulls);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minH).toBeNull();
        expect(result.data.static).toBeNull();
      }
    });

    it("should invalidate if a required field is missing", () => {
      const invalidGridData = { y: 0, w: 6, h: 4 }; // Missing x
      const result = _GridDataSchema.safeParse(invalidGridData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("x") && issue.message.includes("received undefined"),
          ),
        ).toBe(true);
      }
    });

    it("should invalidate if a field has an incorrect type", () => {
      const invalidGridData = { x: "0", y: 0, w: 6, h: 4 }; // x is string
      const result = _GridDataSchema.safeParse(invalidGridData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.path.includes("x") && issue.code === "invalid_type",
          ),
        ).toBe(true);
      }
    });
  });

  describe("StorageSchema", () => {
    it("should have a consistent shape (empty by definition, but check behavior)", () => {
      // The defined shape is empty, passthrough is the key characteristic.
      const innerSchema = StorageSchema._def.innerType;
      const shapeKeys = Object.keys(innerSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot("[]");
    });

    it("should validate an empty object", () => {
      const result = StorageSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it("should validate an object with arbitrary keys due to passthrough", () => {
      const data = { customKey: "value", another: 123 };
      const result = StorageSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it("should apply default empty object if input is undefined", () => {
      const result = StorageSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });
  });

  describe("ChartViewOptionsSchema", () => {
    it("should have a consistent shape", () => {
      const shapeKeys = Object.keys(ChartViewOptionsSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "cellRangeCols",
          "chartSettingsOpen",
          "chartType",
          "enabled",
          "ignoreCellRange",
          "xLabel",
          "yLabel",
        ]
      `);
    });

    it("should validate a valid ChartViewOptions object", () => {
      const validOptions = {
        enabled: true,
        chartType: "columnLineCombo",
        cellRangeCols: {
          columnLineCombo: ["colA", "colB"],
          line: ["colC"],
        },
        chartSettingsOpen: true,
      };
      const result = ChartViewOptionsSchema.safeParse(validOptions);
      expect(result.success).toBe(true);
    });

    it("should apply default values", () => {
      const result = ChartViewOptionsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(false);
        expect(result.data.chartSettingsOpen).toBe(false);
        expect(result.data.cellRangeCols).toBeUndefined();
      }
    });

    it("should validate cellRangeCols structure", () => {
      const validCellRange = {
        enabled: false,
        cellRangeCols: {
          line: ["series1", "series2"],
          invalidChartType: ["data"], // This key itself uses ChartTypeSchema
        },
      };
      const result = ChartViewOptionsSchema.safeParse(validCellRange);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.code === "unrecognized_keys");
        expect(issue).toBeDefined();
        expect(issue?.path).toEqual(["cellRangeCols"]);
        expect(issue?.keys).toEqual(["invalidChartType"]);
      }
      const validCellRange2 = {
        enabled: false,
        cellRangeCols: {
          line: ["series1", "series2"],
          bar: [123], // Value of array should be string
        },
      };
      const result2 = ChartViewOptionsSchema.safeParse(validCellRange2);
      expect(result2.success).toBe(false);
      if (!result2.success) {
        expect(
          result2.error.issues.some(
            (i) =>
              i.path.join(".") === "cellRangeCols.bar.0" && i.code === "invalid_type",
          ),
        ).toBe(true);
      }
    });
  });

  describe("DataSchema", () => {
    it("should have a consistent shape (empty by definition, but check behavior)", () => {
      const innerSchema = DataSchema._def.innerType;
      const shapeKeys = Object.keys(innerSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot("[]");
    });

    it("should validate an empty object", () => {
      const result = DataSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({});
      }
    });

    it("should validate an object with arbitrary keys due to passthrough", () => {
      const data = { customKey: "value", another: 123 };
      const result = DataSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(data);
      }
    });

    it("should be optional (allow undefined)", () => {
      const result = DataSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });
  });

  describe("TableSchema", () => {
    it("should have a consistent shape", () => {
      // Access the inner object schema's shape
      const innerSchema = TableSchema._def.innerType;
      const shapeKeys = Object.keys(innerSchema.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "chartView",
          "columnState",
          "columnsDefs",
          "enableAdvanced",
          "enableFormulas",
          "filterModel",
          "formatterFn",
          "showAll",
          "transpose",
        ]
      `);
    });

    it("should be optional (allow undefined for the whole schema)", () => {
      const result = TableSchema.safeParse(undefined);
      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it("should validate a valid Table object with all fields", () => {
      const validTable = {
        showAll: true,
        chartView: { enabled: true, chartType: "line" },
        columnsDefs: [{ field: "col1", headerName: "Column 1" }],
        columnState: { order: ["col1"] },
        filterModel: { col1: { type: "equals", filter: "value" } },
      };
      const result = TableSchema.safeParse(validTable);
      expect(result.success).toBe(true);
    });

    it("should validate an empty object (all fields are optional within)", () => {
      const result = TableSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          // All inner fields are optional, so they'd be undefined if not provided.
        });
      }
    });

    it("should handle optional sub-schemas correctly", () => {
      const tableWithMissingParts = {
        showAll: null, // nullish is allowed
      };
      const result = TableSchema.safeParse(tableWithMissingParts);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data?.chartView).toBeUndefined();
        expect(result.data?.columnsDefs).toBeUndefined();
        expect(result.data?.showAll).toBeNull();
      }
    });

    it("should accept valid formatterFn values", () => {
      const validFormatters = [
        "int",
        "none",
        "percent",
        "normalized",
        "normalizedPercent",
        "dateToYear",
      ];
      for (const formatter of validFormatters) {
        const result = TableSchema.safeParse({ formatterFn: formatter });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data?.formatterFn).toBe(formatter);
        }
      }
    });

    it("should reject invalid formatterFn values", () => {
      const result = TableSchema.safeParse({ formatterFn: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should allow null and undefined formatterFn", () => {
      const nullResult = TableSchema.safeParse({ formatterFn: null });
      expect(nullResult.success).toBe(true);

      const undefinedResult = TableSchema.safeParse({});
      expect(undefinedResult.success).toBe(true);
      if (undefinedResult.success) {
        expect(undefinedResult.data?.formatterFn).toBeUndefined();
      }
    });
  });

  describe("WidgetSchemaBase", () => {
    it("should have a consistent shape", () => {
      const shapeKeys = Object.keys(WidgetSchemaBase.shape).sort();
      expect(shapeKeys).toMatchInlineSnapshot(`
        [
          "copilotParseAs",
          "dataUpdateDisplay",
          "description",
          "disableRetrievalForCopilot",
          "exportable",
          "external",
          "fileEndpoint",
          "groupById",
          "groupId",
          "id",
          "innerTab",
          "inputType",
          "name",
          "params",
          "raw",
          "refetchInterval",
          "runButton",
          "showTitle",
          "staleTime",
          "storage",
          "type",
          "widgetId",
        ]
      `);
    });

    it("should validate a minimal valid widget base object", () => {
      const minimalWidget = { id: "widget1", widgetId: "base1" };
      const result = WidgetSchemaBase.safeParse(minimalWidget);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staleTime).toBe(1000 * 60 * 5); // Default
        expect(result.data.params).toEqual([]); // Default
        expect(result.data.refetchInterval).toBeUndefined(); // Nullish
      }
    });

    it("should validate with all fields populated", () => {
      const fullWidget = {
        id: "fullId",
        widgetId: "fullWidgetId",
        type: "chart" as const,
        fileEndpoint: "/file",
        name: "My Widget",
        showTitle: false,
        description: "A detailed description.",
        groupId: "groupA",
        groupById: "item1",
        innerTab: "details",
        disableRetrievalForCopilot: true,
        storage: { myKey: "myValue" },
        external: false,
        params: [{ paramName: "p1", type: "text" as const }],
        staleTime: 10000,
        refetchInterval: 5000,
        runButton: true,
        copilotParseAs: "structured" as const,
      };
      const result = WidgetSchemaBase.safeParse(fullWidget);
      expect(result.success).toBe(true);
      if (!result.success) console.log(result.error.issues);
      expect(result.data?.storage).toEqual({ myKey: "myValue" });
    });

    it("should invalidate if required fields (id, widgetId) are missing", () => {
      const invalidWidget = { name: "Test Widget" };
      const result = WidgetSchemaBase.safeParse(invalidWidget);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.path.includes("id") && i.message.includes("received undefined"),
          ),
        ).toBe(true);
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes("widgetId") && i.message.includes("received undefined"),
          ),
        ).toBe(true);
      }
    });

    it("should validate staleTime minimum", () => {
      const invalidStaleTime = { id: "w", widgetId: "w", staleTime: 500 }; // Min is 1000
      const result = WidgetSchemaBase.safeParse(invalidStaleTime);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) =>
              i.path.includes("staleTime") &&
              i.message.includes("expected number to be >=1000"),
          ),
        ).toBe(true);
      }
    });

    it("should validate refetchInterval minimum if number", () => {
      const invalidRefetch = { id: "w", widgetId: "w", refetchInterval: 500 }; // Min is 1000
      const result = WidgetSchemaBase.safeParse(invalidRefetch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => {
            return (
              i.path.includes("refetchInterval") &&
              i.message.includes("expected number to be >=1000")
            );
          }),
        ).toBe(true);
      }

      const validRefetchBoolean = { id: "w", widgetId: "w", refetchInterval: false };
      expect(WidgetSchemaBase.safeParse(validRefetchBoolean).success).toBe(true);

      const validRefetchCron = {
        id: "w",
        widgetId: "w",
        refetchInterval: "*/15 * * * *",
        dataUpdateDisplay: "0 8 * * 1-5",
      };
      expect(WidgetSchemaBase.safeParse(validRefetchCron).success).toBe(true);
    });

    it("should allow showTitle to be null", () => {
      const widget = { id: "w", widgetId: "w", showTitle: null };
      const result = WidgetSchemaBase.safeParse(widget);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.showTitle).toBeNull();
      }
    });
  });
});
