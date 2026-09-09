import { z } from "zod";
import type { FormInputParamDef, ParamDef } from "~/components/types";
import { AG_CHART_TYPES } from "../constants";

function unionErrorMap(message: string) {
  return {
    error: (val) => {
      const output = { message: val.message };
      if (val.code === "invalid_union" || val.code === "invalid_value") {
        output.message = message;
      }
      return output;
    },
  } as { error: z.core.$ZodErrorMap };
}

export const ChartTypeSchema = z
  .enum(
    ["columnLineCombo", "areaColumnCombo", "customCombo", ...AG_CHART_TYPES],
    unionErrorMap("Invalid chart type"),
  )
  .default("line")
  .meta({ id: "ChartType" });

export const _GridDataSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  minH: z.number().nullish(),
  minW: z.number().nullish(),
  maxH: z.number().nullish(),
  maxW: z.number().nullish(),
  moved: z.boolean().nullish(),
  static: z.boolean().nullish(),
  isDraggable: z.boolean().nullish(),
});

export const StorageSchema = z.looseObject({}).default({});

export const CronExpressionSchema = z.string().trim().min(1);
export const RefetchIntervalSchema = z.union([
  z.number().min(1000),
  z.literal(false),
  CronExpressionSchema,
]);

export const TickerSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  category: z.enum(
    ["crypto", "equity", "forex", "index", "futures", "derivative", "etf", "country"],
    unionErrorMap("Invalid input"),
  ),
  color: z.string().nullish(),
  type: z.string().nullish(),
  name: z.string().nullish(),
  exchange: z.string().nullish(),
  currency: z.string().nullish(),
  industry: z.string().nullish(),
  sector: z.string().nullish(),
  country: z.string().nullish(),
  cik: z.string().nullish(),
  isin: z.string().nullish(),
  cusip: z.string().nullish(),
  has_options: z.boolean().nullish(),
});

export const ChartViewOptionsSchema = z.object({
  enabled: z.boolean().default(false).optional(),
  chartType: ChartTypeSchema.optional(),
  ignoreCellRange: z.boolean().optional(),
  cellRangeCols: z
    .record(ChartTypeSchema.optional(), z.array(z.string()).nullish())
    .optional(),
  chartSettingsOpen: z.boolean().default(false).optional(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
});

export const ChartModelSchema = z.looseObject({
  modelType: z.enum(["range", "pivot"]).optional(),
  chartType: ChartTypeSchema.optional(),
  chartOptions: z.record(z.string(), z.any()).optional(),
  cellRange: z
    .looseObject({
      columns: z.array(z.string()).optional(),
    })
    .optional(),
  suppressChartRanges: z.boolean().optional(),
});

export const ColorOptionsSchema = z.object({
  condition: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "between"]).optional(),
  color: z.union([
    z.enum(["green", "red", "blue"]),
    z
      .templateLiteral(["#", z.string()])
      .refine((v) => /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(v), {
        message: "Invalid hex color code",
      }),
  ]),
  fill: z.boolean().default(false).optional(),
});

export const ColorBaseSchema = ColorOptionsSchema.extend({
  condition: z.enum(["eq", "ne", "gt", "lt", "gte", "lte", "contains", "notContains"]),
  value: z.union([z.string(), z.number()]),
});

export const ColorBetweenSchema = ColorOptionsSchema.extend({
  condition: z.literal("between"),
  range: z.object({ min: z.number(), max: z.number() }),
});

export const ColorRuleSchema = z
  .discriminatedUnion("condition", [ColorBaseSchema, ColorBetweenSchema])
  .meta({ id: "ColorRule" });

export const RenderFnTypes = [
  "greenRed",
  "titleCase",
  "hoverCard",
  "cellOnClick",
  "columnColor",
  "showCellChange",
] as const;

export type RenderFn = (typeof RenderFnTypes)[number];

export const RenderFnSchema = z.enum(RenderFnTypes).optional();

