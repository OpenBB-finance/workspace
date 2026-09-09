import { get } from "lodash";
import posthog from "posthog-js";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { getPreSignedUrl } from "~/api/auth.api";
import * as workspaceApi from "~/api/workspace.api";
import { isTruthy } from "~/components/General/Table/utils";
import type { ParamDefT, Ticker, WidgetT } from "~/components/types";
import { getParsedWidgetData } from "~/components/Widgets";
import { getChartWidgetData } from "~/components/Widgets/Chart";
import {
  cleanSearchParams as createCleanUrl,
  convertHeadersToRecord as getHeadersAndUrlParams,
} from "~/lib/api";
import { sdkClient } from "~/lib/api/sdkFetcher";
import type { FilterTypes } from "~/lib/api/sdkSchemas";
import { getAiApiUrl } from "~/lib/constants";
import { useTickersContext } from "~/lib/contexts/CachedTickers";
import { getIframeWidget } from "~/lib/iframeWidgetRegistry";
import { getConfig } from "~/lib/runtimeConfig";
import { useAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type ArtifactT,
  type ChartArtifactT,
  type Copilot,
  type CopilotCommandResultT,
  CopilotDataSchema,
  type CopilotDataT,
  CopilotError,
  CopilotErrorType,
  type CopilotFunctionCallError,
  type DataUrl,
  useCopilotStore,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowThemeStore } from "~/lib/state/theme";
import type { QueryTickersProps } from "~/lib/state/tickers";
import {
  type AddGenerativeWidgetInputArgumentsT,
  type CopilotFunctionCallArgumentsT,
  currentDateModifier,
  type DataSourceT,
  extractUUIDFromURL,
  getJsonWidget,
  getTickerParamName,
  getWidgetDataSource,
  type ParamOptionQueryResultT,
  type ParamOptionQueryT,
  paramOptionQueryResult,
  type TaskRequest,
} from "~/lib/utils";
import { ONBOARDING_STORED_FILES } from "~/lib/utils/createTemplates";
import {
  buildChartWidget,
  buildHtmlWidget,
  buildNoteWidget,
  buildTableWidget,
  GENERATIVE_WIDGET_DEFAULT_GRID,
} from "./buildWidget";
import { toAgGridChartType } from "./createWidgetUtils";
import { useShallowAppWidgetsStore } from "./useGetAppWidgets";
import { findTabMatch } from "./useManageNavigationBar";

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

type DashboardCommandOptions = {
  dashboardId?: string | null;
};

function describeDataSource(dataSource: DataSourceT): string {
  return `widget '${dataSource.id}' from origin '${dataSource.origin}'`;
}

function describeEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname || parsed.host || url;
  } catch {
    return url;
  }
}

function getGenerativeWidgetCitations(
  config: AddGenerativeWidgetInputArgumentsT,
): NonNullable<AddGenerativeWidgetInputArgumentsT["citations"]> {
  return Array.isArray(config.citations) ? config.citations : [];
}

function getGenerativeWidgetArtifacts(
  config: AddGenerativeWidgetInputArgumentsT,
): ArtifactT[] {
  return (Array.isArray(config.artifacts) ? config.artifacts : [])
    .map(normalizeGenerativeWidgetArtifact)
    .filter((artifact): artifact is ArtifactT => !!artifact);
}

