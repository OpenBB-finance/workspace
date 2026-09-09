import { z } from "zod";

// --------------- Zod schemas ---------------

export const OpenBBWidgetManifestSchema = z.object({
  widgetId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  dataType: z.enum(["table", "markdown"]),
});

export const OpenBBParamDefSchema = z.object({
  paramName: z.string(),
  label: z.string().optional(),
  type: z.enum(["text", "number", "date", "boolean"]),
  description: z.string().optional(),
  value: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});

export const OpenBBConnectMessageSchema = z.object({
  type: z.literal("openbb-connect"),
  widgets: z.array(OpenBBWidgetManifestSchema),
  params: z.array(OpenBBParamDefSchema).optional(),
});

export const OpenBBDataMessageSchema = z.object({
  type: z.literal("openbb-data"),
  widgetId: z.string(),
  dataType: z.enum(["table", "markdown"]),
  data: z.union([z.array(z.record(z.unknown())), z.string()]),
  columns: z.array(z.string()).optional(),
});

export const OpenBBErrorMessageSchema = z.object({
  type: z.literal("openbb-error"),
  widgetId: z.string(),
  error: z.string(),
});

const OpenBBWidgetParamPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const OpenBBWidgetParamValueSchema = z.union([
  OpenBBWidgetParamPrimitiveSchema,
  z.array(OpenBBWidgetParamPrimitiveSchema),
]);

export const WIDGET_PARAM_MESSAGE_TYPES = [
  "openbb:widget-params:update",
  "openbb:params:update",
] as const;

export type WidgetParamMessageType = (typeof WIDGET_PARAM_MESSAGE_TYPES)[number];

export const OpenBBWidgetParamsUpdateMessageSchema = z.object({
  type: z.enum(WIDGET_PARAM_MESSAGE_TYPES),
  params: z.record(OpenBBWidgetParamValueSchema).optional(),
  paramName: z.string().optional(),
  value: OpenBBWidgetParamValueSchema.optional(),
});

// --------------- TypeScript types (inferred from schemas) ---------------

export type OpenBBWidgetManifest = z.infer<typeof OpenBBWidgetManifestSchema>;
export type OpenBBParamDef = z.infer<typeof OpenBBParamDefSchema>;
export type OpenBBConnectMessage = z.infer<typeof OpenBBConnectMessageSchema>;
export type OpenBBDataMessage = z.infer<typeof OpenBBDataMessageSchema>;
export type OpenBBErrorMessage = z.infer<typeof OpenBBErrorMessageSchema>;
export type OpenBBWidgetParamValue = z.infer<typeof OpenBBWidgetParamValueSchema>;
export type OpenBBWidgetParamsUpdateMessage = z.infer<
  typeof OpenBBWidgetParamsUpdateMessageSchema
>;

// These outgoing message types don't need validation schemas
export interface OpenBBParamsUpdateMessage {
  type: "openbb-params-update";
  params: Record<string, string>;
}

export interface OpenBBAuthMessage {
  type: "openbb-auth";
  headers: Record<string, string>;
}

export interface OpenBBRequestMessage {
  type: "openbb-request";
  widgetId: string | null;
}

// --------------- Shared parsing helpers ---------------

export function isWidgetParamMessageType(
  value: unknown,
): value is WidgetParamMessageType {
  return (
    typeof value === "string" &&
    (WIDGET_PARAM_MESSAGE_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Parses an `openbb:widget-params:update` / `openbb:params:update` postMessage
 * payload into a flat `{ paramName: value }` record.
 *
 * Returns `null` (silently) when the message is not a params-update type, so
 * callers can route every incoming message through this without spamming
 * warnings. Returns `null` (with a warning) only when the type matches but the
 * shape fails Zod validation.
 */
export function parseIframeParamsMessage(
  data: unknown,
): Record<string, OpenBBWidgetParamValue> | null {
  if (!data || typeof data !== "object") return null;
  if (!isWidgetParamMessageType((data as { type?: unknown }).type)) return null;

  const parsed = OpenBBWidgetParamsUpdateMessageSchema.safeParse(data);
  if (!parsed.success) {
    console.warn(
      "[iframe-protocol] invalid widget params update message.",
      parsed.error.issues,
    );
    return null;
  }

  const result: Record<string, OpenBBWidgetParamValue> = {};
  const msg = parsed.data;

  if (msg.params) {
    for (const [paramName, value] of Object.entries(msg.params)) {
      result[paramName] = value;
    }
  }

  if (msg.paramName) {
    result[msg.paramName] = msg.value ?? null;
  }

  return result;
}

/**
 * Renders a parsed `OpenBBWidgetParamValue` to the string form used by the
 * outbound `openbb-params-update` message and the iframe query-string. Arrays
 * are joined by `,`; `null`/`undefined` collapse to `""`.
 */
export function stringifyParamValue(value: OpenBBWidgetParamValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null)
      .map((item) => String(item))
      .join(",");
  }
  return String(value);
}
