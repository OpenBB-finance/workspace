import { useCallback } from "react";
import {
  type AIMessage,
  type Copilot,
  type CopilotDataT,
  type CopilotWidget,
  type DataUrl,
  type HumanMessage,
  type Message,
  type ToolMessage,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import {
  AVAILABLE_FUNCTIONS,
  type FunctionCallT,
  type GetWidgetDataInputArgumentsT,
  isWidgetDataFunctionCall,
} from "~/lib/utils";
import { useFunctionCall } from "./useFunctionCall";
import { createCopilotWidget } from "./useGetCopilotWidgets";
import { useMentions } from "./useMentions";
import { useWidgetsInCurrentDashboard } from "./useWidgetsInCurrentDashboard";

function hasNonEmptyExtraState(extraState: unknown): boolean {
  if (extraState == null) return false;
  if (typeof extraState !== "object") return true;
  return Object.keys(extraState as Record<string, unknown>).length > 0;
}

export function useGetFinalMessagesAndWidgets() {
  const { getCurrentChat, removeMessages } = useShallowCopilotStore((s) => ({
    getCurrentChat: s.getCurrentChat,
    removeMessages: s.removeMessages,
  }));
  const { getDashboardWidgetData, getCopilotWidgets } = useShallowCopilotDataStore(
    (s) => ({
      getDashboardWidgetData: s.getDashboardWidgetData,
      getCopilotWidgets: s.getCopilotWidgets,
    }),
  );
  const getDashboardWidgetByUuid = useWidgetsInCurrentDashboard();
  const { getWidgetData } = useFunctionCall();
  const processMentions = useMentions()?.processMentions;

  const getFinalMessagesAndWidgets = useCallback(
    async (targetAgent?: Copilot) => {
      const { allDashboardWidgets } = getCopilotWidgets(targetAgent) || {};
      const { messages: chatMessages } = getCurrentChat();
      const unreachableUuids = new Set<string>();
      let mentionWidgets = [] as CopilotWidget[];
      const messagesToRemove = new Set<number>();

      const extractWidgetUuids = (content: FunctionCallT) => {
        const widget_uuids = content.input_arguments?.data_sources?.map(
          (d) => d.widget_uuid,
        );
        const data = [content.extra_state, content].find(
          (d) => d?.copilot_function_call_arguments,
        );
        const widget_queries = data?.copilot_function_call_arguments?.widget_queries;

        return (widget_uuids ?? widget_queries ?? []).map(
          (uuidOrQuery: any) => uuidOrQuery?.widget_uuid ?? uuidOrQuery,
        ) as string[];
      };

      const renewExpiredDataSources = async (message: ToolMessage) => {
        const dataSources =
          (message.input_arguments as GetWidgetDataInputArgumentsT)?.data_sources ?? [];
        if (dataSources.length > 0) {
          const BUFFER = 5 * 60 * 1000; // 5 minutes
          await Promise.all(
            dataSources.map(async (dataSource, i) => {
              if (dataSource.origin === "OpenBB Hub") {
                const data = message.data?.[i] as CopilotDataT | undefined;
                if (!Array.isArray(data?.items)) return;
                const renewalPromises = data.items.map(async (item) => {
                  const dataUrlItem = item as DataUrl;
                  if (
                    dataUrlItem?.expiration &&
                    dataUrlItem.expiration <= Date.now() + BUFFER
                  ) {
                    try {
                      const newData = await getWidgetData([dataSource]);
                      message.data[i] = newData[0] as CopilotDataT;
                    } catch (error) {
                      console.error(
                        `Failed to renew data for data source: ${dataSource}`,
                        error,
                      );
                    }
                  }
                });
                await Promise.all(renewalPromises);
              }
            }),
          );
        }
      };

      const restoreAiTags = (content: string) => {
        const result = content
          .replace(
            /<artifact className="([^"]+)"\/>/g,
            "<|start_artifact_id|>$1<|end_artifact_id|>",
          )
          .replace(/<artifact>/g, "<|start_artifact_id|>")
          .replace(/<\/artifact>/g, "<|end_artifact_id|>")
          .replace(
            /<citation className="([^"]+)"\/>/g,
            "<|start_citation_id|>$1<|end_citation_id|>",
          )
          .replace(/<citation>/g, "<|start_citation_id|>")
          .replace(/<\/citation>/g, "<|end_citation_id|>");
        return result;
      };

      const checkToolMessage = (message: Message) => {
        // For the built-in copilot, widget data tool messages are redundant (data is
        // read from the store), so we drop them unless extra_state carries metadata.
        // Iframe sub-widget data is fetched on-demand via the bridge and is NOT stored
        // in the dashboard widget store, so those tool messages must be preserved.
        if (message?.role !== "tool") return !message;
        const hasIframeSubWidgets = (
          message.input_arguments as any
        )?.data_sources?.some((ds: any) => ds?.id?.includes("::iframe::"));
        return (
          !targetAgent &&
          !hasIframeSubWidgets &&
          !hasNonEmptyExtraState(message.extra_state)
        );
      };

      const processAiMessage = (message: AIMessage, nextMessage?: Message) => {
        try {
          // Function Call
          const content = JSON.parse(message.content) as FunctionCallT;
          if (!AVAILABLE_FUNCTIONS.includes(content.function)) {
            messagesToRemove.add(message.timestamp);
            return null;
          }
          if (isWidgetDataFunctionCall(content)) {
            if (
              content.function === "get_widget_data" &&
              checkToolMessage(nextMessage)
            ) {
              messagesToRemove.add(message.timestamp);
              return null;
            }
            return {
              role: "ai",
              content: restoreAiTags(message.content),
            };
          }
          return message;
        } catch (_) {
          // Basic AI message
          return {
            role: "ai",
            content: restoreAiTags(message.content),
            agent_id: message.copilotId,
          };
        }
      };
      const processToolMessage = async (message: ToolMessage) => {
        if (!AVAILABLE_FUNCTIONS.includes(message.function)) {
          messagesToRemove.add(message.timestamp);
          return null;
        }
        if (isWidgetDataFunctionCall(message)) {
          if (checkToolMessage(message)) {
            messagesToRemove.add(message.timestamp);
            return null;
          }
          const widgetUuids = extractWidgetUuids(message);
          for (const uuid of widgetUuids) {
            // Unreachable widgets are not in the dashboard,
            // but are referenced in tool messages
            if (!allDashboardWidgets?.some((dW) => dW?.uuid === uuid))
              unreachableUuids.add(uuid);
          }
          await renewExpiredDataSources(message);
          return {
            role: "tool",
            function: message.function,
            input_arguments: message.input_arguments,
            data: message.data,
            extra_state: message.extra_state,
          } as ToolMessage;
        }
        return message;
      };

      const processHumanMessage = (message: HumanMessage) => {
        // TODO: This is not very efficient, should just get the mentions
        // for the last Human message
        const { result: prompt, mentions } = processMentions(message.content);
        if (mentions) {
          mentionWidgets = mentions
            .map((mention) => mention.content)
            .filter(Boolean) as CopilotWidget[];
        }
        return {
          role: "human",
          content: prompt.replace(/\u00A0/g, " ").replace(/\u2011/g, "-"),
        };
      };

      const finalMessages = (
        await Promise.all(
          chatMessages
            .filter((message) => message.role !== "system")
            .map(async (message, index, arr) => {
              if (message.role === "human") return processHumanMessage(message);
              if (message.role === "ai") {
                const nextMessage = arr[index + 1];
                return processAiMessage(message, nextMessage);
              }
              if (message.role === "tool") return await processToolMessage(message);
              return null;
            }),
        )
      ).filter(Boolean) as Message[];

      const widgetsFromOtherDashboards: CopilotWidget[] = [];
      for (const uuid of unreachableUuids) {
        const widgetData = getDashboardWidgetData(uuid);
        if (!widgetData) continue;
        const widget = getDashboardWidgetByUuid(uuid);
        if (!widget) continue;
        const copilotWidget = createCopilotWidget(
          uuid,
          widget,
          widgetData.metadata ?? {},
        );
        if (copilotWidget) widgetsFromOtherDashboards.push(copilotWidget);
      }

      removeMessages(Array.from(messagesToRemove));
      const finalDashboardWidgets = [
        ...(allDashboardWidgets || []),
        ...widgetsFromOtherDashboards,
      ];

      return { finalMessages, finalDashboardWidgets, mentionWidgets };
    },
    [
      getDashboardWidgetData,
      getCopilotWidgets,
      getDashboardWidgetByUuid,
      getWidgetData,
      processMentions,
    ],
  );

  return getFinalMessagesAndWidgets;
}
