import { describe, expect, it } from "vitest";
import {
  getParamsOrder,
  updateParamOrder,
} from "~/components/DataConnectors/common/helpers";
import type { ParamDef } from "~/components/types";

describe("getParamsOrder", () => {
  it("should return undefined when params order is unchanged", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toBeUndefined();
  });

  it("should return new order when params are reordered", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param3", value: "value3", show: true },
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toEqual(["param3", "param1", "param2"]);
  });

  it("should exclude params with show: false from order", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: false },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toEqual(["param1", "param3"]);
  });

  it("should return new order when visibility changes", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: false },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toEqual(["param1", "param2", "param3"]);
  });

  it("should handle empty arrays", () => {
    const result = getParamsOrder([], []);
    expect(result).toBeUndefined();
  });

  it("should handle params with undefined show property (defaults to visible)", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1" },
      { type: "text", paramName: "param2", value: "value2" },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1" },
      { type: "text", paramName: "param2", value: "value2" },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toBeUndefined();
  });

  it("should return new order when a param is hidden", () => {
    const origParams: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: false },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1" },
      { type: "text", paramName: "param2", value: "value2" },
      { type: "text", paramName: "param3", value: "value3" },
    ];

    const result = getParamsOrder(origParams, params);
    expect(result).toEqual(["param1", "param3"]);
  });
});

describe("updateParamOrder", () => {
  it("should return original params when paramOrder is undefined", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
    ];

    const result = updateParamOrder(undefined, params);
    expect(result).toEqual(params);
  });

  it("should reorder params according to paramOrder", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const paramOrder = ["param3", "param1", "param2"];

    const result = updateParamOrder(paramOrder, params);

    expect(result[0].paramName).toBe("param3");
    expect(result[1].paramName).toBe("param1");
    expect(result[2].paramName).toBe("param2");
  });

  it("should set show: false for params not in paramOrder", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const paramOrder = ["param1", "param3"]; // param2 is hidden

    const result = updateParamOrder(paramOrder, params);

    const param1 = result.find((p) => p.paramName === "param1");
    const param2 = result.find((p) => p.paramName === "param2");
    const param3 = result.find((p) => p.paramName === "param3");

    expect(param1?.show).toBe(true);
    expect(param2?.show).toBe(false);
    expect(param3?.show).toBe(true);
  });

  it("should place params not in paramOrder at the end", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param3", value: "value3", show: true },
    ];

    const paramOrder = ["param3", "param1"]; // param2 not in order

    const result = updateParamOrder(paramOrder, params);

    expect(result[0].paramName).toBe("param3");
    expect(result[1].paramName).toBe("param1");
    expect(result[2].paramName).toBe("param2");
  });

  it("should handle empty paramOrder", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
    ];

    const paramOrder: string[] = [];

    const result = updateParamOrder(paramOrder, params);

    // All params should have show: false
    expect(result[0].show).toBe(false);
    expect(result[1].show).toBe(false);
  });

  it("should handle empty params array", () => {
    const params: ParamDef[] = [];
    const paramOrder = ["param1", "param2"];

    const result = updateParamOrder(paramOrder, params);
    expect(result).toEqual([]);
  });

  it("should preserve all param properties while updating show and order", () => {
    const params: ParamDef[] = [
      {
        type: "text",
        paramName: "param1",
        value: "value1",
        show: true,
        label: "Label 1",
        description: "Description 1",
      },
      {
        type: "number",
        paramName: "param2",
        value: 42,
        show: true,
        label: "Label 2",
      },
    ];

    const paramOrder = ["param2", "param1"];

    const result = updateParamOrder(paramOrder, params);

    expect(result[0].paramName).toBe("param2");
    expect(result[0].label).toBe("Label 2");
    expect(result[0].value).toBe(42);
    expect(result[0].type).toBe("number");

    expect(result[1].paramName).toBe("param1");
    expect(result[1].label).toBe("Label 1");
    expect(result[1].description).toBe("Description 1");
    expect(result[1].value).toBe("value1");
  });

  it("should handle params with same name appearing in both arrays", () => {
    const params: ParamDef[] = [
      { type: "text", paramName: "param1", value: "value1", show: true },
      { type: "text", paramName: "param2", value: "value2", show: true },
      { type: "text", paramName: "param1", value: "value1-duplicate", show: true },
    ];

    const paramOrder = ["param2", "param1"];

    const result = updateParamOrder(paramOrder, params);

    expect(result.length).toBe(3);
    // First param1 in the array should match the order
    expect(result[0].paramName).toBe("param2");
    expect(result[1].paramName).toBe("param1");
  });
});
