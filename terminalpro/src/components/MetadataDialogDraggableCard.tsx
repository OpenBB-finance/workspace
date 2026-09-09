import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  getFileWidgets,
  getSingleWidgets,
  getWidgetMetadata,
  type PostFileWidget,
  type PostSingleWidget,
  patchWidgetMetadata,
  postFileWidget,
  postSingleWidget,
  postWidgetMetadata,
} from "~/api/auth.api";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import type SOURCES from "~/lib/sources.json";
import { useShallowAppStore } from "~/lib/state/app";
import {
  isMetadataType,
  useShallowBackendConnectorStore,
  type WidgetMetadataItem,
} from "~/lib/state/backendConnector";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  dispatchSaveState,
  dispatchUpdateWidget,
  isOmniType,
  isSSRMType,
  processWidgetId,
  triggerCustomEvent,
  useEventListener,
} from "~/lib/utils";
import { isQueryCodeWidget } from "~/lib/utils/widget";
import type { MetaDataWidgetType } from "~/types/auth.type";
import { handleWidgetMetadata, isDatabaseType } from "~/utils/dataConnectorsHelpers";
import { useGetWidgetsStore } from "./AI/hooks/useGetAppWidgets";
import { Button } from "./ds/atoms/Button";
import { Checkbox } from "./ds/atoms/Checkbox";
import { FormInput } from "./ds/atoms/Input";
import { FormTextarea } from "./ds/atoms/TextArea";
import { BaseDialog } from "./ds/dialogs/BaseDialog";
import { DialogDescription, DialogFooter, DialogTitle } from "./ds/dialogs/Dialog";
import { Form, FormField } from "./ds/molecules/Form";
import Icon from "./Icon";
import Tooltip from "./Tooltip";
import type { WidgetT } from "./types";
import { useWidgetContext } from "./Widget.context";
export type SourceKey = keyof typeof SOURCES;

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
  className?: string;
}

const metadataSchema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
});

export type MetadataForm = z.infer<typeof metadataSchema>;