const RenderFnParamsBaseSchema = z
  .looseObject({
    actionType: z
      // "openUrl", "openModal", "openWidget" not implemented yet
      .enum(["groupBy", "sendToAgent"])
      .nullish(),
    groupByParamName: z.string().nullish(),
    groupBy: z
      .object({
        forceUpdate: z.boolean().optional(),
        paramName: z
          .string()
          .min(1, "`groupBy.paramName` is required when actionType is groupBy"),
        valueField: z.string().optional(),
      })
      .optional(),
    hoverCard: z
      .object({
        cellField: z.string().optional().default("value"),
        title: z.string().optional(),
        markdown: z.string().optional(),
      })
      .nullish(),
    sendToAgent: z
      .object({
        markdown: z.string().optional(),
        agentId: z.string().nullish(),
      })
      .nullish(),
    colorRules: z.array(ColorRuleSchema).nullish(),
    colorValueKey: z.string().nullish(),
  })
  .nullish();

const RenderFnParamsSchema = z.preprocess(
  (val: z.output<typeof RenderFnParamsBaseSchema>, ctx) => {
    if (!val) return undefined;

    if (val?.actionType === "groupBy") {
      if (typeof val.groupByParamName === "string") {
        const { groupByParamName, groupBy, ...rest } = val;
        return {
          ...rest,
          groupBy: {
            ...(groupBy ?? {}),
            paramName: groupByParamName,
          },
        };
      }

      if (!val.groupBy || typeof val.groupBy?.paramName !== "string") {
        ctx.addIssue({
          code: "custom",
          message: "`groupBy.paramName` is required when actionType is `groupBy`",
        });
      }
    }

    if (val?.actionType === "sendToAgent") {
      if (!val.sendToAgent || typeof val.sendToAgent?.markdown !== "string") {
        ctx.addIssue({
          code: "custom",
          message:
            "`sendToAgent.markdown` is required when actionType is `sendToAgent`",
        });
      }
    }

    return val;
  },
  RenderFnParamsBaseSchema,
);

export const FormatterFnSchema = z
  .enum(["int", "none", "percent", "normalized", "normalizedPercent", "dateToYear"])
  .nullish();

