import posthog from "posthog-js";
import { useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ALL_AI_FEATURES,
  getAiApiUrl,
  getDefaultCopilot,
  MAX_COPILOT_LINKS,
} from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type SemanticView,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import {
  type ArtifactT,
  type Copilot,
  type CopilotContextItem,
  type CopilotWidget,
  type CopilotWidgets,
  type Message,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { type AgentToolConfig, useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import { extractUrlsFromText } from "~/lib/utils";
import type { DashboardInfoT } from "~/lib/utils/workspaceDashboard";
import type { SkillCatalogEntry, SkillPayload } from "~/types/auth.type";
import { isSnowflakeArtifact } from "../Artifact";
import { useGetCopilotRequestHeaders } from "./useGetCopilotRequestHeaders";
import { useGetCustomApiKeys } from "./useGetCustomApiKeys";
import { useGetFinalMessagesAndWidgets } from "./useGetFinalMessagesAndWidgets";

const featureFlagMapping = {
  extraWidgetsEnabled: "widget-global-search",
  orchestrationModeEnabled: "agent-orchestration",
  generativeUiEnabled: "generative-ui",
  mcpToolsEnabled: "mcp-tools",
} as const;

const getEnabledFeatures = (features: Copilot["features"] | undefined) => {
  const featuresEnabled = Object.fromEntries(
    Object.entries(featureFlagMapping).map(([key, flag]) => [
      key,
      features?.[flag] === true,
    ]),
  ) as Partial<Record<keyof typeof featureFlagMapping, boolean>>;

  return featuresEnabled;
};

/**
 * Parses slash skill commands from a message.
 * Returns the parsed slugs and the message with slash commands removed.
 */
export function parseSkillSlashCommands(message: string) {
  // Match /slug: patterns at word boundaries
  const regex = /\/skill:([a-z0-9]+(?:-[a-z0-9]+)*)\b/gi;
  const slugs = new Set<string>();
  let cleanedMessage = message;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(message)) !== null) {
    const slug = match[1].toLowerCase();
    slugs.add(slug);
    // Remove the slash command from the message
    cleanedMessage = cleanedMessage.replace(match[0], " ").replace(/\s+/g, " ").trim();
  }
  return { slugs: Array.from(slugs), cleanedMessage };
}

function extractSemanticViewFqnsFromText(message: string): string[] {
  const svMatches = message.match(
    /\/sv:([A-Za-z0-9_$]+\.[A-Za-z0-9_$]+\.[A-Za-z0-9_$]+)/g,
  );
  return svMatches ? [...new Set(svMatches.map((match) => match.slice(4)))] : [];
}

function extractSemanticViewFqnsFromMessages(messages: Message[]): string[] {
  return [
    ...new Set(
      messages.flatMap((message) =>
        message.role === "human"
          ? extractSemanticViewFqnsFromText(message.content)
          : [],
      ),
    ),
  ];
}

function getAvailableSemanticViews(
  semanticViews: Record<string, SemanticView> | undefined,
): SemanticView[] | undefined {
  const availableSemanticViews = Object.values(semanticViews ?? {});
  return availableSemanticViews.length > 0 ? availableSemanticViews : undefined;
}

