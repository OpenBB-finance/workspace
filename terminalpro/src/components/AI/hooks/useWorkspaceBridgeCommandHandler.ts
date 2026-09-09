import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { getApiSources, postApiSource } from "~/api/auth.api";
import * as workspaceApi from "~/api/workspace.api";
import { useMcpExecutor } from "~/components/AI/hooks/mcp/useMcpExecutor";
import { useActiveWorkspaceDashboardId } from "~/components/AI/hooks/useActiveWorkspaceDashboardId";
import { useAiFetchRequestInit } from "~/components/AI/hooks/useAiFetchRequestInit";
import { useFunctionCall } from "~/components/AI/hooks/useFunctionCall";
import { useGetWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import {
  findTabMatch,
  useManageNavigationBar,
} from "~/components/AI/hooks/useManageNavigationBar";
import { useWorkspaceBridgeSnapshot } from "~/components/AI/hooks/useWorkspaceBridgeSnapshot";
import type {
  BridgeErrorCode,
  WorkspaceBridgeCommand,
  WorkspaceBridgeCommandResult,
  WorkspaceBridgeCommandT,
  WorkspaceWidgetConfig,
} from "~/components/AI/workspaceBridgeProtocol";
import type { WidgetT } from "~/components/types";
import { type ProcessedTemplate, useSharedTemplates } from "~/hooks/useSharedTemplates";
import { BLOCKED_WIDGET_IDS } from "~/lib/constants";
import { useAppStore } from "~/lib/state/app";
import {
  type BackendTemplate,
  type Source,
  useBackendConnectorStore,
} from "~/lib/state/backendConnector";
import type { Copilot, CopilotCommandResultT } from "~/lib/state/copilot";
import { useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import { type UserGeneratedApp, useUserAppsStore } from "~/lib/state/userApps";
import { duplicateTabItem } from "~/lib/utils";
import {
  addGenerativeWidgetInputArguments,
  type GetParamOptionsInputArgumentsT,
  type GetWidgetDataInputArgumentsT,
  type ManageNavigationBarInputArgumentsT,
} from "~/lib/utils/ai";
import { createCustomTemplateTab } from "~/lib/utils/createTemplates";
import {
  deserializeDashboardTabId,
  getDashboardInfo,
  serializeDashboardTabId,
} from "~/lib/utils/workspaceDashboard";
import type { SkillPayload } from "~/types/auth.type";
import { getWidgetOrigin } from "./utils";

type FunctionCallApi = ReturnType<typeof useFunctionCall>;
type ManageNavigationBarApi = ReturnType<typeof useManageNavigationBar>;
type ExecuteAgentToolFn = ReturnType<typeof useMcpExecutor>;
type WorkspaceSkill = {
  slug: string;
  description: string;
  content: string;
};

type CommandHandlerDeps = {
  currentDashboardId: string;
  navigateToDashboard: (dashboardId: string) => void;
  getSharedTemplates: () => ProcessedTemplate<string>[];
  getSnapshot: () => unknown;
  getWidgetData: FunctionCallApi["getWidgetData"];
  getParamOptions: FunctionCallApi["getParamOptions"];
  assignTasksToAgents: FunctionCallApi["assignTasksToAgents"];
  addGenerativeWidget: FunctionCallApi["addGenerativeWidget"];
  manageNavigationBar: ManageNavigationBarApi;
  executeAgentTool: ExecuteAgentToolFn;
  getSkillBySlug: (slug: string) => WorkspaceSkill | null | undefined;
  forwardMessageToAgent: (
    message: string,
    fromAgentId: string,
    targetAgent: Copilot,
  ) => Promise<void>;
};

type DashboardScopedCommand = {
  command: string;
  request_id?: string | null;
  dashboard_id?: string | null;
};

type WidgetScopedCommand = DashboardScopedCommand & {
  widget_uuid?: string | null;
  widget_id?: string | null;
};

const LAYOUT_UI_ARG_KEYS = new Set([
  "x",
  "y",
  "w",
  "h",
  "min_w",
  "min_h",
  "max_w",
  "max_h",
  "grid_data",
  "inner_tab",
]);

const GENERATIVE_ONLY_WIDGET_IDS = new Set(["rich_note"]);
const UNSUPPORTED_MCP_CREATE_WIDGET_REASONS: Record<string, string> = {
  rss_viewer:
    "rss_viewer requires feed bootstrap that is not yet exposed through create_widget.",
  currency_snapshot:
    "currency_snapshot still relies on runtime-only storage bootstrap that does not match the plain create_widget symbol contract.",
  watchlist:
    "watchlist still injects default watchlist data instead of honoring a deterministic symbol list.",
  market_indices:
    "market_indices does not yet deterministically honor requested symbols through create_widget.",
};
const UNSUPPORTED_MCP_CREATE_WIDGET_IDS = new Set(
  Object.keys(UNSUPPORTED_MCP_CREATE_WIDGET_REASONS),
);

function errorResult(
  command: string,
  requestId: string | null | undefined,
  code: BridgeErrorCode,
  message: string,
): WorkspaceBridgeCommandResult {
  return {
    ok: false,
    command,
    request_id: requestId ?? null,
    message,
    error: {
      code,
      message,
    },
  };
}

function successResult(
  command: string,
  requestId: string | null | undefined,
  message: string,
  data?: unknown,
  warnings?: string[],
): WorkspaceBridgeCommandResult {
  return {
    ok: true,
    command,
    request_id: requestId ?? null,
    message,
    data,
    ...(warnings && warnings.length > 0 ? { warnings } : {}),
  };
}

/**
 * Bridge-internal command names are not always the tool names the MCP sidecar
 * exposes to agents. Error/help text must reference the MCP-facing name so an
 * agent can actually call the tool it is pointed at.
 */
const MCP_TOOL_NAME_OVERRIDES: Record<string, string> = {
  update_dashboard_layout: "update_widget_layout",
};

/**
 * Appended to backend widgets.json/apps.json validation failures so agents can
 * self-correct from the shipped specs instead of guessing payload shapes.
 */
const BACKEND_AUTHORING_HINT =
  "For the expected widgets.json/apps.json shape, read the MCP resources openbb://workspace/specs/widgets-json, openbb://workspace/specs/apps-json, and openbb://workspace/validation/common-errors (index: openbb://workspace/app-builder/index).";

function toMcpToolName(command: string): string {
  return MCP_TOOL_NAME_OVERRIDES[command] ?? command;
}

function commandFailedResult(
  command: string,
  requestId: string | null | undefined,
  results: CopilotCommandResultT[],
): WorkspaceBridgeCommandResult {
  const message =
    results.find((result) => result.status === "error")?.message ||
    "Workspace command failed.";

  return errorResult(command, requestId, "command_failed", message);
}

function commandResultsSucceeded(results: CopilotCommandResultT[]) {
  return results.every((result) => result.status === "success");
}

function toCase(str: string, caseType: "camel" | "snake"): string {
  switch (caseType) {
    case "snake":
      return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    case "camel":
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    default:
      return str;
  }
}

function normalizeList<T>(items: T[] | null | undefined): T[] {
  return Array.isArray(items) ? items : [];
}

function asRecord(
  value: unknown,
  caseType?: "camel" | "snake",
  filterFn?: (key: string, value: unknown) => boolean,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  if (!(caseType || filterFn)) return value as Record<string, unknown>;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, value]) => (filterFn ? filterFn(key, value) : true))
      .map(([key, value]) => [toCase(key, caseType), value]),
  );
}