export const TableColumnDefsSchema = z.array(
  z.object({
    field: z.string(),
    enableCellChangeWs: z.boolean().default(true).nullish(),
    headerName: z.string(),
    chartDataType: z.enum(["category", "series", "time", "excluded"]).optional(),
    cellDataType: z
      .enum(["text", "number", "boolean", "date", "dateString", "object"])
      .optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    formatterFn: FormatterFnSchema,
    decimalPlaces: z.number().min(0).max(6).optional(),
    renderFn: z
      .preprocess((val) => {
        if (typeof val === "string") {
          return val.split(",").map((v) => v.trim());
        }

        return Array.isArray(val) ? val?.map((v) => v?.trim()) : val;
      }, z.array(RenderFnSchema).optional())
      .nullish(),
    renderFnParams: RenderFnParamsSchema.nullish(),
    // Sparkline configuration
    sparkline: z
      .object({
        type: z.enum(["line", "area", "bar"]),
        dataField: z.string().optional(),
        options: z
          .object({
            stroke: z.string().optional(),
            strokeWidth: z.number().optional(),
            fill: z.string().optional(),
            fillOpacity: z.number().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            direction: z.enum(["vertical", "horizontal"]).optional(),
            xKey: z.string().optional(),
            yKey: z.string().optional(),
            tooltip: z
              .object({
                enabled: z.boolean().optional(),
                renderer: z.string().optional(),
              })
              .optional(),
            axis: z
              .object({
                type: z.enum(["number", "category", "time"]).optional(),
                stroke: z.string().optional(),
                strokeWidth: z.number().optional(),
                paddingInner: z.number().optional(),
                paddingOuter: z.number().optional(),
              })
              .optional(),
            markers: z
              .object({
                enabled: z.boolean().optional(),
                shape: z
                  .enum(["circle", "diamond", "square", "plus", "cross", "triangle"])
                  .optional(),
                size: z.number().optional(),
                fill: z.string().optional(),
                stroke: z.string().optional(),
                strokeWidth: z.number().optional(),
                highlightSize: z.number().optional(),
              })
              .optional(),
            highlightStyle: z
              .object({
                fill: z.string().optional(),
                stroke: z.string().optional(),
                strokeWidth: z.number().optional(),
              })
              .optional(),
            // Points of interest configuration
            pointsOfInterest: z
              .object({
                firstLast: z
                  .object({
                    size: z.number().optional(),
                    fill: z.string().optional(),
                    stroke: z.string().optional(),
                    strokeWidth: z.number().optional(),
                  })
                  .optional(),
                minimum: z
                  .object({
                    size: z.number().optional(),
                    fill: z.string().optional(),
                    stroke: z.string().optional(),
                    strokeWidth: z.number().optional(),
                  })
                  .optional(),
                maximum: z
                  .object({
                    size: z.number().optional(),
                    fill: z.string().optional(),
                    stroke: z.string().optional(),
                    strokeWidth: z.number().optional(),
                  })
                  .optional(),
                positiveNegative: z
                  .object({
                    positive: z
                      .object({
                        size: z.number().optional(),
                        fill: z.string().optional(),
                        stroke: z.string().optional(),
                        strokeWidth: z.number().optional(),
                      })
                      .optional(),
                    negative: z
                      .object({
                        size: z.number().optional(),
                        fill: z.string().optional(),
                        stroke: z.string().optional(),
                        strokeWidth: z.number().optional(),
                      })
                      .optional(),
                  })
                  .optional(),
                highlighted: z
                  .object({
                    size: z.number().optional(),
                    fill: z.string().optional(),
                    stroke: z.string().optional(),
                    strokeWidth: z.number().optional(),
                  })
                  .optional(),
              })
              .optional(),
            // Custom formatter function for styling bars/columns based on values
            customFormatter: z.string(),
            label: z
              .object({
                enabled: z.boolean().optional(),
                fontWeight: z.string().optional(),
                fontStyle: z.string().optional(),
                fontSize: z.number().optional(),
                fontFamily: z.string().optional(),
                color: z.string().optional(),
                placement: z
                  .enum([
                    "inside",
                    "outside",
                    "inside-center",
                    "inside-end",
                    "outside-center",
                    "outside-end",
                  ])
                  .optional(),
              })
              .optional(),
            padding: z
              .object({
                top: z.number().optional(),
                right: z.number().optional(),
                bottom: z.number().optional(),
                left: z.number().optional(),
              })
              .optional(),
          })
          .optional(),
      })
      .optional(),
    width: z.number().nullish(),
    maxWidth: z.number().nullish(),
    minWidth: z.number().nullish(),
    hide: z.boolean().nullish(),
    headerTooltip: z.string().nullish(),
    rowGroup: z.boolean().nullish(),
    aggFunc: z.string().nullish(),
    pinned: z.union([z.literal("left"), z.literal("right"), z.boolean()]).nullish(),
    align: z.enum(["left", "center", "right"]).optional(),
  }),
);

export const DataSchema = z.looseObject({}).optional();

export const TableSchema = z
  .object({
    showAll: z.boolean().nullish(),
    chartView: ChartViewOptionsSchema.optional(),
    columnsDefs: TableColumnDefsSchema.optional(),
    columnState: DataSchema.optional(),
    filterModel: DataSchema.optional(),
    transpose: z.boolean().optional(),
    enableAdvanced: z.boolean().optional(),
    enableFormulas: z.boolean().optional(),
    formatterFn: FormatterFnSchema,
  })
  .optional();

export const EditorLanguages = [
  "sql",
  "javascript",
  "python",
  "json",
  "html",
  "css",
  "markdown",
  "xml",
  "text",
] as const;
export type EditorLanguage = (typeof EditorLanguages)[number];

const ParamDefSchemaBase = z
  .object({
    paramName: z.string().min(1, "This field is required"),
    label: z.string().optional(),
    value: z.any().nullish(),
    description: z.any().optional(),
    multiple: z.boolean().default(false).optional(),
    row: z.number().optional(),
    type: z
      .enum(
        ["text", "date", "ticker", "number", "boolean", "endpoint", "button", "tabs"],
        unionErrorMap(
          "Supported types are text, date, ticker, number, boolean, endpoint, tabs",
        ),
      )
      .default("text")
      .optional(),
    show: z.boolean().default(true).optional(),
    hidden: z.boolean().optional().default(false),
    style: z
      .object({
        popupWidth: z.number().min(100).max(1000).optional(), // value in px for <AdvancedSelect /> popup width
      })
      .optional(),
    options: z
      .array(
        z
          .object({
            label: z.string(),
            value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullish(),
          })
          .optional(),
      )
      .default([])
      .optional(),
    multiSelect: z.boolean().default(false).optional(),
    roles: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
    query: z.string().optional(),
  })
  .partial({
    options: true,
    value: true,
    label: true,
    description: true,
    row: true,
    multiple: true,
    placeholder: true,
    multiSelect: true,
    show: true,
    hidden: true,
    query: true,
  })
  .meta({ id: "ParamDef" });