export function MetadataDialog(props: Props) {
  const { open, setOpen, className } = props;
  const { setStoredFiles, setSingleWidgets, setWidgetMetadata } =
    useShallowBackendConnectorStore((state) => ({
      setStoredFiles: state.setStoredFiles,
      setWidgetMetadata: state.setWidgetMetadata,
      setSingleWidgets: state.setSingleWidgets,
    }));

  const copilot = useShallowCopilotDataStore((state) => ({
    addDataOnDashboardWidget: state.addDataOnDashboardWidget,
    dashboardWidgetsData: state.dashboardWidgetsData,
  }));

  const { getWidgetsByAttribute, storeUpdateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    storeUpdateWidget: s.updateWidget,
  }));

  const { widget, activeDashboardId, updateWidget } = useWidgetContext();
  const aiEnhancements = useShallowThemeStore((state) => state.aiEnhancements);

  const widgetInfo = useMemo(
    () => processWidgetId(widget.widgetId, widget.connectionType),
    [widget.widgetId, widget.connectionType],
  );
  const liveWidgetMetadata = useShallowBackendConnectorStore((state) =>
    state.getWidgetMetadataById(widgetInfo.uuid),
  );

  const metadata = useMemo(() => {
    if (widget.connectionType === "widgetMetadata") return liveWidgetMetadata;

    return handleWidgetMetadata<WidgetMetadataItem>(widget);
  }, [liveWidgetMetadata, widget.widgetId, widget.connectionType]);

  const { isSsrmAdvancedWidget, isSqlOrPythonQuery, aiMetadataFeatureEnabled } =
    useMemo(() => {
      const copilotConfig = getConfig().copilot;
      const aiMetadataFeatureEnabled =
        copilotConfig.enabled && copilotConfig.aiEnhancements && aiEnhancements;
      return {
        isSsrmAdvancedWidget: widget.type === "ssrm_advanced",
        isSqlOrPythonQuery: isQueryCodeWidget(widget.params),
        aiMetadataFeatureEnabled,
      };
    }, [aiEnhancements, widget.params]);

  const initialAutoUpdateMetadataOnRun = useMemo(() => {
    if (!isSsrmAdvancedWidget) return false;

    const widgetAutoUpdate = widget.storage?.autoUpdateMetadataOnRun;
    const metadataAutoUpdate = metadata?.storage?.autoUpdateMetadataOnRun;

    if (typeof widgetAutoUpdate === "boolean") return widgetAutoUpdate;
    if (typeof metadataAutoUpdate === "boolean") return metadataAutoUpdate;

    return aiMetadataFeatureEnabled;
  }, [
    aiMetadataFeatureEnabled,
    isSsrmAdvancedWidget,
    metadata?.storage?.autoUpdateMetadataOnRun,
    widget.storage?.autoUpdateMetadataOnRun,
  ]);

  const [state, dispatch] = useStateReducer({
    isGeneratingMetadata: false,
    isQueryStale: false,
    pendingMetadataAfterRun: false,
    autoUpdateMetadataOnRun: initialAutoUpdateMetadataOnRun,
    isLoading: false,
  });

  const sourceValue = useMemo(() => {
    if (typeof widget?.source === "string") return widget.source;
    if (Array.isArray(widget?.source)) return widget.source.join(", ");
    return metadata?.source ?? "";
  }, [metadata?.source, widget?.source]);

  const form = useForm<MetadataForm>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      name: metadata?.name ?? widget?.name ?? "",
      description: metadata?.description ?? widget?.description ?? "",
      category: metadata?.category ?? widget?.category ?? "",
      subCategory: metadata?.subCategory ?? widget?.subCategory ?? "",
      source: sourceValue,
    },
  });

  // Track previous open state to only reset form when dialog opens, not on background changes
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (justOpened) {
      form.reset({
        name: metadata?.name ?? widget?.name ?? "",
        description: metadata?.description ?? widget?.description ?? "",
        category: metadata?.category ?? widget?.category ?? "",
        subCategory: metadata?.subCategory ?? widget?.subCategory ?? "",
        source: sourceValue,
      });
      dispatch({ autoUpdateMetadataOnRun: initialAutoUpdateMetadataOnRun });
      // Request current staleness state from the widget
      if (isSsrmAdvancedWidget) {
        triggerCustomEvent(`requestStaleState-${widget.id}`, true);
      }
    }
  }, [open]);

  const handleRunMetadataNow = useCallbackRef(() => {
    if (!isSsrmAdvancedWidget || state.isGeneratingMetadata) return;

    if (!aiMetadataFeatureEnabled) {
      toast.error("AI Enhancements Disabled", {
        description: "AI Enhancements must be enabled to run metadata update.",
      });
      return;
    }

    if (!isSqlOrPythonQuery) {
      toast.error("Unsupported Widget Type", {
        description: "Metadata update is only available for SQL/Python query widgets.",
      });
      return;
    }

    dispatch({ isGeneratingMetadata: true });

    if (state.isQueryStale) {
      dispatch({ pendingMetadataAfterRun: true });
      triggerCustomEvent(`runParams-${widget.id}`, true);
      return;
    }

    const currentValues = form.getValues();
    triggerCustomEvent(`runMetadataUpdate-${widget.id}`, {
      runMetadataUpdate: true,
      metadata: {
        name: currentValues.name,
        description: currentValues.description,
        category: currentValues.category,
        subCategory: currentValues.subCategory,
        source: currentValues.source,
      },
    });
  });

  const handleAutoUpdateMetadataOnRunChange = useCallback(
    (autoUpdateMetadataOnRun: boolean) => {
      dispatch({ autoUpdateMetadataOnRun });

      if (!isSsrmAdvancedWidget) return;

      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          autoUpdateMetadataOnRun,
        },
      }));
    },
    [isSsrmAdvancedWidget, updateWidget],
  );

  const handleMetadataUpdateComplete = useCallback(
    (detail: any) => {
      dispatch({ isGeneratingMetadata: false });
      if (detail?.success && detail.metadata) {
        form.setValue("name", detail.metadata.name || form.getValues("name"));
        form.setValue(
          "description",
          detail.metadata.description || form.getValues("description"),
        );
        form.setValue(
          "category",
          detail.metadata.category || form.getValues("category"),
        );
        form.setValue(
          "subCategory",
          detail.metadata.subCategory || form.getValues("subCategory"),
        );
      }
    },
    [form.setValue, form.getValues],
  );

  const handleStaleParams = useCallbackRef((detail: any) => {
    dispatch({ isQueryStale: Boolean(detail?.staleParams) });
  });

  const handleRunComplete = useCallbackRef((detail: any) => {
    if (!state.pendingMetadataAfterRun) return;

    if (!(detail?.requestSucceeded && detail?.hasData)) {
      dispatch({ pendingMetadataAfterRun: false, isGeneratingMetadata: false });

      if (detail?.requestSucceeded && detail?.hasData === false) {
        toast.error("No Query Results", {
          description:
            "Metadata update skipped because the latest run returned no data.",
        });
      }
      return;
    }

    dispatch({ pendingMetadataAfterRun: false });
    triggerCustomEvent(`runMetadataUpdate-${widget.id}`, {
      runMetadataUpdate: true,
      metadata: {
        name: form.getValues("name"),
        description: form.getValues("description"),
        category: form.getValues("category"),
        subCategory: form.getValues("subCategory"),
        source: form.getValues("source"),
      },
    });
  });

  useEventListener(`metadataUpdateComplete-${widget.id}`, handleMetadataUpdateComplete);
  useEventListener(`staleParams-${widget.id}`, handleStaleParams);
  useEventListener(`runComplete-${widget.id}`, handleRunComplete);

  const handleSubmit = useCallback(
    async (data: MetadataForm) => {
      dispatchSaveState();
      dispatch({ isLoading: true });
      const autoUpdateMetadataOnRun = state.autoUpdateMetadataOnRun;
      try {
        let updateOtherDashboardsWidgets = true; // we need this for when creating a metadata item from inside a dashboard. we cannot update all the other elements with widgetId because core widgets created from the search will have widgetId as iframe or rss_viewer or rich_note, so they would all be updated which is not what we want
        let updateCurrentWidgetOnly = false;
        const isDatabase = isDatabaseType(widget.connectionType);
        const widgetStorage = isSsrmAdvancedWidget
          ? {
              ...(widget.storage || {}),
              autoUpdateMetadataOnRun,
            }
          : widget.storage;
        if (isMetadataType(widget, metadata, "file")) {
          // Handle file widget update
          const cleanData = {
            stored_file_uuid: metadata?.uuid,
            originalFileName: metadata?.originalFileName,
            url: metadata?.url,
            extension: metadata?.extension,
            name: data.name,
            description: data.description,
            category: data.category,
            subCategory: data.subCategory,
            source: data.source,
            dataKey: metadata?.dataKey,
          } as PostFileWidget;

          const { status } = await postFileWidget(widgetInfo.uuid, cleanData);
          if (status !== 200) {
            throw new Error("Failed to update file widget");
          }

          // Update file widgets
          const fileWidgets = await getFileWidgets();
          setStoredFiles(fileWidgets);
        } else if (isMetadataType(widget, metadata, "single")) {
          const cleanData: PostSingleWidget = {
            name: data.name,
            description: data.description,
            category: data.category as PostSingleWidget["category"],
            subCategory: data.subCategory,
            source: data.source,
            endpoint: metadata?.endpoint,
            gridData: metadata?.gridData,
            data: metadata?.data,
            endpointHeaders: metadata?.endpointHeaders,
            dataKey: metadata?.dataKey,
          };

          const { status } = await postSingleWidget(widget.widgetId, cleanData);
          if (status !== 200) {
            toast.error("Something went wrong. Please try again.", {
              description: "Unknown error",
            });
            return;
          }
          const result = await getSingleWidgets();
          setSingleWidgets(result);
        } else {
          const widgetMetadata = {
            name: data.name,
            description: data.description,
            category: data.category,
            subCategory: data.subCategory,
            source: data.source,
            storage: widgetStorage,
          } as WidgetMetadataItem;

          if (metadata) {
            const result = await patchWidgetMetadata(widgetMetadata, widgetInfo.uuid);
            updateCurrentWidgetOnly =
              isSSRMType(widget.type) || isOmniType(widget.type);
            if (!result.success) {
              throw new Error("Failed to update widget metadata");
            }
          } else {
            updateOtherDashboardsWidgets = false;
            widgetMetadata.subCategory = undefined;
            const id = uuidv4();

            let widgetConfig: WidgetT | undefined;
            const { getAppWidget, getSqlWidget, getRunCodeWidget } =
              useGetWidgetsStore.getState();
            if (isSSRMType(widget.type)) {
              const sqlWidget = inSnowflakeNativeApp
                ? getSqlWidget()
                : getAppWidget(widget.widgetId, widget.sourceName);
              if (!sqlWidget) throw new Error("SQL widget not found");
              const query = widget.storage?.params?.query || "";
              widgetConfig = {
                ...sqlWidget,
                storage: {
                  params: { query },
                  ...(isSsrmAdvancedWidget && { autoUpdateMetadataOnRun }),
                },
              };
            } else if (isOmniType(widget.type)) {
              const omniWidget = inSnowflakeNativeApp
                ? getRunCodeWidget()
                : getAppWidget(widget.widgetId, widget.sourceName);
              if (!omniWidget) throw new Error("Omni widget not found");
              const prompt = widget.storage?.params?.prompt || "";
              widgetConfig = { ...omniWidget, storage: { params: { prompt } } };
            }

            if (widgetConfig) {
              widgetInfo.cleanWidgetId = "widget_studio";
              widgetMetadata.widgetConfig = {
                ...widgetConfig,
                id,
                name: data.name,
                description: data.description,
                widgetType: "widget_studio",
                connectionType: "widgetMetadata",
              };
            }
            // TODO: We should be getting the widgetType explicitly from the widget
            const widgetType = widgetInfo.cleanWidgetId as MetaDataWidgetType;
            const result = await postWidgetMetadata({
              ...widgetMetadata,
              widgetId: id,
              widgetType: widgetType,
              subCategory: data.subCategory,
            });
            updateWidget((prev) => ({
              ...prev,
              widgetId: `${widgetType}-${id}`,
              name: data.name,
              description: data.description,
              category: data.category,
              subCategory: data.subCategory,
              source: data.source as any,
              ...(isSsrmAdvancedWidget && {
                storage: {
                  ...prev.storage,
                  autoUpdateMetadataOnRun,
                },
              }),
            }));
            if (!result.success) {
              throw new Error("Failed to create widget metadata");
            }
          }
          const updatedMetadata = await getWidgetMetadata();
          setWidgetMetadata(updatedMetadata);
        }

        const updatedFields = {
          name: data.name,
          ...(!isDatabase && {
            description: data.description,
          }),
          category: data.category,
          subCategory: data.subCategory,
          source: data.source as any,
        };

        if (updateCurrentWidgetOnly)
          updateWidget((prev) => ({
            ...prev,
            ...updatedFields,
            ...(isSsrmAdvancedWidget && {
              storage: {
                ...prev.storage,
                autoUpdateMetadataOnRun,
              },
            }),
          }));

        if (updateOtherDashboardsWidgets && !updateCurrentWidgetOnly) {
          const selectedWidgets = getWidgetsByAttribute("widgetId", widget.widgetId);

          for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
            for (const w of widgets) {
              const updatedWidget = {
                ...w,
                ...updatedFields,
                ...(isSsrmAdvancedWidget && {
                  storage: {
                    ...w.storage,
                    autoUpdateMetadataOnRun,
                  },
                }),
              };

              if (activeDashboardId === dashId && w.innerTab === widget.innerTab) {
                dispatchUpdateWidget(w.id, updatedWidget);
                continue;
              }

              storeUpdateWidget(dashId, updatedWidget);
            }
          }
        }

        if (widget.id in copilot.dashboardWidgetsData) {
          const aiWidgetData = copilot.dashboardWidgetsData[widget.id];
          copilot.addDataOnDashboardWidget(widget.id, {
            ...aiWidgetData,
            title: data.name,
            description: data.description,
            metadata: {
              ...(aiWidgetData?.metadata || {}),
              source: data.source,
              category: data.category,
              description: data.description,
            },
          });
        }

        toast.success("Widget metadata updated successfully");
        setOpen(false);
      } catch (error) {
        toast.error("Update Error", {
          description: "An error occurred while updating widget metadata",
        });
      } finally {
        dispatch({ isLoading: false });
      }
    },
    [
      getWidgetsByAttribute,
      storeUpdateWidget,
      metadata,
      state.autoUpdateMetadataOnRun,
      isSsrmAdvancedWidget,
      setStoredFiles,
      setSingleWidgets,
      setWidgetMetadata,
      widget,
      setOpen,
    ],
  );

  if (!widget) return null;

  return (
    <BaseDialog
      open={open}
      onClose={() => setOpen(false)}
      focusOnOpen={false}
      className={className}
    >
      <DialogTitle>Edit widget metadata</DialogTitle>
      <DialogDescription>
        By editing the metadata, you will help OpenBB Copilot to better understand your
        widget.
      </DialogDescription>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col overflow-hidden flex-1 min-h-0"
        >
          <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-2 pr-1">
            {isSsrmAdvancedWidget && aiMetadataFeatureEnabled && (
              <div className="flex flex-col rounded-lg border border-general-border-primary overflow-hidden mb-2">
                <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-general-bg-secondary">
                  <span className="text-xs text-general-label-primary">
                    Update metadata based on query
                  </span>
                  <Tooltip message="Generate new metadata">
                    <Button
                      variant="outlined"
                      size="sm"
                      type="button"
                      disabled={
                        !isSqlOrPythonQuery ||
                        state.isLoading ||
                        state.isGeneratingMetadata
                      }
                      onClick={handleRunMetadataNow}
                      className="p-1.5"
                      aria-label="Generate new metadata"
                    >
                      {state.isGeneratingMetadata ? (
                        <Icon id="mdi-loading" className="size-4 animate-spin" />
                      ) : (
                        <Icon id="sparkles-icon" className="size-4" />
                      )}
                    </Button>
                  </Tooltip>
                </div>
                <div className="px-3 py-1.5 bg-general-bg-tertiary">
                  <Checkbox
                    id="auto-update-metadata-on-run-dialog"
                    label="Auto-update on run"
                    checked={state.autoUpdateMetadataOnRun}
                    disabled={!isSqlOrPythonQuery}
                    onCheckedChange={handleAutoUpdateMetadataOnRunChange}
                  />
                  {!isSqlOrPythonQuery && (
                    <p className="text-xs text-general-label-disabled mt-2">
                      Automatic metadata updates are only supported for SQL/Python query
                      widgets.
                    </p>
                  )}
                </div>
              </div>
            )}
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label="Name"
                  maxLength={50}
                  disabled={state.isGeneratingMetadata}
                  {...field}
                />
              )}
            />
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormTextarea
                  label={
                    <p>
                      Description
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  disabled={state.isGeneratingMetadata}
                  {...field}
                />
              )}
            />
            <FormField
              name="category"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label={
                    <p>
                      Category
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  disabled={state.isGeneratingMetadata}
                  {...field}
                />
              )}
            />
            <FormField
              name="subCategory"
              render={({ field }) => (
                <FormInput
                  label={
                    <p>
                      Sub Category
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  disabled={state.isGeneratingMetadata}
                  {...field}
                />
              )}
            />
            <FormField
              name="source"
              render={({ field }) => (
                <FormInput
                  maxLength={50}
                  label={
                    <p>
                      Source<span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  disabled={state.isGeneratingMetadata}
                  {...field}
                />
              )}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outlined"
              size="sm"
              type="button"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={state.isLoading}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </BaseDialog>
  );
}
