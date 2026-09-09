import { useMutation } from "@tanstack/react-query";
import posthog from "posthog-js";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import { v4 as uuidv4 } from "uuid";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { getConfig } from "~/lib/runtimeConfig";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  type BackendTemplate,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import {
  type AIMessage,
  type AppArtifactT,
  type Citation as CitationT,
  type Copilot,
  type CopilotCommandResultT,
  type CopilotDataT,
  type CopilotFile,
  type CopilotFunctionCallError,
  type Message,
  type SystemSSEContent,
  type ToolMessage,
  useCopilotStore,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSkillsLibraryStore } from "~/lib/state/skillsLibrary";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";
import {
  type AddGenerativeWidgetInputArgumentsT,
  type FunctionCallT,
  functionCallSchema,
  manageNavigationBarInputArguments,
} from "~/lib/utils";
import { createCustomTemplateTab } from "~/lib/utils/createTemplates";
import type { SkillPayload } from "~/types/auth.type";
import {
  buildAppArtifactSource,
  buildWidgetMetadataResolver,
  buildWidgetSourceResolver,
  shouldAutoOpenAppArtifact,
} from "../appArtifactUtils";
import { useMcpExecutor } from "./mcp/useMcpExecutor";
import { useAiFetchRequestInit, type XHeadersT } from "./useAiFetchRequestInit";
import { useCreateSkillFromConversation } from "./useCreateSkillFromConversation";
import { useFunctionCall } from "./useFunctionCall";
import { useManageNavigationBar } from "./useManageNavigationBar";
import useQueriesLeft from "./useQueriesLeft";
import {
  ResetState,
  type StreamingState,
  StreamingStatus,
  useShallowStreamingStore,
  useStreamingHooks,
  useStreamingStore,
} from "./useStreaming";
import { dispatchCopilotCommand, partitionFilesOnSend } from "./utils";

export type CopilotSubmitParams = {
  question?: string;
  addHumanMessage?: boolean;
  mockResponse?:
    | string
    | {
        messageContent: string;
        citations?: any[];
        artifact?: any;
      };
};

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

const createFunctionCallMessages = (
  dataOrResults: (CopilotDataT | CopilotFunctionCallError)[] | CopilotCommandResultT[],
  functionCallSpec: FunctionCallT,
) => {
  const aiMessage = {
    role: "ai",
    content: JSON.stringify({
      function: functionCallSpec.function,
      input_arguments: functionCallSpec?.input_arguments,
    }),
  } as AIMessage;
  const toolMessage = {
    role: "tool",
    function: functionCallSpec.function,
    input_arguments: functionCallSpec?.input_arguments,
    data: dataOrResults,
    extra_state: functionCallSpec?.extra_state,
  } as ToolMessage;
  return { aiMessage, toolMessage };
};

