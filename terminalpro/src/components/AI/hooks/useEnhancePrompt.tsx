import { useCallback, useMemo, useState } from "react";
import {
  ALL_AI_FEATURES,
  getAiApiUrl,
  getDefaultCopilot,
  MAX_COPILOT_LINKS,
} from "~/lib/constants";
import { useShallowAuthStore } from "~/lib/state/auth";
import type { CopilotContextItem } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowMcpToolsStore } from "~/lib/state/mcpTools";
import { extractUrlsFromText } from "~/lib/utils";
import { showNotification } from "~/lib/utils/toast";
import { useGetCopilotRequestHeaders } from "./useGetCopilotRequestHeaders";
import { useGetCustomApiKeys } from "./useGetCustomApiKeys";
import { useGetFinalMessagesAndWidgets } from "./useGetFinalMessagesAndWidgets";

export function useEnhancePrompt() {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const userToken = useShallowAuthStore((s) => s.user?.token);
  const getCurrentChatArtifacts = useShallowCopilotStore(
    (s) => s.getCurrentChatArtifacts,
  );

  const {
    getCopilotWidgets,
    widgetSubsetData,
    extraWidgetsEnabled,
    generativeUiEnabled,
  } = useShallowCopilotDataStore((s) => ({
    widgetSubsetData: s.widgetSubsetData,
    extraWidgetsEnabled: s.extraWidgetsEnabled,
    generativeUiEnabled: s.generativeUiEnabled,
    getCopilotWidgets: s.getCopilotWidgets,
  }));

  const customFeatureStates = useShallowCopilotStore((s) => s.customFeatureStates);

  const getCopilotRequestHeaders = useGetCopilotRequestHeaders();
  const getCustomApiKeys = useGetCustomApiKeys();
  const getFinalMessagesAndWidgets = useGetFinalMessagesAndWidgets();
  const getEnabledToolsForAgent = useShallowMcpToolsStore(
    (s) => s.getEnabledToolsForAgent,
  );
  const getEnabledToolCount = useShallowMcpToolsStore((s) => s.getEnabledToolCount);

  // Get workspace options (including web search)
  // Always use getDefaultCopilot() features for prompt enhancement
  const workspaceOptions = useMemo(() => {
    const options: Record<string, boolean | string> = {};
    const features = getDefaultCopilot().features || {};

    // Built-in options controlled by UI toggles and agent capability
    if (features?.["widget-global-search"] && extraWidgetsEnabled)
      options["widget-global-search"] = true;
    if (features?.["generative-ui"] && generativeUiEnabled)
      options["generative-ui"] = true;
    if (features?.["mcp-tools"] && getEnabledToolCount() > 0)
      options["mcp-tools"] = true;

    // Custom features like workspace-web-search - respect UI toggle state
    for (const [key, val] of Object.entries(features)) {
      if (ALL_AI_FEATURES.has(key)) continue;
      if (val && typeof val === "object") {
        const featureType = val.type || "toggle";
        const stateVal = customFeatureStates[key];
        if (featureType === "text" || featureType === "select") {
          if (typeof stateVal === "string" && stateVal) {
            options[key] = stateVal;
          }
        } else if (stateVal) {
          options[key] = true;
        }
      } else if (val === true) {
        const isEnabledInUI = customFeatureStates[key];
        if (isEnabledInUI) {
          options[key] = true;
        }
      }
    }

    return options;
  }, [
    extraWidgetsEnabled,
    generativeUiEnabled,
    getEnabledToolCount,
    customFeatureStates,
  ]);

  const enhancePrompt = useCallback(
    async (promptText: string): Promise<string> => {
      if (!userToken) {
        throw new Error("User not authenticated");
      }

      setIsEnhancing(true);

      try {
        const { selectedWidgets, temporaryWidgets, allWidgets, workspaceState } =
          getCopilotWidgets();
        const customApiKeys = getCustomApiKeys();

        // Always use getDefaultCopilot() features for prompt enhancement
        const features = getDefaultCopilot().features;
        const extraWidgetsCap = Boolean(features?.["widget-global-search"]);
        const mcpToolsEnabled = Boolean(
          features?.["mcp-tools"] && getEnabledToolCount() > 0,
        );

        const { finalMessages, finalDashboardWidgets, mentionWidgets } =
          await getFinalMessagesAndWidgets();

        const { expandedPrimaryWidgets, expandedSecondaryWidgets, expandedAllWidgets } =
          computeExpandedWidgets(
            selectedWidgets,
            temporaryWidgets,
            allWidgets,
            mentionWidgets,
            finalDashboardWidgets,
          );

        // Check if there's sufficient context for prompt enhancement
        const hasWidgets =
          expandedPrimaryWidgets.length > 0 || expandedSecondaryWidgets.length > 0;
        const hasMcpTools = mcpToolsEnabled;
        const hasWebSearch = Boolean(workspaceOptions["workspace-web-search"]);

        if (!(hasWidgets || hasMcpTools || hasWebSearch)) {
          showNotification({
            message: "Not enough context for prompt suggestion",
            description:
              "Enable widgets, MCP tools, or web search to get prompt suggestions",
            toastType: "error",
          });
          return promptText;
        }

        const artifacts = getCurrentChatArtifacts();
        const contextArtifacts = convertArtifactsToContextItems(artifacts);
        const context = [
          ...contextArtifacts,
          ...(widgetSubsetData || []),
        ] as CopilotContextItem[];

        // Get enabled tools if MCP is enabled
        const enabledTools = mcpToolsEnabled ? await getEnabledToolsForAgent() : [];

        const payload = {
          widgets: {
            primary: expandedPrimaryWidgets,
            secondary: expandedSecondaryWidgets,
            extra: extraWidgetsEnabled && extraWidgetsCap ? expandedAllWidgets : [],
          },
          messages: [
            ...finalMessages,
            {
              role: "human",
              content: promptText,
            },
          ],
          context: context,
          urls: extractUrls(promptText, MAX_COPILOT_LINKS),
          api_keys: customApiKeys,
          workspace_state: workspaceState,
          workspace_options: workspaceOptions,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          tools: enabledTools,
        };

        const response = await fetch(`${getAiApiUrl()}/v1/enhance_prompt`, {
          method: "POST",
          headers: getCopilotRequestHeaders(undefined, getDefaultCopilot()),
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `Enhancement failed: ${response.status} ${response.statusText}`,
          );
        }

        let enhancedText = await response.text();

        // Strip surrounding quotes if present
        enhancedText = enhancedText.trim();
        if (
          (enhancedText.startsWith('"') && enhancedText.endsWith('"')) ||
          (enhancedText.startsWith("'") && enhancedText.endsWith("'"))
        ) {
          enhancedText = enhancedText.slice(1, -1);
        }

        return enhancedText;
      } finally {
        setIsEnhancing(false);
      }
    },
    [
      userToken,
      getCopilotWidgets,
      getCustomApiKeys,
      getFinalMessagesAndWidgets,
      getCurrentChatArtifacts,
      widgetSubsetData,
      extraWidgetsEnabled,
      generativeUiEnabled,
      getCopilotRequestHeaders,
      workspaceOptions,
      getEnabledToolsForAgent,
      getEnabledToolCount,
    ],
  );

  return { enhancePrompt, isEnhancing };
}