function isCurrentDashboardPlaceholder(value: string | null | undefined): boolean {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "active_dashboard" ||
    normalized === "current_dashboard" ||
    normalized === "current" ||
    normalized === "active" ||
    normalized === "null" ||
    normalized === "undefined"
  );
}

function resolveDashboardId(
  commandDashboardId: string | null | undefined,
  currentDashboardId: string,
) {
  return isCurrentDashboardPlaceholder(commandDashboardId)
    ? currentDashboardId
    : commandDashboardId;
}

function requireDashboardId(
  command: DashboardScopedCommand,
  currentDashboardId: string,
  message: string,
): string | WorkspaceBridgeCommandResult {
  const dashboardId = resolveDashboardId(command.dashboard_id, currentDashboardId);
  return dashboardId
    ? dashboardId
    : errorResult(command.command, command.request_id, "invalid_request", message);
}

function resolveWidgetUuid(
  command: WidgetScopedCommand,
  dashboardId: string,
): string | WorkspaceBridgeCommandResult {
  const toolName = toMcpToolName(command.command);
  if (command.widget_uuid) {
    const widget = useAppStore
      .getState()
      .getTabWidgetById(dashboardId, command.widget_uuid);

    if (!widget) {
      return errorResult(
        command.command,
        command.request_id,
        "command_failed",
        `${toolName} could not find widget_uuid '${command.widget_uuid}' on dashboard '${dashboardId}'. Call get_workspace_snapshot to list widget_uuids on each dashboard.`,
      );
    }

    return command.widget_uuid;
  }

  if (!command.widget_id) {
    return errorResult(
      command.command,
      command.request_id,
      "invalid_request",
      `${toolName} requires widget_uuid or widget_id.`,
    );
  }

  const widgets = useAppStore.getState().items?.[dashboardId]?.data?.widgets ?? [];
  const matches = widgets.filter((widget) => widget.widgetId === command.widget_id);

  if (matches.length === 1) {
    return matches[0].id;
  }

  if (matches.length > 1) {
    return errorResult(
      command.command,
      command.request_id,
      "invalid_request",
      `${toolName} found multiple widgets with widget_id '${command.widget_id}' on dashboard '${dashboardId}'. Use widget_uuid instead.`,
    );
  }

  return errorResult(
    command.command,
    command.request_id,
    "command_failed",
    `${toolName} could not find a widget with widget_id '${command.widget_id}' on dashboard '${dashboardId}'. Call get_workspace_snapshot to list widget_uuids on each dashboard.`,
  );
}

function buildWidgetConfig(config?: WorkspaceWidgetConfig | null) {
  return {
    dataArgs: config?.data_args ?? undefined,
    uiArgs: config?.ui_args ?? undefined,
  };
}

function resolveInnerTabId(
  dashboardId: string,
  rawInnerTab: string | null | undefined,
): string | undefined {
  if (!rawInnerTab) {
    return undefined;
  }

  const navBar = useAppStore
    .getState()
    .items?.[dashboardId]?.data?.widgets?.find(
      (widget) => widget.widgetId === "navigation_bar",
    );
  const tabs = Array.isArray(navBar?.storage?.tabs)
    ? (navBar.storage.tabs as { id: string; name: string }[])
    : [];
  if (tabs.length === 0) {
    return rawInnerTab;
  }

  return findTabMatch(tabs, rawInnerTab)?.id ?? rawInnerTab;
}

function buildWidgetConfigForDashboard(
  dashboardId: string,
  config?: WorkspaceWidgetConfig | null,
) {
  const normalizedConfig = buildWidgetConfig(config);
  const uiArgs = asRecord(normalizedConfig.uiArgs);
  // ui_args come from external MCP callers; a non-string innerTab is ignored.
  const rawInnerTab = uiArgs?.innerTab;
  const innerTab = typeof rawInnerTab === "string" ? rawInnerTab.trim() : undefined;

  if (!innerTab) return normalizedConfig;

  return {
    ...normalizedConfig,
    uiArgs: {
      ...uiArgs,
      innerTab: resolveInnerTabId(dashboardId, innerTab),
    },
  };
}

// ui_args keys the widget config path understands (updateWidgetState routes
// these onto the widget itself or well-known storage slots). Anything else is
// written to raw widget storage and may have no effect.
const KNOWN_UI_ARG_KEYS = new Set([
  "name",
  "description",
  "source",
  "innerTab",
  "gridData",
  "chartView",
  "chartSettingsOpen",
  "html",
]);

/**
 * Widget mutations silently ignore data_args keys the widget does not declare
 * and write unrecognized ui_args keys to raw storage. Surface both so the
 * calling agent learns the real contract instead of assuming success.
 */
function widgetConfigWarnings(
  paramsDef: WidgetT["params"] | null | undefined,
  config?: WorkspaceWidgetConfig | null,
): string[] {
  const warnings: string[] = [];
  const declared = (Array.isArray(paramsDef) ? paramsDef : [])
    .map((param) => param?.paramName)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  const dataArgs = asRecord(config?.data_args) ?? {};
  const { droppedKeys: droppedDataArgs } = workspaceApi.computeWidgetParamUpdates(
    paramsDef,
    dataArgs,
  );
  if (droppedDataArgs.length > 0) {
    warnings.push(
      `data_args keys not declared by this widget were ignored: ${droppedDataArgs.join(", ")}. Declared params: ${
        declared.length > 0 ? declared.join(", ") : "(none)"
      }.`,
    );
  }

  const uiArgs = asRecord(config?.ui_args) ?? {};
  const unknownUiArgs = Object.keys(uiArgs).filter(
    (key) => !KNOWN_UI_ARG_KEYS.has(key),
  );
  if (unknownUiArgs.length > 0) {
    warnings.push(
      `ui_args keys not recognized by the widget config contract were written to raw widget storage and may have no effect: ${unknownUiArgs.join(", ")}.`,
    );
  }

  return warnings;
}

function hasLayoutUiArgs(config?: WorkspaceWidgetConfig | null) {
  const uiArgs = asRecord(config?.ui_args, "snake");
  if (!uiArgs) return false;

  return Object.keys(uiArgs).some((key) => LAYOUT_UI_ARG_KEYS.has(key));
}

function isAvailableWidget(widget: WidgetT): boolean {
  if (widget?.disabled) return false;
  const widgetId = widget.widgetId ?? "";
  const isExternal = widget.external === true;

  return Boolean(
    widgetId &&
      widgetId !== "navigation_bar" &&
      !GENERATIVE_ONLY_WIDGET_IDS.has(widgetId) &&
      !UNSUPPORTED_MCP_CREATE_WIDGET_IDS.has(widgetId) &&
      widget.disableRetrievalForCopilot !== true &&
      !(BLOCKED_WIDGET_IDS.has(widgetId) && !isExternal),
  );
}

function getUnsupportedCreateWidgetMessage(widgetId: string) {
  const reason = UNSUPPORTED_MCP_CREATE_WIDGET_REASONS[widgetId];
  if (!reason) {
    return null;
  }

  return `create_widget does not support '${widgetId}'. ${reason}`;
}

function toGridDataPayload(gridData: unknown) {
  const payload = asRecord(
    gridData,
    "snake",
    (_, value) => typeof value === "number" && Number.isFinite(value),
  );

  return Object.keys(payload || {}).length > 0 ? payload : undefined;
}

function toWidgetParamPayload(param: unknown) {
  const item = asRecord(param, "snake");
  if (!item) return param;

  const optionsEndpoint = item.options_endpoint;
  const optionsParams = Array.isArray(item.options_params) && item.options_params;
  const requiresOptionsLookup =
    item.get_options === true ||
    optionsEndpoint !== undefined ||
    optionsParams !== undefined;

  return {
    ...item,
    ...(requiresOptionsLookup ? { requires_options_lookup: true } : {}),
    ...(optionsEndpoint ? { options_lookup_endpoint: optionsEndpoint } : {}),
    ...(optionsParams ? { options_lookup_params: optionsParams } : {}),
  };
}

