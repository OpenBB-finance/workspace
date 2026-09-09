import { z } from "zod";
import {
  ChartViewOptionsSchema,
  CronExpressionSchema,
  FormatterFnSchema,
  ParamsSchema,
  RefetchIntervalSchema,
  TableColumnDefsSchema,
  type WidgetVizType,
  widgetTypesSchema,
} from "~/lib/types/app";
export const banned_keywords = [
  "add",
  "alter",
  "backup",
  "check",
  "constraint",
  "create",
  "delete",
  "drop",
  "exec",
  "insert",
  "update",
];
const bannedKeywordsPattern = `^(?!(${banned_keywords.join("|")})\\b)`;
const bannedKeywordsRegex = new RegExp(bannedKeywordsPattern, "i");
const passwordRegex = /^(?=\S*[a-z])(?=\S*[A-Z])(?=\S*\d)(?=\S*[^\w\s])\S{8,}$/;
const invalidPassword =
  "Password: min. 8 characters, including a number, uppercase, lowercase, and special character. Spaces are forbidden.";

export const zodPassword = z
  .string()
  .min(1, "This field is required")
  .regex(passwordRegex, invalidPassword);

export const zodEmail = z.email("Invalid email").min(1, "This field is required");

export const query = z
  .string()
  .min(1, "This field is required")
  .regex(bannedKeywordsRegex, "Query must not start with a banned keyword");

export const SQLIntroSchema = z
  .object({
    database_type: z.enum(["mysql", "sqlite"]),
    username: z.string().min(1, "This field is required"),
    password: z.string().min(1, "This field is required"),
    host: z.string().min(1, "This field is required"),
  })
  .or(
    z.object({
      database_type: z.enum(["mysql", "sqlite"]),
    }),
  );

export type SQLIntroForm = z.infer<typeof SQLIntroSchema>;

export const SnowflakeIntroSchema = z.object({
  username: z.string().min(1, "This field is required"),
  password: z.string().min(1, "This field is required"),
  account: z.string().min(1, "This field is required"),
});

export type SnowflakeIntroForm = z.infer<typeof SnowflakeIntroSchema>;

export const MetadataSchema = z.object({
  category: z.string().optional(),
  sub_category: z.string().optional(),
  subCategory: z.string().optional(),
  description: z.string().optional(),
});

export const DatabaseSubmitSchema = z.object({
  ...MetadataSchema.shape,
  name: z.string().min(1, "This field is required"),
  database: z.string().min(1, "This field is required"),
  query,
});

export type DatabaseSubmitForm = z.infer<typeof DatabaseSubmitSchema>;

export const totpSchema = z.object({
  totp: z
    .string()
    .length(6, "This field must be six characters")
    .regex(/^[0-9]{6}$/, { message: "Invalid code" }),
});

export type totpForm = z.infer<typeof totpSchema>;

function isAllowedIframeUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    if (parsed.protocol !== "http:") return false;

    return ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export const urlSchema = z.object({
  url: z
    .string()
    .transform((url) => {
      if (!/^https?:\/\//i.test(url)) {
        return `https://${url}`;
      }
      return url;
    })
    .refine(isAllowedIframeUrl, {
      message: "URL must start with https:// or local http://",
    })
    .refine(
      (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Invalid URL",
      },
    ),
});

export type urlForm = z.infer<typeof urlSchema>;