export function useAiFetchRequestInit() {
  const { id: currentDashboardId } = useParams();

  const userToken = useShallowAuthStore((s) => s.user?.token);

  const getEnabledToolsForAgent = useShallowMcpToolsStore(
    (s) => s.getEnabledToolsForAgent,
  );
  const getEnabledToolCount = useShallowMcpToolsStore((s) => s.getEnabledToolCount);
  const semanticViews = useShallowBackendConnectorStore((s) => s.semanticViews);

  // Skills store access
  const { getSkillsCatalog, getSkillBySlug, skills } = useShallowSkillsLibraryStore(
    (s) => ({
      getSkillsCatalog: s.getSkillsCatalog,
      getSkillBySlug: s.getSkillBySlug,
      skills: s.skills,
    }),
  );

  const {
    selectedCopilot,
    getCurrentChat,
    getCurrentChatArtifacts,
    orchestrationModeEnabled,
    customFeatureStates,
    getSelectedModelForAgent,
  } = useShallowCopilotStore((s) => ({
    selectedCopilot: s.selectedCopilot,
    getCurrentChat: s.getCurrentChat,
    getCurrentChatArtifacts: s.getCurrentChatArtifacts,
    customFeatureStates: s.customFeatureStates,
    orchestrationModeEnabled: s.orchestrationModeEnabled,
    getSelectedModelForAgent: s.getSelectedModelForAgent,
  }));

  // dashboardWidgetsData contain all the widgets with data filled in a dashboard
  const {
    getCopilotWidgets,
    widgetSubsetData,
    extraWidgetsEnabled,
    generativeUiEnabled,
    copilotWidgetsLastUpdated,
  } = useShallowCopilotDataStore((s) => ({
    widgetSubsetData: s.widgetSubsetData,
    extraWidgetsEnabled: s.extraWidgetsEnabled,
    generativeUiEnabled: s.generativeUiEnabled,
    getCopilotWidgets: s.getCopilotWidgets,
    copilotWidgetsLastUpdated: s.copilotWidgetsLastUpdated,
  }));

  const workspaceOptions = useMemo(() => {
    const options: Record<string, boolean | string> = {};
    const features = selectedCopilot?.features || {};
    // Features that are available within the UI and the agent just needs to expose them
    const EXCLUDE = ALL_AI_FEATURES;

    // Built-in options controlled by UI toggles and agent capability
    if (features?.["widget-global-search"] && extraWidgetsEnabled)
      options["widget-global-search"] = true;

    if (features?.["agent-orchestration"] && orchestrationModeEnabled)
      options["agent-orchestration"] = true;

    if (features?.["generative-ui"] && generativeUiEnabled)
      options["generative-ui"] = true;

    if (features?.["mcp-tools"] && getEnabledToolCount() > 0)
      options["mcp-tools"] = true;

    // Custom features (object metadata) obey customFeatureStates
    for (const [key, val] of Object.entries(features)) {
      if (EXCLUDE.has(key)) continue;
      if (val && typeof val === "object") {
        const featureType = val.type || "toggle";
        const stateVal = customFeatureStates?.[key];
        if (featureType === "text" || featureType === "select") {
          if (typeof stateVal === "string" && stateVal) {
            options[key] = stateVal;
          }
        } else if (stateVal) {
          options[key] = true;
        }
      } else if (val === true) {
        // Boolean features that are not excluded are forwarded as options
        options[key] = true;
      }
    }

    return options;
  }, [
    selectedCopilot?.features,
    extraWidgetsEnabled,
    generativeUiEnabled,
    customFeatureStates,
    orchestrationModeEnabled,
    getEnabledToolCount,
  ]);

  const getCopilotRequestHeaders = useGetCopilotRequestHeaders();
  const getCustomApiKeys = useGetCustomApiKeys();
  const getFinalMessagesAndWidgets = useGetFinalMessagesAndWidgets();

  const getQueryFetchParams = useCallback(
    async (
      props: GetQueryFetchParamsProps,
    ): Promise<{ queryUrl: string; init: RequestInit }> => {
      const { incomingMessage, abortSignal, targetAgent } = props;
      const { selectedWidgets, temporaryWidgets, allWidgets, workspaceState } =
        getCopilotWidgets(targetAgent);
      const customApiKeys = getCustomApiKeys();

      const features = targetAgent?.features || selectedCopilot?.features;
      const {
        extraWidgetsEnabled: extraWidgetsCap,
        orchestrationModeEnabled: orchestrationModeCap,
        mcpToolsEnabled,
      } = getEnabledFeatures(features);

      const { uuid: chatId } = getCurrentChat();
      if (posthog) {
        posthog.capture("asked_copilot_question", {
          copilot_id: targetAgent?.id || selectedCopilot?.id,
          copilot_name: targetAgent?.name || selectedCopilot?.name,
          question: incomingMessage,
          openbb_session_id: userToken,
          trace_id: chatId,
        });
      }

      const artifacts = getCurrentChatArtifacts();
      const contextArtifacts = convertArtifactsToContextItems(artifacts);
      const { finalMessages, finalDashboardWidgets, mentionWidgets } =
        await getFinalMessagesAndWidgets(targetAgent);

      const { expandedPrimaryWidgets, expandedSecondaryWidgets, expandedAllWidgets } =
        computeExpandedWidgets(
          selectedWidgets,
          temporaryWidgets,
          allWidgets,
          mentionWidgets,
          finalDashboardWidgets,
        );

      const context = [
        ...contextArtifacts,
        ...(widgetSubsetData || []),
      ] as CopilotContextItem[];

      // Get enabled MCP tools for AI agent
      const enabledTools = await getEnabledToolsForAgent();

      // Only include agents in workspace state if orchestration is enabled
      const finalWorkspaceState = { ...(workspaceState || {}) } as WorkspaceStateT;

      if (!(orchestrationModeEnabled && orchestrationModeCap))
        finalWorkspaceState.agents = undefined;

      // Build skills catalog and selected skills from slash commands
      const skillsCatalog = getSkillsCatalog();
      const { slugs: forcedSkillSlugs } = parseSkillSlashCommands(incomingMessage);
      const selectedSkills: SkillPayload[] = [];

      for (const slug of forcedSkillSlugs) {
        const skill = getSkillBySlug(slug);
        if (skill) {
          selectedSkills.push({
            slug: skill.slug,
            description: skill.description,
            contentMarkdown: skill.content,
            source: "forced_slash",
          });
          if (posthog) {
            posthog.capture("skill_slash_command_used", {
              skill_slug: slug,
              trace_id: chatId,
            });
          }
        }
      }

      const semanticViewFqns = extractSemanticViewFqnsFromText(incomingMessage);
      const availableSemanticViews = getAvailableSemanticViews(semanticViews);

      const agentForModel = targetAgent ?? selectedCopilot;
      const agentModels = agentForModel?.models;
      const selectedModelId =
        agentForModel?.id && agentModels?.length
          ? (getSelectedModelForAgent(agentForModel.id) ?? agentModels[0]?.id)
          : undefined;

      const payload: HumanQueryPayload = {
        model: selectedModelId,
        widgets: {
          primary: expandedPrimaryWidgets,
          secondary: expandedSecondaryWidgets,
          extra: extraWidgetsEnabled && extraWidgetsCap ? expandedAllWidgets : [],
        },
        messages: finalMessages,
        context: context,
        urls: extractUrls(incomingMessage, MAX_COPILOT_LINKS),
        api_keys: customApiKeys,
        workspace_state: finalWorkspaceState,
        workspace_options: Object.fromEntries(
          Object.entries(workspaceOptions).filter(
            ([flag]) =>
              (!targetAgent && flag === "agent-orchestration") || features?.[flag],
          ),
        ),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        tools: mcpToolsEnabled ? enabledTools : [],
        skills_catalog: skillsCatalog.length > 0 ? skillsCatalog : undefined,
        selected_skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        semantic_views: semanticViewFqns.length > 0 ? semanticViewFqns : undefined,
        available_semantic_views: availableSemanticViews,
      };

      console.debug(
        "[copilot-debug] mcpToolsEnabled:",
        mcpToolsEnabled,
        "tools:",
        enabledTools?.length,
        "workspace_options:",
        payload.workspace_options,
      );

      return {
        queryUrl: targetAgent?.endpoints?.query || selectedCopilot?.endpoints?.query,
        init: {
          method: "POST",
          signal: abortSignal,
          headers: getCopilotRequestHeaders(undefined, targetAgent),
          body: JSON.stringify(payload),
        },
      };
    },
    [
      workspaceOptions,
      userToken,
      selectedCopilot,
      getCustomApiKeys,
      getCopilotRequestHeaders,
      getCopilotWidgets,
      widgetSubsetData,
      extraWidgetsEnabled,
      generativeUiEnabled,
      customFeatureStates,
      getSelectedModelForAgent,
      getFinalMessagesAndWidgets,
      getEnabledToolsForAgent,
      copilotWidgetsLastUpdated,
      getCurrentChatArtifacts,
      getSkillsCatalog,
      getSkillBySlug,
      skills,
      semanticViews,
    ],
  );

  const getFunctionCallFetchParams = useCallback(
    async (
      props: GetFunctionCallFetchParamsProps,
    ): Promise<{ queryUrl: string; init: RequestInit }> => {
      const { xHeaders, abortSignal, targetAgent } = props;
      const { selectedWidgets, temporaryWidgets, allWidgets, workspaceState } =
        getCopilotWidgets(targetAgent);
      const customApiKeys = getCustomApiKeys();

      const features = targetAgent?.features || selectedCopilot?.features;
      const {
        extraWidgetsEnabled: extraWidgetsCap,
        generativeUiEnabled: generativeUiCap,
        mcpToolsEnabled,
        orchestrationModeEnabled: orchestrationModeCap,
      } = getEnabledFeatures(features);

      // Get enabled MCP tools for AI agent - CRITICAL for sequential tool execution
      const enabledTools = await getEnabledToolsForAgent();

      const artifacts = getCurrentChatArtifacts();
      const contextArtifacts = convertArtifactsToContextItems(artifacts);
      const { finalMessages, finalDashboardWidgets, mentionWidgets } =
        await getFinalMessagesAndWidgets(targetAgent);

      const { expandedPrimaryWidgets, expandedSecondaryWidgets, expandedAllWidgets } =
        computeExpandedWidgets(
          selectedWidgets,
          temporaryWidgets,
          allWidgets,
          mentionWidgets,
          finalDashboardWidgets,
        );

      const context = [
        ...contextArtifacts,
        ...(widgetSubsetData || []),
      ] as CopilotContextItem[];

      // Only include agents in workspace state if orchestration is enabled
      const finalWorkspaceState = { ...(workspaceState || {}) } as WorkspaceStateT;

      if (!(orchestrationModeEnabled && orchestrationModeCap))
        finalWorkspaceState.agents = undefined;

      // Include skills catalog for function call context
      const skillsCatalog = getSkillsCatalog();
      const semanticViewFqns = extractSemanticViewFqnsFromMessages(finalMessages);
      const availableSemanticViews = getAvailableSemanticViews(semanticViews);

      const agentForModel = targetAgent ?? selectedCopilot;
      const agentModels = agentForModel?.models;
      const selectedModelId =
        agentForModel?.id && agentModels?.length
          ? (getSelectedModelForAgent(agentForModel.id) ?? agentModels[0]?.id)
          : undefined;

      const payload: FunctionCallPayload = {
        model: selectedModelId,
        widgets: {
          primary: expandedPrimaryWidgets,
          secondary: expandedSecondaryWidgets,
          extra: extraWidgetsEnabled && extraWidgetsCap ? expandedAllWidgets : [],
        },
        messages: finalMessages,
        context: context,
        api_keys: customApiKeys,
        workspace_state:
          generativeUiEnabled && generativeUiCap ? finalWorkspaceState : undefined,
        workspace_options: Object.fromEntries(
          Object.entries(workspaceOptions).filter(
            ([flag]) =>
              (!targetAgent && flag === "agent-orchestration") || features?.[flag],
          ),
        ),
        tools: mcpToolsEnabled ? enabledTools : [], // Include tools only if agent supports MCP
        skills_catalog: skillsCatalog.length > 0 ? skillsCatalog : undefined,
        semantic_views: semanticViewFqns.length > 0 ? semanticViewFqns : undefined,
        available_semantic_views: availableSemanticViews,
      };

      return {
        queryUrl: targetAgent?.endpoints?.query || selectedCopilot?.endpoints?.query,
        init: {
          method: "POST",
          signal: abortSignal,
          headers: getCopilotRequestHeaders(xHeaders?.traceId, targetAgent),
          body: JSON.stringify(payload),
        },
      };
    },
    [
      getCurrentChatArtifacts,
      selectedCopilot,
      getEnabledToolsForAgent,
      getCopilotWidgets,
      getCopilotRequestHeaders,
      getCustomApiKeys,
      widgetSubsetData,
      workspaceOptions,
      getSelectedModelForAgent,
      getFinalMessagesAndWidgets,
      copilotWidgetsLastUpdated,
      extraWidgetsEnabled,
      generativeUiEnabled,
      orchestrationModeEnabled,
      getSkillsCatalog,
      semanticViews,
      skills,
    ],
  );

  const getUpdateCopilotTitleFetchParams = useCallback(
    async (
      props: GetUpdateCopilotTitleFetchParamsProps,
    ): Promise<{ url: string; init: RequestInit }> => {
      const { xTraceId } = props;
      const { finalMessages } = await getFinalMessagesAndWidgets();
      const customApiKeys = getCustomApiKeys();

      const payload: UpdateTitlePayload = {
        messages: finalMessages,
        api_keys: customApiKeys,
      };
      return {
        url: `${getAiApiUrl()}/v1/generate/chat/title`,
        init: {
          method: "POST",
          headers: getCopilotRequestHeaders(xTraceId, getDefaultCopilot()),
          body: JSON.stringify(payload),
        },
      };
    },
    [
      getFinalMessagesAndWidgets,
      getCopilotRequestHeaders,
      getCustomApiKeys,
      currentDashboardId,
    ],
  );

  return [
    getQueryFetchParams,
    getFunctionCallFetchParams,
    getUpdateCopilotTitleFetchParams,
  ] as const;
}