function toWidgetCatalogEntry(widget: WidgetT, originOverride?: string) {
  const origin = originOverride ?? getWidgetOrigin(widget as WidgetT);

  return {
    origin,
    backend_name: origin,
    backend_id: widget.sourceId || null,
    widget_id: widget.widgetId || "",
    name: widget.name,
    description: widget.description,
    category: widget.category,
    sub_category: widget.subCategory,
    widget_type: widget.type,
  };
}

function getWidgetSchemaPayload(
  origin: string,
  widgetId: string,
): Record<string, unknown> | null {
  const widget = useGetWidgetsStore
    .getState()
    .getAppWidget(widgetId as WidgetT["widgetId"], origin);
  if (!widget || !isAvailableWidget(widget)) return null;

  let schema: Record<string, unknown> | undefined;
  if (widget.sourceId && widget.schemaName) {
    const apiSource = useBackendConnectorStore
      .getState()
      .getApiSourceById(widget.sourceId);
    const rawSchema = apiSource?.schemas?.[widget.schemaName];
    if (rawSchema && typeof rawSchema === "object") {
      schema = rawSchema as Record<string, unknown>;
    }
  }

  return {
    ...toWidgetCatalogEntry(widget, origin),
    params: Array.isArray(widget.params)
      ? widget.params.map((param) => toWidgetParamPayload(param))
      : [],
    schema,
    grid_data: toGridDataPayload(widget.gridData),
    metadata:
      widget.metadata && typeof widget.metadata === "object" ? widget.metadata : {},
  };
}

function normalizeDataSource(
  value: unknown,
): GetWidgetDataInputArgumentsT["data_sources"][number] {
  const item = asRecord(value, "snake") ?? {};
  const id = item.id ?? item.widget_id;
  const widgetUuid = item.widget_uuid;

  return {
    origin: typeof item.origin === "string" ? item.origin : "",
    id: typeof id === "string" ? id : "",
    input_args: asRecord(item.input_args) ?? {},
    widget_uuid: typeof widgetUuid === "string" && widgetUuid ? widgetUuid : null,
    ssm_request: asRecord(item.ssm_request),
  };
}

function normalizeDataSources(
  items: unknown[] | null | undefined,
): GetWidgetDataInputArgumentsT["data_sources"] {
  return normalizeList(items).map((item) => normalizeDataSource(item));
}

function normalizeParamOptionsQuery(
  value: unknown,
): GetParamOptionsInputArgumentsT["param_options_queries"][number] {
  const item = asRecord(value, "snake") ?? {};
  const id = item.id ?? item.widget_id;
  const param = item.param ?? item.param_name;
  const optionsEndpointInputArgs = asRecord(item.options_endpoint_input_args) ?? {};

  return {
    origin: typeof item.origin === "string" ? item.origin : "",
    id: typeof id === "string" ? id : "",
    param: typeof param === "string" ? param : "",
    options_endpoint_input_args: optionsEndpointInputArgs,
  };
}

function normalizeParamOptionsQueries(
  items: unknown[] | null | undefined,
): GetParamOptionsInputArgumentsT["param_options_queries"] {
  return normalizeList(items).map((item) => normalizeParamOptionsQuery(item));
}

function completeCopilotCommand(
  command: string,
  requestId: string | null | undefined,
  successMessage: string,
  results: CopilotCommandResultT[],
  data: Record<string, unknown>,
): WorkspaceBridgeCommandResult {
  if (!commandResultsSucceeded(results)) {
    return commandFailedResult(command, requestId, results);
  }

  return successResult(command, requestId, successMessage, data);
}

function getResultFuncs<T extends WorkspaceBridgeCommand>(cmd: T) {
  return {
    successResult: (message: string, data?: unknown, warnings?: string[]) =>
      successResult(cmd.command, cmd.request_id, message, data, warnings),
    errorResult: (code: BridgeErrorCode, message: string) =>
      errorResult(cmd.command, cmd.request_id, code, message),
    completeCopilotCommand: (
      successMessage: string,
      results: CopilotCommandResultT[],
      data: Record<string, unknown>,
    ) =>
      completeCopilotCommand(
        cmd.command,
        cmd.request_id,
        successMessage,
        results,
        data,
      ),
  };
}

function createdWidgetUuidFromResults(results: CopilotCommandResultT[]) {
  for (const result of results) {
    const widgetUuid = result.widget_uuid ?? result.widgetUuid;
    if (typeof widgetUuid === "string" && widgetUuid) return widgetUuid;
  }

  return undefined;
}

function handleAgentEvent(event: string, data: string): void {
  if (event !== "copilotStatusUpdate") return;

  const payload = JSON.parse(data) as { eventType?: string; message?: string };
  if (payload.eventType === "ERROR") {
    throw new Error(payload.message || "Assigned agent reported an error.");
  }
}

async function drainAgentResponse(response: Response): Promise<void> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    try {
      await response.json();
      return;
    } catch {
      await response.text();
      return;
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Invalid streaming response from assigned agent.");
  }

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const chunks = buffer.split(/\r\n\r\n|\r\r|\n\n/g);
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      let event = "";
      let data = "";

      for (const line of chunk.split(/\n|\r|\r\n/g)) {
        const match = /(?<field>[^:]+)(?:: ?(?<value>.*))?/.exec(line);
        if (!match?.groups) {
          continue;
        }

        if (match.groups.field === "event") {
          event = match.groups.value || "";
        }
        if (match.groups.field === "data") {
          data += `${match.groups.value || ""}\n`;
        }
      }

      if (!data) {
        continue;
      }

      handleAgentEvent(event, data.endsWith("\n") ? data.slice(0, -1) : data);
    }

    if (done) {
      if (buffer.trim()) {
        handleAgentEvent("", buffer.trim());
      }
      return;
    }
  }
}

function buildSkillPayload(skill: WorkspaceSkill): SkillPayload {
  return {
    slug: skill.slug,
    description: skill.description,
    contentMarkdown: skill.content,
    source: "model_selected",
  };
}

/**
 * `getWidgetData` returns the in-app `CopilotDataT` shape, where each item's
 * `content` is JSON-stringified (a copilot content-block convention). MCP callers
 * want structured rows, so for the bridge response only we parse those strings
 * back into arrays/objects. Only JSON-array/object strings are parsed — plain
 * text content (markdown notes, single-column SQL text) is left as-is. The
 * in-app copilot data path is unaffected.
 */
export function normalizeWidgetDataForBridge(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((entry) => {
    const items = (entry as { items?: unknown })?.items;
    if (!entry || typeof entry !== "object" || !Array.isArray(items)) return entry;

    const normalizedItems = items.map((item) => {
      const content = (item as { content?: unknown })?.content;
      if (typeof content !== "string") return item;
      const trimmed = content.trim();
      if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return item;
      try {
        return { ...(item as Record<string, unknown>), content: JSON.parse(content) };
      } catch {
        return item;
      }
    });

    return { ...(entry as Record<string, unknown>), items: normalizedItems };
  });
}

