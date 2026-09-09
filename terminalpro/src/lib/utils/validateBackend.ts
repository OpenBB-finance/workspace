import cloneDeep from "lodash/cloneDeep";
import type { $ZodIssue } from "zod/v4/core";
import type { WidgetT } from "~/components/types";
import { backendTemplateSchema, KNOWN_TEMPLATE_KEYS } from "~/lib/types/app";

// Snake_case aliases accepted on apps.json templates. Backends following the
// public docs may emit snake_case; we rewrite to camelCase before validation
// so the schema and downstream consumers only see one shape.
const TEMPLATE_KEY_ALIASES: Record<string, string> = {
  mcp_servers: "mcpServers",
};

function normalizeBackendTemplate(template: unknown) {
  if (!template || typeof template !== "object") return template;
  const obj = template as Record<string, unknown>;
  for (const [from, to] of Object.entries(TEMPLATE_KEY_ALIASES)) {
    if (from in obj && !(to in obj)) {
      obj[to] = obj[from];
      delete obj[from];
    }
  }
  return obj;
}

import {
  cleanSearchParams,
  convertHeadersToRecord,
  createParamDefs,
  createURL,
  createURLString,
  createWidgetInitParams,
} from "~/lib/utils/widgetParams";
import WIDGETS from "~/lib/widgets.json";
import {
  detectUnrecognizedKeys,
  KNOWN_WIDGET_KEYS,
  specificationSchema,
  type UnrecognizedKeysReport,
  type WidgetsType,
  type WidgetType,
} from "~/utils/zodForms";
import type {
  BackendAgent,
  BackendTemplate,
  Source,
  ValidateBackend,
} from "../state/backendConnector";

/**
 * Creates the appropriate HTTP method and payload for widget endpoint validation
 */