// Helper function to compute expanded widgets from the various widget sources
const computeExpandedWidgets = (
  selectedWidgets: CopilotWidget[],
  temporaryWidgets: CopilotWidget[],
  allWidgets: CopilotWidget[],
  mentionWidgets: CopilotWidget[],
  finalDashboardWidgets: CopilotWidget[],
) => {
  // Step 1: Build the initial groups (pre-expansion)
  const preExpandedPrimary = [
    ...selectedWidgets,
    ...temporaryWidgets,
    ...mentionWidgets,
  ];
  const preExpandedSecondary = finalDashboardWidgets;

  // Step 2: Expand tabs to their constituent widgets for *each* group
  const expandedPrimary = expandTabsToWidgets(preExpandedPrimary);
  const expandedSecondary = expandTabsToWidgets(preExpandedSecondary);
  const expandedAllWidgets = expandTabsToWidgets(allWidgets);

  // Step 3: Ensure widgets are NOT duplicated between primary and secondary
  const [dedupedPrimaryRaw, dedupedSecondaryRaw] = mutuallyExclude(
    [expandedPrimary, expandedSecondary],
    widgetDedupeKey,
  );

  // Step 4: Remove any accidental duplicates within each list (edge-case safety)
  const uniqueBy = (arr: CopilotWidget[], key: (item: CopilotWidget) => unknown) => {
    const seen = new Set();
    return arr.filter((item) => {
      const val = key(item);
      if (seen.has(val)) return false;
      seen.add(val);
      return true;
    });
  };

  const dedupedPrimary = uniqueBy(dedupedPrimaryRaw, widgetDedupeKey);
  const dedupedSecondary = uniqueBy(dedupedSecondaryRaw, widgetDedupeKey);

  return {
    expandedPrimaryWidgets: dedupedPrimary,
    expandedSecondaryWidgets: dedupedSecondary,
    expandedAllWidgets,
  };
};