export const resetSchema = z
  .object({
    password: zodPassword,
    confirm: zodPassword,
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type resetForm = z.infer<typeof resetSchema>;

const widgetShapeDefinition = {
  name: z.string(),
  showTitle: z.boolean().default(true).nullish(),
  description: z.string(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  schemaName: z.string().optional(),
  source: z.union([z.string(), z.array(z.string())]).optional(),
  widgetId: z.string().optional(),
  widgetType: z.string().optional(),
  endpoint: z.string(),
  fileEndpoint: z.string().optional(),
  wsEndpoint: z.string().optional(),
  params: ParamsSchema.optional(),
  groupById: z.string().optional().nullish(),
  data: z
    .object({
      dataKey: z.string().optional(),
      wsRowIdColumn: z.union([z.string(), z.array(z.string())]).optional(),
      wsRowIdColumns: z.array(z.string()).optional(),
      table: z
        .object({
          showAll: z.boolean().optional(),
          enableAdvanced: z.boolean().optional(),
          transpose: z.boolean().nullish(),
          period: z.union([z.boolean(), z.array(z.string())]).optional(),
          columnsDefs: TableColumnDefsSchema.optional(),
          chartView: ChartViewOptionsSchema.default({
            enabled: false,
            chartType: "line",
          }).optional(),
          formatterFn: FormatterFnSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  type: widgetTypesSchema.default("table").optional(),
  defaultViz: widgetTypesSchema.optional(),
  gridData: z
    .object({
      w: z.number(),
      h: z.number(),
    })
    .optional(),
  staleTime: z
    .union([z.number().min(1000), z.literal(false)])
    .default(1000 * 60 * 15)
    .optional(),
  refetchInterval: RefetchIntervalSchema.nullish(),
  dataUpdateDisplay: CronExpressionSchema.optional(),
  runButton: z.boolean().optional(),
  disableRetrievalForCopilot: z.boolean().optional(),
  copilotParseAs: z
    .union([z.literal("structured"), z.literal("unstructured")])
    .optional(),
  inputType: z.string().optional(),
  raw: z.boolean().optional(),
  exportable: z.boolean().optional(),
  storage: z.record(z.string(), z.any()).optional(),
};

const widgetSchemaBase = z.object(widgetShapeDefinition).meta({ id: "Widget" });

export const widgetSchema = z
  .preprocess(
    ({
      subCategory,
      defaultViz,
      type,
      ...rest
    }: z.output<typeof widgetSchemaBase> & {
      defaultViz?: WidgetVizType;
    }) => {
      if ((rest.runButton && !rest.refetchInterval) || rest.refetchInterval === false) {
        rest.staleTime = false;
        rest.refetchInterval = false;
      } else if (!rest.runButton && rest.refetchInterval === undefined) {
        rest.refetchInterval = 1000 * 60 * 15;
      }

      return {
        subCategory,
        type: (type ?? defaultViz) as WidgetVizType,
        defaultViz,
        ...rest,
      };
    },
    widgetSchemaBase,
  )
  .refine(
    // make sure multi_file_viewer has "fileSelector" in roles
    (data) => {
      if (data.type === "multi_file_viewer") {
        return data.params?.some(
          (param) => param.type === "endpoint" && param.roles?.includes("fileSelector"),
        );
      }
      return true;
    },
    {
      path: ["params"],
      message: `Endpoint param with \`{ roles: ["fileSelector"] }\` required for \`multi_file_viewer\`.`,
    },
  );

export type WidgetType = z.infer<typeof widgetSchema>;
export type WidgetsType = {
  [key: string]: WidgetType & {
    sdkFunc: string;
    disabled?: boolean;
    sub_category?: string;
    defaultViz?: WidgetVizType;
  };
};
export const specificationSchema = z.record(z.string(), widgetSchema).meta({
  properties: {
    $id: {
      type: "string",
      format: "uri-reference",
    },
    $schema: {
      type: "string",
      format: "uri",
    },
  },
});

// console.warn(
//   z.toJSONSchema(specificationSchema, { reused: "inline", target: "draft-7" }),
// );

// Derived from the Zod schema shape so it stays in sync automatically.
export const KNOWN_WIDGET_KEYS = new Set(Object.keys(widgetShapeDefinition));

export interface UnrecognizedKeysEntry {
  name: string;
  keys: string[];
}

export interface UnrecognizedKeysReport {
  label: string;
  entries: UnrecognizedKeysEntry[];
}

const IGNORE_KEYS = new Set(["mcp_tool", "searchCategory"]);

/**
 * Detects unrecognized top-level keys in a set of named objects.
 *
 * Designed to run on **raw** (pre-Zod-parse) JSON entries so that keys
 * stripped by Zod's `.object()` are still visible.
 *
 * - Non-object / nullish entries are silently skipped.
 * - Each entry is identified by `name`, falling back to `id`, then `"Unknown"`.
 *
 * @returns A structured report for the given label, or `null` if every entry
 *          only contains recognised keys.
 */
export function detectUnrecognizedKeys(
  label: string,
  entries: unknown[],
  knownKeys: Set<string>,
): UnrecognizedKeysReport | null {
  const found: UnrecognizedKeysEntry[] = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const obj = entry as Record<string, unknown>;
    const extraKeys = Object.keys(obj).filter(
      (k) => !knownKeys.has(k) && !IGNORE_KEYS.has(k),
    );
    if (extraKeys.length > 0) {
      found.push({
        name: String(obj.name || obj.id || "Unknown"),
        keys: extraKeys,
      });
    }
  }

  return found.length > 0 ? { label, entries: found } : null;
}

/** Formats structured reports into plain text (used for clipboard copy). */
export function formatUnrecognizedKeysAsText(
  reports: UnrecognizedKeysReport[],
): string {
  return reports
    .map((r) => {
      const lines = r.entries.map((e) => `• ${e.name}: ${e.keys.join(", ")}`);
      return `${r.label}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}

export const WidgetSchema = z.object({
  name: z.string(),
  url: z.string(),
});