function createValidationRequest(
  widget: WidgetType,
  initialParams: Record<string, any>,
) {
  // POST widgets that need special handling
  if (widget.type === "omni") {
    return {
      method: "POST",
      body: JSON.stringify({
        prompt: "test validation query",
        ...initialParams,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }

  if (widget.type === "ssrm_table") {
    return {
      method: "POST",
      body: JSON.stringify({
        startRow: 0,
        endRow: 10,
        ...initialParams,
      }),
      headers: { "Content-Type": "application/json" },
    };
  }

  if (widget.type === "multi_file_viewer") {
    return {
      method: "POST",
      body: JSON.stringify({ ...initialParams }),
      headers: { "Content-Type": "application/json" },
    };
  }

  // Default to GET for all other widget types
  return {
    method: "GET",
    headers: {},
  };
}

export async function validateBackendEndpoints(
  widgets: WidgetsType,
  backendUrl: URL,
  headers: Record<string, string>,
  isVendorApp = false,
  signal?: AbortSignal,
) {
  const failedEndpoints: string[] = [];
  for (const widgetId in widgets) {
    const widget = widgets[widgetId];
    const initialParams = createWidgetInitParams(widget as unknown as WidgetT);

    const url = createURLString(widget.endpoint, backendUrl);
    const validationRequest = createValidationRequest(widget, initialParams);

    let endpoint: string;
    let requestOptions: RequestInit;

    if (validationRequest.method === "POST") {
      // For POST requests, don't add params to URL, they go in the body
      endpoint = url;
      requestOptions = {
        method: "POST",
        headers: {
          ...headers,
          ...validationRequest.headers,
        },
        body: validationRequest.body,
        signal,
      };
    } else {
      // For GET requests, add params to URL as before
      endpoint = cleanSearchParams(url, initialParams);
      requestOptions = {
        method: "GET",
        headers: {
          ...headers,
          ...validationRequest.headers,
        },
        signal,
      };
    }

    const endpointRes = await fetch(endpoint, requestOptions).catch(
      (err: Error) =>
        new Response(JSON.stringify({ message: err.message }), {
          status: 500,
          statusText: err.message,
        }),
    );

    if (!endpointRes.ok) {
      if (endpointRes.status === 422 || endpointRes.status === 405) continue;

      const error = await endpointRes.json();
      const errorDetail = error?.detail || error?.message || error?.error || error;
      const errorString = JSON.stringify(errorDetail);

      if (["field required", "missing"].some((e) => errorString.includes(e))) continue;

      failedEndpoints.push(`Widget: ${widgetId} - ${errorString}`);
    }

    if (isVendorApp) break; // for vendor apps, only validate the first widget to avoid excessive requests
  }

  return failedEndpoints;
}

const isValidWidget = (widget: any): widget is WidgetType => {
  return specificationSchema.safeParse({ data_widget: widget }).success;
};

/**
 * Returns an error message for an invalid object format.
 * This is used when the widgets.json file is not in the expected format.
 * @param object The object to validate.
 * @returns A string error message.
 */
const getInvalidError = (object: unknown): string => {
  const received = JSON.stringify(object, null, 0).slice(0, 38);
  const jsonStart = received.slice(0, 2);
  const suffix = jsonStart === `{"` ? "}" : jsonStart === "[{" ? "}]" : "";

  const error = `\n\n[widgets.json]: Invalid format
  Expected: \`{"table_data": {"name": "Table data", ... }}\`
  Received: \`${received.replace(/[\s\W]$/, "")} ... ${suffix}\``;
  console.error(error);
  return error;
};

export function validateObject(object: object): null | string {
  if (Array.isArray(object) || isValidWidget(object)) return getInvalidError(object);

  // Mutate params in place. `cloneDeep` removed: downstream (`processWorkerResults`)
  // recomputes `widget.params` from scratch anyway, so the mutation is harmless and
  // the clone was the dominant cost for backends with hundreds/thousands of widgets.
  const widgets = object as Record<string, WidgetType>;
  const errors: string[] = [];

  for (const widgetId in widgets) {
    const widget = widgets[widgetId];
    widget.params = createParamDefs(widget);

    const parsedWidget = specificationSchema.safeParse({ [widgetId]: widget });
    const issues = parsedWidget.error?.issues;
    formatZodIssues(issues, errors, widget, widgetId);
  }

  if (import.meta.env.DEV) console.log("Valid widgets.json");

  return errors.length > 0 ? errors.join("\n\n") : null;
}

const expectedRegex = /expected one of (.+) - received (.*)/;
function formatZodIssue(issue: $ZodIssue, widgetId?: string): string {
  //@ts-expect-error
  const { message, path, code, expected = "", input } = issue;
  const cleanedPath = path.filter((p) => p !== widgetId).join(", ") || "object";

  if (code === "invalid_type") return `[${cleanedPath}]: ${message}`;
  if (expected && input) {
    const errorMsg = `\nExpected: \`${expected}\` - Received: \`${input}\``;
    return `[${cleanedPath}]: ${code} ${errorMsg}`;
  }

  let errorMsg = message.replace(expectedRegex, (_, exp: string, rec: string) => {
    const expectedFormatted = exp
      .replace(/"/g, "")
      .split("|")
      .map((e) => e.trim())
      .join("` | `");
    return `\nExpected: \`${expectedFormatted}\`\nReceived: \`${rec}\``;
  });
  if (errorMsg.startsWith("\nExpected:")) {
    errorMsg = `${code} ${errorMsg}`;
  }

  return `[${cleanedPath}]: ${errorMsg}`;
}

export function formatZodIssues(
  issues: $ZodIssue[],
  errors: string[] = [],
  widget?: any,
  widgetId?: string,
) {
  widgetId = widgetId || widget?.widgetId;

  if (issues?.length > 0) {
    const issuesString = issues
      .map((issue) => {
        if (issue.code !== "invalid_union" || issue.inclusive === false)
          return formatZodIssue(issue, widgetId);
        const unionErrors = issue.errors.reduce(
          (acc, unionError) => {
            const curr = Object.fromEntries(
              unionError.map((issue) => [issue.path.join("."), issue]),
            );
            Object.assign(acc, curr);
            return acc;
          },
          {} as Record<string, $ZodIssue>,
        );

        return Object.values(unionErrors)
          .flatMap((issue) => formatZodIssue(issue, widgetId))
          .join(",\n");
      })
      .join(",\n");

    const id = widgetId ? ` (${widgetId})` : "";
    const prefix = widget?.name ? `${widget?.name}${id}:` : "";
    errors.push(`${prefix}\n ${issuesString}`);
  }

  return errors;
}

// Update the validateBackendTemplate function to include template name in errors
function validateBackendTemplates(templates: BackendTemplate[]): string[] {
  const appEntries = cloneDeep(templates) as BackendTemplate[];
  const errors: string[] = [];

  for (const template of appEntries) {
    // Skip null, undefined, or invalid templates
    if (!template || typeof template !== "object") {
      continue;
    }

    const result = backendTemplateSchema.safeParse(template);
    if (!result.success) {
      const issues = result.error.issues;
      template.name = template.name || "Unknown App";
      formatZodIssues(issues, errors, template);
    }
  }

  return errors;
}

const errorResponse = {
  widgets: {},
  errorMessage: null,
  templates: [] as BackendTemplate[],
  agents: [] as BackendAgent[],
  totalFailed: 1,
  templateErrorMessage: null,
  templateWarningMessage: null,
  unrecognizedKeysMessage: null,
  isOpenBBPlatform: null,
} satisfies ValidateBackend;

const DEFAULT_OPTIONS = {
  validateAllWidgets: false,
  vendorAppCache: false,
  agents: true,
  apps: true,
  schemas: true,
  semanticViews: true,
  extraHeaders: {} as Record<string, string>,
};

export type GetApiSourceWidgetsOptions = Partial<typeof DEFAULT_OPTIONS>;

function parseOptions(
  options?: GetApiSourceWidgetsOptions | boolean,
): GetApiSourceWidgetsOptions {
  if (typeof options === "boolean") {
    return {
      ...DEFAULT_OPTIONS,
      validateAllWidgets: options,
    };
  }

  return { ...DEFAULT_OPTIONS, ...(options || {}) };
}

function validateWidgetsAppsJson(params: {
  templates: BackendTemplate[];
  widgetValidationError: string | null;
  failedEndpoints?: string[];
  unrecognizedReports?: UnrecognizedKeysReport[];
}) {
  const {
    templates,
    widgetValidationError,
    failedEndpoints = [],
    unrecognizedReports = [],
  } = params;

  const templateErrors = validateBackendTemplates(templates);
  const templateErrorMessage =
    templateErrors.length > 0 ? templateErrors.join("\n\n") : null;

  // combine widget validation errors and endpoint errors
  const allWidgetErrors = [];
  if (widgetValidationError) allWidgetErrors.push(widgetValidationError);
  if (failedEndpoints.length > 0) allWidgetErrors.push(...failedEndpoints);

  const errorMessage = allWidgetErrors.length > 0 ? allWidgetErrors.join("\n\n") : null;
  const totalFailed = failedEndpoints.length + templateErrors.length;
  const unrecognizedKeysMessage =
    unrecognizedReports.length > 0 ? unrecognizedReports : null;

  return {
    errorMessage,
    templateErrorMessage,
    unrecognizedKeysMessage,
    totalFailed,
    templateErrors,
  };
}

// Modify the validateBackend function to include template validation
export async function validateBackend(
  source: Source,
  options?: GetApiSourceWidgetsOptions | boolean,
) {
  options = parseOptions(options);
  const isVendorApp = !!(source.vendorAppUuid || source.vendorApp);

  if (isVendorApp && !options.validateAllWidgets && options.vendorAppCache) {
    const { widgetsJsonCache = {}, appsJsonCache = [] } = source.vendorApp || {};
    const widgetValidationError = validateObject(widgetsJsonCache);
    const unrecognizedReports = [] as UnrecognizedKeysReport[];
    for (const t of appsJsonCache) normalizeBackendTemplate(t);

    if (!widgetValidationError) {
      const report = detectUnrecognizedKeys(
        "[widgets.json]",
        Object.values(widgetsJsonCache),
        KNOWN_WIDGET_KEYS,
      );
      if (report) unrecognizedReports.push(report);
    }

    const jsonErrors = validateWidgetsAppsJson({
      templates: appsJsonCache,
      widgetValidationError,
      unrecognizedReports,
    });

    return {
      widgets: widgetValidationError ? {} : widgetsJsonCache, // return empty widgets if validation failed
      ...jsonErrors,
      templates: jsonErrors.templateErrors.length > 0 ? [] : appsJsonCache, // return empty templates if validation failed
      agents: [], // vendor apps don't have agents
    } as ValidateBackend;
  }

  // 60s timeout when you connect - in the future we can do something else here -
  // let user set it or turn off for on prem?
  const requestTimeout = 60000;
  const { headers, newParams } = convertHeadersToRecord(source.endpointHeaders);

  Object.assign(headers, options.extraHeaders || {}); // Merge extra headers into the main headers object

  const backendUrl = createURL(source.url);
  const widgetsUrl = createURL("widgets.json", backendUrl, newParams);
  const reqInit = { headers, signal: AbortSignal.timeout(requestTimeout) };

  const widgetsRes = await fetch(widgetsUrl, reqInit).catch((error) => ({
    ok: false,
    status: error.code || 500,
    statusText: error.message || "Network error",
    json: async () => ({}),
    headers: new Headers(),
  }));

  if (!widgetsRes.ok) {
    const statusCode = widgetsRes.status;
    let errorMessage =
      "Unable to find a widgets.json file. Please check the console logs for more details.";

    // Handle specific status codes with more descriptive messages
    if (statusCode === 401 || statusCode === 403) {
      errorMessage =
        "Authentication failed. Please check your Authorization header or check the console logs for more details.";
    } else if (statusCode === 404) {
      errorMessage = "The widgets.json file was not found on the server.";
    } else if (statusCode === 422) {
      errorMessage =
        "The server rejected the request. Please check your Authorization header or check the console logs for more details.";
    } else if (statusCode >= 500) {
      errorMessage =
        "Server error occurred. Please try again later or check the console logs for more details.";
    } else if (statusCode === 23) {
      errorMessage = "Request timed out. Please check server status or try again.";
    }

    throw new Error(`${errorMessage} (Status: ${statusCode})`);
  }

  // Detect unrecognized keys — widget check is gated behind successful
  // validation (malformed data would produce noisy warnings), while the
  // template check runs independently since templates have their own pipeline.
  const unrecognizedReports = [] as UnrecognizedKeysReport[];

  const widgets = (await widgetsRes.json()) as WidgetsType;
  const isOpenBBPlatform =
    widgetsRes.headers.get("X-Backend-Type") === "OpenBB Platform";
  const widgetValidationError = validateObject(widgets);

  if (!widgetValidationError) {
    const report = detectUnrecognizedKeys(
      "[widgets.json]",
      Object.values(widgets),
      KNOWN_WIDGET_KEYS,
    );
    if (report) unrecognizedReports.push(report);
  }
  // don't early return here - continue to check templates even if widgets have errors,
  // this is so we can still show the user the apps they have and the errors they have
  let failedEndpoints = [];
  if (options.validateAllWidgets && !widgetValidationError) {
    failedEndpoints = await validateBackendEndpoints(
      widgets,
      backendUrl,
      headers,
      isVendorApp,
      reqInit.signal,
    );
  }

  let templates: BackendTemplate[] = [];
  let agents: BackendAgent[] = [];
  let schemas: Source["schemas"];
  let semanticViews: Source["semanticViews"];

  const getPromise = async (fn: () => Promise<Response>, enabled: boolean) => {
    if (!enabled) return Promise.resolve({ ok: false } as Response);
    return fn().catch(() => ({ ok: false }) as Response);
  };

  // After widgets validated, fire apps + agents in parallel (independent of each other).
  const appsPromise = getPromise(async () => {
    const appsUrl = createURL("apps.json", backendUrl, newParams);
    const templatesUrl = createURL("templates.json", backendUrl, newParams);
    return fetch(appsUrl, reqInit).then((res) =>
      res.ok ? res : fetch(templatesUrl, reqInit),
    );
  }, options.apps);

  const agentsPromise = getPromise(async () => {
    const agentsUrl = createURL("agents.json", backendUrl);
    return fetch(agentsUrl, reqInit);
  }, options.agents);

  if (options.apps) {
    const tempsRes = await appsPromise;

    if (tempsRes.ok) {
      const fileName = tempsRes.url?.endsWith("apps.json")
        ? "apps.json"
        : "templates.json";
      const data = await tempsRes.json().catch(() => []);
      // Handle different response types properly:
      // - [] (empty array) -> []
      // - {} (empty object) -> [] (treat as no templates)
      // - undefined/null -> []
      // - [template1, template2] -> [template1, template2]
      // - {valid template object} -> [{valid template object}]
      if (Array.isArray(data)) {
        templates = data;
      } else if (data && typeof data === "object" && Object.keys(data).length > 0) {
        templates = [data];
      } else {
        templates = []; // Handle empty object {}, null, undefined, etc.
      }

      for (const t of templates) normalizeBackendTemplate(t);

      const report = detectUnrecognizedKeys(
        `[${fileName}]`,
        templates,
        KNOWN_TEMPLATE_KEYS,
      );
      if (report) unrecognizedReports.push(report);
    }
  }

  if (options.agents) {
    const agentsRes = await agentsPromise;

    if (agentsRes.ok) {
      const data = await agentsRes.json().catch(() => []);
      if (Array.isArray(data)) {
        agents = data.filter(
          (agent: unknown) =>
            agent && typeof agent === "object" && "id" in agent && "name" in agent,
        ) as BackendAgent[];
      }
    }
  }

  const hasSSRM =
    !widgetValidationError &&
    Object.values(widgets || {}).some((w) => w.type === "ssrm_advanced");

  // Database-only endpoints — fired in parallel after widgets parse confirms SSRM.
  if (hasSSRM && (options.schemas || options.semanticViews)) {
    const schemasReq = getPromise(
      () => fetch(createURL("table-schemas", backendUrl, newParams), reqInit),
      options.schemas,
    );

    const semanticViewsReq = getPromise(
      () => fetch(createURL("semantic-views", backendUrl, newParams), reqInit),
      options.semanticViews,
    );

    const [schemasRes, semanticViewsRes] = await Promise.all([
      schemasReq,
      semanticViewsReq,
    ]);

    if (schemasRes.ok) {
      schemas = await schemasRes.json().catch(() => undefined);
    }
    if (semanticViewsRes.ok) {
      semanticViews = await semanticViewsRes.json().catch(() => undefined);
    }
  }

  const jsonErrors = validateWidgetsAppsJson({
    templates,
    widgetValidationError,
    failedEndpoints,
    unrecognizedReports,
  });

  return {
    widgets: widgetValidationError ? {} : widgets, // return empty widgets if validation failed
    ...jsonErrors,
    templates: jsonErrors.templateErrors.length > 0 ? [] : templates, // return empty templates if validation failed
    agents,
    schemas,
    semanticViews,
    isOpenBBPlatform,
  } as ValidateBackend;
}

export function getJsonWidget(widget: string | Partial<WidgetT>): WidgetT | null {
  if (typeof widget === "string") {
    widget = WIDGETS[widget] as Partial<WidgetT>;
    if (!widget) return null;
  }

  return cloneDeep({ ...(WIDGETS[widget?.widgetId] ?? widget) });
}

export async function validateSource(
  source: Source,
  options?: GetApiSourceWidgetsOptions | boolean,
) {
  const validated = await validateBackend(source, options).catch(
    (e) => ({ ...errorResponse, errorMessage: e.message }) as ValidateBackend,
  );

  if (!validated.templates.length || validated.errorMessage) return validated;

  const tabWidgets = {} as { [appName: string]: { [tabId: string]: string[] } };
  const vendorApp = source.vendorApp;
  const isSingleTemplate = validated.templates.length === 1;

  for (const t of validated.templates) {
    if (vendorApp && isSingleTemplate) t.name = vendorApp.name;

    for (const tab of Object.values(t.tabs || {})) {
      for (const layout of tab.layout || []) {
        const widgetId = layout.i;
        if (getJsonWidget(widgetId)?.name) continue; // skip if it's a built-in widget

        if (!tabWidgets[t.name]) tabWidgets[t.name] = {};
        if (!tabWidgets[t.name][tab.id]) tabWidgets[t.name][tab.id] = [];
        tabWidgets[t.name][tab.id].push(widgetId);
      }
    }
  }

  // check for widgets used in apps that are missing from the backend widgets
  for (const [appName, item] of Object.entries(tabWidgets)) {
    for (const [tabId, widgetIds] of Object.entries(item)) {
      const missingWidgetIds = widgetIds.filter((id) => !validated.widgets[id]);
      if (missingWidgetIds.length === 0) continue;

      const errors = [
        `${appName} (tab: ${tabId}):`,
        `[widgets.json]: Missing widgets used in tab \`${missingWidgetIds.join("`, `")}\``,
      ];

      validated.templateWarningMessage = validated.templateWarningMessage || "";
      validated.templateWarningMessage += `\n\n${errors.join("\n")}`;
    }
  }

  return validated;
}

function slugify(str: string, separator = "-") {
  if (!str) return "";
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s/g, separator)
    .replace(/\n/g, separator)
    .replace(/[^\w-]+/g, "");
}

export async function getApiSourceWidgets(
  source: Source,
  options?: GetApiSourceWidgetsOptions | boolean,
) {
  const validated = await validateSource(source, options);

  if (validated.templates.length > 0) {
    // do some validation here
    validated.templates = validated.templates.map((template) => {
      template.id = `custom-${source.id ?? source.uuid}-${slugify(template.name)}`;
      template.templateId = template.templateId || template.id;
      // handle relative URLs for images
      for (const img_key of ["img", "img_dark", "img_light"]) {
        if (!template[img_key]) continue;
        template[img_key] = createURLString(template[img_key], source.url);
      }
      return template;
    });
  }

  return validated;
}

function handleVendorAppSource(source: Source) {
  const vendorApp = source.vendorApp;
  source.vendorAppUuid = vendorApp?.uuid;

  if (vendorApp && source.status === "error") {
    source.widgets = vendorApp?.widgetsJsonCache || {};
    source.templates = vendorApp?.appsJsonCache || [];
  }

  source.hasApiKey = source.endpointHeaders?.some(
    (h) => h.key.toLowerCase() === "authorization" && h.value.startsWith("Bearer "),
  );
  return source;
}

export function processWorkerResults(
  results: { source: Source; result: ValidateBackend }[],
  partial = false,
) {
  return results.reduce(
    (acc, cur) => {
      const { source: apiSource, result } = cur;

      try {
        if (result.errorMessage) {
          apiSource.status = "error";
          acc.apiSources.push(handleVendorAppSource({ ...apiSource }));
          return acc;
        }

        const {
          widgets,
          errorMessage,
          templateWarningMessage,
          unrecognizedKeysMessage,
          templates,
          schemas,
          semanticViews,
          agents,
        } = result;
        if (semanticViews) acc.semanticViews = semanticViews;

        if (!partial && templateWarningMessage) {
          acc.toastErrors.push({
            source: { name: apiSource.name, id: apiSource.id },
            message: templateWarningMessage,
          });
        }

        const isPublishedMarketplaceApp =
          apiSource.vendorApp && !apiSource.vendorApp?.isDevelopment;
        if (!partial && unrecognizedKeysMessage && !isPublishedMarketplaceApp) {
          acc.unrecognizedKeysMessages.push({
            source: { name: apiSource.name, id: apiSource.id },
            reports: unrecognizedKeysMessage,
          });
        }

        if (errorMessage) {
          console.error(errorMessage);
          apiSource.status = "error";
          acc.apiSources.push(handleVendorAppSource({ ...apiSource }));
          return acc;
        }

        apiSource.widgets = Object.entries(widgets).reduce((acc, [key, widget]) => {
          widget.params = createParamDefs(widget, apiSource.url);
          const subCategory = widget.sub_category ?? widget.subCategory;

          acc[key] = {
            ...widget,
            widgetId: key,
            subCategory,
            endpointHeaders: apiSource.endpointHeaders,
          };
          return acc;
        }, {});

        acc.apiSources.push({
          ...apiSource,
          templates,
          schemas,
          semanticViews,
          agents,
          status: "success",
        });
        return acc;
      } catch (err) {
        console.error(err.message);
        acc.apiSources.push(handleVendorAppSource({ ...apiSource }));
        return acc;
      }
    },
    {
      apiSources: [] as Source[],
      semanticViews: null as Source["semanticViews"],
      toastErrors: [] as { source: { name: string; id: string }; message: string }[],
      unrecognizedKeysMessages: [] as {
        source: { name: string; id: string };
        reports: UnrecognizedKeysReport[];
      }[],
      __partial: partial,
    },
  );
}

export type WorkerResult = ReturnType<typeof processWorkerResults>;