// Attachment widgets have no `uuid`, only `widget_id` — without the fallback they
// all collide on `undefined` and get dropped as duplicates of each other.
const widgetDedupeKey = (widget: CopilotWidget) => widget.uuid ?? widget.widget_id;

function mutuallyExclude(
  groups: CopilotWidget[][],
  equalityKey: (item: CopilotWidget) => unknown,
) {
  return groups.reduce((acc, currentGroup, _) => {
    const newGroup = currentGroup.filter(
      (widget) =>
        !acc.some((group) =>
          group.some((item) => equalityKey(item) === equalityKey(widget)),
        ),
    );
    acc.push(newGroup);
    return acc;
  }, [] as CopilotWidget[][]);
}

function expandTabsToWidgets(widgets: CopilotWidget[]): CopilotWidget[] {
  const tabWidgets = widgets.filter((widget) => widget.widget_id?.startsWith("tab_"));
  const nonTabWidgets = widgets.filter(
    (widget) => !widget.widget_id?.startsWith("tab_"),
  );

  // Extract constituent widgets from tabs
  const expandedWidgets: CopilotWidget[] = [];

  tabWidgets.forEach((tabWidget) => {
    const tabWidgetsInTab = tabWidget.metadata?.tabWidgets || [];
    if (tabWidgetsInTab.length > 0) {
      expandedWidgets.push(...tabWidgetsInTab);
    }
  });

  // Return non-tab widgets plus expanded widgets from tabs
  return [...nonTabWidgets, ...expandedWidgets];
}