const ParamValueSchema = z.discriminatedUnion("type", [
  ParamDefSchemaBase.extend({
    type: z.literal("text"),
    value: z.string().nullish(),
    language: z.enum(EditorLanguages, unionErrorMap("Unsupported language")).nullish(),
  }).meta({ id: "TextParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("tabs"),
    value: z.string().nullish(),
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string().nullish(),
        }),
      )
      .optional(),
  }).meta({ id: "TabsParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("ticker"),
    value: z.string().nullish(),
  }).meta({ id: "TickerParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("date"),
    value: z.string().nullish(),
  }).meta({ id: "DateParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("button"),
    label: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullish(),
  }).meta({ id: "ButtonParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("number"),
    value: z
      .union([z.number(), z.string().regex(/^-?\d*\.?\d*$/)])
      .pipe(z.coerce.number())
      .nullish(),
  }).meta({ id: "NumberParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("boolean"),
    value: z.boolean().nullish(),
  }).meta({ id: "BooleanParamDef" }),
  ParamDefSchemaBase.extend({
    type: z.literal("endpoint"),
    value: z.any().nullish(),
    optionsEndpoint: z.string().optional(),
    optionsParams: z.record(z.string(), z.any()).optional(),
    groupById: z.string().optional(),
    query: z.string().optional(),
  }).meta({ id: "EndpointParamDef" }),
  ParamDefSchemaBase.extend({
    paramName: z.string().optional(),
    type: z.literal("form"),
    endpoint: z.string().optional(),
    method: z.enum(["POST", "PUT"]).optional(),
    inputParams: z
      .array(
        ParamDefSchemaBase.extend({
          type: z
            .enum(
              ["date", "boolean", "endpoint", "number", "text", "button"],
              unionErrorMap(
                "Supported types are text, date, button, number, boolean, endpoint",
              ),
            )
            .optional(),
        }),
      )
      .optional(),
  }).meta({ id: "FormParamDef" }),
]);

export const ParamDefSchema = ParamValueSchema.refine(
  (data) => {
    if (data.multiple === true && data.type !== "text") {
      return false;
    }
    return true;
  },
  {
    message: "multiple can only be true when type is 'text'",
    path: ["multiple"],
  },
);

const ParamDefSchemaArray = z.array(ParamDefSchema).refine(
  (params) => {
    const fileSelectorCount = params.filter((param) =>
      param.roles?.includes("fileSelector"),
    ).length;
    return fileSelectorCount <= 1;
  },
  {
    message: "Only one parameter can have the role 'fileSelector'.",
  },
);

const toParamType = { date: "date" } as const;

export function newParamDef<T extends ParamDef | FormInputParamDef>(paramDef: T): T {
  const { type, value, show } = paramDef;
  let options = paramDef.options ?? [];

  if (type === "boolean" && !options.length) {
    options = [
      { label: "True", value: true },
      { label: "False", value: false },
    ];
  }

  const parseValue = (v: any) => {
    if (!v) return undefined;
    if (type === "number" && typeof v === "string") {
      for (const fnc of [Number.parseFloat, Number.parseInt]) {
        const num = fnc(v);
        if (!Number.isNaN(num)) return num;
      }
    }
    if (type === "text") return v?.toString();
    return v;
  };

  const parsedValue = parseValue(value);

  return {
    ...paramDef,
    value: parsedValue ?? null,
    label: paramDef.label ?? paramDef.paramName,
    type: type ?? toParamType?.[paramDef.paramName] ?? "text",
    show: typeof show === "boolean" ? show : true,
    options,
  };
}

export function isParamDef(p: any): p is ParamDef {
  return typeof p === "object" && (p?.type === "form" || p?.paramName);
}

