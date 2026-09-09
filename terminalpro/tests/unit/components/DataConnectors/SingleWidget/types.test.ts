import { describe, expect, it } from "vitest";
import type { $ZodCheckMinLength } from "zod/v4/core";
import { CATEGORY_OPTIONS } from "~/components/DataConnectors/common/helpers";
import { WidgetSchema } from "~/components/DataConnectors/SingleWidget/types";

describe("WidgetSchema", () => {
  it("should have the expected schema structure", () => {
    const schemaShape = WidgetSchema.def.shape;

    const expectedFields = [
      "name",
      "description",
      "category",
      "subCategory",
      "source",
      "endpoint",
      "dataKey",
      "endpointHeaders",
    ];

    expectedFields.forEach((field) => {
      expect(schemaShape).toHaveProperty(field);
    });

    expect(schemaShape.name.def.type).toBe("string");
    expect(schemaShape.endpoint.def.type).toBe("string");

    const nameMinLength = schemaShape.name.def.checks.find(
      (check): check is $ZodCheckMinLength => check._zod.def.check === "min_length",
    );
    expect(nameMinLength).toBeDefined();
    expect(nameMinLength._zod.def.minimum).toBe(1);

    const endpointMinLength = schemaShape.endpoint.def.checks.find(
      (check): check is $ZodCheckMinLength => check._zod.def.check === "min_length",
    );
    expect(endpointMinLength).toBeDefined();
    expect(endpointMinLength._zod.def.minimum).toBe(1);

    expect(schemaShape.category.def.type).toBe("optional");
    const categoryInnerType = schemaShape.category.def.innerType;
    expect(categoryInnerType.def.type).toBe("enum");
    expect(Object.keys(categoryInnerType.def.entries)).toEqual(CATEGORY_OPTIONS);

    if (schemaShape.endpointHeaders.def.type === "optional") {
      const headersArray = schemaShape.endpointHeaders.def.innerType;
      expect(headersArray.def.type).toBe("array");

      const headerObject = headersArray.def.element._zod.def;
      expect(headerObject.type).toBe("object");

      const headerShape = headerObject.shape;
      expect(headerShape).toHaveProperty("key");
      expect(headerShape).toHaveProperty("value");

      expect(headerShape.key.def.type).toBe("string");
      expect(headerShape.value.def.type).toBe("string");
    }
  });

  it("should validate a valid widget configuration", () => {
    const validWidget = {
      name: "Test Widget",
      description: "A test widget",
      category: "Stocks",
      subCategory: "performance",
      source: "API",
      endpoint: "https://api.example.com/data",
      dataKey: "results",
      endpointHeaders: [
        { key: "Content-Type", value: "application/json" },
        { key: "Authorization", value: "Bearer token123" },
      ],
    };

    const result = WidgetSchema.safeParse(validWidget);

    if (!result.success) {
      console.log(result.error.issues);
    }

    expect(result.success).toBe(true);
  });

  it("should validate with minimal required fields", () => {
    const minimalWidget = {
      name: "Minimal Widget",
      endpoint: "https://api.example.com/data",
    };

    const result = WidgetSchema.safeParse(minimalWidget);
    expect(result.success).toBe(true);
  });

  it("should reject when required fields are missing", () => {
    const invalidWidget = {
      description: "Missing required fields",
    };

    const result = WidgetSchema.safeParse(invalidWidget);
    expect(result.success).toBe(false);

    if (!result.success) {
      const nameError = result.error.issues.find((issue) =>
        issue.path.includes("name"),
      );
      expect(nameError).toBeDefined();
      expect(nameError?.message).toBe(
        "Invalid input: expected string, received undefined",
      );
    }
  });

  it("should reject when endpoint is missing", () => {
    const invalidWidget = {
      name: "No Endpoint Widget",
    };

    const result = WidgetSchema.safeParse(invalidWidget);
    expect(result.success).toBe(false);

    if (!result.success) {
      const endpointError = result.error.issues.find((issue) =>
        issue.path.includes("endpoint"),
      );
      expect(endpointError).toBeDefined();
      expect(endpointError?.message).toBe(
        "Invalid input: expected string, received undefined",
      );
    }
  });

  it("should reject invalid header entries", () => {
    const widgetWithInvalidHeaders = {
      name: "Invalid Headers Widget",
      endpoint: "https://api.example.com/data",
      endpointHeaders: [
        { key: "", value: "application/json" },
        { key: "Authorization", value: "" },
      ],
    };

    const result = WidgetSchema.safeParse(widgetWithInvalidHeaders);
    expect(result.success).toBe(false);

    if (!result.success) {
      const headerErrors = result.error.issues.filter((issue) =>
        issue.path.some((p) => p === "endpointHeaders"),
      );
      expect(headerErrors.length).toBeGreaterThan(0);
    }
  });

  it("should validate with an invalid category", () => {
    const widgetWithInvalidCategory = {
      name: "Invalid Category Widget",
      endpoint: "https://api.example.com/data",
      category: "invalid-category",
    };

    const result = WidgetSchema.safeParse(widgetWithInvalidCategory);
    expect(result.success).toBe(false);

    if (!result.success) {
      const categoryError = result.error.issues.find((issue) =>
        issue.path.includes("category"),
      );
      expect(categoryError).toBeDefined();
    }
  });
});
