import { describe, expect, it } from "vitest";
import {
  formatPrimitiveTypeLabel,
  formatSchemaType,
  formatSchemaValue,
  isRecord,
  schemaParameters,
} from "~/components/AI/utils/mcpToolSchema";

describe("isRecord", () => {
  it("accepts plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("rejects null, arrays, and primitives", () => {
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("x")).toBe(false);
    expect(isRecord(3)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("formatSchemaValue", () => {
  it("returns undefined only for undefined", () => {
    expect(formatSchemaValue(undefined)).toBeUndefined();
  });

  it("stringifies null, primitives, and objects", () => {
    expect(formatSchemaValue(null)).toBe("null");
    expect(formatSchemaValue("hi")).toBe("hi");
    expect(formatSchemaValue(42)).toBe("42");
    expect(formatSchemaValue(false)).toBe("false");
    expect(formatSchemaValue({ a: 1 })).toBe('{"a":1}');
    expect(formatSchemaValue([1, 2])).toBe("[1,2]");
  });

  it("falls back to String() when JSON.stringify throws", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    // Does not throw; produces some string representation.
    expect(typeof formatSchemaValue(circular)).toBe("string");
  });
});

describe("formatPrimitiveTypeLabel", () => {
  it("abbreviates known JSON Schema primitives", () => {
    expect(formatPrimitiveTypeLabel("string")).toBe("str");
    expect(formatPrimitiveTypeLabel("integer")).toBe("int");
    expect(formatPrimitiveTypeLabel("number")).toBe("num");
    expect(formatPrimitiveTypeLabel("boolean")).toBe("bool");
    expect(formatPrimitiveTypeLabel("object")).toBe("obj");
  });

  it("passes through unknown types unchanged", () => {
    expect(formatPrimitiveTypeLabel("custom")).toBe("custom");
  });
});

describe("formatSchemaType", () => {
  it("returns 'value' for non-object or typeless schemas", () => {
    expect(formatSchemaType(null)).toBe("value");
    expect(formatSchemaType("string")).toBe("value");
    expect(formatSchemaType({})).toBe("value");
  });

  it("formats primitive types", () => {
    expect(formatSchemaType({ type: "string" })).toBe("str");
    expect(formatSchemaType({ type: "integer" })).toBe("int");
  });

  it("appends format when present", () => {
    expect(formatSchemaType({ type: "string", format: "date-time" })).toBe(
      "str (date-time)",
    );
  });

  it("renders enums as a union of values", () => {
    expect(formatSchemaType({ enum: ["a", "b", "c"] })).toBe("a | b | c");
  });

  it("renders union type arrays", () => {
    expect(formatSchemaType({ type: ["string", "number"] })).toBe("str | num");
  });

  it("renders arrays with their item type", () => {
    expect(formatSchemaType({ type: "array", items: { type: "string" } })).toBe(
      "str[]",
    );
  });

  it("renders anyOf and oneOf as unions", () => {
    expect(formatSchemaType({ anyOf: [{ type: "string" }, { type: "number" }] })).toBe(
      "str | num",
    );
    expect(
      formatSchemaType({ oneOf: [{ type: "boolean" }, { type: "integer" }] }),
    ).toBe("bool | int");
  });

  it("renders const values", () => {
    expect(formatSchemaType({ const: "fixed" })).toBe("fixed");
  });

  it("prioritizes enum over type", () => {
    expect(formatSchemaType({ type: "string", enum: ["x", "y"] })).toBe("x | y");
  });
});

describe("schemaParameters", () => {
  it("returns [] when schema or properties are missing", () => {
    expect(schemaParameters(undefined)).toEqual([]);
    expect(schemaParameters(null)).toEqual([]);
    expect(schemaParameters({})).toEqual([]);
    expect(schemaParameters({ properties: "nope" })).toEqual([]);
  });

  it("maps properties to parameters with type, description and required flag", () => {
    const schema = {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string", description: "Ticker symbol" },
        limit: { type: "integer", default: 10 },
      },
    };

    expect(schemaParameters(schema)).toEqual([
      {
        name: "symbol",
        typeLabel: "str",
        description: "Ticker symbol",
        required: true,
        currentValue: undefined,
        defaultValue: undefined,
      },
      {
        name: "limit",
        typeLabel: "int",
        description: undefined,
        required: false,
        currentValue: undefined,
        defaultValue: "10",
      },
    ]);
  });

  it("includes the current value from supplied params", () => {
    const schema = { properties: { symbol: { type: "string" } } };
    const [param] = schemaParameters(schema, { symbol: "AAPL" });
    expect(param.currentValue).toBe("AAPL");
  });

  it("ignores non-string entries in required and tolerates non-object property schemas", () => {
    const schema = {
      required: ["a", 5],
      properties: { a: { type: "string" }, b: "not-an-object" },
    };
    const params = schemaParameters(schema);
    expect(params.find((p) => p.name === "a")?.required).toBe(true);
    expect(params.find((p) => p.name === "b")).toMatchObject({
      typeLabel: "value",
      required: false,
    });
  });
});