async function handleDataCommand(
  command: WorkspaceBridgeCommandT<
    | "get_workspace_snapshot"
    | "get_widget_data"
    | "list_available_widgets"
    | "get_widget_schema"
    | "get_params_options"
  >,
  deps: Pick<CommandHandlerDeps, "getSnapshot" | "getWidgetData" | "getParamOptions">,
): Promise<WorkspaceBridgeCommandResult> {
  const { errorResult, successResult } = getResultFuncs(command);

  switch (command.command) {
    case "get_workspace_snapshot":
      return successResult("Workspace snapshot generated.", deps.getSnapshot());
    case "get_widget_data": {
      const data = await deps.getWidgetData(normalizeDataSources(command.data_sources));
      return successResult("Widget data fetched.", normalizeWidgetDataForBridge(data));
    }
    case "list_available_widgets": {
      const backendNameToWidgetMap =
        useGetWidgetsStore.getState().backendNameToWidgetMap;

      const { origin, backend_id } = command;

      const widgets = Array.from(backendNameToWidgetMap.entries())
        .flatMap(([backendName, widgetMap]) =>
          Array.from(widgetMap.values()).reduce(
            (acc, widget) => {
              if (!isAvailableWidget(widget)) return acc;
              const w = toWidgetCatalogEntry(widget, backendName);

              const isOriginMatch = origin ? w.origin === origin : true;
              const isBackendMatch = backend_id ? w.backend_id === backend_id : true;
              if (isOriginMatch && isBackendMatch) acc.push(w);

              return acc;
            },
            [] as ReturnType<typeof toWidgetCatalogEntry>[],
          ),
        )
        .sort((left, right) =>
          `${left.origin}:${left.widget_id}`.localeCompare(
            `${right.origin}:${right.widget_id}`,
          ),
        );

      return successResult("Available widgets listed.", { widgets });
    }
    case "get_widget_schema": {
      if (!(command.origin && command.widget_id)) {
        return errorResult(
          "invalid_request",
          "get_widget_schema requires origin and widget_id.",
        );
      }

      const widget = getWidgetSchemaPayload(command.origin, command.widget_id);
      if (!widget) {
        return errorResult(
          "command_failed",
          `Widget '${command.widget_id}' from origin '${command.origin}' was not found. Call list_available_widgets to get valid origin/widget_id pairs.`,
        );
      }

      return successResult("Widget schema loaded.", { widget });
    }
    case "get_params_options": {
      const data = await deps.getParamOptions(
        normalizeParamOptionsQueries(command.param_options_queries),
      );
      return successResult("Parameter options fetched.", data);
    }
  }
}

