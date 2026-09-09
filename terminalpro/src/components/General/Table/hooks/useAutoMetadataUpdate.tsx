import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import {
  getWidgetMetadata,
  patchWidgetMetadata,
  postWidgetMetadata,
} from "~/api/auth.api";
import { getSSRRows } from "~/components/General/Table/utils";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { WIDGET_METADATA_CONNECTION_TYPE, WIDGET_STUDIO_TYPE } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { useShallowAuthStore } from "~/lib/state/auth";
import {
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  isUUID,
  processWidgetId,
  triggerCustomEvent,
  useEventListener,
} from "~/lib/utils";
import { isQueryCodeWidget } from "~/lib/utils/widget";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";

interface ManualMetadataSeed {
  name?: string;
  description?: string;
  category?: string;
  subCategory?: string;
  source?: string;
}

interface AIMetadataResponse {
  title?: string;
  description?: string;
  category?: string;
  subcategory?: string;
}

interface GenerateAIMetadataParams {
  rowData: Record<string, unknown>[];
  currentValues: {
    name: string;
    description?: string;
    category?: string;
    subCategory?: string;
    source?: string;
  };
  widget: WidgetT;
  query: string;
  userToken: string;
}

export interface AutoMetadataUpdateOptions {
  rowDataOverride?: Record<string, unknown>[];
}