const GENERATIVE_ARTIFACT_TYPES = [
  "text",
  "table",
  "chart",
  "html",
  "snowflake_query",
  "snowflake_python",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Converts an artifact payload from an add_generative_widget call into the
 * internal ArtifactT shape. Accepts two shapes: an already-normalized artifact
 * ({type, content}), forwarded as-is with uuid/name backfilled, and the raw
 * copilot wire format ({source_info, data_format, content}) where table/chart
 * content arrives as a JSON string. Returns null for anything else so malformed
 * tool-call payloads are dropped instead of stored in widget storage.
 */
function normalizeGenerativeWidgetArtifact(artifact: unknown): ArtifactT | null {
  if (!isRecord(artifact)) return null;

  if ("type" in artifact && "content" in artifact) {
    const name =
      asNonEmptyString(artifact.name) || asNonEmptyString(artifact.uuid) || uuidv4();
    return {
      ...artifact,
      uuid: asNonEmptyString(artifact.uuid) || name,
      name,
    } as ArtifactT;
  }

  if (!("source_info" in artifact) || !("data_format" in artifact)) return null;

  const sourceInfo = isRecord(artifact.source_info) ? artifact.source_info : {};
  const dataFormat = isRecord(artifact.data_format) ? artifact.data_format : {};
  const name =
    asNonEmptyString(sourceInfo.name) || asNonEmptyString(sourceInfo.uuid) || uuidv4();
  const type = GENERATIVE_ARTIFACT_TYPES.find((t) => t === dataFormat.parse_as);
  if (!type) return null;

  const parsedContent = parseArtifactContent(artifact.content, type);
  const metadata = isRecord(sourceInfo.metadata) ? sourceInfo.metadata : undefined;
  const normalizedArtifact: Record<string, unknown> = {
    uuid: asNonEmptyString(sourceInfo.uuid) || name,
    name,
    description: sourceInfo.description,
    type,
    content: parsedContent,
  };
  if (dataFormat.chart_params !== undefined) {
    normalizedArtifact.chart_params = dataFormat.chart_params;
  }
  const queryDataSource = dataFormat.query_data_source || metadata?.query_data_source;
  if (queryDataSource !== undefined) {
    normalizedArtifact.query_data_source = queryDataSource;
  }
  if (sourceInfo.metadata !== undefined) {
    normalizedArtifact.metadata = sourceInfo.metadata;
  }

  return normalizedArtifact as ArtifactT;
}

function parseArtifactContent(content: unknown, type: ArtifactT["type"]) {
  if (type === "table" || type === "chart") {
    const parsed = parseJsonContent(content);
    return Array.isArray(parsed) ? parsed : [];
  }

  return typeof content === "string" ? content : JSON.stringify(content);
}

function parseJsonContent(content: unknown) {
  if (typeof content !== "string") return content;
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

async function readErrorBody(response: Response): Promise<string | null> {
  try {
    const body = await response.clone().text();
    if (!body) return null;
    const normalized = body.replace(/\s+/g, " ").trim();
    return normalized ? normalized.slice(0, 300) : null;
  } catch {
    return null;
  }
}

async function parseResponseBody(
  response: Response,
  widgetType?: WidgetT["type"],
): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  const isHtml =
    widgetType === "html" ||
    // Endpoints might return JSON as text/plain,
    // so we only check for text/html or application/xhtml+xml to be safe
    contentType.includes("text/html") ||
    contentType.includes("application/xhtml+xml");

  const getResult = async () => {
    if (isHtml) return await response.text();

    const clonedRes = response.clone();
    try {
      return await response.json();
    } catch {
      return await clonedRes.text();
    }
  };

  const result = await getResult();
  if (typeof result !== "string") return result;

  return {
    content: result,
    data_format: {
      data_type: "object",
      parse_as: isHtml ? "html" : "text",
    },
  };
}

async function responseToCopilotError(
  response: Response,
  {
    context,
    badRequestHint,
  }: {
    context: string;
    badRequestHint: string;
  },
): Promise<CopilotError> {
  const endpoint = describeEndpoint(response.url);
  const body = await readErrorBody(response);
  const bodySuffix = body ? ` Response body: ${body}` : "";

  switch (response.status) {
    case 400:
      return new CopilotError(
        CopilotErrorType.GATEWAY_ERROR,
        `${context} hit '${endpoint}' and returned HTTP 400. ${badRequestHint}${bodySuffix}`,
      );
    case 404:
      return new CopilotError(
        CopilotErrorType.GATEWAY_ERROR,
        `${context} hit '${endpoint}' and returned HTTP 404. Re-check the resource identifier or query arguments, and confirm this data source is available in Workspace.${bodySuffix}`,
      );
    case 422:
      return new CopilotError(
        CopilotErrorType.GATEWAY_ERROR,
        `${context} hit '${endpoint}' and returned HTTP 422. The request shape was rejected by the data source.${bodySuffix}`,
      );
    default:
      return new CopilotError(
        CopilotErrorType.GATEWAY_ERROR,
        `${context} hit '${endpoint}' and returned HTTP ${response.status}.${bodySuffix}`,
      );
  }
}

export function useFunctionCall() {
  const { id: currentDashboardId = "" } = useParams();
  const getDashboardWidgetData = useShallowCopilotDataStore(
    (state) => state.getDashboardWidgetData,
  );

  const getAppWidget = useShallowAppWidgetsStore((s) => s.getAppWidget);
  const userToken = useShallowAuthStore((s) => s.user?.token);
  const aiEnhancementsEnabled = useShallowThemeStore(
    (state) => state.aiEnhancements && aiCopilotAiEnhancementsFF,
  );

  const getWidgetFromBackend = useCallback(
    (backendName: string, widgetId: string): WidgetT | null => {
      const widget = getAppWidget(widgetId as WidgetT["widgetId"], backendName);
      return widget ?? null;
    },
    [getAppWidget],
  );

  const { externalCopilotHolders, selectedCopilot } = useShallowCopilotStore((s) => ({
    externalCopilotHolders: s.externalCopilotHolders,
    selectedCopilot: s.selectedCopilot,
  }));

  const queryTickers = useTickersContext((state) => state.queryTickers);
  const { checkWidgetSignature } = useShallowCopilotDataStore((s) => ({
    checkWidgetSignature: s.checkWidgetSignature,
  }));

  const toFunctionCallError = useCallback(
    (
      error: unknown,
      fallbackMessage = "Error executing the function call.",
    ): CopilotFunctionCallError =>
      error instanceof CopilotError
        ? {
            error_type: error.error_type as CopilotErrorType,
            content: error.content,
          }
        : error instanceof Error
          ? {
              error_type: CopilotErrorType.UNEXPECTED,
              content: error.message || fallbackMessage,
            }
          : {
              error_type: CopilotErrorType.UNEXPECTED,
              content: fallbackMessage,
            },
    [],
  );

  const getWidgetData = useCallback(
    async (
      dataSources: DataSourceT[],
    ): Promise<(CopilotDataT | CopilotFunctionCallError)[]> => {
      const finalResults: (CopilotDataT | CopilotFunctionCallError)[] = [];
      for (const dataSource of dataSources) {
        if (dataSource.origin !== "OpenBB Hub") {
          const { origin, id, input_args, ssm_request } = dataSource;
          const widgetUuid = dataSource.widget_uuid;
          // This ensures that we only get the data if the widget hasn't changed
          if (
            widgetUuid &&
            checkWidgetSignature(widgetUuid, {
              origin: origin,
              widgetId: id,
              args: input_args,
              ssmRequest: ssm_request,
            })
          ) {
            try {
              const widgetData = workspaceApi.readWidget(
                currentDashboardId,
                widgetUuid,
              );
              // Check if cached data is non-empty before using it
              // SSRM widgets (Snowflake, etc.) may have empty cached data since they fetch on-demand
              const cachedData = widgetData?.data;
              // SSRM widgets `data.rowData` is only on requests, for `widgetData.data` we have the
              // processed rowData that's meant to be used directly
              if (widgetData && isTruthy(cachedData)) {
                finalResults.push(convertToCopilotData(cachedData));
                continue;
              }
              // If cached data is empty, fall through to fetch fresh data
            } catch (error) {
              if (import.meta.env.DEV) {
                console.error("Error reading widget data", error);
              }
            }
          }
        }

        try {
          // Safety check: Tab widgets should never be used for direct data fetching
          // They should only be expanded into their constituent widgets
          if (dataSource.id?.startsWith("tab_")) {
            console.warn(
              `Attempted to fetch data from tab widget ${dataSource.id}. Tab widgets should be expanded before reaching this stage.`,
            );
            throw new CopilotError(
              CopilotErrorType.NOT_FOUND,
              "Tab widgets cannot be used directly for data fetching. They should be expanded into their constituent widgets.",
            );
          }

          let result: Promise<any> | DataUrl | null = null;
          switch (dataSource.origin) {
            case "OpenBB Sandbox":
              result = await getOpenbbSandboxWidgetsData(
                dataSource,
                getWidgetFromBackend,
                queryTickers,
              );
              break;
            case "OpenBB Hub":
              result = await getOpenBBHubPreSignedUrls(
                dataSource,
                getWidgetFromBackend,
              );
              break;
            case "OpenBB Workspace":
              result = await getWorkspaceWidgetsData(
                dataSource,
                getDashboardWidgetData,
                getWidgetFromBackend,
              );
              break;
            default:
              result = await getCustomWidgetsData(
                dataSource,
                getWidgetFromBackend,
                getDashboardWidgetData,
              );
              break;
          }
          finalResults.push(convertToCopilotData(result));
        } catch (error) {
          console.error("Error fetching data", error);
          if (posthog) {
            posthog.capture("GET_WIDGET_DATA_ERROR", {
              message: error.message,
              stack: error.stack,
            });
          }
          finalResults.push(
            toFunctionCallError(
              error,
              `Fetching data for ${describeDataSource(dataSource)} failed.`,
            ),
          );
        }
      }
      return finalResults;
    },
    [
      getWidgetFromBackend,
      getDashboardWidgetData,
      queryTickers,
      checkWidgetSignature,
      toFunctionCallError,
    ],
  );

  const getParamOptions = useCallback(
    async (
      paramOptionsQueries: ParamOptionQueryT[],
    ): Promise<(CopilotDataT | CopilotFunctionCallError)[]> => {
      const finalResults: (CopilotDataT | CopilotFunctionCallError)[] = [];
      for (const paramOptionsQuery of paramOptionsQueries) {
        try {
          let result: any | null = null;
          switch (paramOptionsQuery.origin) {
            case "OpenBB Sandbox":
              result = await getWidgetsParamOptions(
                paramOptionsQuery,
                getWidgetFromBackend,
              );
              break;
            default:
              result = await getWidgetsParamOptions(
                paramOptionsQuery,
                getWidgetFromBackend,
              );
              break;
          }
          finalResults.push(convertToCopilotData(result));
        } catch (error) {
          console.error("Error fetching param options", error);
          if (posthog) {
            posthog.capture("GET_PARAM_OPTIONS_ERROR", {
              message: error.message,
              stack: error.stack,
            });
          }
          finalResults.push(
            toFunctionCallError(
              error,
              `Fetching parameter options for widget '${paramOptionsQuery.id}' from origin '${paramOptionsQuery.origin}' failed.`,
            ),
          );
        }
      }
      return finalResults;
    },
    [getWidgetFromBackend, toFunctionCallError],
  );

  const fetchWidgetInfo = useCallback(
    async (widgetData: string): Promise<{ title?: string; description?: string }> => {
      if (!(aiEnhancementsEnabled && userToken)) {
        return {};
      }

      try {
        const response = await fetch(`${getAiApiUrl()}/v1/generate/widget_info`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            widget_generation_request: {
              widget_data: widgetData,
            },
          }),
        });

        if (!response.ok) {
          console.warn("Failed to fetch AI widget info:", response.status);
          return {};
        }

        return await response.json();
      } catch (error) {
        console.warn("Failed to fetch AI widget info:", error);
        return {};
      }
    },
    [aiEnhancementsEnabled, userToken],
  );

  /**
   * Resolve a raw inner_tab name from the backend to an existing tab ID.
   * Matches by name (case-insensitive) or slug. Returns undefined if no match.
   */
  // Reads state imperatively via getState() — returns a snapshot at call-time, not
  // at render-time. Safe here because callers (addWidgetToDashboard, addGenerativeWidget)
  // are async and don't depend on batched React state updates within the same tick.
  const resolveInnerTabId = useCallback(
    (rawInnerTab: string, dashboardId = currentDashboardId): string | undefined => {
      const appState = useAppStore.getState();
      const tab = appState.items?.[dashboardId];
      const navBar = tab?.data?.widgets?.find((w) => w.widgetId === "navigation_bar");
      const tabs: { id: string; name: string }[] = navBar?.storage?.tabs || [];
      if (tabs.length === 0) return undefined;

      return findTabMatch(tabs, rawInnerTab)?.id;
    },
    [currentDashboardId],
  );

  const addWidgetToDashboard = useCallback(
    async (
      dataSources: DataSourceT[],
      copilotArgs?: CopilotFunctionCallArgumentsT,
    ): Promise<CopilotCommandResultT[]> => {
      const finalResults: CopilotCommandResultT[] = [];
      for (const dataSource of dataSources) {
        try {
          const config: {
            dataArgs?: Record<string, any>;
            uiArgs?: Record<string, any>;
          } = {
            dataArgs: dataSource.input_args,
          };

          // Handle inner_tab assignment when a navigation bar exists
          const rawInnerTab = dataSource.input_args?.inner_tab;
          if (rawInnerTab) {
            const tabId = resolveInnerTabId(rawInnerTab);
            if (tabId) {
              config.uiArgs = { ...config.uiArgs, innerTab: tabId };
            }
          }

          const shouldEnableChartView =
            !!copilotArgs?.chart_params && copilotArgs?.widget_type !== "table";

          if (shouldEnableChartView) {
            config.uiArgs = {
              ...config.uiArgs,
              chartSettingsOpen: false,
              chartView: {
                enabled: true,
                chartType: toAgGridChartType(copilotArgs?.chart_params?.chartType),
              },
            };
          }

          // Special handling for rich_note widgets to add content
          // Handle both 'rich_note' and 'rich_note-*' patterns
          const isRichNote =
            dataSource.id === "rich_note" || dataSource.id?.startsWith("rich_note-");

          if (isRichNote) {
            // Use content from input_args if provided, otherwise create editable note
            const content =
              dataSource.input_args?.content ||
              "# New Note\n\nClick to edit this note and add your content...";

            config.uiArgs = {
              ...config.uiArgs,
              html: content,
              gridData: {
                w: GENERATIVE_WIDGET_DEFAULT_GRID.w,
                h: GENERATIVE_WIDGET_DEFAULT_GRID.h,
              },
            };

            // Use AI-generated name and description from backend if provided
            if (dataSource.input_args?.name) {
              config.uiArgs.name = dataSource.input_args.name;
            }
            if (dataSource.input_args?.description) {
              config.uiArgs.description = dataSource.input_args.description;
            }
          } else {
            const queryContent = dataSource.input_args?.query;
            if (queryContent && aiEnhancementsEnabled) {
              const aiInfo = await fetchWidgetInfo(JSON.stringify(queryContent));
              if (aiInfo.title || aiInfo.description) {
                config.uiArgs = config.uiArgs || {};
                if (aiInfo.title) {
                  config.uiArgs.name = aiInfo.title;
                }
                if (aiInfo.description) {
                  config.uiArgs.description = aiInfo.description;
                }
              }
            }
          }

          await workspaceApi.createWidget(
            currentDashboardId,
            dataSource.origin,
            dataSource.id,
            config,
          );
          finalResults.push({
            status: "success",
            message: `Widget with id '${dataSource.id}' created successfully with arguments ${JSON.stringify(dataSource.input_args)}`,
          });
        } catch (error) {
          console.error("Error creating widget", error);
          finalResults.push({
            status: "error",
            message: `Error creating widget with id '${dataSource.id}': ${error.message}`,
          });
        }
      }
      return finalResults;
    },
    [currentDashboardId, aiEnhancementsEnabled, fetchWidgetInfo, resolveInnerTabId],
  );

  const updateWidgetInDashboard = useCallback(
    async (dataSources: DataSourceT[]): Promise<CopilotCommandResultT[]> => {
      const finalResults: CopilotCommandResultT[] = [];
      for (const dataSource of dataSources) {
        const widgetUuid = dataSource.widget_uuid;
        try {
          if (widgetUuid) {
            const config: {
              dataArgs?: Record<string, any>;
              uiArgs?: Record<string, any>;
            } = {
              dataArgs: dataSource.input_args,
            };

            // Special handling for rich_note widget updates
            const widget = useAppStore.getState().getWidgetById(widgetUuid);

            // Check if this is a rich_note widget (handle both 'rich_note' and 'rich_note-*' patterns)
            const isRichNote =
              widget?.widgetId === "rich_note" ||
              widget?.widgetId?.startsWith("rich_note-");

            if (isRichNote) {
              // Initialize uiArgs if needed
              if (!config.uiArgs) {
                config.uiArgs = {};
              }

              // Convert markdown to HTML if content is provided
              if (dataSource.input_args?.content) {
                config.uiArgs.html = dataSource.input_args.content;
              }

              // Always check for AI-generated name and description, regardless of content
              if (dataSource.input_args?.name) {
                config.uiArgs.name = dataSource.input_args.name;
              }
              if (dataSource.input_args?.description) {
                config.uiArgs.description = dataSource.input_args.description;
              }
            }

            await workspaceApi.updateWidget(currentDashboardId, widgetUuid, config);
          }
          finalResults.push({
            status: "success",
            message: `Widget with uuid '${widgetUuid}' updated successfully with arguments ${JSON.stringify(dataSource.input_args)}`,
          });
        } catch (error) {
          console.error("Error updating widget", error);
          finalResults.push({
            status: "error",
            message: `Error updating widget with uuid '${widgetUuid}': ${error.message}`,
          });
        }
      }
      return finalResults;
    },
    [currentDashboardId],
  );

  const assignTasksToAgents = useCallback(
    async (
      tasks: TaskRequest[],
      forwardMessageToAi: (
        message: string,
        fromAgentId: string,
        targetAgent: Copilot,
      ) => Promise<void>,
    ): Promise<CopilotCommandResultT[]> => {
      const finalResults: CopilotCommandResultT[] = [];
      const sourceAgentId = selectedCopilot?.id;

      if (!sourceAgentId) {
        return tasks.map((task) => ({
          status: "error",
          message: `Cannot assign task '${task.id}' without an active source agent.`,
        }));
      }

      for (const task of tasks) {
        try {
          const holder = externalCopilotHolders.find(
            (holder) =>
              holder.enabled !== false && holder.url === task.assigned_holder_url,
          );
          const agent = holder?.copilots?.find(
            (copilot) => copilot.id === task.assigned_agent_id,
          );

          if (!agent) {
            finalResults.push({
              status: "error",
              message: `Agent with id '${task.assigned_agent_id}' not found`,
            });
            continue;
          }

          // Wait for state to update before making the request
          await new Promise((resolve) => setTimeout(resolve, 100));
          // Pass the agent directly to avoid relying on state changes
          await forwardMessageToAi(task.description, sourceAgentId, agent);

          finalResults.push({
            status: "success",
            message: `Task '${task.id}' finished by agent '${agent.name}' from holder '${task.assigned_holder_url}' and with id '${task.assigned_agent_id}'`,
          });
        } catch (error) {
          console.error("Error finding agent", error);
          finalResults.push({
            status: "error",
            message: `Error processing task with id '${task.id}': ${error.message}`,
          });
        }
      }
      return finalResults;
    },
    [externalCopilotHolders, selectedCopilot],
  );

  const addGenerativeWidget = useCallback(
    async (
      config: AddGenerativeWidgetInputArgumentsT,
      options: DashboardCommandOptions = {},
    ): Promise<CopilotCommandResultT[]> => {
      const { widget_type, data, name, description, chart_params, inner_tab } = config;
      const dashboardId = options.dashboardId || currentDashboardId;
      const dashboard = useAppStore.getState().items?.[dashboardId];

      if (!dashboardId || !dashboard) {
        return [
          {
            status: "error",
            message:
              "No active dashboard was found. Open a dashboard route or provide a valid dashboard_id.",
          },
        ];
      }

      if (import.meta.env.DEV) {
        console.log("[GenerativeWidget] Creating widget:", {
          type: widget_type,
          dataType: typeof data,
          dataRows: Array.isArray(data) ? data.length : "N/A (string)",
          chartParams: chart_params,
        });
      }

      try {
        const widgetUuid = uuidv4();
        let newWidget: WidgetT;
        let artifact: ArtifactT | null = null;

        if (widget_type === "note") {
          if (typeof data !== "string") {
            throw new Error("Note widget requires string data");
          }
          const noteContent = data;
          const citations = getGenerativeWidgetCitations(config);
          const artifacts = getGenerativeWidgetArtifacts(config);
          newWidget = buildNoteWidget(noteContent, {
            uuid: widgetUuid,
            name,
            description,
            citations,
            artifacts,
          });

          // Create text artifact for chat
          artifact = {
            uuid: widgetUuid,
            name,
            description,
            type: "text",
            content: noteContent,
            metadata: { source: "generative_widget" },
          };
        } else if (widget_type === "html") {
          if (typeof data !== "string") {
            throw new Error("HTML widget requires string data");
          }
          const htmlContent = data;
          newWidget = buildHtmlWidget(htmlContent, {
            uuid: widgetUuid,
            name,
            description,
          });

          // Create HTML artifact for chat
          artifact = {
            uuid: widgetUuid,
            name,
            description,
            type: "html",
            content: htmlContent,
            metadata: { source: "generative_widget" },
          };
        } else if (widget_type === "chart") {
          if (
            !chart_params?.chartType ||
            !chart_params.xKey ||
            !(Array.isArray(chart_params.yKey) && chart_params.yKey.length > 0)
          ) {
            throw new Error(
              "Chart widget requires chart_params with chartType, xKey, and a non-empty yKey",
            );
          }
          if (!Array.isArray(data)) {
            throw new Error("Chart widget requires array data");
          }
          const chartData = data as Record<string, unknown>[];
          newWidget = buildChartWidget(chartData, {
            uuid: widgetUuid,
            name,
            description,
            chartType: chart_params.chartType,
            xKey: chart_params.xKey,
            yKey: chart_params.yKey,
            angleKey: chart_params.angleKey,
            calloutLabelKey: chart_params.calloutLabelKey,
          });

          // Create chart artifact for chat
          artifact = {
            uuid: widgetUuid,
            name,
            description,
            type: "chart",
            content: chartData,
            chart_params: chart_params as ChartArtifactT["chart_params"],
            metadata: { source: "generative_widget" },
          };
        } else {
          // Table
          if (!Array.isArray(data)) {
            throw new Error("Table widget requires array data");
          }
          const tableData = data as Record<string, unknown>[];
          newWidget = buildTableWidget(tableData, {
            uuid: widgetUuid,
            name,
            description,
          });

          // Create table artifact for chat
          artifact = {
            uuid: widgetUuid,
            name,
            description,
            type: "table",
            content: tableData,
            metadata: { source: "generative_widget" },
          };
        }

        // Fetch AI-generated title/description before adding to dashboard
        try {
          const widgetData = typeof data === "string" ? data : JSON.stringify(data);
          const resp = await sdkClient.post(
            `${getAiApiUrl()}/v1/generate/widget_info`,
            {
              widget_generation_request: {
                name,
                description,
                widget_data: widgetData,
              },
            },
          );
          const aiInfo = resp.data;
          if (aiInfo?.title) {
            newWidget = { ...newWidget, name: aiInfo.title };
          }
          if (aiInfo?.description) {
            newWidget = { ...newWidget, description: aiInfo.description };
          }
        } catch (e) {
          // Fallback to LLM-provided name/description
          console.warn("[GenerativeWidget] Failed to fetch AI widget info:", e);
          if (posthog) {
            posthog.capture("GENERATIVE_WIDGET_INFO_ERROR", {
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }

        // Resolve the placement tab. An explicit inner_tab wins; otherwise, when
        // adding to the dashboard the user is currently viewing, fall back to the
        // tab in the URL (?tab=) — the source of truth navigate_workspace writes —
        // rather than the store's lagging data.currentTab. The latter trails the
        // URL by a render cycle, so a navigate→add issued back-to-back (the
        // documented MCP workflow) would otherwise land on the previous tab.
        const requestedInnerTab =
          inner_tab ||
          (dashboardId === currentDashboardId
            ? new URLSearchParams(window.location.search).get("tab") || ""
            : "");
        if (requestedInnerTab) {
          const tabId = resolveInnerTabId(requestedInnerTab, dashboardId);
          if (tabId) {
            newWidget = { ...newWidget, innerTab: tabId };
          }
        }

        // Add widget to the dashboard
        const createdWidgetUuid = await useAppStore
          .getState()
          .addWidget(dashboardId, newWidget);
        if (!createdWidgetUuid) {
          throw new Error(
            "Failed to add the generative widget to the target dashboard.",
          );
        }

        // Add artifact to chat for visibility
        if (artifact) {
          useCopilotStore.getState().addArtifactToCurrentChat(artifact);
        }

        return [
          {
            status: "success",
            message: `Widget '${newWidget.name}' created successfully`,
            widget_uuid: createdWidgetUuid,
          },
        ];
      } catch (error) {
        console.error("[GenerativeWidget] Error creating widget:", error);
        return [
          {
            status: "error",
            message:
              error instanceof Error ? error.message : "Unknown error creating widget",
          },
        ];
      }
    },
    [currentDashboardId, resolveInnerTabId],
  );

  return {
    getWidgetData,
    getParamOptions,
    addWidgetToDashboard,
    updateWidgetInDashboard,
    assignTasksToAgents,
    addGenerativeWidget,
  };
}

async function getOpenbbSandboxWidgetsData(
  dataSource: DataSourceT,
  getWidgetFromBackend: (backendName: string, widgetId: string) => WidgetT | null,
  queryTickers: (props: QueryTickersProps) => Promise<Record<string, Ticker>>,
): Promise<any> {
  let result: any | null = null;
  let builtInWidget: WidgetT | undefined;
  // This a temporary solution to handle financial statements widget
  if (
    ["balance_sheet", "income_statement", "cash_flow_statement"].includes(dataSource.id)
  ) {
    builtInWidget = getJsonWidget((dataSource.id as WidgetT["widgetId"])!);
  } else {
    builtInWidget = getWidgetFromBackend("OpenBB Sandbox", dataSource.id) ?? undefined;
  }

  if (!builtInWidget)
    throw new CopilotError(
      CopilotErrorType.NOT_FOUND,
      `Widget with origin ${dataSource.origin} and id ${dataSource.id} not found`,
    );

  // TODO: Here instead of recreating the request a widget makes,
  // we should just call a function that the widget uses to fetch data
  // This is a temporary solution to handle Pyth Live Watchlist widget
  if (builtInWidget.widgetId === "pyth_price_feeds") {
    const response = await fetch(
      "https://benchmarks.pyth.network/v1/price_differences/",
    );
    if (!response.ok) {
      throw new CopilotError(
        CopilotErrorType.GATEWAY_ERROR,
        "The data source was unavailable. Is it connected and available to OpenBB Workspace?",
      );
    }
    const data = await response.json();

    const processedData = data.reduce((acc: any[], item: any) => {
      try {
        if (item?.sparkline?.length > 0) {
          acc.push({
            ...item,
            price: item.sparkline[item.sparkline.length - 1],
          });
        }
      } catch (error) {
        console.error("Error processing price feed item:", error);
      }
      return acc;
    }, []);

    return processedData;
  }

  // Here we assume:
  // 1. There is 1-1 mapping between platformDataFunctions and platform API endpoints
  //      e.g. obb.equity.price.historical -> /equity/price/historical
  // 2. The first element of platformDataFunction is the relevant endpoint
  let resourceEndpoint = "";
  if (builtInWidget.proEndpoint) {
    resourceEndpoint = builtInWidget.proEndpoint.split(".").join("/");
  } else if (
    builtInWidget.platformDataFunction &&
    builtInWidget.platformDataFunction.length > 0
  ) {
    resourceEndpoint = builtInWidget.platformDataFunction[0]
      .split(".")
      .slice(1)
      .join("/");
  }
  if (!resourceEndpoint)
    throw new CopilotError(
      CopilotErrorType.NOT_FOUND,
      "The data source was unavailable. Is it connected and available to OpenBB Workspace?",
    );

  let mainTicker: Ticker | undefined;
  const tickerParam = getTickerParamName(builtInWidget);
  const symbol = tickerParam
    ? dataSource.input_args?.[tickerParam]?.toString()
    : undefined;

  const supportedAssetClasses = builtInWidget?.supportedAssetClasses;

  if (tickerParam && symbol && !supportedAssetClasses?.includes("country")) {
    const matchedTickers = await queryTickers({
      tickers: symbol,
      filter: supportedAssetClasses?.map((type) =>
        type?.toLowerCase()?.replace("equity", "stock"),
      ) as FilterTypes[],
    });
    mainTicker = matchedTickers[symbol];
  }
  const widgetSource = getWidgetDataSource({
    ...builtInWidget,
    data: {
      ...(builtInWidget?.data || {}),
      mainTicker,
    },
  });

  let providerParams = {} as Record<string, any>;
  if (widgetSource) {
    providerParams = builtInWidget.proEndpoint
      ? { provider: "pro", data_provider: widgetSource }
      : { provider: widgetSource };

    if (
      builtInWidget?.widgetId === "company_profile" &&
      mainTicker?.category === "etf"
    ) {
      resourceEndpoint = "etf/info";
    }

    if (builtInWidget?.widgetId === "key_metrics" && mainTicker) {
      providerParams.category = mainTicker?.category;
    }
  }

  const fixedParams = (builtInWidget?.inputs?.fixed || []).reduce((acc, curr) => {
    // TODO: Find a way to remove fixed params, because they have no explicit type definition
    // Checking for "$currentDate" in the name is a temporary solution
    const value =
      typeof curr.value === "string" && curr.value.includes("$currentDate")
        ? currentDateModifier(curr.value)
        : curr.value;
    acc[curr.name] = value;
    return acc;
  }, providerParams);

  const filteredParams = Object.fromEntries(
    Object.entries({
      ...fixedParams,
      ...dataSource.input_args,
    }).filter(([, value]) => value !== null && value !== "null"),
  ) as Record<string, string>;

  const newWidget = { ...builtInWidget };
  newWidget.storage = { ...(newWidget.storage ?? {}), params: filteredParams };

  const urlParams = new URLSearchParams(filteredParams);
  const endpoint = `api/v1/${resourceEndpoint}?${urlParams.toString()}`;

  try {
    result = await sdkClient
      .get(endpoint)
      .then((res) => getParsedWidgetData(res.data, newWidget));
  } catch (error) {
    console.error("Error fetching data from OpenBB Sandbox", error);
    switch (error.response?.status) {
      case 404:
        throw new CopilotError(
          CopilotErrorType.GATEWAY_ERROR,
          "The data source was unavailable. Is it connected and available to OpenBB Workspace?",
        );
      case 422:
        throw new CopilotError(
          CopilotErrorType.GATEWAY_ERROR,
          `Fetching data from widget returned an error: ${error.response.data}`,
        );
      default:
        throw error;
    }
  }

  const selectedGroup = dataSource?.input_args?.selectedGroup as string;
  if (
    selectedGroup &&
    ["financial_statements", "grouped_comparison"].some(
      (g) => builtInWidget.widgetId === g,
    )
  ) {
    result = result?.[selectedGroup] || result;
  }

  if (builtInWidget?.type === "chart") {
    const plotResults = await getChartWidgetData(builtInWidget, result, symbol);
    result = plotResults?.exportData;
  }

  return result;
}

const SSRM_BODY_KEYS = [
  "query",
  "startRow",
  "endRow",
  "rowGroupCols",
  "valueCols",
  "pivotCols",
  "pivotMode",
  "groupKeys",
  "filterModel",
  "sortModel",
];

function getRequest(
  widget: WidgetT,
  inputArgs: Record<string, any>,
  ssmRequest?: Record<string, any>,
): Request {
  const baseUrl = widget.endpoint;
  if (!baseUrl) throw new Error("Missing widget endpoint url.");
  switch (widget.type) {
    case "multi_file_viewer":
    case "omni": {
      const { headers, newParams: urlParams } = getHeadersAndUrlParams(
        widget.endpointHeaders,
      );
      const url = createCleanUrl(baseUrl, urlParams);
      const options = {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(inputArgs),
      };
      const request = new Request(url, options);
      return request;
    }
    case "ssrm_advanced":
    case "ssrm_table": {
      const { headers, newParams } = getHeadersAndUrlParams(
        widget.endpointHeaders,
        inputArgs,
      );
      const urlParams = Object.fromEntries(
        Object.entries(newParams).filter(([key]) => !SSRM_BODY_KEYS.includes(key)),
      );

      const url = createCleanUrl(baseUrl, urlParams);
      if (ssmRequest && !("query" in ssmRequest)) {
        ssmRequest.query = inputArgs.query;
      }
      const options = {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: ssmRequest ? JSON.stringify(ssmRequest) : JSON.stringify(inputArgs),
      };
      const request = new Request(url, options);
      return request;
    }
    default: {
      const { headers, newParams: urlParams } = getHeadersAndUrlParams(
        widget.endpointHeaders,
        inputArgs,
      );
      const url = createCleanUrl(baseUrl, urlParams);
      const request = new Request(url, { method: "GET", headers });
      return request;
    }
  }
}

async function postProcessData(data: any, widget: WidgetT): Promise<any> {
  switch (widget.type) {
    case "chart":
      return await getChartWidgetData(widget, data).then((r) => r.exportData);
    default:
      return data;
  }
}

export async function getCustomWidgetsData(
  dataSource: DataSourceT,
  getWidgetFromBackend: (backendName: string, widgetId: string) => WidgetT | null,
  getDashboardWidgetData: (widgetId: string) => any,
): Promise<any> {
  let result: any = null;
  const context = `Fetching data for ${describeDataSource(dataSource)}`;
  const widgetUuid = dataSource.widget_uuid;

  const getCustomWidget = () => {
    const customWidget = getWidgetFromBackend(dataSource.origin, dataSource.id);
    if (customWidget) return customWidget;
    // Fallback to checking shared dashboard widgets if not found in the backend registry
    return widgetUuid ? useSharedAppStore.getState().getWidgetById(widgetUuid) : null;
  };

  const customWidget = getCustomWidget();
  if (!customWidget) {
    // The widget isn't in the backend registry. This happens for Widget Studio
    // widgets that belong to an installed/shared app rather than the user's own
    // widget metadata. If the widget is placed on the current dashboard its data
    // is already loaded, so fall back to that instead of failing.
    if (widgetUuid) {
      const widgetData = getDashboardWidgetData(widgetUuid);
      if (widgetData) return widgetData.data;
    }
    throw new CopilotError(
      CopilotErrorType.NOT_FOUND,
      `Widget with id ${dataSource.id} not found`,
    );
  }

  try {
    // TODO: Remove this backward compatibility
    if (customWidget.type === "multi_file_viewer")
      return await backwardCompatMultiFileViewer(customWidget, dataSource);

    const request = getRequest(
      customWidget,
      dataSource.input_args,
      dataSource.ssm_request,
    );
    const response = await fetch(request);
    if (!response.ok) throw response;
    const requestResult = await parseResponseBody(response, customWidget.type);
    const dataKey = customWidget?.data?.dataKey;
    if (dataKey && typeof requestResult === "object")
      result = get(requestResult, dataKey, requestResult);
    else result = requestResult;
  } catch (error) {
    console.log(`Error fetching data from ${dataSource.origin}`, error);
    if (error instanceof Response) {
      throw await responseToCopilotError(error, {
        context,
        badRequestHint:
          "The request reached the data source, but the input_args were invalid for this endpoint. Re-check the widget id and send only supported arguments from the latest workspace snapshot.",
      });
    }
    throw error;
  }

  // When the caller explicitly requests raw data (e.g. the MCP bridge for chart
  // widgets, per the `raw=true` convention), the backend already returns tabular
  // rows. Skip the chart-figure export transform in postProcessData, which would
  // otherwise feed those rows into a Plotly-figure parser and discard them
  // (returning []). Non-raw requests keep their existing behavior.
  const rawArg = dataSource.input_args?.raw;
  if (rawArg === true || rawArg === "true") return result;

  return postProcessData(result, customWidget);
}

async function backwardCompatMultiFileViewer(widget: WidgetT, dataSource: DataSourceT) {
  let result: any = null;
  let response: Response | Response[] = await fetch(
    getRequest(widget, dataSource.input_args),
  );

  if (response.status === 405) {
    const paramName =
      widget.params?.find(
        (p) => p.type === "endpoint" && p.roles?.includes("fileSelector"),
      )?.paramName || "";

    const filenames: string[] = dataSource.input_args[paramName] || [];
    const { [paramName]: _, ...inputArgs } = dataSource.input_args;

    const { headers, newParams: urlParams } = getHeadersAndUrlParams(
      widget.endpointHeaders,
      inputArgs,
    );

    response = await Promise.all(
      filenames.map(async (filename) => {
        const url = createCleanUrl(widget.endpoint, {
          ...urlParams,
          [paramName]: filename,
        });
        const request = new Request(url, { method: "GET", headers });
        return fetch(request).catch(
          () => ({ ok: true, json: async () => null }) as Response,
        );
      }),
    );
  }

  const errorResponse = !Array.isArray(response) && response;
  if (errorResponse && !errorResponse.ok) throw errorResponse;

  if (Array.isArray(response)) {
    response = (await Promise.all(response).then((results) => {
      const data = Promise.all(
        results.flatMap(async (res) => {
          if (!res.ok) return null;
          try {
            return await res.json();
          } catch {
            console.error("Failed to parse response as JSON", res);
            return null;
          }
        }),
      ).then((v) => v.filter(Boolean));

      return { json: async () => data };
    })) as Response;
  }

  const requestResult = await parseResponseBody(response);
  const dataKey = widget?.data?.dataKey;
  if (dataKey) result = get(requestResult, dataKey, requestResult);
  else result = requestResult;
  return Array.isArray(result) ? result : [result];
}

async function getOpenBBHubPreSignedUrls(
  dataSource: DataSourceT,
  getWidgetFromBackend: (backendName: string, widgetId: string) => WidgetT | null,
): Promise<DataUrl> {
  // Onboarding files
  const onboardingFile = ONBOARDING_STORED_FILES[dataSource.id];
  if (onboardingFile) {
    const onBoardingFileUrl = import.meta.env.DEV
      ? onboardingFile?.urlDev
      : onboardingFile?.urlProd;
    if (!onBoardingFileUrl) throw new Error("Failed to get url from onboarding file");
    const uuid = extractUUIDFromURL(onBoardingFileUrl);
    if (!uuid) throw new Error("Failed to get uuid from url");
    return getFileReference(uuid);
  }

  // Uploaded file widgets
  const fileWidget = getWidgetFromBackend("OpenBB Hub", dataSource.id);
  if (fileWidget?.endpoint?.url) {
    const uuid = extractUUIDFromURL(fileWidget.endpoint.url);
    if (!uuid) throw new Error("Failed to get uuid from url");
    return getFileReference(uuid);
  }

  // Drag-and-drop files: the widget id already carries the stored file uuid
  const fileUuid = extractUuidFromWidgetId(dataSource.id);
  if (fileUuid) return getFileReference(fileUuid);

  throw new CopilotError(
    CopilotErrorType.NOT_FOUND,
    `Failed to get data for data source with id ${dataSource.id}`,
  );
}

async function getWorkspaceWidgetsData(
  dataSource: DataSourceT,
  getDashboardWidgetData: (widgetId: string) => any,
  getWidgetFromBackend: (backendName: string, widgetId: string) => WidgetT | null,
): Promise<any> {
  const widgetUuid = dataSource.widget_uuid;

  // Handle iframe sub-widget requests (composite key: parentUuid::iframe::subWidgetId)
  const targetId = widgetUuid ?? dataSource.id;
  const iframeParts = targetId?.split("::iframe::");
  if (iframeParts && iframeParts.length === 2) {
    const [parentUuid, subWidgetId] = iframeParts;
    const bridge = getIframeWidget(parentUuid);
    if (!bridge) {
      throw new CopilotError(CopilotErrorType.NOT_FOUND, "Iframe bridge not available");
    }
    const msg = await bridge.requestWidgetData(subWidgetId);
    return msg.data;
  }

  if (widgetUuid) {
    const widgetData = getDashboardWidgetData(widgetUuid);
    if (widgetData) return widgetData.data;
    const widget = getWidgetFromBackend("OpenBB Workspace", dataSource.id);
    if (widget?.storage) {
      const { rowsData, html } = widget.storage;
      if (rowsData || html) return rowsData || html;
    }
  }
  throw new CopilotError(
    CopilotErrorType.NOT_FOUND,
    `Widget with id ${dataSource.id} not found`,
  );
}

export function extractUuidFromWidgetId(widgetId: string): string | null {
  const uuidRegex =
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
  const match = widgetId.match(uuidRegex);
  if (match) {
    const widgetUuid = match[0];
    return widgetUuid;
  }
  return null;
}

/**
 * Parses the expiration time from a presigned URL.
 * Looks for Expires or X-Amz-Expires parameter and converts to milliseconds.
 * Uses parseInt to correctly handle trailing URL parameters (e.g., "3600&X-Amz-SignedHeaders=...")
 */
export function parseUrlExpiration(url: string, defaultTtlSeconds: number): number {
  if (!url) return defaultTtlSeconds * 1000;
  const expiresMatch = url.split("Expires=")?.[1];
  if (!expiresMatch) return defaultTtlSeconds * 1000;
  const parsed = Number.parseInt(expiresMatch, 10);
  if (Number.isNaN(parsed)) return defaultTtlSeconds * 1000;
  return parsed * 1000;
}

async function getFileReference(uuid: string): Promise<DataUrl> {
  const ttl = 3600; // seconds
  const response = await getPreSignedUrl(uuid, ttl);
  const reference = response.pre_signed_url;
  const expiration = parseUrlExpiration(reference, ttl);
  const extension = response.original_file_name.split(".").pop()?.toLowerCase();
  if (!(reference && extension)) throw new Error("Failed to get required data");
  return {
    url: reference,
    data_format: {
      data_type: extension,
      filename: response.original_file_name,
    },
    expiration: expiration,
  } as DataUrl;
}

export async function getWidgetsParamOptions(
  paramOptionsQuery: ParamOptionQueryT,
  getWidgetFromBackend: (backendName: string, widgetId: string) => WidgetT | null,
): Promise<ParamOptionQueryResultT> {
  const widget = getWidgetFromBackend(paramOptionsQuery.origin, paramOptionsQuery.id);
  if (!widget)
    throw new CopilotError(
      CopilotErrorType.NOT_FOUND,
      `Widget with id ${paramOptionsQuery.id} not found`,
    );
  const { headers } = getHeadersAndUrlParams(widget.endpointHeaders);
  // this name should be more explicit like param_name
  const paramName = paramOptionsQuery.param;
  const widgetParams = (widget.params || []).filter(
    (p) => p.paramName === paramName && p.type === "endpoint",
  ) as ParamDefT<"endpoint">[];
  if (widgetParams.length === 0) throw new Error(`Param ${paramName} not found`);
  const widgetParam = widgetParams[0];
  const optionsEndpoint = widgetParam.optionsEndpoint;
  if (!optionsEndpoint) throw new Error(`Endpoint not found for param ${paramName}`);
  const optionsEndpointParams = widgetParam.optionsParams || {};
  const newOptionsEndpointParams = Object.entries(optionsEndpointParams).reduce(
    (acc, [key, value]) => {
      if (typeof value === "string" && value.startsWith("$")) {
        const queryKey = value.slice(1);
        acc[key] = paramOptionsQuery.options_endpoint_input_args[queryKey];
      } else acc[key] = value;
      return acc;
    },
    {},
  ) as Record<string, any>;
  const url = createCleanUrl(optionsEndpoint, newOptionsEndpointParams);
  const request = new Request(url, { method: "GET", headers: headers });
  const response = await fetch(request).then((res) => res.json());
  const optionsData = response.map((option: any) => {
    if (typeof option === "string") return { label: option, value: option };
    return option;
  });
  const result = paramOptionQueryResult.safeParse({
    param_options: [{ param: paramName, options: optionsData }],
  });
  if (!result.success) {
    if (import.meta.env.DEV) console.error(result.error);
    throw new Error("Failed to parse param options result");
  }
  return result.data;
}

/**
 * Converts raw widget data into the CopilotDataT format for AI context.
 *
 * Handles several data formats:
 * 1. SSRM responses: `{ rowData: [...], rowCount: n }` - extracts the `rowData` array
 * 2. Single-string-field SQL results: `[{ HTML_CONTENT: "..." }]` - converts to text content items
 * 3. Arrays of objects - wrapped as CopilotData items
 * 4. Objects with `extra_citations` - extracts citations and wraps remainder
 *
 * Falls back to JSON stringifying the entire data if parsing fails.
 *
 * @param data - Raw widget data in any supported format
 * @returns Normalized CopilotDataT with items array and optional extra_citations
 */
export function convertToCopilotData(data: any): CopilotDataT {
  let items: any;
  let extra_citations: any[] = [];

  // Helper to check if an object is a single-field object with a string value
  // This handles SQL widgets that return a single column like HTML_CONTENT or TEXT_COLUMN
  const isSingleStringField = (obj: any): obj is Record<string, string> => {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return false;
    const keys = Object.keys(obj);
    return keys.length === 1 && typeof obj[keys[0]] === "string";
  };

  // Helper to convert a single-field object to DataContent format
  const toDataContent = (obj: Record<string, string>) => {
    const key = Object.keys(obj)[0];
    return {
      content: obj[key],
      data_format: {
        data_type: "object" as const,
        parse_as: "text" as const,
      },
    };
  };

  // Helper to process an array of items for single-string-field conversion
  const processArrayForSingleStringFields = (arr: any[]) => {
    if (arr.length > 0 && arr.every(isSingleStringField)) {
      return arr.map(toDataContent);
    }
    return arr;
  };

  // Extract the actual data from SSRM response format ({ rowData: [...], rowCount: n })
  // This is common for Snowflake and other SQL backend widgets
  let dataToProcess = data;
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    Array.isArray(data.rowData)
  ) {
    dataToProcess = data.rowData;
  }

  if (typeof dataToProcess === "string") {
    items = [
      {
        content: dataToProcess,
        data_format: {
          data_type: "object" as const,
          parse_as: "text" as const,
        },
      },
    ];
  } else if (Array.isArray(dataToProcess)) {
    // Check if array contains single-field objects with string values (e.g., SQL query result)
    // Example: [{ HTML_CONTENT: "<html>..." }] from a SELECT HTML_CONTENT query
    items = processArrayForSingleStringFields(dataToProcess);
  } else {
    const { extra_citations: citations, ...rest } = dataToProcess || {};
    extra_citations = citations || [];

    if (isSingleStringField(rest)) {
      items = [toDataContent(rest)];
    } else {
      items = [rest];
    }
  }

  // Custom widgets return an object that follows CopilotDataSchema
  const result = CopilotDataSchema.safeParse({ items, extra_citations });
  if (result.success) return result.data;

  // Built-in widgets fallback here because they return an array of data
  return { items: [{ content: JSON.stringify(data) }] };
}