function extractUrls(text: string, limit = 4) {
  const urls = extractUrlsFromText(text);
  return urls.slice(0, limit);
}

function convertArtifactsToContextItems(artifacts: ArtifactT[]): CopilotContextItem[] {
  return (
    artifacts
      // #TODO: @jose-donato RITA AI
      .filter((artifact) => artifact.type !== "app")
      .map((artifact) => {
        return {
          uuid: artifact.uuid,
          name: artifact.name ?? "",
          description: artifact.description ?? "",
          metadata: artifact.metadata,
          data: {
            items: [
              {
                content: JSON.stringify(artifact.content),
                data_format: {
                  data_type: "object",
                  chart_params:
                    artifact.type === "chart" ? artifact.chart_params : undefined,
                  parse_as: artifact.type,
                  query_data_source: isSnowflakeArtifact(artifact)
                    ? artifact.query_data_source
                    : undefined,
                },
              },
            ],
          },
        };
      })
  );
}

export type XHeadersT = {
  traceId?: string | undefined;
  completionId?: string | undefined;
};

type GetQueryFetchParamsProps = {
  incomingMessage: string;
  abortSignal: AbortSignal;
  targetAgent?: Copilot;
};

type GetFunctionCallFetchParamsProps = {
  xHeaders: XHeadersT;
  abortSignal: AbortSignal;
  targetAgent?: Copilot;
};