export function isParamDefArray(params: any): params is ParamDef[] {
  return Array.isArray(params) && params.every((p) => isParamDef(p));
}

export const ParamsSchema = z
  .preprocess((val) => {
    if (!Array.isArray(val)) return [];

    const values = val.map((item) => (isParamDef(item) ? newParamDef(item) : item));

    let row = isParamDef(values[0]) ? 1 : 0;
    for (const item of values) {
      if (isParamDefArray(item)) {
        for (const p of item) {
          if (!isParamDef(p)) continue;

          Object.assign(p, newParamDef(p));
          p.row = row;
        }
        row++;
        continue;
      }

      if (isParamDef(item) && item.row === undefined) {
        item.row = 0;
      }
    }

    return values.flat();
  }, ParamDefSchemaArray)
  .default([]);

export const WidgetVizTypes = [
  "advanced_charting",
  "chart",
  "chart-highcharts",
  "chart-vegalite",
  "file_viewer",
  "html",
  "iframe",
  "live_grid",
  "markdown",
  "metric",
  "multi_file_viewer",
  "newsfeed",
  "note",
  "rich_note",
  "omni",
  "pdf",
  "table",
  "ssrm_table",
  "ssrm_advanced",
  "youtube",
] as const;

const supportedTypesError = WidgetVizTypes.filter(
  (v) => !["file_viewer", "iframe"].includes(v),
)
  .map((v) => `\`${v}\``)
  .join(", ");

export type WidgetVizType = (typeof WidgetVizTypes)[number] | "custom";

export const widgetTypesSchema = z
  .preprocess(
    (val) => (val === "note" ? "rich_note" : val),
    z
      .enum(
        WidgetVizTypes,
        unionErrorMap(`Supported types are ${supportedTypesError}.`),
      )
      .nullish(),
  )
  .meta({ id: "WidgetType" });

export const WidgetStateSchema = z
  .looseObject({
    paramOrder: z.array(z.string()).optional(),
    params: z.record(z.string(), z.any()).optional(),
    chartView: ChartViewOptionsSchema.optional(),
    chartModel: ChartModelSchema.optional(),
    columnState: DataSchema,
    filterModel: DataSchema,
    storage: z
      .looseObject({
        text: z.string().optional(),
        html: z.string().optional(),
      })
      .optional(),
  })
  .meta({ id: "WidgetState" });

export const TemplateLayoutItemSchema = z
  .looseObject({
    i: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    minW: z.number().optional(),
    minH: z.number().optional(),
    maxW: z.number().optional(),
    maxH: z.number().optional(),
    moved: z.boolean().optional(),
    static: z.boolean().optional(),
    isDraggable: z.boolean().optional(),
    state: WidgetStateSchema.optional(),
    groups: z.array(z.string()).optional(),
  })
  .meta({ id: "Layout" });

const templateShapeDefinition = {
  templateId: z.string().optional(),
  id: z
    .string()
    .regex(/^custom-.+/)
    .optional(),
  name: z.string(),
  description: z.string().optional(),
  selected_agent: z.string().optional(),
  img: z.string().optional(),
  img_dark: z.string().optional(),
  img_light: z.string().optional(),
  authentication: z.string().optional(),
  tabs: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        name: z.string(),
        layout: z.array(TemplateLayoutItemSchema),
      }),
    )
    .meta({ id: "Tabs" }),
  groups: z
    .array(
      z
        .object({
          name: z.string(),
          paramName: z.string().optional(),
          type: z.string(),
          widgetIds: z.array(z.string()).optional(),
          defaultValue: z.any().nullish(),
        })
        .meta({ id: "Group" }),
    )
    .default([])
    .optional(),
  prompts: z.array(z.string()).optional(),
  mcpServers: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        url: z.url(),
        authType: z.enum(["oauth", "token"]).optional(),
      }),
    )
    .optional(),
  // Included in the schema so unrecognized-keys detection does not flag it as unknown.
  allowCustomization: z.boolean().optional(),
};