function useStreamResponse(stopSubmit: () => void) {
  const navigate = useNavigate();
  const { id: currentDashboard } = useParams();
  const commandRef = useCopilotContext().commandRef;
  const [limitReached, abortController, streamingStatus, dispatch] =
    useShallowStreamingStore((s) => [
      s.limitReached,
      s.abortController,
      s.streamingStatus,
      s.dispatch,
    ]);

  const [_, setStreamedData] = useLocalStorage("streamedData", "");
  const [__, setStreamedCitations] = useLocalStorage<CitationT[]>(
    "streamedCitations",
    [],
  );

  const aiEnhancements = useShallowThemeStore((state) => state.aiEnhancements);

  const queriesLeft = useQueriesLeft()?.queriesLeft;

  const userToken = useShallowAuthStore((s) => s.user?.token);
  const addTab = useShallowAppStore((s) => s.addTab);
  const { apiSources, widgetMetadata } = useShallowBackendConnectorStore((s) => ({
    apiSources: s.apiSources,
    widgetMetadata: s.widgetMetadata,
  }));
  const resolveWidget = useMemo(
    () => buildWidgetMetadataResolver(widgetMetadata),
    [widgetMetadata],
  );
  const generativeUiEnabled = useShallowCopilotDataStore((s) => s.generativeUiEnabled);

  const copilot = useShallowCopilotStore((s) => ({
    addArtifactToCurrentChat: s.addArtifactToCurrentChat,
    selectedCopilot: s.selectedCopilot,
    setIsTyping: s.setIsTyping,
    updateLastMessage: s.updateLastMessage,
    updateLastMessageError: s.updateLastMessageError,
    makeLastMessageFC: s.makeLastMessageFC,
    addMessage: s.addMessage,
    removeMessages: s.removeMessages,
    getCurrentChat: s.getCurrentChat,
    updateCopilotLabelAndSetTitleNeedsUpdate:
      s.updateCopilotLabelAndSetTitleNeedsUpdate,
  }));

  const [
    getQueryFetchParams,
    getFunctionCallFetchParams,
    getUpdateCopilotTitleFetchParams,
  ] = useAiFetchRequestInit();
  const {
    getWidgetData,
    getParamOptions,
    addWidgetToDashboard,
    updateWidgetInDashboard,
    assignTasksToAgents,
    addGenerativeWidget,
  } = useFunctionCall();
  const manageNavigationBar = useManageNavigationBar();

  // MCP tool execution
  const executeAgentTool = useMcpExecutor();

  // Skills store access for get_skill_content function call
  const getSkillBySlug = useShallowSkillsLibraryStore((s) => s.getSkillBySlug);

  // Save the current conversation as a skill (save_skill function call)
  const createSkillFromConversation = useCreateSkillFromConversation();

  // Add a new ref to store the resolution function
  const resolveStreamRef = useRef<(() => void) | null>(null);
  const handleEventRef =
    useRef<(props: HandleEventProps) => Promise<Record<string, any>>>();

  // Store pending MCP citations across streaming lifecycle (accumulates across multiple tool calls)
  const pendingMcpCitationsRef = useRef<CitationT[]>([]);

  const autoOpenAppArtifact = useCallback(
    async (artifact: AppArtifactT, targetAgent?: Copilot) => {
      const features = targetAgent?.features || copilot.selectedCopilot?.features;
      // Read items imperatively: back-to-back artifacts in one stream must see the dashboard
      // state left by the previous auto-open, which the render closure would not reflect.
      const items = useAppStore.getState().items;
      const currentDashboardItem = currentDashboard ? items?.[currentDashboard] : null;
      if (
        !shouldAutoOpenAppArtifact({
          generativeUiEnabled,
          features,
          currentDashboardItem,
        })
      ) {
        return;
      }

      try {
        await createCustomTemplateTab({
          addTab,
          navigate,
          items,
          template: artifact.app as unknown as BackendTemplate,
          source: buildAppArtifactSource(artifact),
          currentDashboard: currentDashboard ?? "",
          dashboardBehavior: "current",
          resolveWidgetSource: buildWidgetSourceResolver(
            artifact.widget_refs ?? [],
            apiSources,
          ),
          resolveWidget,
        });
      } catch (error) {
        toast.error("Failed to open app", {
          description: error instanceof Error ? error.message : "Unexpected error",
        });
      }
    },
    [
      addTab,
      navigate,
      currentDashboard,
      apiSources,
      resolveWidget,
      generativeUiEnabled,
      copilot.selectedCopilot?.features,
    ],
  );

  const updateCopilotTitle = useCallback(
    async (xTraceId: string) => {
      // only update the title if the title needs to be updated, i.e.
      //   1. the title is "New Chat" because it hasn't been manually updated by the user
      //   2. one of the messages has been edited and so we re-update the title in case it changes topic of conversation
      //   3. the title has never been updated and we need to generate a title
      // Note: if the user manually updates the title, we don't want to overwrite it

      const { titleManuallyUpdated, titleNeedsUpdate, messages } =
        copilot.getCurrentChat();
      if (!(!titleManuallyUpdated && titleNeedsUpdate && messages.length > 1)) return;
      const { url, init } = await getUpdateCopilotTitleFetchParams({ xTraceId });
      try {
        const response = await fetch(url, init);
        if (!response.ok) throw new Error(response.statusText);
        const data = await response.json();
        copilot.updateCopilotLabelAndSetTitleNeedsUpdate(data, false);
      } catch (e) {
        console.error(e);
        return;
      }
    },
    [
      copilot.getCurrentChat,
      copilot.updateCopilotLabelAndSetTitleNeedsUpdate,
      userToken,
    ],
  );

  const processStream = useCallback(
    async (
      xHeaders: XHeadersT,
      reader: ReadableStreamDefaultReader,
      abortSignal: AbortSignal,
      question: string,
      keepAlive = false, // Whether to keep the streaming state alive after processing the stream
      targetAgent?: Copilot,
    ) => {
      const decoder = new TextDecoder("utf-8");
      let accumulatedMessageData = "";
      let accumulatedCitations = [];
      let streamBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (handleEventRef.current)
            handleEventRef.current({
              event: "done",
              question,
              accumulatedMessageData,
              accumulatedCitations,
              abortSignal,
              xHeaders,
              keepAlive,
              targetAgent,
            });
          break;
        }
        /*
          each chunk is the following:
          event: message_chunk
          data: {'delta': '...'}

          event: message_chunk
          data: {'delta': '...'}

          etc
      */
        const chunk = decoder.decode(value, { stream: true });
        streamBuffer += chunk;
        const events = streamBuffer.split(/\r\n\r\n|\r\r|\n\n/g);

        // The leftover text to remain in the buffer is whatever doesn't have two newlines after it. If the buffer ended
        // with two newlines, this will be an empty string.
        streamBuffer = events.pop()!;
        let event = "";

        for (const eventChunk of events) {
          // Split up by single newlines.
          const lines = eventChunk.split(/\n|\r|\r\n/g);
          let data = "";
          for (const line of lines) {
            try {
              const lineMatch = /(?<field>[^:]+)(?:: ?(?<value>.*))?/.exec(line);
              if (lineMatch) {
                const groups = lineMatch.groups || {};
                const value = groups.value || "";

                switch (groups.field) {
                  case "event":
                    event = value;
                    break;
                  case "data": {
                    data += value;
                    data += "\n";
                    break;
                  }
                  // other types are explicitly ignored
                }
              }
            } catch (e) {
              console.error(e);
            }
          }
          // Skip the event if the data buffer is the empty string.
          if (data === "") continue;

          // Remove the last newline character if it exists
          if (data[data.length - 1] === "\n") {
            data = data.slice(0, -1);
          }

          // Parse the data as JSON
          data = JSON.parse(data);

          if (handleEventRef.current)
            ({ accumulatedMessageData, accumulatedCitations } =
              await handleEventRef.current({
                event,
                data,
                question,
                accumulatedMessageData,
                accumulatedCitations,
                abortSignal,
                xHeaders,
                keepAlive,
                targetAgent,
              }));
        }
      }
    },
    [handleEventRef],
  );

  const submitFunctionCallResponse = useCallback(
    async (
      props: HandleFunctionCallProps,
      dataOrResults:
        | (CopilotDataT | CopilotFunctionCallError)[]
        | CopilotCommandResultT[],
    ) => {
      const { incomingMessage, abortSignal, xHeaders, functionCallSpec, targetAgent } =
        props;
      const copilotId = targetAgent?.id || copilot.selectedCopilot?.id;

      const updateChatMessages = (aiMessage: AIMessage, toolMessage: ToolMessage) => {
        if (!copilot.selectedCopilot) return;
        copilot.addMessage({
          ...aiMessage,
          copilotId,
          timestamp: Date.now(),
          isHidden: true,
        });
        copilot.addMessage({
          ...toolMessage,
          copilotId,
          timestamp: Date.now() + 1,
          isHidden: true,
        });
      };

      const { aiMessage, toolMessage } = createFunctionCallMessages(
        dataOrResults,
        functionCallSpec,
      );

      // Extract MCP extra_citations (if any) and accumulate for injection at 'done'
      if (
        functionCallSpec.function === "execute_agent_tool" &&
        Array.isArray(dataOrResults)
      ) {
        const citations = dataOrResults.flatMap((item: any) =>
          Array.isArray(item?.extra_citations) ? item.extra_citations : [],
        );
        if (citations.length > 0) {
          const normalized = normalizeCitations(citations);
          // Deduplicate by id while accumulating
          const existingIds = new Set(pendingMcpCitationsRef.current.map((c) => c.id));
          const toAdd = normalized.filter((c) => !existingIds.has(c.id));
          pendingMcpCitationsRef.current.push(...toAdd);
        }
      }

      updateChatMessages(aiMessage, toolMessage);

      const { queryUrl, init } = await getFunctionCallFetchParams({
        xHeaders,
        abortSignal,
        targetAgent,
      });
      const response = await fetch(queryUrl, init);
      if (!response.ok) throw new Error(response.statusText);
      const reader = response.body?.getReader();
      if (!isReadableStream(reader))
        throw new Error("Invalid response from getWidgetDataFunction");
      return await processStream(
        xHeaders,
        reader,
        abortSignal,
        incomingMessage,
        false,
        targetAgent,
      );
    },
    [
      getFunctionCallFetchParams,
      processStream,
      copilot.selectedCopilot?.id,
      copilot.addMessage,
      pendingMcpCitationsRef,
    ],
  );

  const handleFunctionCall = useCallback(
    async (props: HandleFunctionCallProps) => {
      if (!copilot.selectedCopilot) return;
      const { functionCallSpec, xHeaders, abortSignal, incomingMessage } = props;
      copilot.makeLastMessageFC();

      if (posthog) {
        const dataSources = functionCallSpec.input_arguments?.data_sources;
        const sourceOrigins = Array.isArray(dataSources)
          ? [
              ...new Set(
                dataSources.map((ds: { origin?: string }) => ds.origin).filter(Boolean),
              ),
            ]
          : undefined;
        posthog.capture(`copilot_${functionCallSpec.function}`, {
          widget_uuid: dataSources,
          trace_id: xHeaders?.traceId,
          source_origins: sourceOrigins,
        });
      }

      const forwardMessageToAi = async (
        message: string,
        fromAgentId: string,
        targetAgent?: Copilot,
      ) => {
        copilot.addMessage({
          role: "ai",
          content: message,
          copilotId: fromAgentId,
          timestamp: Date.now(),
        });

        const { queryUrl, init } = await getQueryFetchParams({
          incomingMessage: message,
          abortSignal,
          targetAgent,
        });

        const response = await fetch(queryUrl, init);

        if (!response.ok) throw new Error(response.statusText);

        // Check if this is a streaming response
        const contentType = response.headers.get("content-type");

        if (targetAgent && !contentType?.includes("text/event-stream")) {
          // Handle non-streaming response from external agent
          try {
            const jsonResponse = await response.json();

            // Convert to streaming format for compatibility
            // This is a simplified approach - you may need to adjust based on the actual response format
            copilot.addMessage({
              role: "ai",
              content: JSON.stringify(jsonResponse),
              copilotId: targetAgent.id,
              timestamp: Date.now() + 1,
            });
            return;
          } catch (e) {
            throw new Error(`Failed to process agent response: ${e.message}`);
          }
        }

        const reader = response.body?.getReader();
        if (!isReadableStream(reader))
          throw new Error("Invalid response from getWidgetDataFunction");
        return await processStream(
          xHeaders,
          reader,
          abortSignal,
          incomingMessage,
          true,
          targetAgent,
        );
      };

      switch (functionCallSpec.function) {
        // We handle both LLM functions in the same way
        case "get_widget_data":
        case "get_extra_widget_data": {
          const data = await getWidgetData(
            functionCallSpec.input_arguments.data_sources || [],
          );
          return await submitFunctionCallResponse(props, data);
        }
        case "get_params_options": {
          const data = await getParamOptions(
            functionCallSpec.input_arguments.param_options_queries || [],
          );
          return await submitFunctionCallResponse(props, data);
        }
        case "add_widget_to_dashboard": {
          const results = await addWidgetToDashboard(
            functionCallSpec.input_arguments.data_sources || [],
            functionCallSpec.extra_state?.copilot_function_call_arguments,
          );
          return await submitFunctionCallResponse(props, results);
        }
        case "update_widget_in_dashboard": {
          const results = await updateWidgetInDashboard(
            functionCallSpec.input_arguments.data_sources || [],
          );
          return await submitFunctionCallResponse(props, results);
        }
        case "assign_tasks_to_agents": {
          const results = await assignTasksToAgents(
            functionCallSpec.input_arguments.task_requests || [],
            forwardMessageToAi,
          );
          // If we expect a direct response from the agent, don't show the tool results
          // The agent's response will be displayed directly
          // if any of the tasks failed, we show the results as normal
          const expectDirectResponse =
            functionCallSpec.extra_state?.expect_direct_response &&
            results.every((val) => val.status === "success");

          return await submitFunctionCallResponse(
            props,
            expectDirectResponse ? [] : results,
          );
        }
        case "execute_agent_tool": {
          const { server_id, tool_name, parameters } = functionCallSpec.input_arguments;
          const data = await executeAgentTool(server_id, tool_name, parameters);
          return await submitFunctionCallResponse(props, data);
        }
        case "manage_navigation_bar": {
          const parsed = manageNavigationBarInputArguments.safeParse(
            functionCallSpec.input_arguments,
          );
          if (!parsed.success) {
            return await submitFunctionCallResponse(props, [
              {
                status: "error",
                message: `Invalid manage_navigation_bar arguments: ${parsed.error.message}`,
              },
            ]);
          }
          const results = await manageNavigationBar(parsed.data);
          return await submitFunctionCallResponse(props, results);
        }
        case "add_generative_widget": {
          const args =
            functionCallSpec.input_arguments as AddGenerativeWidgetInputArgumentsT;
          const results = await addGenerativeWidget(args);
          return await submitFunctionCallResponse(props, results);
        }
        case "get_skill_content": {
          const { slug, reason } = functionCallSpec.input_arguments as {
            slug: string;
            reason?: string;
          };
          const skill = getSkillBySlug(slug);

          if (posthog) {
            posthog.capture("skill_model_requested", {
              skill_slug: slug,
              reason: reason,
              found: !!skill,
              trace_id: xHeaders?.traceId,
            });
          }

          if (!skill) {
            return await submitFunctionCallResponse(props, [
              {
                status: "error",
                message: `Skill with slug "/${slug}" not found in user's skill library.`,
              },
            ]);
          }

          const skillPayload: SkillPayload = {
            slug: skill.slug,
            description: skill.description,
            contentMarkdown: skill.content,
            source: "model_selected",
          };

          return await submitFunctionCallResponse(props, [
            {
              status: "success",
              data: { skill: skillPayload },
            },
          ]);
        }
        case "save_skill": {
          const { name, instructions } = functionCallSpec.input_arguments ?? {};
          const results = await createSkillFromConversation({ name, instructions });
          return await submitFunctionCallResponse(props, results);
        }
        default:
          throw new Error(`Unknown function: ${functionCallSpec.function}`);
      }
    },
    [
      copilot,
      getWidgetData,
      getParamOptions,
      addWidgetToDashboard,
      updateWidgetInDashboard,
      executeAgentTool,
      manageNavigationBar,
      addGenerativeWidget,
      getSkillBySlug,
      createSkillFromConversation,
      getFunctionCallFetchParams,
      getQueryFetchParams,
      processStream,
      submitFunctionCallResponse,
    ],
  );

  const handleEvent = useCallback(
    async (props: HandleEventProps) => {
      const { event, data, question, abortSignal, xHeaders, keepAlive, targetAgent } =
        props;
      let aiMessageBuffer: string = props.accumulatedMessageData;
      let citationBuffer: CitationT[] = props.accumulatedCitations;
      const copilotId = targetAgent?.id || copilot.selectedCopilot?.id;

      if (!copilot.selectedCopilot) return;

      const flushBuffers = () => {
        // Used when there is a MessageChunk receiving stream ongoing
        // but we there is an incoming FunctionCall or StatusUpdate
        if (!aiMessageBuffer) return;
        copilot.updateLastMessage({
          content: aiMessageBuffer,
          citations: citationBuffer,
        });
        aiMessageBuffer = "";
        citationBuffer = [];
        dispatch(
          { ...ResetState, ...StreamingStatus.READY, loading: true },
          setStreamedData,
          setStreamedCitations,
        );
      };

      switch (event.trim()) {
        case "copilotStatusUpdate": {
          flushBuffers();
          const content = data as SystemSSEContent;
          // Hidden updates are not shown in the chat, but
          // the state is still loading until the next message
          if (content.hidden) break;
          if (content.eventType === "WARNING") {
            if (posthog) {
              posthog.capture("WARNING_COPILOT_MESSAGE", {
                copilot_warning_error: content?.eventType,
                copilot_warning_message: content?.message,
                trace_id: xHeaders?.traceId,
              });
            }
          }
          if (content.eventType === "ERROR") {
            if (posthog) {
              posthog.capture("ERROR_COPILOT_MESSAGE", {
                copilot_error_error: content?.eventType,
                copilot_error_message: content?.message,
                trace_id: xHeaders?.traceId,
              });
            }
            // Usually this will be a context exceeded error.
            // By removing the last AI and tool messages we remove
            // the function call result that is exceeding the context.
            const { messages } = copilot.getCurrentChat();
            const timestamps = getLatestAiToolPairTimestamps(messages);
            if (timestamps) copilot.removeMessages(timestamps);
          }
          copilot.addMessage({
            role: "system",
            content: content,
            copilotId,
            orchestrationModeEnabled:
              useCopilotStore.getState().orchestrationModeEnabled,
            timestamp: Date.now() + 1, // adding 1 to avoid timestamp collision with the human message
          });
          break;
        }
        case "copilotMessageArtifact": {
          if (!aiMessageBuffer) {
            copilot.addMessage({
              role: "ai",
              content: "",
              copilotId,
              timestamp: Date.now() + 1,
            });
            dispatch(StreamingStatus.STARTED);
          }
          const suffix = aiMessageBuffer.endsWith("| ") ? "\n" : "";
          const artifactMarker = `${suffix}<artifact className="${data.name}"/>`;
          aiMessageBuffer += artifactMarker;
          copilot.addArtifactToCurrentChat(data);
          setStreamedData((prevData) => prevData + artifactMarker);
          if (data?.type === "app") void autoOpenAppArtifact(data, targetAgent);

          break;
        }
        case "copilotMessageChunk": {
          if (!aiMessageBuffer) {
            // We add an empty message that will be updated with the data from the chunks
            copilot.addMessage({
              role: "ai",
              content: "",
              copilotId,
              timestamp: Date.now() + 1, // adding 1 to avoid timestamp collision with the human message
            });
            dispatch(StreamingStatus.STARTED);
          }
          const delta = data.delta;
          if (!delta) break;
          aiMessageBuffer += delta;
          setStreamedData((prevData) => prevData + delta);
          break;
        }
        case "copilotCitationCollection": {
          if (!aiMessageBuffer) {
            copilot.addMessage({
              role: "ai",
              content: "",
              copilotId,
              timestamp: Date.now() + 1,
            });
            dispatch(StreamingStatus.STARTED);
          }

          let citationMarkers = data.citations
            .map((citation: CitationT) => `<citation className="${citation.id}"/>`)
            .join("");

          if (citationMarkers && aiMessageBuffer.endsWith("| "))
            citationMarkers = `\n${citationMarkers}`;

          aiMessageBuffer += citationMarkers;
          setStreamedData((prevData) => prevData + citationMarkers);

          setStreamedCitations((prevData) => {
            return [...prevData, ...data.citations];
          });

          citationBuffer.push(...data.citations);
          break;
        }
        case "copilotFunctionCall": {
          flushBuffers();
          const functionCallSpec = functionCallSchema.parse(data) as FunctionCallT;
          await handleFunctionCall({
            functionCallSpec,
            incomingMessage: question,
            abortSignal,
            xHeaders,
            targetAgent,
          });
          break;
        }
        case "copilotPromptSuggestions": {
          const suggestions = data?.suggestions;
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            copilot.updateLastMessage({ suggestions });
          }
          break;
        }
        case "done": {
          if (!keepAlive)
            dispatch(
              { ...ResetState, ...StreamingStatus.READY },
              setStreamedData,
              setStreamedCitations,
            );
          const updateMessage = {} as Partial<AIMessage>;

          // Merge any pending MCP citations into the buffer and append markers
          const pending = pendingMcpCitationsRef.current;
          if (pending.length) {
            const idsInContent = new Set(
              Array.from(
                (aiMessageBuffer || "").matchAll(/<citation className="([^"]+)"\/>/g),
              ).map((m) => m[1]),
            );
            const newMarkers = pending
              .filter((c) => !idsInContent.has(c.id))
              .map((c) => `<citation className="${c.id}"/>`)
              .join("");

            if (newMarkers) {
              aiMessageBuffer +=
                (aiMessageBuffer?.endsWith("| ") ? "\n" : "") + newMarkers;
            }
            // Merge into citationBuffer with deduplication
            const bufferIds = new Set(citationBuffer.map((c) => c.id));
            for (const c of pending) if (!bufferIds.has(c.id)) citationBuffer.push(c);
            // Clear accumulated pending citations
            pendingMcpCitationsRef.current = [];
          }

          if (aiMessageBuffer) {
            updateMessage.content = aiMessageBuffer;
            // Only update title if there is actual AI message content
            // Title generation is an OpenBB backend feature available for all agents
            if (aiEnhancements && aiCopilotAiEnhancementsFF) {
              updateCopilotTitle(xHeaders?.traceId || "");
            }
          }
          if (citationBuffer.length > 0) {
            updateMessage.citations = citationBuffer;
          }
          if (copilot.selectedCopilot.id === "openbb-copilot") {
            for (const key of ["traceId", "completionId"]) {
              if (xHeaders[key]) {
                updateMessage[key] = xHeaders[key];
              }
            }
          }
          if (Object.keys(updateMessage).length > 0) {
            copilot.updateLastMessage(updateMessage);
          }

          setTimeout(() => {
            document.getElementById("copilot-input")?.focus();
          }, 100);
          break;
        }
        default:
          console.warn("Unknown event type:", event);
      }
      return {
        accumulatedMessageData: aiMessageBuffer,
        accumulatedCitations: citationBuffer,
      };
    },
    [
      copilot,
      handleFunctionCall,
      updateCopilotTitle,
      aiEnhancements,
      commandRef,
      autoOpenAppArtifact,
      pendingMcpCitationsRef,
    ],
  );

  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  const startStreamCb = useCallback(
    async (params: CopilotSubmitParams): Promise<void> => {
      const { question, addHumanMessage = true, mockResponse } = params;
      copilot.setIsTyping(false);

      const { sent, hasPending } = partitionFilesOnSend(
        useStreamingStore.getState().files,
      );
      if (hasPending) {
        toast.info("Wait for the file upload to finish");
        return;
      }

      // Attached files move onto the message they are sent with.
      const sentFiles = addHumanMessage ? sent : [];
      const clearSentFiles = sentFiles.length
        ? {
            files: (prev: CopilotFile[]) =>
              prev.filter((file) => file.status === "failed"),
          }
        : {};

      if (mockResponse) {
        // Add the human message if needed
        if (addHumanMessage) {
          copilot.addMessage({
            role: "human",
            content: question || commandRef.current,
            copilotId: copilot.selectedCopilot.id,
            timestamp: Date.now(),
            ...(sentFiles.length ? { files: sentFiles } : {}),
          });
        }

        let content =
          typeof mockResponse === "string" ? mockResponse : mockResponse.messageContent;

        // Add the artifact if it exists
        if (typeof mockResponse === "object" && mockResponse.artifact) {
          copilot.addArtifactToCurrentChat(mockResponse.artifact);
          // Add artifact marker to content
          const artifactName = mockResponse.artifact.name || mockResponse.artifact.uuid;
          const artifactMarker = `<artifact className="${artifactName}"/>`;
          content = `${content}\n${artifactMarker}`;
        }

        // Add the mock AI response
        copilot.addMessage({
          role: "ai",
          content: content,
          copilotId: copilot.selectedCopilot.id,
          timestamp: Date.now() + 1,
          citations:
            typeof mockResponse === "object" ? mockResponse.citations : undefined,
        });

        // Reset state
        dispatch(
          { ...ResetState, ...StreamingStatus.NOT_STARTED, ...clearSentFiles },
          setStreamedData,
          setStreamedCitations,
        );
        dispatchCopilotCommand("");

        // Resolve the promise for mock responses
        if (resolveStreamRef.current) {
          resolveStreamRef.current();
          resolveStreamRef.current = null;
        }

        return;
      }

      if (queriesLeft === 0) {
        dispatch({ limitReached: true });
        return;
      }

      if (streamingStatus === "streaming-ready") {
        // Ensure that previous requests are aborted and state is reset
        const newState = { ...ResetState } as Partial<StreamingState>;
        if (abortController) {
          abortController.abort();
          newState.abortController = null;
        }
        dispatch(newState, setStreamedData, setStreamedCitations);
      }
      if (streamingStatus === "streaming-stopped") return stopSubmit();

      const incomingMessage = question || commandRef.current;

      if (addHumanMessage)
        copilot.addMessage({
          role: "human" as const,
          content: incomingMessage,
          copilotId: copilot.selectedCopilot.id,
          timestamp: Date.now(),
          ...(sentFiles.length ? { files: sentFiles } : {}),
        });

      const newAbortController = new AbortController();

      // Clear previous data
      dispatch(
        {
          ...ResetState,
          loading: true,
          abortController: newAbortController,
          ...clearSentFiles,
        },
        setStreamedData,
        setStreamedCitations,
      );
      dispatchCopilotCommand("");

      const { queryUrl, init } = await getQueryFetchParams({
        // Reverse non-breaking space/hyphen from message
        incomingMessage: incomingMessage
          .replace(/\u00A0/g, " ")
          .replace(/\u2011/g, "-"),
        abortSignal: newAbortController.signal,
      });
      const response = await fetch(queryUrl, init);
      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error(`[copilot] ${response.status} ${queryUrl}:`, errBody);
        throw new Error(response.statusText);
      }

      const traceId = response.headers.get("X-Trace-Id") || "";
      const completionId = response.headers.get("X-Completion-ID") || "";
      const xHeaders = { traceId, completionId };
      const reader = response.body?.getReader();
      if (!isReadableStream(reader)) throw new Error("Response body is not readable");
      return await processStream(
        xHeaders,
        reader,
        newAbortController.signal,
        incomingMessage,
      );
    },
    [
      commandRef,
      resolveStreamRef,
      processStream,
      copilot,
      limitReached,
      streamingStatus,
      abortController,
      getQueryFetchParams,
      dispatch,
      queriesLeft,
      stopSubmit,
      setStreamedData,
      setStreamedCitations,
    ],
  );

  const { mutateAsync } = useMutation<any, Error, CopilotSubmitParams>({
    mutationFn: startStreamCb,
    onSuccess: (_data, _question) => {},
    onError: (error) => throwError(error),
  });

  const throwError = useCallback(
    (error: any) => {
      if (typeof error === "string") {
        error = new Error(error);
      }
      if (error.name === "AbortError") {
        // Ignore errors related to user aborting the request
        return;
      }
      console.error("Error:", error);
      if (posthog) {
        posthog.capture("CRITICAL_COPILOT_MESSAGE", {
          copilot_critical_error: error.stack,
          copilot_critical_message: error.message,
        });
      }
      copilot.updateLastMessageError(true);
      dispatch({ loading: false, ...StreamingStatus.READY });
      dispatchCopilotCommand("");
    },
    [copilot.updateLastMessageError, dispatch],
  );

  const startStreamRef = useRef(mutateAsync);

  useEffect(() => {
    startStreamRef.current = mutateAsync;
  }, [mutateAsync]);

  const handleSubmit = useCallback(
    async ({ question, addHumanMessage, mockResponse }) => {
      // makes sure all widgets are visible before sending the question
      // otherwise dashboard data might be incomplete
      useThemeStore.getState().setPendingExport(true);

      // Create a promise that resolves when streaming is complete
      const streamComplete = new Promise<void>((resolve) => {
        resolveStreamRef.current = resolve;
      });

      await startStreamRef.current({ question, addHumanMessage, mockResponse });
      useThemeStore.getState().setPendingExport(false);

      return streamComplete;
    },
    [startStreamRef, resolveStreamRef],
  );

  return handleSubmit;
}