// Helper functions (copied from useAiFetchRequestInit.tsx to keep the hook self-contained)
function computeExpandedWidgets(
  selectedWidgets: any[],
  temporaryWidgets: any[],
  allWidgets: any[],
  mentionWidgets: any[],
  finalDashboardWidgets: any[],
) {
  const preExpandedPrimary = [
    ...selectedWidgets,
    ...temporaryWidgets,
    ...mentionWidgets,
  ];
  const preExpandedSecondary = finalDashboardWidgets;

  const expandedPrimary = expandTabsToWidgets(preExpandedPrimary);
  const expandedSecondary = expandTabsToWidgets(preExpandedSecondary);
  const expandedAllWidgets = expandTabsToWidgets(allWidgets);

  const [dedupedPrimaryRaw, dedupedSecondaryRaw] = mutuallyExclude(
    [expandedPrimary, expandedSecondary],
    widgetDedupeKey,
  );

  const uniqueBy = (arr: any[], key: (item: any) => unknown) => {
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
}

// Attachment widgets have no `uuid`, only `widget_id` — without the fallback they
// all collide on `undefined` and get dropped as duplicates of each other.
const widgetDedupeKey = (widget: any) => widget.uuid ?? widget.widget_id;

function mutuallyExclude(groups: any[][], equalityKey: (item: any) => unknown) {
  return groups.reduce((acc, currentGroup, _) => {
    const newGroup = currentGroup.filter(
      (widget) =>
        !acc.some((group) =>
          group.some((item) => equalityKey(item) === equalityKey(widget)),
        ),
    );
    acc.push(newGroup);
    return acc;
  }, [] as any[][]);
}

function expandTabsToWidgets(widgets: any[]): any[] {
  const tabWidgets = widgets.filter((widget) => widget.widget_id?.startsWith("tab_"));
  const nonTabWidgets = widgets.filter(
    (widget) => !widget.widget_id?.startsWith("tab_"),
  );

  const expandedWidgets: any[] = [];

  tabWidgets.forEach((tabWidget) => {
    const tabWidgetsInTab = tabWidget.metadata?.tabWidgets || [];
    if (tabWidgetsInTab.length > 0) {
      expandedWidgets.push(...tabWidgetsInTab);
    }
  });

  return [...nonTabWidgets, ...expandedWidgets];
}

function extractUrls(text: string, limit = 4) {
  const urls = extractUrlsFromText(text);
  return urls.slice(0, limit);
}

function convertArtifactsToContextItems(artifacts: any[]): CopilotContextItem[] {
  return artifacts.map((artifact) => {
    return {
      uuid: artifact.uuid,
      name: artifact.name ?? "",
      description: artifact.description ?? "",
      data: {
        items: [
          {
            content: JSON.stringify(artifact.content),
            data_format: {
              data_type: "object",
              chart_params:
                artifact.type === "chart" ? artifact.chart_params : undefined,
              parse_as:
                artifact.type === "chart" && artifact.chart_params
                  ? "chart"
                  : artifact.type,
            },
          },
        ],
      },
    };
  });
}