export const backendTemplateSchema = z
  .object(templateShapeDefinition)
  .transform((val) => {
    if (val.groups?.find((g) => g.widgetIds !== undefined)) {
      val.tabs = Object.fromEntries(
        Object.entries(val.tabs).map(([key, tab]) => [
          key,
          {
            ...tab,
            layout: tab.layout.map((layout) => ({
              ...layout,
              groups:
                layout.groups ??
                val.groups
                  .filter((g) => g.widgetIds.includes(layout.i))
                  .map((g) => g.name),
            })),
          },
        ]),
      );
    }
    return val;
  });

export const templateSpecificationSchema = z.array(
  z.object(templateShapeDefinition).meta({ id: "AppsJson" }),
);

// Derived from the Zod schema shape so it stays in sync automatically
export const KNOWN_TEMPLATE_KEYS = new Set(Object.keys(templateShapeDefinition));

export const WidgetSchemaBase = z.object({
  id: z.string(),
  widgetId: z.string(),
  type: widgetTypesSchema.optional(),
  fileEndpoint: z.string().optional(),
  name: z.string().optional(),
  showTitle: z.boolean().default(true).nullish(),
  description: z.string().optional(),
  groupId: z.string().nullish(),
  groupById: z.string().nullish(),
  innerTab: z.string().optional(),
  disableRetrievalForCopilot: z.boolean().optional(),
  storage: StorageSchema.optional(),
  external: z.boolean().optional(),
  params: ParamsSchema.optional(),
  staleTime: z
    .number()
    .min(1000)
    .nullish()
    .default(1000 * 60 * 5),
  refetchInterval: RefetchIntervalSchema.nullish(),
  dataUpdateDisplay: CronExpressionSchema.optional(),
  runButton: z.boolean().optional(),
  /** @deprecated Use `language` field in params array instead for omni/ssrm_advanced widgets */
  inputType: z.string().optional(),
  copilotParseAs: z
    .union([z.literal("structured"), z.literal("unstructured")])
    .optional(),
  raw: z.boolean().optional(),
  exportable: z.boolean().default(true).optional(),
});

export const InternalWidgetSchema = WidgetSchemaBase.extend({
  data: z
    .object({
      mainTicker: TickerSchema.optional(),
      secondaryTickers: z.array(TickerSchema).optional(),
      html: z.string().optional(),
      table: DataSchema,
    })
    .optional()
    .default({ table: {} }),
  refetchInterval: z
    .union([z.number().min(1000), z.literal(false), CronExpressionSchema])
    .optional()
    .default(1000 * 60 * 15),
});

export const ExternalWidgetSchema = WidgetSchemaBase.extend({
  category: z.string().nullish(),
  subCategory: z.string().nullish(),
  connectionType: z
    .enum([
      "single",
      "advanced-backend",
      "file",
      "database",
      "snowflake",
      "widgetMetadata",
    ])
    .nullish(),
  endpoint: z
    .object({
      url: z.string(),
      method: z.enum(["GET", "POST"]),
      headers: z.record(z.string(), z.string()).optional(),
      query: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  wsEndpoint: z.string().optional(),
  data: z.preprocess(
    (val: any) => {
      if (val?.wsRowIdColumn && !val?.wsRowIdColumns) {
        const { wsRowIdColumn, ...rest } = val;
        rest.wsRowIdColumns =
          typeof wsRowIdColumn === "string" ? [wsRowIdColumn] : wsRowIdColumn;

        return rest;
      }
      return val;
    },
    z
      .looseObject({
        wsRowIdColumns: z.array(z.string()).optional(),
        table: TableSchema.optional(),
        mainTicker: TickerSchema.optional(),
      })
      .optional()
      .default({ table: {} }),
  ),
  source: z.union([z.array(z.string()), z.string()]).nullish(),
  sourceId: z.string().nullish(),
  sourceName: z.string().nullish(),
  sourceDatabase: z.string().optional(),
  schemaName: z.string().optional(),
  isSharedWidget: z.boolean().nullish(),
})
  .transform((val) => {
    if ((val.runButton && !val.refetchInterval) || val.refetchInterval === false) {
      val.staleTime = Number.POSITIVE_INFINITY;
      val.refetchInterval = false;
    } else if (!val.runButton && val.refetchInterval === undefined) {
      val.refetchInterval = 1000 * 60 * 15;
    }
    return val;
  })
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

export function isWidgetVizType(type: string): type is WidgetVizType {
  return WidgetVizTypes.includes(type as any);
}
