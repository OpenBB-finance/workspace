/**
 * Helpers for turning an MCP tool's JSON-Schema `inputSchema` (typed as `any`
 * on the store) into a flat, render-ready list of parameters for the tool
 * hover tooltip. All functions are pure and defensive: malformed or partial
 * schemas degrade to readable fallbacks rather than throwing.
 */

export type JsonSchemaObject = Record<string, unknown>;

export type SchemaParameter = {
  name: string;
  typeLabel: string;
  description?: string;
  required: boolean;
  currentValue?: string;
  defaultValue?: string;
};

export function isRecord(value: unknown): value is JsonSchemaObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function formatSchemaValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function formatPrimitiveTypeLabel(type: string): string {
  switch (type) {
    case "string":
      return "str";
    case "integer":
      return "int";
    case "number":
      return "num";
    case "boolean":
      return "bool";
    case "object":
      return "obj";
    default:
      return type;
  }
}

export function formatSchemaType(schema: unknown): string {
  if (!isRecord(schema)) return "value";

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum
      .map((value) => formatSchemaValue(value))
      .filter((value): value is string => !!value)
      .join(" | ");
  }

  const variants = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : undefined;
  if (variants?.length) {
    return variants.map(formatSchemaType).join(" | ");
  }

  if (schema.const !== undefined) return formatSchemaValue(schema.const) ?? "const";

  const type = schema.type;
  if (Array.isArray(type)) {
    return type.map((value) => formatPrimitiveTypeLabel(String(value))).join(" | ");
  }
  if (type === "array") {
    return `${formatSchemaType(schema.items)}[]`;
  }
  if (typeof type === "string") {
    const typeLabel = formatPrimitiveTypeLabel(type);
    return typeof schema.format === "string"
      ? `${typeLabel} (${schema.format})`
      : typeLabel;
  }

  return "value";
}

export function schemaParameters(
  inputSchema: unknown,
  currentParams?: Record<string, string>,
): SchemaParameter[] {
  if (!isRecord(inputSchema) || !isRecord(inputSchema.properties)) return [];
  const required = new Set(
    Array.isArray(inputSchema.required)
      ? inputSchema.required.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  );

  return Object.entries(inputSchema.properties).map(([name, schema]) => {
    const schemaRecord = isRecord(schema) ? schema : {};
    return {
      name,
      typeLabel: formatSchemaType(schemaRecord),
      description:
        typeof schemaRecord.description === "string"
          ? schemaRecord.description
          : undefined,
      required: required.has(name),
      currentValue: formatSchemaValue(currentParams?.[name]),
      defaultValue: formatSchemaValue(schemaRecord.default),
    };
  });
}