async function handleDashboardCommand(
  command: WorkspaceBridgeCommandT<
    "manage_dashboard" | "update_dashboard_layout" | "navigate_workspace"
  >,
  deps: Pick<CommandHandlerDeps, "currentDashboardId" | "navigateToDashboard">,
): Promise<WorkspaceBridgeCommandResult> {
  const { errorResult, successResult } = getResultFuncs(command);
  switch (command.command) {
    case "manage_dashboard":
      switch (command.operation) {
        case "create": {
          if (!command.name?.trim()) {
            return errorResult(
              "invalid_request",
              "manage_dashboard operation='create' requires name.",
            );
          }

          const dashboardId = command.dashboard_id?.trim() || uuidv4();

          try {
            workspaceApi.createDashboard(dashboardId, { name: command.name.trim() });
            if (command.activate !== false && deps.currentDashboardId !== dashboardId) {
              deps.navigateToDashboard(dashboardId);
            }
            return successResult("Dashboard created.", {
              dashboard_id: dashboardId,
              name: command.name.trim(),
              active: command.activate !== false,
            });
          } catch (error) {
            return errorResult(
              "command_failed",
              error instanceof Error ? error.message : "Failed to create dashboard.",
            );
          }
        }
        case "read": {
          const dashboardId = requireDashboardId(
            command,
            deps.currentDashboardId,
            "manage_dashboard operation='read' requires dashboard_id when no dashboard route is active.",
          );
          if (typeof dashboardId !== "string") return dashboardId;

          try {
            const dashboard = workspaceApi.readDashboard(dashboardId);
            return successResult("Dashboard loaded.", {
              dashboard_id: dashboardId,
              dashboard,
            });
          } catch (error) {
            return errorResult(
              "command_failed",
              error instanceof Error ? error.message : "Failed to read dashboard.",
            );
          }
        }
        case "update": {
          if (!command.name?.trim()) {
            return errorResult(
              "invalid_request",
              "manage_dashboard operation='update' requires name.",
            );
          }

          const dashboardId = requireDashboardId(
            command,
            deps.currentDashboardId,
            "manage_dashboard operation='update' requires dashboard_id. Call get_workspace_snapshot to list dashboard_ids.",
          );
          if (typeof dashboardId !== "string") return dashboardId;

          const name = command.name.trim();
          try {
            workspaceApi.updateDashboard(dashboardId, { name });
            return successResult("Dashboard updated.", {
              dashboard_id: dashboardId,
              name,
            });
          } catch (error) {
            return errorResult(
              "command_failed",
              error instanceof Error ? error.message : "Failed to update dashboard.",
            );
          }
        }
        default: {
          return errorResult(
            "invalid_request",
            "manage_dashboard requires operation from {create, read, update}.",
          );
        }
      }
    case "update_dashboard_layout": {
      const dashboardId = requireDashboardId(
        command,
        deps.currentDashboardId,
        "update_widget_layout requires dashboard_id when no dashboard route is active.",
      );
      if (typeof dashboardId !== "string") return dashboardId;

      const widgetUuid = resolveWidgetUuid(command, dashboardId);
      if (typeof widgetUuid !== "string") return widgetUuid;

      if (
        ![command.x, command.y, command.w, command.h].every(
          (value) => typeof value === "number" && Number.isFinite(value),
        )
      ) {
        return errorResult(
          "invalid_request",
          "update_widget_layout requires numeric x, y, w, and h.",
        );
      }

      try {
        workspaceApi.updateDashboardLayout(dashboardId, widgetUuid, {
          ...(command.tab_id ? { tabId: command.tab_id } : {}),
          x: command.x,
          y: command.y,
          w: command.w,
          h: command.h,
          ...(typeof command.min_w === "number" ? { minW: command.min_w } : {}),
          ...(typeof command.min_h === "number" ? { minH: command.min_h } : {}),
          ...(typeof command.max_w === "number" ? { maxW: command.max_w } : {}),
          ...(typeof command.max_h === "number" ? { maxH: command.max_h } : {}),
        });
        const settledWidget = useAppStore
          .getState()
          .getTabWidgetById(dashboardId, widgetUuid);
        const settledTabId = serializeDashboardTabId(settledWidget?.innerTab);
        const settledTab = getDashboardInfo(dashboardId)?.tabs.find(
          (tab) => tab.tab_id === settledTabId,
        );
        return successResult(
          "Dashboard layout updated.",
          {
            dashboard_id: dashboardId,
            widget_uuid: widgetUuid,
            ...(command.tab_id ? { tab_id: command.tab_id } : {}),
            x: command.x,
            y: command.y,
            w: command.w,
            h: command.h,
            settled_layout: {
              tab_id: settledTabId,
              layout: settledTab?.layout ?? [],
            },
          },
          [
            "x/y/w/h echo the requested placement; vertical grid compaction may settle the widget at a lower y and collisions can shift neighboring widgets. settled_layout is the tab's layout after the mutation.",
          ],
        );
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to update dashboard layout.",
        );
      }
    }
    case "navigate_workspace":
      switch (command.operation) {
        case "dashboard": {
          if (!command.dashboard_id?.trim()) {
            return errorResult(
              "invalid_request",
              "navigate_workspace operation='dashboard' requires dashboard_id.",
            );
          }

          const dashboardId = command.dashboard_id.trim();
          const appState = useAppStore.getState();
          const dashboard = appState.items?.[dashboardId];
          if (!dashboard?.data) {
            return errorResult(
              "command_failed",
              `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
            );
          }

          const tabId = command.tab_id?.trim();
          const currentTab = dashboard.data?.currentTab;
          const tabSuffix = tabId ? `?tab=${tabId}` : "";
          if (
            dashboardId !== deps.currentDashboardId ||
            (tabSuffix && tabId !== currentTab)
          ) {
            deps.navigateToDashboard(`${dashboardId}${tabSuffix}`);
          }
          return successResult("Navigated to dashboard.", {
            dashboard_id: dashboardId,
            name: dashboard.data.name,
            ...(tabId ? { tab_id: tabId } : {}),
          });
        }
        case "tab": {
          if (!command.tab_id?.trim()) {
            return errorResult(
              "invalid_request",
              "navigate_workspace operation='tab' requires tab_id.",
            );
          }

          const dashboardId = requireDashboardId(
            command,
            deps.currentDashboardId,
            "navigate_workspace operation='tab' requires dashboard_id when no dashboard route is active.",
          );
          if (typeof dashboardId !== "string") return dashboardId;

          const dashboardInfo = getDashboardInfo(dashboardId);
          if (!dashboardInfo) {
            return errorResult(
              "command_failed",
              `Dashboard '${dashboardId}' not found. Call get_workspace_snapshot to list dashboard_ids.`,
            );
          }

          // The snapshot serializes the default (tab-less) view as "__no_tab__";
          // round-trip it back to the plain dashboard route instead of a
          // phantom ?tab=__no_tab__.
          const storedTabId = deserializeDashboardTabId(command.tab_id);
          const serializedTabId = serializeDashboardTabId(storedTabId);
          if (!dashboardInfo.tabs.some((tab) => tab.tab_id === serializedTabId)) {
            return errorResult(
              "invalid_request",
              `navigate_workspace operation='tab' could not find tab '${command.tab_id.trim()}' on dashboard '${dashboardId}'. Valid tab_ids: ${dashboardInfo.tabs
                .map((tab) => tab.tab_id)
                .join(", ")}.`,
            );
          }

          deps.navigateToDashboard(
            storedTabId ? `${dashboardId}?tab=${storedTabId}` : dashboardId,
          );
          return successResult("Switched tab.", {
            dashboard_id: dashboardId,
            tab_id: serializedTabId,
          });
        }
        default:
          return errorResult(
            "invalid_request",
            "navigate_workspace requires operation from {dashboard, tab}.",
          );
      }
  }
}

async function handleWidgetCommand(
  command: WorkspaceBridgeCommandT<
    "read_widget" | "create_widget" | "update_widget" | "delete_widget"
  >,
  deps: Pick<CommandHandlerDeps, "currentDashboardId">,
): Promise<WorkspaceBridgeCommandResult> {
  const { errorResult, successResult } = getResultFuncs(command);
  switch (command.command) {
    case "read_widget": {
      const dashboardId = requireDashboardId(
        command,
        deps.currentDashboardId,
        "read_widget requires dashboard_id when no dashboard route is active.",
      );
      if (typeof dashboardId !== "string") return dashboardId;

      const widgetUuid = resolveWidgetUuid(command, dashboardId);
      if (typeof widgetUuid !== "string") return widgetUuid;

      try {
        const widget = workspaceApi.readWidget(dashboardId, widgetUuid);
        return successResult("Widget loaded.", {
          dashboard_id: dashboardId,
          widget_uuid: widgetUuid,
          widget,
        });
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to read widget.",
        );
      }
    }
    case "create_widget": {
      const dashboardId = requireDashboardId(
        command,
        deps.currentDashboardId,
        "create_widget requires dashboard_id, backend_name, and widget_id.",
      );
      if (typeof dashboardId !== "string") return dashboardId;
      if (!command.backend_name || !command.widget_id) {
        return errorResult(
          "invalid_request",
          "create_widget requires dashboard_id, backend_name, and widget_id.",
        );
      }
      if (GENERATIVE_ONLY_WIDGET_IDS.has(command.widget_id)) {
        return errorResult(
          "invalid_request",
          "create_widget does not support 'rich_note'. Use add_generative_widget with widget_type='note' instead.",
        );
      }

      const unsupportedMessage = getUnsupportedCreateWidgetMessage(command.widget_id);
      if (unsupportedMessage) {
        return errorResult("invalid_request", unsupportedMessage);
      }

      if (command.dry_run) {
        let widgetDefinition: WidgetT;
        try {
          widgetDefinition = workspaceApi.getWidgetDefinitionOrThrow(
            command.backend_name,
            command.widget_id,
          );
        } catch (error) {
          return errorResult(
            "command_failed",
            error instanceof Error ? error.message : "Failed to create widget.",
          );
        }
        const config = buildWidgetConfigForDashboard(dashboardId, command.config);
        const { params } = workspaceApi.computeWidgetParamUpdates(
          widgetDefinition.params,
          config.dataArgs,
        );
        const warnings = widgetConfigWarnings(widgetDefinition.params, command.config);
        return successResult(
          "Dry run: widget would be created. Nothing was changed.",
          {
            valid: true,
            dashboard_id: dashboardId,
            effective_params: {
              ...((widgetDefinition.storage?.params ?? {}) as Record<string, unknown>),
              ...params,
            },
            warnings,
          },
          warnings,
        );
      }

      try {
        const widgetUuid = await workspaceApi.createWidget(
          dashboardId,
          command.backend_name,
          command.widget_id,
          buildWidgetConfigForDashboard(dashboardId, command.config),
        );
        const widgetDefinition = useGetWidgetsStore
          .getState()
          .getAppWidget(command.widget_id as WidgetT["widgetId"], command.backend_name);
        const appState = useAppStore.getState();
        const createdWidget = appState.getTabWidgetById(dashboardId, widgetUuid);
        const gridData = appState.getWidgetGridData(dashboardId, widgetUuid);
        return successResult(
          "Widget created.",
          {
            widget_uuid: widgetUuid,
            dashboard_id: dashboardId,
            effective_params: (createdWidget?.storage?.params ?? {}) as Record<
              string,
              unknown
            >,
            grid_data: gridData
              ? { x: gridData.x, y: gridData.y, w: gridData.w, h: gridData.h }
              : null,
            inner_tab: createdWidget?.innerTab || null,
          },
          widgetConfigWarnings(widgetDefinition?.params, command.config),
        );
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to create widget.",
        );
      }
    }
    case "update_widget": {
      const dashboardId = requireDashboardId(
        command,
        deps.currentDashboardId,
        "update_widget requires dashboard_id.",
      );
      if (typeof dashboardId !== "string") return dashboardId;

      const widgetUuid = resolveWidgetUuid(command, dashboardId);
      if (typeof widgetUuid !== "string") return widgetUuid;

      const dataArgs = asRecord(command.config?.data_args) ?? {};
      const uiArgs = asRecord(command.config?.ui_args) ?? {};
      if (Object.keys(dataArgs).length === 0 && Object.keys(uiArgs).length === 0) {
        return errorResult(
          "invalid_request",
          "update_widget requires data_args and/or ui_args; call get_widget_schema to see valid params.",
        );
      }

      if (hasLayoutUiArgs(command.config)) {
        return errorResult(
          "invalid_request",
          "update_widget only supports widget-instance config updates. Use update_widget_layout for x/y/w/h, gridData, or tab placement.",
        );
      }

      if (command.dry_run) {
        const widget = useAppStore.getState().getTabWidgetById(dashboardId, widgetUuid);
        const config = buildWidgetConfigForDashboard(dashboardId, command.config);
        const { params } = workspaceApi.computeWidgetParamUpdates(
          widget?.params,
          config.dataArgs,
        );
        const warnings = widgetConfigWarnings(widget?.params, command.config);
        return successResult(
          "Dry run: widget would be updated. Nothing was changed.",
          {
            valid: true,
            dashboard_id: dashboardId,
            widget_uuid: widgetUuid,
            effective_params: {
              ...((widget?.storage?.params ?? {}) as Record<string, unknown>),
              ...params,
            },
            warnings,
          },
          warnings,
        );
      }

      try {
        await workspaceApi.updateWidget(
          dashboardId,
          widgetUuid,
          buildWidgetConfigForDashboard(dashboardId, command.config),
        );
        const updatedWidget = useAppStore
          .getState()
          .getTabWidgetById(dashboardId, widgetUuid);
        return successResult(
          "Widget updated.",
          {
            dashboard_id: dashboardId,
            widget_uuid: widgetUuid,
            effective_params: (updatedWidget?.storage?.params ?? {}) as Record<
              string,
              unknown
            >,
          },
          widgetConfigWarnings(updatedWidget?.params, command.config),
        );
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to update widget.",
        );
      }
    }
    case "delete_widget": {
      const dashboardId = requireDashboardId(
        command,
        deps.currentDashboardId,
        "delete_widget requires dashboard_id.",
      );
      if (typeof dashboardId !== "string") return dashboardId;

      const widgetUuid = resolveWidgetUuid(command, dashboardId);
      if (typeof widgetUuid !== "string") return widgetUuid;

      try {
        await workspaceApi.deleteWidget(dashboardId, widgetUuid);
        return successResult("Widget deleted.", {
          dashboard_id: dashboardId,
          widget_uuid: widgetUuid,
        });
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to delete widget.",
        );
      }
    }
  }
}

async function handleWorkspaceMutationCommand(
  command: WorkspaceBridgeCommandT<"manage_navigation_bar" | "add_generative_widget">,
  deps: Pick<
    CommandHandlerDeps,
    "currentDashboardId" | "manageNavigationBar" | "addGenerativeWidget"
  >,
): Promise<WorkspaceBridgeCommandResult> {
  const dashboardId = requireDashboardId(
    command,
    deps.currentDashboardId,
    `${command.command} requires dashboard_id.`,
  );
  if (typeof dashboardId !== "string") return dashboardId;

  switch (command.command) {
    case "manage_navigation_bar": {
      const {
        dashboard_id: _dashboardId,
        request_id: _requestId,
        command: _command,
        ...args
      } = command;
      const results = await deps.manageNavigationBar(
        args as ManageNavigationBarInputArgumentsT,
        { dashboardId },
      );
      return completeCopilotCommand(
        command.command,
        command.request_id,
        "Navigation bar updated.",
        results,
        { dashboard_id: dashboardId, results },
      );
    }
    case "add_generative_widget": {
      const {
        dashboard_id: _dashboardId,
        request_id: _requestId,
        command: _command,
        ...args
      } = command;
      const parsed = addGenerativeWidgetInputArguments.safeParse(args);
      if (!parsed.success) {
        const issues = parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("; ");
        return errorResult(
          command.command,
          command.request_id,
          "invalid_request",
          `add_generative_widget arguments are invalid: ${issues}. chart_params keys must be camelCase: chartType, xKey, yKey (yKey is an array of strings).`,
        );
      }
      const results = await deps.addGenerativeWidget(parsed.data, { dashboardId });
      return completeCopilotCommand(
        command.command,
        command.request_id,
        "Generative widget created.",
        results,
        {
          dashboard_id: dashboardId,
          widget_uuid: createdWidgetUuidFromResults(results),
          results,
        },
      );
    }
  }
}

async function handleAgentAndSkillCommand(
  command: WorkspaceBridgeCommandT<
    "assign_tasks_to_agents" | "execute_agent_tool" | "get_skill_content"
  >,
  deps: Pick<
    CommandHandlerDeps,
    | "assignTasksToAgents"
    | "forwardMessageToAgent"
    | "executeAgentTool"
    | "getSkillBySlug"
  >,
): Promise<WorkspaceBridgeCommandResult> {
  const { errorResult, successResult, completeCopilotCommand } =
    getResultFuncs(command);
  switch (command.command) {
    case "assign_tasks_to_agents": {
      const results = await deps.assignTasksToAgents(
        normalizeList(command.task_requests),
        deps.forwardMessageToAgent,
      );
      return completeCopilotCommand("Tasks assigned to agents.", results, { results });
    }
    case "execute_agent_tool": {
      if (!command.server_id || !command.tool_name) {
        return errorResult(
          "invalid_request",
          "execute_agent_tool requires server_id and tool_name.",
        );
      }

      try {
        const data = await deps.executeAgentTool(
          command.server_id,
          command.tool_name,
          command.parameters ?? {},
        );
        return successResult("Agent tool executed.", data);
      } catch (error) {
        return errorResult(
          "command_failed",
          error instanceof Error ? error.message : "Failed to execute agent tool.",
        );
      }
    }
    case "get_skill_content": {
      if (!command.slug) {
        return errorResult("invalid_request", "get_skill_content requires slug.");
      }

      const skill = deps.getSkillBySlug(command.slug);
      if (!skill) {
        return errorResult(
          "command_failed",
          `Skill with slug '/${command.slug}' not found in Workspace skill library.`,
        );
      }

      return successResult("Skill content loaded.", {
        skill: buildSkillPayload(skill),
      });
    }
  }
}

function summarizeBackend(source: Source) {
  return {
    id: source.id ?? source.uuid,
    name: source.name,
    url: source.url,
    status: source.status ?? "pending",
    is_openbb_platform: source.isOpenBBPlatform ?? false,
    has_api_key: source.hasApiKey ?? false,
    widget_count: Object.keys(source.widgets ?? {}).length,
    app_count: source.templates?.length ?? 0,
    agent_count: source.agents?.length ?? 0,
  };
}

async function handleManageBackendsCommand(
  command: WorkspaceBridgeCommandT<"manage_backends">,
): Promise<WorkspaceBridgeCommandResult> {
  const operation = command.operation;
  const { errorResult, successResult } = getResultFuncs(command);
  if (
    operation !== "list" &&
    operation !== "add" &&
    operation !== "update" &&
    operation !== "refresh" &&
    operation !== "remove"
  ) {
    return errorResult(
      "invalid_request",
      "manage_backends requires operation from {list, add, update, refresh, remove}.",
    );
  }

  const store = useBackendConnectorStore.getState();
  const headers = command.endpoint_headers
    ? command.endpoint_headers.map((header) => ({
        key: header.key,
        value: header.value,
        location: (header.location ?? "headers") as "headers" | "query",
      }))
    : null;

  if (operation === "list") {
    return successResult("Backends listed.", {
      backends: store.apiSources.map(summarizeBackend),
    });
  }

  if (operation === "add") {
    if (!command.name || !command.url) {
      return errorResult(
        "invalid_request",
        "manage_backends operation='add' requires name and url.",
      );
    }
    const cleanUrl = command.url.trim().replace(/\/+$/, "");
    const conflict = store.checkExistingBackend({
      id: "",
      name: command.name,
      url: cleanUrl,
    });
    if (conflict) {
      return errorResult(
        "invalid_request",
        conflict.name || conflict.url || "Backend already exists.",
      );
    }
    const appId = uuidv4();
    const { status } = await postApiSource(appId, {
      name: command.name,
      url: cleanUrl,
      endpointHeaders: headers ?? [],
    });
    if (status !== 200) {
      return errorResult(
        "command_failed",
        `Failed to save backend (status ${status}).`,
      );
    }
    const allSources = await getApiSources();
    const created: Source =
      allSources.find((source) => source.id === appId) ??
      ({
        id: appId,
        uuid: appId,
        name: command.name,
        url: cleanUrl,
        endpointHeaders: headers ?? null,
        isOpenBBPlatform: command.is_openbb_platform ?? false,
      } as Source);
    const finalSource: Source =
      typeof command.is_openbb_platform === "boolean"
        ? { ...created, isOpenBBPlatform: command.is_openbb_platform }
        : created;

    const validateWidgets = command.validate_widgets ?? true;
    const { errorMessage, templateErrorMessage } = await store.updateApiSource(
      finalSource,
      true,
    );
    const refreshed = store.getApiSourceById(appId) ?? finalSource;
    const validationError = errorMessage || templateErrorMessage || null;

    if (validateWidgets && validationError) {
      return errorResult(
        "command_failed",
        `Backend saved but widget validation failed: ${validationError} ${BACKEND_AUTHORING_HINT}`,
      );
    }
    return successResult("Backend added.", {
      backend: summarizeBackend(refreshed),
      validation_warning: validationError,
    });
  }

  if (!command.backend_id) {
    return errorResult(
      "invalid_request",
      `manage_backends operation='${operation}' requires backend_id.`,
    );
  }

  const existing = store.getApiSourceById(command.backend_id);
  if (!existing) {
    return errorResult("command_failed", `Backend '${command.backend_id}' not found.`);
  }

  if (operation === "remove") {
    const removed = await store.deleteApiSource({
      id: existing.id,
      sourceId: existing.id,
      vendorAppUuid: existing.vendorAppUuid ?? existing.vendorApp?.uuid,
    });
    if (!removed) {
      return errorResult(
        "command_failed",
        `Failed to remove backend '${command.backend_id}'.`,
      );
    }
    return successResult("Backend removed.", {
      backend_id: command.backend_id,
    });
  }

  if (operation === "refresh") {
    const { success } = await store.refreshApiSourceById(command.backend_id);
    const refreshed = store.getApiSourceById(command.backend_id) ?? existing;
    if (!success) {
      return errorResult(
        "command_failed",
        `Backend '${refreshed.name}' refresh failed; check the backend URL and headers.`,
      );
    }
    return successResult("Backend refreshed.", {
      backend: summarizeBackend(refreshed),
    });
  }

  if (
    !command.name &&
    !command.url &&
    headers === null &&
    (command.is_openbb_platform === null || command.is_openbb_platform === undefined)
  ) {
    return errorResult(
      "invalid_request",
      "manage_backends operation='update' requires at least one of name, url, endpoint_headers, or is_openbb_platform.",
    );
  }

  const updatedSource: Source = {
    ...existing,
    name: command.name ?? existing.name,
    url: command.url ? command.url.trim().replace(/\/+$/, "") : existing.url,
    endpointHeaders: headers ?? existing.endpointHeaders,
    isOpenBBPlatform: command.is_openbb_platform ?? existing.isOpenBBPlatform ?? false,
  };

  const { status } = await postApiSource(existing.id ?? command.backend_id, {
    name: updatedSource.name,
    url: updatedSource.url,
    endpointHeaders: updatedSource.endpointHeaders ?? [],
  });
  if (status !== 200) {
    return errorResult(
      "command_failed",
      `Failed to update backend (status ${status}).`,
    );
  }

  const { errorMessage, templateErrorMessage } = await store.updateApiSource(
    updatedSource,
    true,
  );
  const refreshed =
    store.getApiSourceById(existing.id ?? command.backend_id) ?? updatedSource;
  const validationError = errorMessage || templateErrorMessage || null;
  const validateWidgets = command.validate_widgets ?? true;
  if (validateWidgets && validationError) {
    return errorResult(
      "command_failed",
      `Backend updated but widget validation failed: ${validationError} ${BACKEND_AUTHORING_HINT}`,
    );
  }
  return successResult("Backend updated.", {
    backend: summarizeBackend(refreshed),
    validation_warning: validationError,
  });
}

function summarizeApp(template: BackendTemplate) {
  return {
    name: template.name,
    template_id: template.templateId ?? template.id ?? null,
    description: template.description ?? "",
    tab_count: Object.keys(template.tabs ?? {}).length,
    group_count: template.groups?.length ?? 0,
    prompt_count: template.prompts?.length ?? 0,
    allow_customization: template.allowCustomization ?? false,
  };
}

type AppEntry =
  | {
      kind: "backend" | "shared";
      template: BackendTemplate & { createdBy?: string };
      source: Source;
    }
  | { kind: "saved"; app: UserGeneratedApp };

/**
 * Mirrors the app sources merged by `useAllTemplates` for the Apps page:
 * templates from the user's own backends, templates shared through role
 * permissions, and saved (user-generated) apps owned by or shared with the
 * user. Backends that are both owned and shared only contribute once.
 */
function collectAppEntries(
  getSharedTemplates: CommandHandlerDeps["getSharedTemplates"],
): AppEntry[] {
  const entries: AppEntry[] = [];
  const ownedBackendIds = new Set<string>();

  for (const source of useBackendConnectorStore.getState().apiSources) {
    const sourceId = source.id ?? source.uuid;
    if (sourceId) ownedBackendIds.add(sourceId);
    for (const template of source.templates ?? []) {
      entries.push({ kind: "backend", template, source });
    }
  }

  for (const template of getSharedTemplates()) {
    const source = template.source;
    const sourceId = source?.id ?? source?.uuid;
    if (!source || (sourceId && ownedBackendIds.has(sourceId))) continue;
    entries.push({ kind: "shared", template, source });
  }

  const userAppsStore = useUserAppsStore.getState();
  for (const app of [
    ...userAppsStore.getAllUserApps(),
    ...userAppsStore.getAllSharedUserApps(),
  ]) {
    entries.push({ kind: "saved", app });
  }

  return entries;
}

function summarizeAppEntry(entry: AppEntry) {
  if (entry.kind === "saved") {
    const app = entry.app;
    return {
      name: app.name,
      template_id: app.uuid ?? null,
      description: app.description ?? "",
      type: "saved" as const,
      backend_id: null,
      backend_name: null,
      is_shared: app.isShared ?? false,
      created_by: app.createdBy ?? null,
      widget_count: app.widgets?.length ?? 0,
      prompt_count: app.prompts?.length ?? 0,
    };
  }

  return {
    ...summarizeApp(entry.template),
    type: entry.kind,
    backend_id: entry.source.id ?? entry.source.uuid ?? null,
    backend_name: entry.source.name ?? null,
    is_shared: entry.kind === "shared",
    created_by: entry.template.createdBy ?? null,
  };
}

function findAppEntry(
  entries: AppEntry[],
  appName: string | null | undefined,
  templateId: string | null | undefined,
): AppEntry | undefined {
  if (templateId) {
    const byId = entries.find((entry) =>
      entry.kind === "saved"
        ? entry.app.uuid === templateId
        : entry.template.templateId === templateId || entry.template.id === templateId,
    );
    if (byId) return byId;
  }
  if (appName) {
    return entries.find((entry) =>
      entry.kind === "saved"
        ? entry.app.name === appName
        : entry.template.name === appName,
    );
  }
  return undefined;
}

function instantiateSavedApp(app: UserGeneratedApp): string | undefined {
  const appStore = useAppStore.getState();
  const newTab = duplicateTabItem(
    {
      data: {
        name: app.name,
        type: "custom",
        templateId: `custom-${app.uuid}`,
        widgets: app.widgets,
        groups: app.groups || [],
        gridLayout: app.gridLayout || {},
      },
    },
    undefined,
    false,
  );
  appStore.addTab(newTab, true);
  return newTab.index;
}

async function handleManageAppsCommand(
  command: WorkspaceBridgeCommandT<"manage_apps">,
  deps: Pick<CommandHandlerDeps, "navigateToDashboard" | "getSharedTemplates">,
): Promise<WorkspaceBridgeCommandResult> {
  const operation = command.operation;
  const { errorResult, successResult } = getResultFuncs(command);
  if (operation !== "list" && operation !== "read" && operation !== "instantiate") {
    return errorResult(
      "invalid_request",
      "manage_apps requires operation from {list, read, instantiate}.",
    );
  }

  const entries = collectAppEntries(deps.getSharedTemplates);
  const backendId = command.backend_id ?? null;
  let scoped = entries;
  if (backendId) {
    scoped = entries.filter(
      (entry) =>
        entry.kind !== "saved" && (entry.source.id ?? entry.source.uuid) === backendId,
    );
    const backendExists =
      scoped.length > 0 ||
      Boolean(useBackendConnectorStore.getState().getApiSourceById(backendId));
    if (!backendExists) {
      return errorResult("invalid_request", `Backend '${backendId}' not found.`);
    }
  }

  if (operation === "list") {
    return successResult("Apps listed.", { apps: scoped.map(summarizeAppEntry) });
  }

  if (!command.app_name && !command.template_id) {
    return errorResult(
      "invalid_request",
      `manage_apps operation='${operation}' requires app_name or template_id.`,
    );
  }

  const entry = findAppEntry(scoped, command.app_name, command.template_id);
  if (!entry) {
    return errorResult(
      "invalid_request",
      backendId ? `App not found on backend '${backendId}'.` : "App not found.",
    );
  }

  if (operation === "read") {
    if (entry.kind === "saved") {
      return successResult("App read.", {
        app: {
          ...summarizeAppEntry(entry),
          widgets: entry.app.widgets ?? [],
          groups: entry.app.groups ?? [],
          prompts: entry.app.prompts ?? [],
        },
      });
    }
    return successResult("App read.", {
      app: {
        ...summarizeAppEntry(entry),
        tabs: entry.template.tabs ?? {},
        groups: entry.template.groups ?? [],
        prompts: entry.template.prompts ?? [],
      },
    });
  }

  // instantiate: always create a fresh dashboard (predictable for automated callers)
  const appName = entry.kind === "saved" ? entry.app.name : entry.template.name;
  let dashboardId: string | undefined;
  try {
    if (entry.kind === "saved") {
      dashboardId = instantiateSavedApp(entry.app);
    } else {
      const appStore = useAppStore.getState();
      dashboardId = await createCustomTemplateTab({
        addTab: appStore.addTab,
        navigate: null,
        items: appStore.items,
        template: entry.template,
        source: entry.source,
        currentDashboard: "",
      });
    }
  } catch (error) {
    return errorResult(
      "command_failed",
      error instanceof Error ? error.message : "Failed to instantiate app.",
    );
  }
  if (!dashboardId) {
    return errorResult(
      "command_failed",
      "App instantiation did not return a dashboard id.",
    );
  }

  if (command.activate !== false) {
    deps.navigateToDashboard(dashboardId);
  }

  return successResult("App instantiated.", {
    dashboard_id: dashboardId,
    dashboard_url: `/app/${dashboardId}`,
    app_name: appName,
    active: command.activate !== false,
  });
}

export function useWorkspaceBridgeCommandHandler() {
  const currentDashboardId = useActiveWorkspaceDashboardId();
  const navigate = useNavigate();
  const [getQueryFetchParams] = useAiFetchRequestInit();
  const getSnapshot = useWorkspaceBridgeSnapshot();
  const { getWidgetData, getParamOptions, assignTasksToAgents, addGenerativeWidget } =
    useFunctionCall();
  const manageNavigationBar = useManageNavigationBar();
  const executeAgentTool = useMcpExecutor();
  const getSkillBySlug = useShallowSkillsLibraryStore((s) => s.getSkillBySlug);
  const { data: sharedTemplatesData } = useSharedTemplates({ enabled: true });
  const getSharedTemplates = useCallback(
    () => sharedTemplatesData ?? [],
    [sharedTemplatesData],
  );

  const forwardMessageToAgent = useCallback(
    async (message: string, _fromAgentId: string, targetAgent: Copilot) => {
      const abortController = new AbortController();
      const { queryUrl, init } = await getQueryFetchParams({
        incomingMessage: message,
        abortSignal: abortController.signal,
        targetAgent,
      });
      if (!queryUrl) {
        throw new Error(`Agent '${targetAgent.name}' is missing a query endpoint.`);
      }

      const response = await fetch(queryUrl, init);
      if (!response.ok) {
        throw new Error(response.statusText || "Assigned agent request failed.");
      }

      await drainAgentResponse(response);
    },
    [getQueryFetchParams],
  );

  return useCallback(
    async (command: WorkspaceBridgeCommand): Promise<WorkspaceBridgeCommandResult> => {
      try {
        switch (command.command) {
          case "get_workspace_snapshot":
          case "get_widget_data":
          case "list_available_widgets":
          case "get_widget_schema":
          case "get_params_options":
            return await handleDataCommand(command, {
              getSnapshot,
              getWidgetData,
              getParamOptions,
            });
          case "manage_dashboard":
          case "update_dashboard_layout":
          case "navigate_workspace":
            return await handleDashboardCommand(command, {
              currentDashboardId,
              navigateToDashboard: (dashboardId) =>
                navigate(`/app/${dashboardId}`, { replace: true }),
            });
          case "read_widget":
          case "create_widget":
          case "update_widget":
          case "delete_widget":
            return await handleWidgetCommand(command, { currentDashboardId });
          case "manage_navigation_bar":
          case "add_generative_widget":
            return await handleWorkspaceMutationCommand(command, {
              currentDashboardId,
              manageNavigationBar,
              addGenerativeWidget,
            });
          case "assign_tasks_to_agents":
          case "execute_agent_tool":
          case "get_skill_content":
            return await handleAgentAndSkillCommand(command, {
              assignTasksToAgents,
              forwardMessageToAgent,
              executeAgentTool,
              getSkillBySlug,
            });
          case "manage_backends":
            return await handleManageBackendsCommand(command);
          case "manage_apps":
            return await handleManageAppsCommand(command, {
              getSharedTemplates,
              navigateToDashboard: (dashboardId) =>
                navigate(`/app/${dashboardId}`, { replace: true }),
            });
          default: {
            const fallback = command as {
              command?: unknown;
              request_id?: string | null;
            };
            const cmd = fallback.command;
            return errorResult(
              typeof cmd === "string" ? cmd : "unknown_command",
              fallback.request_id ?? null,
              "invalid_request",
              `Unsupported workspace bridge command '${String(cmd)}'. The browser bundle may be older than the sidecar.`,
            );
          }
        }
      } catch (error) {
        return errorResult(
          command.command,
          command.request_id,
          "command_failed",
          error instanceof Error
            ? error.message
            : "Workspace bridge command failed unexpectedly.",
        );
      }
    },
    [
      addGenerativeWidget,
      assignTasksToAgents,
      currentDashboardId,
      executeAgentTool,
      forwardMessageToAgent,
      getParamOptions,
      getSharedTemplates,
      getSkillBySlug,
      getSnapshot,
      getWidgetData,
      manageNavigationBar,
      navigate,
    ],
  );
}
