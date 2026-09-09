import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getWidgetMetadata, postWidgetMetadata } from "~/api/auth.api";
import type { WidgetJsonT, WidgetT } from "~/components/types";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { ensureString, uuidv4 } from "~/lib/utils";
import { clearWidgetBuilderStorage } from "../persistence";
import { useWidgetConfigContext } from "../WidgetConfigContext";

const optionalSourceKeys = ["sourceId", "sourceName", "isSharedWidget"];

function addSourceKeysToWidgetConfig(
  widgetConfig: Partial<WidgetJsonT | WidgetT>,
  source: WidgetJsonT | WidgetT,
) {
  for (const key of optionalSourceKeys) {
    if (source[key]) widgetConfig[key] = source[key];
  }
  return widgetConfig;
}

export function useWidgetActions() {
  const navigate = useNavigate();
  const addWidgetsToTabs = useShallowAppStore((state) => state.addWidgetsToTabs);
  const setWidgetMetadata = useShallowBackendConnectorStore(
    (state) => state.setWidgetMetadata,
  );

  const context = useWidgetConfigContext((s) => ({
    dispatch: s.dispatchFormState,
    getFormState: s.getFormState,
    setWidgetConfig: s.setWidgetConfig,
    getWidgetConfig: s.getWidgetConfig,
    getPreviewWidget: s.getPreviewWidget,
  }));

  const handleSaveWidget = useCallback(async () => {
    context.dispatch({ isSaving: true });
    const state = context.getFormState();
    try {
      const widgetId = uuidv4();
      const widgetType = "widget_studio";
      const widgetConfig = context.getWidgetConfig();
      const widgetMetadata = {
        name: widgetConfig.name,
        description: widgetConfig.description,
        category: widgetConfig.category,
        subCategory: widgetConfig.subCategory,
        source: ensureString(widgetConfig.source),
        widgetConfig: {
          type: widgetConfig.type,
          endpoint: {
            url: state.endpoint,
            method: "GET" as const,
            headers: widgetConfig.headers || {},
          },
          params: widgetConfig.params || [],
          runButton: widgetConfig.runButton,
          gridData: widgetConfig.gridData || {},
          data: {
            ...(widgetConfig.dataKey && { dataKey: widgetConfig.dataKey }),
            ...(widgetConfig.type === "live_grid" &&
              widgetConfig.wsEndpoint && {
                wsEndpoint: widgetConfig.wsEndpoint,
              }),
            ...(widgetConfig.type === "live_grid" &&
              widgetConfig.wsRowIdColumn && {
                wsRowIdColumn: widgetConfig.wsRowIdColumn,
              }),
            ...(widgetConfig.type === "table" && {
              table: {
                enableCharts: widgetConfig.enableCharts,
                showAll: widgetConfig.showAll,
                ...(widgetConfig.chartViewEnabled && {
                  chartView: {
                    enabled: widgetConfig.chartViewEnabled,
                    chartType: widgetConfig.chartType,
                  },
                }),
                ...(widgetConfig.columnsDefs?.length > 0 && {
                  columnsDefs: widgetConfig.columnsDefs.map((column) => ({
                    field: column.field,
                    headerName: column.headerName,
                    chartDataType: column.chartDataType,
                    cellDataType: column.cellDataType,
                    formatterFn: column.formatterFn,
                    ...(column.renderFn?.length > 0 && {
                      renderFn: column.renderFn,
                    }),
                    ...(column.width && { width: column.width }),
                    ...(column.minWidth && { minWidth: column.minWidth }),
                    ...(column.maxWidth && { maxWidth: column.maxWidth }),
                    ...(column.hide && { hide: column.hide }),
                    ...(column.pinned && { pinned: column.pinned }),
                  })),
                }),
              },
            }),
          },
          refetchInterval: widgetConfig.refetchInterval,
          ...(widgetConfig.dataUpdateDisplay && {
            dataUpdateDisplay: widgetConfig.dataUpdateDisplay,
          }),
          staleTime: widgetConfig.staleTime,
        },
        storage: {
          params:
            widgetConfig.params?.reduce(
              (acc, param) => {
                if (param.paramName) {
                  const value =
                    param.value !== undefined && param.value !== null
                      ? param.value
                      : "";
                  acc[param.paramName] = value;
                }
                return acc;
              },
              {} as Record<string, any>,
            ) || {},
        } as WidgetT,
      };

      addSourceKeysToWidgetConfig(widgetMetadata.widgetConfig, widgetConfig);

      const widgetToSave = { ...widgetMetadata, widgetId, widgetType } as const;
      console.log("Saving widget metadata:", widgetToSave);

      const result = await postWidgetMetadata(widgetToSave);

      if (!result.success) {
        throw new Error("Failed to save widget metadata");
      }

      const updatedMetadata = await getWidgetMetadata();
      console.log("Updated widget metadata:", updatedMetadata);
      setWidgetMetadata(updatedMetadata);

      toast.success("Widget saved successfully", {
        description: "Your custom widget has been saved and can now be used.",
      });

      clearWidgetBuilderStorage();
    } catch (error) {
      console.error("Error saving widget:", error);
      toast.error("Failed to save widget", {
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      context.dispatch({ isSaving: false });
    }
  }, [setWidgetMetadata, context]);

  const handleAddToDashboard = useCallback(
    async (dashboards: string[]) => {
      const state = context.getFormState();
      const previewWidget = context.getPreviewWidget();
      const widgetConfig = context.getWidgetConfig();
      const dashboardWidget = {
        ...previewWidget,
        id: uuidv4(),
        external: true,
        widgetId: previewWidget.widgetId,
        connectionType: "widgetMetadata" as const,
      } as WidgetJsonT;

      // Add source information to widgetConfig if this widget is based on an existing backend widget. this is so we can save the sourceId and sourceName into widget when adding to dashboard (to be used later if the backend is deleted)
      if (
        state.dataOrigin === "existing_widget" &&
        state.selectedBackend &&
        widgetConfig.sourceId &&
        widgetConfig.sourceName
      ) {
        dashboardWidget.widgetConfig = {
          ...dashboardWidget.widgetConfig,
          sourceId: widgetConfig.sourceId,
          sourceName: widgetConfig.sourceName,
        };
      }

      addSourceKeysToWidgetConfig(dashboardWidget, widgetConfig);

      await addWidgetsToTabs(dashboards, dashboardWidget);

      const toastOptions: any = {
        description: "Your custom widget has been successfully added",
      };

      if (dashboards.length === 1) {
        toastOptions.action = {
          label: "Go to Dashboard",
          onClick: () => navigate(`/app/${dashboards[0]}`),
        };
      }

      toast.success(
        `Widget added to ${dashboards.length} dashboard${dashboards.length > 1 ? "s" : ""}`,
        toastOptions,
      );
    },
    [context, addWidgetsToTabs, navigate],
  );

  return [handleSaveWidget, handleAddToDashboard] as const;
}