export function useHandleStreaming() {
  useStreamingHooks();
  const { handleSubmitRef, stopSubmitRef } = useCopilotContext();

  const { abortController, dispatch } = useShallowStreamingStore((s) => ({
    abortController: s.abortController,
    dispatch: s.dispatch,
  }));

  const [streamedData, setStreamedData] = useLocalStorage("streamedData", "");
  const [streamedCitations, setStreamedCitations] = useLocalStorage<CitationT[]>(
    "streamedCitations",
    [],
  );

  const { updateLastMessage } = useShallowCopilotStore((s) => ({
    updateLastMessage: s.updateLastMessage,
  }));

  const stopSubmit = useCallbackRef(() => {
    const newState = { ...ResetState } as any;
    if (abortController) {
      abortController.abort();
      newState.abortController = null;
    }

    const { selectedCopilot, addMessage, getCurrentChat } = useCopilotStore.getState();

    const { messages } = getCurrentChat();
    const lastMessage = messages[messages.length - 1];

    if (streamedData) {
      // Case 1: There is streamed AI content - update it with cancellation
      const updateData: Partial<AIMessage> = {
        content: streamedData,
        isCancelled: true,
      };
      // Include citations if they exist
      if (streamedCitations && streamedCitations.length > 0) {
        updateData.citations = streamedCitations;
      }
      updateLastMessage(updateData);
    } else if (lastMessage && lastMessage.role === "ai") {
      // Case 2: AI message exists but no streamed data yet - mark as cancelled
      const updateData: Partial<AIMessage> = { isCancelled: true };
      // Still include citations if they exist in localStorage
      if (streamedCitations && streamedCitations.length > 0) {
        updateData.citations = streamedCitations;
      }
      updateLastMessage(updateData);
    } else if (selectedCopilot) {
      // Case 3: No AI message exists yet, only system messages - create cancelled AI message
      const newMessage: AIMessage = {
        role: "ai",
        content: "",
        isCancelled: true,
        copilotId: selectedCopilot.id,
        timestamp: Date.now() + 1,
      };
      // Include citations if they exist
      if (streamedCitations && streamedCitations.length > 0) {
        newMessage.citations = streamedCitations;
      }
      addMessage(newMessage);
    }

    dispatch(newState, setStreamedData, setStreamedCitations);

    dispatchCopilotCommand("");
  });

  const handleSubmit = useStreamResponse(stopSubmit);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
    stopSubmitRef.current = stopSubmit;
    const ctrl = new AbortController();

    function dispatchedSubmit(e: CustomEvent) {
      handleSubmit(e.detail);
    }
    window.addEventListener("copilotSubmit", dispatchedSubmit, { signal: ctrl.signal });
    window.addEventListener("copilotStopSubmit", stopSubmit, { signal: ctrl.signal });
    return () => ctrl.abort();
  }, [handleSubmitRef, stopSubmitRef, handleSubmit, stopSubmit]);
}