async function generateAIMetadata({
  rowData,
  currentValues,
  widget,
  query,
  userToken,
}: GenerateAIMetadataParams): Promise<AIMetadataResponse | null> {
  let truncatedWidgetData: string;
  try {
    const widgetDataStr = JSON.stringify(rowData.slice(0, 5));
    truncatedWidgetData =
      widgetDataStr.length > 1000 ? widgetDataStr.slice(0, 1000) : widgetDataStr;
  } catch (error) {
    console.error("Failed to serialize widget data for AI metadata generation:", error);
    return null;
  }

  const params = widget.params?.map((param) => {
    const paramName = param.paramName || "";
    return {
      name: paramName,
      value: widget.storage?.params?.[paramName] ?? param.value ?? "",
      type: param.type,
      description: param.description,
    };
  });

  const aiPayload = {
    widget_generation_request: {
      widget_data: truncatedWidgetData,
      metadata: {
        name: currentValues.name,
        description: currentValues.description,
        type: widget.type,
        category: currentValues.category,
        subCategory: currentValues.subCategory,
        endpoint: widget.endpoint?.url,
        query,
        params: params || [],
      },
    },
  };

  const aiApiUrl = getConfig().urls.ai;
  const aiResponse = await fetch(`${aiApiUrl}/v1/generate/widget_info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify(aiPayload),
  });

  if (!aiResponse.ok) {
    console.error(
      `Failed to auto-update widget metadata: ${aiResponse.status} ${aiResponse.statusText}`,
    );
    return null;
  }

  const aiResult = (await aiResponse.json()) as AIMetadataResponse;
  const { title, description, category, subcategory } = aiResult;

  if (!(title || description || category || subcategory)) {
    return null;
  }

  return aiResult;
}

interface EnsureWidgetMetadataParams {
  widget: WidgetT;
  currentValues: {
    name: string;
    description?: string;
    category?: string;
    subCategory?: string;
    source?: string;
  };
  setWidgetMetadata: (metadata: WidgetMetadataItem[]) => void;
  updateWidget: (updater: (prev: WidgetT) => WidgetT) => void;
}

async function ensureWidgetMetadata({
  widget,
  currentValues,
  setWidgetMetadata,
  updateWidget,
}: EnsureWidgetMetadataParams): Promise<{
  metadata: WidgetMetadataItem;
  targetId: string;
} | null> {
  const widgetInfo = processWidgetId(widget.widgetId, widget.connectionType);
  const widgetIdLooksLikeUUID = Boolean(widgetInfo.uuid) && isUUID(widgetInfo.uuid);
  const fallbackId =
    widgetInfo.cleanWidgetId === WIDGET_STUDIO_TYPE || widgetIdLooksLikeUUID
      ? widgetInfo.uuid
      : undefined;

  const metadata = handleWidgetMetadata<WidgetMetadataItem>(widget);
  const targetId = metadata?.widgetId || fallbackId;

  if (!metadata) {
    const newId = targetId || uuidv4();
    const widgetConfig = {
      type: widget.type,
      endpoint: widget.endpoint,
      params: widget.params || [],
      runButton: widget.runButton,
      gridData: widget.gridData || {},
      data: widget.data || {},
      refetchInterval: widget.refetchInterval,
      staleTime: widget.staleTime,
      ...(widget.sourceId && { sourceId: widget.sourceId }),
      ...(widget.sourceName && { sourceName: widget.sourceName }),
      id: newId,
      name: currentValues.name,
      description: currentValues.description,
      widgetType: WIDGET_STUDIO_TYPE,
      connectionType: WIDGET_METADATA_CONNECTION_TYPE,
    };

    const widgetMetaData = {
      widgetId: newId,
      widgetType: WIDGET_STUDIO_TYPE,
      name: currentValues.name,
      description: currentValues.description || "",
      category: currentValues.category || "",
      subCategory: currentValues.subCategory || "",
      source: currentValues.source || "",
      storage: widget.storage,
      widgetConfig,
    } as WidgetMetadataItem;

    const createResult = await postWidgetMetadata(widgetMetaData);

    if (!createResult.success) return null;

    const allMetadata = await getWidgetMetadata();
    setWidgetMetadata(allMetadata);

    const updatedMetadata = Object.fromEntries(
      Object.entries(currentValues).filter(([, value]) => Boolean(value)),
    );

    updateWidget((prev) => ({
      ...prev,
      widgetId: `${WIDGET_STUDIO_TYPE}-${newId}`,
      ...updatedMetadata,
    }));

    return { metadata: widgetMetaData, targetId: newId };
  }

  if (!targetId) return null;

  return { metadata, targetId };
}

/**
 * Hook to handle automatic and manual metadata updates for SQL/Python query widgets.
 *
 * Automatically generates widget metadata (title, description, category, subcategory)
 * using AI when a query is executed, or allows manual triggering via the metadata dialog.
 */
export function useAutoMetadataUpdate(
  currentQueryRef: React.RefObject<string | null>,
  existingRowData?: Record<string, unknown>[],
) {
  const aiEnhancements = useShallowThemeStore((s) => s.aiEnhancements);
  const userToken = useShallowAuthStore((s) => s.user?.token);
  const setWidgetMetadata = useShallowBackendConnectorStore((s) => s.setWidgetMetadata);
  const { widget, getWidget, isPreview, updateWidget } = useWidgetContext();

  const { isQueryCode, aiMetadataFeatureEnabled, shouldAutoUpdateMetadataOnRun } =
    useMemo(() => {
      const isQueryCode = isQueryCodeWidget(widget.params);
      const copilotConfig = getConfig().copilot;
      const aiMetadataFeatureEnabled =
        aiEnhancements && copilotConfig.enabled && copilotConfig.aiEnhancements;
      const shouldAutoUpdateMetadataOnRun =
        !isPreview &&
        isQueryCode &&
        (widget.storage?.autoUpdateMetadataOnRun ?? aiMetadataFeatureEnabled) &&
        aiMetadataFeatureEnabled;

      return { isQueryCode, aiMetadataFeatureEnabled, shouldAutoUpdateMetadataOnRun };
    }, [
      aiEnhancements,
      isPreview,
      widget.params,
      widget.storage?.autoUpdateMetadataOnRun,
    ]);

  const inFlightRef = useRef(false);
  const lastUpdatedQueryRef = useRef<string | null>(null);

  const runMetadataUpdate = useCallback(
    async (
      isManual: boolean,
      seed?: ManualMetadataSeed | null,
      options?: AutoMetadataUpdateOptions,
    ) => {
      if (inFlightRef.current) return;

      const canUpdate =
        shouldAutoUpdateMetadataOnRun ||
        (isManual && !isPreview && aiMetadataFeatureEnabled && isQueryCode);

      if (!canUpdate) return;

      if (!userToken) {
        if (isManual) {
          toast.error("Authentication Required", {
            description: "You need to be authenticated to run metadata update.",
          });
        }
        return;
      }

      const query = (currentQueryRef.current || "").trim();
      if (!query) {
        if (isManual)
          toast.error("Invalid Query", {
            description:
              "Query is empty. Enter a query before running metadata update.",
          });

        return;
      }

      if (!isManual && query === lastUpdatedQueryRef.current) return;

      inFlightRef.current = true;
      const widget = getWidget();

      try {
        const source = seed?.source?.trim()
          ? seed.source.trim()
          : Array.isArray(widget.source)
            ? widget.source.join(", ")
            : widget.source;
        const currentValues = {
          name: seed?.name?.trim() || widget.name || "Untitled Widget",
          description: seed?.description?.trim() || widget.description,
          category: seed?.category?.trim() || widget.category,
          subCategory: seed?.subCategory?.trim() || widget.subCategory,
          source,
        };

        let rowData =
          Array.isArray(options?.rowDataOverride) && options.rowDataOverride.length > 0
            ? options.rowDataOverride
            : [];

        if (rowData.length === 0) {
          const requestParams = Object.entries(widget.storage?.params || {}).reduce(
            (acc, [key, value]) => {
              if (key === "query" || value === undefined || value === null) return acc;
              acc[key] = String(value);
              return acc;
            },
            {} as Record<string, string>,
          );

          const response = await getSSRRows(widget.endpoint, requestParams, {
            startRow: 0,
            endRow: 500,
            query,
          });

          const latestRows = response?.rowData;
          rowData =
            Array.isArray(latestRows) && latestRows.length > 0 ? latestRows : [];
        }

        if (
          rowData.length === 0 &&
          Array.isArray(existingRowData) &&
          existingRowData.length > 0 &&
          (isManual || options?.rowDataOverride)
        ) {
          rowData = existingRowData;
        }

        if (rowData.length === 0) {
          if (isManual) {
            toast.error("No Query Results", {
              description: "No query results available to generate metadata.",
            });
          }
          return;
        }

        // Ensure widget metadata exists (create if needed)
        const metadataResult = await ensureWidgetMetadata({
          widget,
          currentValues,
          setWidgetMetadata,
          updateWidget,
        });

        if (!metadataResult) {
          if (isManual) {
            toast.error("Metadata Error", {
              description:
                "An error occurred while trying to create or find widget metadata.",
            });
          }
          return;
        }

        const { metadata, targetId } = metadataResult;

        // Call AI to generate metadata
        const aiResult = await generateAIMetadata({
          rowData,
          currentValues,
          widget,
          query,
          userToken,
        });

        if (!aiResult) {
          if (isManual) {
            triggerCustomEvent(`metadataUpdateComplete-${widget.id}`, {
              success: false,
              error: "Failed to generate metadata with AI.",
            });
            toast.error("AI Metadata Error", {
              description: "Failed to generate metadata with AI.",
            });
          }
          return;
        }

        const { title, description, category, subcategory } = aiResult;
        const updatedMetaData = Object.fromEntries(
          Object.entries({
            name: title?.trim() || currentValues.name,
            description: description?.trim() || currentValues.description,
            category: category?.trim() || currentValues.category,
            subCategory: subcategory?.trim() || currentValues.subCategory,
            source: currentValues.source,
          }).filter(([, value]) => Boolean(value)),
        );

        // Save generated metadata
        const patchResult = await patchWidgetMetadata(
          {
            ...metadata,
            name: currentValues.name || metadata.name || "Untitled Widget",
            ...updatedMetaData,
            storage: widget.storage,
          },
          targetId,
        );

        if (!patchResult.success) {
          console.error("Failed to patch widget metadata after AI generation.");
          if (isManual) {
            triggerCustomEvent(`metadataUpdateComplete-${widget.id}`, {
              success: false,
              error: patchResult.message || "Failed to save generated metadata.",
            });
            toast.error("Failed to save generated metadata.", {
              description: patchResult.message || undefined,
            });
          }
          return;
        }

        const updatedMetadata = await getWidgetMetadata();
        setWidgetMetadata(updatedMetadata);

        updateWidget((prev) => ({ ...prev, ...updatedMetaData }));

        lastUpdatedQueryRef.current = query;
        if (isManual) {
          triggerCustomEvent(`metadataUpdateComplete-${widget.id}`, {
            success: true,
            metadata: updatedMetaData,
          });
          toast.success("Widget Metadata Updated", {
            description:
              "Successfully updated widget metadata with AI-generated values.",
          });
        }
      } catch (error) {
        console.error("Error auto-updating widget metadata on query run:", error);
        const apiError = error as {
          response?: {
            data?: { detail?: string | unknown[]; message?: string };
            status?: number;
          };
          message?: string;
        };
        const detail =
          typeof apiError?.response?.data?.detail === "string"
            ? apiError.response.data.detail
            : JSON.stringify(apiError?.response?.data?.detail) ||
              apiError?.response?.data?.message ||
              apiError?.message;
        if (isManual) {
          triggerCustomEvent(`metadataUpdateComplete-${widget.id}`, {
            success: false,
            error: detail,
          });
          toast.error("Error updating widget metadata.", {
            description: detail,
          });
        }
      } finally {
        inFlightRef.current = false;
      }
    },
    [
      shouldAutoUpdateMetadataOnRun,
      isPreview,
      aiMetadataFeatureEnabled,
      isQueryCode,
      userToken,
      existingRowData,
      currentQueryRef,
      setWidgetMetadata,
      updateWidget,
      getWidget,
    ],
  );

  // Listen for manual metadata update events from the dialog
  useEventListener(`runMetadataUpdate-${widget.id}`, (detail) => {
    if (isPreview) return;

    if (!aiMetadataFeatureEnabled) {
      toast.error("AI Enhancements Disabled", {
        description: "AI Enhancements must be enabled to run metadata update.",
      });
      return;
    }

    if (!isQueryCode) {
      toast.error("Unsupported Widget Type", {
        description: "Metadata update is only available for SQL/Python query widgets.",
      });
      return;
    }

    void runMetadataUpdate(true, detail?.metadata);
  });

  const triggerMetadataUpdate = useCallback(
    (options?: AutoMetadataUpdateOptions) => {
      if (shouldAutoUpdateMetadataOnRun) {
        void runMetadataUpdate(false, undefined, options);
      }
    },
    [runMetadataUpdate, shouldAutoUpdateMetadataOnRun],
  );

  return triggerMetadataUpdate;
}