type GetUpdateCopilotTitleFetchParamsProps = {
  xTraceId: string;
};

export type WorkspaceStateT = {
  agents:
    | {
        holder_url: string;
        id: string;
        name: string;
        description: string;
        features: Record<string, boolean>;
      }[]
    | undefined;
  action_history: string[];
  current_dashboard_uuid: string | undefined;
  current_dashboard_info: DashboardInfoT;
  current_page_context: string;
};

type HumanQueryPayload = {
  model?: string;
  widgets: CopilotWidgets | undefined;
  messages: Message[];
  context: CopilotContextItem[];
  urls: string[];
  api_keys?: {
    openai_api_key?: string;
  };
  workspace_state?: WorkspaceStateT;
  workspace_options?: Record<string, boolean | string>;
  timezone: string;
  tools?: AgentToolConfig[];
  skills_catalog?: SkillCatalogEntry[];
  selected_skills?: SkillPayload[];
  semantic_views?: string[];
  available_semantic_views?: SemanticView[];
};

type FunctionCallPayload = {
  model?: string;
  widgets: CopilotWidgets;
  messages: Message[];
  context: CopilotContextItem[];
  api_keys?: {
    openai_api_key?: string;
  };
  workspace_state?: WorkspaceStateT;
  workspace_options?: Record<string, boolean | string>;
  tools: AgentToolConfig[]; // CRITICAL: Include tools for sequential execution
  skills_catalog?: SkillCatalogEntry[];
  selected_skills?: SkillPayload[];
  semantic_views?: string[];
  available_semantic_views?: SemanticView[];
};

type UpdateTitlePayload = {
  messages: Message[];
  api_keys?: {
    openai_api_key?: string;
  };
  workspace_state?: WorkspaceStateT;
  workspace_options?: Record<string, boolean | string>;
};