export default useStreamResponse;

type HandleEventProps = {
  event: string;
  data?: any;
  question: string;
  accumulatedMessageData: string;
  accumulatedCitations: any[];
  abortSignal: AbortSignal;
  xHeaders: XHeadersT;
  keepAlive?: boolean;
  targetAgent?: Copilot;
};

type HandleFunctionCallProps = {
  functionCallSpec: FunctionCallT;
  incomingMessage: string;
  abortSignal: AbortSignal;
  xHeaders: XHeadersT;
  targetAgent?: Copilot;
};

function isReadableStream<T>(obj: any): obj is ReadableStreamDefaultReader<T> {
  return obj && typeof obj.read === "function";
}

function getLatestAiToolPairTimestamps(messages: Message[]): number[] | null {
  const lastToolIndex = messages.findLastIndex((message) => message.role === "tool");
  const toolMessage = messages[lastToolIndex];
  const previousMessage = messages[lastToolIndex - 1];
  if (previousMessage?.role === "ai") {
    try {
      // Check if the ai message is a function call
      const content = JSON.parse(previousMessage.content);
      if (content.function) return [previousMessage.timestamp, toolMessage.timestamp];
    } catch (_) {
      return null;
    }
  }
  return null;
}

// Helper to normalize extra_citations (add id/signature) into CitationT[]
function normalizeCitations(citations: any[]): CitationT[] {
  if (!Array.isArray(citations)) return [];
  return citations.map((c: any) => {
    if (c?.id && c?.signature !== undefined) return c as CitationT;
    return {
      id: c?.id || uuidv4(),
      signature: c?.signature || "",
      source_info: c?.source_info,
      details: c?.details,
      artifacts: c?.artifacts,
      quote_bounding_boxes: c?.quote_bounding_boxes,
    } as CitationT;
  });
}
