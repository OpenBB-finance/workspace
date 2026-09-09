import DOMPurify from "dompurify";
import { usePostHog } from "posthog-js/react";
import { useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { createMetaDataWidget } from "~/api/auth.api";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useCopilotStore, useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import { generateRandomName } from "~/lib/utils";
import { HTML_SANITIZE_CONFIG } from "~/lib/utils/sanitize";
import { scrollToAndHighlightWidget } from "~/lib/utils/widgetHighlight";
import type { WidgetJsonT, WidgetT } from "../../types";
import {
  applyChartViewToWidget,
  buildChartColumnDefs,
  createConversationContextPayload,
  getFallbackName,
  removeCitationsFromText,
  sanitizeTableContent,
} from "./createWidgetUtils";
import { useGetWidgetsStore } from "./useGetAppWidgets";

const aiCopilotAiEnhancementsFF =
  getConfig().copilot.enabled && getConfig().copilot.aiEnhancements;

export type CreateWidgetParams =
  | {
      widgetType: "text" | "ssrm_advanced";
      content: string;
      metadata?: {
        uuid?: string;
        name?: string;
        description?: string;
        [key: string]: any;
      };
    }
  | {
      widgetType: "html" | "run_code";
      content: string;
      metadata?: {
        uuid?: string;
        name?: string;
        description?: string;
        [key: string]: any;
      };
    }
  | {
      widgetType: "table" | "chart";
      content: object[];
      metadata: Record<string, unknown> | null;
    };

async function handleCreateMetaDataWidget(widget: WidgetJsonT | WidgetT) {
  const widgetId = await createMetaDataWidget(widget);
  if (widgetId) widget.widgetId = widgetId;
  widget.connectionType = "widgetMetadata";
  return widget;
}

export function useCreateWidgetFromArtifact() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();
  const abortControllerRef = useRef<AbortController | null>(null);

  const userToken = useShallowAuthStore((s) => s.user?.token);
  const { addWidget, addTab } = useShallowAppStore((s) => ({
    addWidget: s.addWidget,
    addTab: s.addTab,
  }));

  const aiEnhancementsEnabled = useShallowThemeStore(
    (state) => state.aiEnhancements && aiCopilotAiEnhancementsFF,
  );

  const {
    getRecentConversationContext,
    getRelatedArtifacts,
    getCurrentChat,
    setCreateWidgetMetadataDialog,
  } = useShallowCopilotStore((s) => ({
    getRecentConversationContext: s.getRecentConversationContext,
    getRelatedArtifacts: s.getRelatedArtifacts,
    getCurrentChat: s.getCurrentChat,
    setCreateWidgetMetadataDialog: s.setCreateWidgetMetadataDialog,
  }));

  const { selectedWidgets } = useShallowCopilotDataStore((s) => ({
    selectedWidgets: s.copilotWidgets.selectedWidgets,
  }));

  const lastInnerTab = useShallowAppStore((state) => state?.getLastInnerTab(id));
  const innerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const getConversationContext = useCallback(() => {
    const currentChat = getCurrentChat();
    const recentMessages = getRecentConversationContext(5);
    const relatedArtifacts = getRelatedArtifacts(3);

    const recentContent = recentMessages
      .slice()
      .reverse()
      .find((msg) => msg.role === "human")?.content;

    const chatContent = currentChat.messages
      .slice()
      .reverse()
      .find((msg) => msg.role === "human")?.content;

    const userPrompt = recentContent || chatContent || "";

    return createConversationContextPayload(
      userPrompt,
      recentMessages,
      selectedWidgets,
      relatedArtifacts,
    );
  }, [
    getCurrentChat,
    getRecentConversationContext,
    getRelatedArtifacts,
    selectedWidgets,
  ]);

  const fetchWidgetInfo = useCallback(
    async (params: CreateWidgetParams, signal?: AbortSignal) => {
      const { widgetType, content, metadata } = params;
      const { uuid: _, name, description, ...rest } = metadata ?? {};

      const conversationContext = getConversationContext();

      const requestPayload = {
        widget_generation_request: {
          name: name,
          description: description,
          widget_data: widgetType !== "text" ? JSON.stringify(content) : content,
          metadata: rest ?? undefined,
          conversation_context: conversationContext,
        },
      };

      const response = await fetch(`${getConfig().urls.ai}/v1/generate/widget_info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userToken}`,
        } as HeadersInit,
        body: JSON.stringify(requestPayload),
        signal,
      });

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}`);
      }

      return await response.json();
    },
    [userToken, getConversationContext],
  );

  const widgetCreation = useCallback(
    async (widget: WidgetJsonT | WidgetT) => {
      const newWidget = await handleCreateMetaDataWidget(widget);
      if (id) {
        const widgetUuid = await addWidget(id, newWidget);
        return { widgetUuid, widgetId: newWidget.widgetId };
      }

      const tabId = uuidv4();
      addTab({
        index: tabId,
        data: {
          name: generateRandomName(),
          type: "custom",
          widgets: [newWidget],
        },
      });
      setTimeout(() => navigate(`/app/${tabId}`));

      return { widgetUuid: newWidget.id, widgetId: newWidget.widgetId };
    },
    [addWidget, addTab, id, navigate],
  );

  const createWidgetFromParams = useCallback(
    async (
      params: CreateWidgetParams,
      widgetInfo: { name: string; description: string },
    ): Promise<{ widgetUuid: string; widgetId: string } | null> => {
      const { widgetType, content, metadata = {} } = params;
      const { name: widgetName, description: widgetDescription } = widgetInfo;

      const widgetUuid = uuidv4();
      const widget = {
        id: widgetUuid,
        name: widgetName,
        description: widgetDescription,
        innerTab,
        gridData: { w: 40, h: 12 },
        category: "Others",
        subCategory: "",
        source: "",
        external: false,
      } as WidgetJsonT;

      const logEvent = { ...widgetInfo } as Record<string, any>;

      try {
        if (widgetType === "table" || widgetType === "chart") {
          if (!Array.isArray(content)) {
            throw new Error("Invalid data format for widget creation");
          }

          const sanitizedContent = sanitizeTableContent(content);

          widget.widgetId = `copilot_table-${widgetUuid}`;
          widget.data = {
            table: {
              showAll: true,
              enableCharts: true,
              chartView: { chartType: "line" },
            },
          };

          if (widgetType === "table") {
            const columns = sanitizedContent[0] ? Object.keys(sanitizedContent[0]) : [];
            widget.storage = { rowsData: sanitizedContent, columns };
            Object.assign(logEvent, { event_name: "created_copilot_table_widget" });
            return await widgetCreation(widget);
          }

          if (widgetType === "chart") {
            const chartMeta = metadata as Record<string, unknown> | null;
            const { xKey, yKey, chartType, angleKey, calloutLabelKey } = (chartMeta ??
              {}) as {
              xKey?: string;
              yKey?: string[];
              chartType?: string;
              angleKey?: string;
              calloutLabelKey?: string;
            };
            const columnDefs = buildChartColumnDefs({
              xKey,
              yKey,
              chartType,
              angleKey,
              calloutLabelKey,
            });

            Object.assign(
              widget,
              applyChartViewToWidget(widget, { enabled: true, chartType }),
            );
            widget.storage = {
              ...widget.storage,
              rowsData: sanitizedContent,
              columnDefs,
            };

            Object.assign(logEvent, { event_name: "created_copilot_table_widget" });
            return await widgetCreation(widget);
          }
        }

        if (widgetType === "text") {
          const contentStr = typeof content === "string" ? content : "";
          const html = removeCitationsFromText(contentStr);

          widget.widgetId = `rich_note-${widgetUuid}`;
          widget.storage = { html };

          Object.assign(logEvent, { event_name: "created_copilot_text_note" });

          return await widgetCreation(widget);
        }

        if (widgetType === "ssrm_advanced") {
          const query = typeof content === "string" ? content : "";
          const sqlWidget = useGetWidgetsStore.getState().getSqlWidget();
          if (!sqlWidget) throw new Error("SQL Builder widget not found");

          const widgetConfig = { ...sqlWidget, storage: { params: { query } } };

          const newWidget = {
            ...widgetConfig,
            id: widgetUuid,
            name: widgetName,
            description: widgetDescription,
            widgetType: "widget_studio",
            connectionType: "widgetMetadata",
            innerTab,
          } as WidgetT;

          newWidget.widgetId = `widget_studio-${widgetUuid}`;

          Object.assign(logEvent, {
            event_name: "created_copilot_ssrm_advanced_widget",
          });

          return await widgetCreation(newWidget);
        }

        if (widgetType === "run_code") {
          const { widgetId, sourceName } = metadata ?? {};
          const runCodeWidget = useGetWidgetsStore
            .getState()
            .getAppWidget(widgetId, sourceName);
          const prompt = typeof content === "string" ? content : "";
          if (!runCodeWidget) throw new Error("Run Code widget not found");
          const newWidget = {
            ...runCodeWidget,
            id: widgetUuid,
            name: widgetName,
            description: widgetDescription,
            widgetType: "widget_studio",
            connectionType: "widgetMetadata",
            innerTab,
            storage: { params: { prompt } },
          } as WidgetT;

          newWidget.widgetId = `widget_studio-${widgetUuid}`;

          Object.assign(logEvent, {
            event_name: "created_copilot_run_code_widget",
          });

          return await widgetCreation(newWidget);
        }

        if (widgetType === "html") {
          const contentStr = typeof content === "string" ? content : "";

          widget.widgetId = `html-${widgetUuid}`;
          widget.storage = {
            html: DOMPurify.sanitize(contentStr, {
              ...HTML_SANITIZE_CONFIG,
              WHOLE_DOCUMENT: true,
            }),
          };

          Object.assign(logEvent, {
            event_name: "created_copilot_html_widget",
          });
          return await widgetCreation(widget);
        }
        throw new Error("Invalid widget type");
      } finally {
        if (posthog && logEvent?.event_name) {
          const { event_name, ...properties } = logEvent;
          posthog.capture(event_name, properties);
        }
      }
    },
    [id, innerTab, posthog, widgetCreation],
  );

  const createWidget = useCallback(
    async (params: CreateWidgetParams) => {
      const { widgetType, metadata } = params;
      const fallbackName = getFallbackName(widgetType);
      const existingName =
        typeof metadata?.name === "string" ? metadata.name : undefined;
      const existingDescription =
        typeof metadata?.description === "string" ? metadata.description : undefined;

      abortControllerRef.current = new AbortController();
      const toastId = toast.loading(`Creating ${widgetType} widget...`, {
        style: { pointerEvents: "auto" },
        cancel: {
          label: "Edit metadata",
          onClick: () => {
            abortControllerRef.current?.abort();
            toast.dismiss(toastId);
            setCreateWidgetMetadataDialog({
              mode: "create",
              initialValues: {
                name: existingName || "",
                description: existingDescription || "",
              },
              pendingParams: params as unknown as Record<string, unknown>,
            });
          },
        },
      });

      try {
        let widgetName: string = existingName || fallbackName;
        let widgetDescription: string = existingDescription || fallbackName;

        // Only fetch AI-generated info if AI enhancements are enabled
        if (aiEnhancementsEnabled) {
          try {
            const aiInfo = await fetchWidgetInfo(
              params,
              abortControllerRef.current.signal,
            );
            if (aiInfo?.title) widgetName = aiInfo.title;
            if (aiInfo?.description) widgetDescription = aiInfo.description;
          } catch (error) {
            // If aborted, don't continue - the user clicked "Edit metadata"
            if (error instanceof Error && error.name === "AbortError") {
              return;
            }
            console.warn("Failed to fetch AI widget info, using fallback:", error);
          }
        }

        const result = await createWidgetFromParams(params, {
          name: widgetName,
          description: widgetDescription,
        });

        const copilotStore = useCopilotStore.getState();
        const isFullscreen = copilotStore.isFullscreen;

        const widgetUuid = result?.widgetUuid;
        const widgetId = result?.widgetId;

        toast.success(widgetName, {
          id: toastId,
          description:
            widgetDescription && widgetDescription !== widgetName ? (
              <div className="mb-2">{widgetDescription}</div>
            ) : undefined,
          style: { pointerEvents: "auto" },
          cancel: {
            label: "Edit metadata",
            onClick: () => {
              if (!(widgetUuid && widgetId)) return;
              setCreateWidgetMetadataDialog({
                mode: "update",
                initialValues: {
                  name: widgetName,
                  description: widgetDescription,
                },
                widgetId,
                widgetUuid,
                dashboardId: id,
              });
            },
          },
          ...(isFullscreen &&
            widgetUuid && {
              action: {
                label: "Show Widget",
                onClick: async () => {
                  const needsLayoutWait = copilotStore.isFullscreen;
                  if (needsLayoutWait) {
                    copilotStore.toggleFullscreen();
                  }
                  await scrollToAndHighlightWidget(widgetUuid, {
                    waitForLayout: needsLayoutWait,
                  });
                },
              },
            }),
        });
      } catch (err: unknown) {
        // Don't show error if aborted (user clicked "Edit metadata")
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const errorMessage = err instanceof Error ? err.message : "An error occurred";
        toast.error("Failed to create widget", {
          id: toastId,
          description: errorMessage,
        });
      }
    },
    [
      aiEnhancementsEnabled,
      fetchWidgetInfo,
      createWidgetFromParams,
      setCreateWidgetMetadataDialog,
      id,
    ],
  );

  // Expose createWidgetFromParams for the metadata dialog to use
  const createWidgetWithMetadata = useCallback(
    async (
      params: CreateWidgetParams,
      metadata: { name: string; description: string },
    ) => {
      const toastId = toast.loading("Creating widget...");
      try {
        const result = await createWidgetFromParams(params, metadata);
        const widgetUuid = result?.widgetUuid;
        const widgetId = result?.widgetId;

        toast.success(`Created: ${metadata.name}`, {
          id: toastId,
          description: metadata.description ? (
            <div className="mb-2">{metadata.description}</div>
          ) : undefined,
          style: { pointerEvents: "auto" },
          cancel: {
            label: "Edit metadata",
            onClick: () => {
              if (!(widgetUuid && widgetId)) return;
              setCreateWidgetMetadataDialog({
                mode: "update",
                initialValues: {
                  name: metadata.name,
                  description: metadata.description,
                },
                widgetId,
                widgetUuid,
                dashboardId: id,
              });
            },
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "An error occurred";
        toast.error("Failed to create widget", {
          id: toastId,
          description: errorMessage,
        });
        throw error;
      }
    },
    [createWidgetFromParams, id, setCreateWidgetMetadataDialog],
  );

  return { createWidget, createWidgetWithMetadata };
}
