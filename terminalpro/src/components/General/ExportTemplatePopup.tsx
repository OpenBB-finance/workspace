import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import { type TabData, useShallowAppStore } from "~/lib/state/app";
import {
  type BackendTemplate,
  useBackendConnectorStore,
  useShallowBackendConnectorStore,
} from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import type { TabLayout } from "~/lib/templates";
import { createParamDefs, slugify } from "~/lib/utils";
import { extractCustomTemplateInfo } from "~/lib/utils/createTemplates";
import { useGetWidgetsStore } from "../AI/hooks/useGetAppWidgets";
import { getParamsOrder } from "../DataConnectors/common/helpers";
import { Button } from "../ds/atoms/Button";
import { DialogFooter } from "../ds/dialogs/Dialog";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { AppDialogShell } from "./AppDialog/AppDialogShell";
import {
  type AppMetadataForm,
  appMetadataObjectSchema,
  trimPrompts,
} from "./AppDialog/schema";
import { getSeriesType } from "./Table/Chart/utils";
import { getStateStorage } from "./Table/hooks/useUpdateColumnState";
import { isTruthy } from "./Table/utils";

export default function ExportTemplatePopup() {
  const { exportTemplatePopup, setExportTemplatePopup } = useShallowThemeStore(
    (state) => ({
      exportTemplatePopup: state.exportTemplatePopup,
      setExportTemplatePopup: state.setExportTemplatePopup,
    }),
  );
  const getSourceById = useShallowBackendConnectorStore(
    (state) => state.getApiSourceById,
  );

  const { id: activeDashboardId } = useParams();
  const getDashboardById = useShallowAppStore((state) => state.getTabById);

  const currentDashboardData = exportTemplatePopup
    ? getDashboardById(activeDashboardId)?.data
    : null;

  const form = useForm<AppMetadataForm>({
    resolver: zodResolver(appMetadataObjectSchema),
    defaultValues: {
      name: "",
      description: "",
      imageUrl: "",
      prompts: [],
    },
  });

  const { replace } = useFieldArray({
    control: form.control,
    name: "prompts",
  });

  useEffect(() => {
    if (!currentDashboardData) {
      form.reset({ name: "", description: "", imageUrl: "", prompts: [] });
      replace([]);
      return;
    }

    const sourceInfo = extractCustomTemplateInfo(currentDashboardData?.templateId);
    if (sourceInfo?.sourceId && sourceInfo?.templateName) {
      const { sourceId, templateName } = sourceInfo;
      const template = getSourceById(sourceId)?.templates?.find(
        (t) => slugify(t.name) === templateName,
      );

      form.reset({
        name: template?.name || "",
        description: template?.description || "",
        imageUrl: template?.img || "",
        prompts: [],
      });
      replace((template?.prompts ?? []).map((value) => ({ value })));
    } else {
      form.reset({ name: "", description: "", imageUrl: "", prompts: [] });
      replace([]);
    }
  }, [!!currentDashboardData]);

  const onSubmit = useCallback(
    (data: AppMetadataForm) => {
      if (!currentDashboardData) {
        toast.error("No dashboard data available to create a template.");
        return;
      }

      const formattedData = formatDashboardDataForTemplate(currentDashboardData, data);
      saveTemplate(formattedData);
      setExportTemplatePopup(false);
    },
    [currentDashboardData, setExportTemplatePopup],
  );

  const handleCopyToClipboard = useCallback(
    async (event: ReactMouseEvent) => {
      event.preventDefault();

      const isValid = await form.trigger();
      if (!isValid) return;

      const formData = form.getValues();
      if (!currentDashboardData) {
        toast.error("No dashboard data available to create a template.");
        return;
      }

      const formattedData = formatDashboardDataForTemplate(
        currentDashboardData,
        formData,
      );
      const jsonData = JSON.stringify(formattedData, null, 2);

      try {
        await navigator.clipboard.writeText(jsonData);
        toast.success("App copied to clipboard!");
        setExportTemplatePopup(false);
      } catch (error) {
        console.error("Failed to copy app to clipboard:", error);
        toast.error("Failed to copy app to clipboard");
      }
    },
    [currentDashboardData, form, setExportTemplatePopup],
  );

  const previewWidgets = useMemo<AppTemplate["widgets"]>(
    () => (currentDashboardData?.widgets ?? []) as AppTemplate["widgets"],
    [currentDashboardData],
  );

  const handleClose = useCallback(() => {
    setExportTemplatePopup(false);
  }, [setExportTemplatePopup]);

  const footer = (
    <DialogFooter className="pt-4">
      <Button variant="outlined" type="button" size="sm" onClick={handleClose}>
        Cancel
      </Button>
      <Tooltip message="Copy template to clipboard">
        <Button
          type="button"
          variant="outlined"
          size="sm"
          onClick={handleCopyToClipboard}
          className="flex items-center gap-1"
        >
          <Icon id="clipboard-icon" className="size-3.5" />
          Copy
        </Button>
      </Tooltip>
      <Button type="submit" size="sm">
        Download App
      </Button>
    </DialogFooter>
  );

  return (
    <AppDialogShell
      open={exportTemplatePopup}
      onClose={handleClose}
      title="Export App"
      form={form}
      onSubmit={onSubmit}
      previewWidgets={previewWidgets}
      footer={footer}
    />
  );
}

function saveTemplate(templateData: BackendTemplate) {
  const jsonData = JSON.stringify(templateData, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${templateData.name.toLowerCase().replace(/\s+/g, "_")}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success("App downloaded successfully!");
}

function formatDashboardDataForTemplate(
  dashboardData: TabData,
  formData: AppMetadataForm,
) {
  const getAppWidget = useGetWidgetsStore.getState().getAppWidget;
  const getSourceById = useBackendConnectorStore.getState().getApiSourceById;

  const { widgetIdMap, widgetStateMap, widgetMinimizedMap, optionEndpoints } =
    dashboardData.widgets.reduce(
      (acc, widget) => {
        acc.widgetIdMap[widget.id] = widget.widgetId;
        if (widget.isMinimized) {
          acc.widgetMinimizedMap[widget.id] = widget.originalH;
        }
        const state = {} as TabLayout["state"];

        const source = widget.sourceId ? getSourceById(widget.sourceId) : undefined;
        const sourceWidget = getAppWidget(widget.widgetId, widget.sourceName);

        if (sourceWidget && widget.params) {
          state.paramOrder = getParamsOrder(
            createParamDefs(sourceWidget, source?.url),
            widget.params,
          );
        }

        state.params = (widget?.params || [])?.reduce((paramsAcc, param) => {
          const paramValue = widget.storage?.params?.[param.paramName];
          // to not include default values in the template
          if (paramValue && paramValue !== param.value) {
            paramsAcc[param.paramName] = paramValue;
          }
          if (param.type === "endpoint") {
            acc.optionEndpoints[param.groupById] = param.paramName;
          }
          return paramsAcc;
        }, {});

        const ignoreKeys = [
          "version",
          "chartId",
          "unlinkChart",
          "chartThemeName",
          "chartPalette",
        ];
        state.chartModel = {};
        state.chartView = widget.storage?.chartView || {};
        state.storage = {};

        const storedState = getStateStorage(widget);
        const seriesType = getSeriesType(state.chartModel?.chartType);

        for (const key of Object.keys(storedState?.chartModel || {})) {
          const value = storedState?.chartModel?.[key];
          if (!ignoreKeys.includes(key) && value) {
            state.chartModel[key] =
              key === "cellRange" ? { columns: value.columns } : value;
          }
        }

        if (Object.keys(state.chartModel).length > 0) {
          state.chartModel.chartOptions = {
            [seriesType]: state.chartModel?.chartOptions?.[seriesType],
          };
        }

        const wColState = widget.data?.table?.columnState || {};
        state.filterModel = widget.data?.table?.filterModel || {};
        state.columnState = Object.keys(wColState).reduce((columnAcc, colId) => {
          const { sideBar, columnSizing, pagination, version, ...colState } =
            wColState[colId] || {};

          if (Object.keys(colState).some((key) => isTruthy(colState[key]))) {
            columnAcc[colId] = colState;
          }

          return columnAcc;
        }, {});

        for (const storageKey of [
          "timezones",
          "text",
          "html",
          "rawDataView",
          "chartNavigatorEnabled",
          "chartMiniChartEnabled",
          "chartBarFillEnabled",
        ]) {
          if (widget?.storage?.[storageKey]) {
            state.storage[storageKey] = widget?.storage?.[storageKey];
          }
        }

        acc.widgetStateMap[widget.id] = Object.fromEntries(
          Object.entries(state).filter(([, value]) => isTruthy(value)),
        );

        return acc;
      },
      {
        widgetIdMap: {},
        widgetStateMap: {},
        widgetMinimizedMap: {},
        optionEndpoints: {},
      },
    );

  const navigationBarNames = dashboardData.widgets.reduce((acc, widget) => {
    if (widget.widgetId === "navigation_bar") {
      for (const tab of widget.storage.tabs) acc[tab.id] = tab.name;
    }
    return acc;
  }, {});

  const groups = dashboardData.groups.map((group) => ({
    name: group.name,
    type: group.type,
    ...((group.type === "endpointParam" || group.type === "param") && {
      paramName: optionEndpoints?.[group.groupById] ?? group.groupById,
    }),
    defaultValue: group.type === "ticker" ? group.value?.symbol : group.value,
    widgetIds: dashboardData.widgets
      .filter((widget) => {
        if (group.type === "param" || group.type === "endpointParam")
          return widget?.paramGroups?.[group?.groupById] === group.id;

        return widget.groupId === group.id;
      })
      .map((widget) => widget.id),
  }));

  const tabs = Object.entries(dashboardData.gridLayout).reduce(
    (acc, [tabId, layouts]) => {
      const effectiveTabId = tabId ?? "overview";
      const tabName = navigationBarNames[effectiveTabId] || effectiveTabId;

      acc[effectiveTabId] = {
        id: effectiveTabId,
        name: tabName,
        layout: layouts
          .filter((layout) => widgetIdMap[layout.i] !== "navigation_bar")
          .map((layout) => {
            const isMinimized = layout.i in widgetMinimizedMap;
            const originalH = widgetMinimizedMap[layout.i];
            return {
              i: widgetIdMap[layout.i] || layout.i,
              x: layout.x,
              y: layout.y,
              w: layout.w,
              h: isMinimized && originalH ? originalH : layout.h,
              ...(isMinimized && { minimized: true }),
              ...(Object.keys(widgetStateMap[layout.i] || {}).length && {
                state: widgetStateMap[layout.i],
              }),
              groups: groups
                .filter((group) => group.widgetIds.includes(layout.i))
                .map((group) => group.name),
            };
          }),
      };
      return acc;
    },
    {} as BackendTemplate["tabs"],
  );

  const promptsList = trimPrompts(formData.prompts);

  return {
    name: formData.name,
    img: formData.imageUrl || "",
    img_dark: formData.imageUrl || "",
    img_light: formData.imageUrl || "",
    description: formData.description,
    allowCustomization: true,
    tabs,
    groups: groups.map((group) => {
      const { widgetIds, ...rest } = group;
      return rest;
    }),
    ...(promptsList.length > 0 && { prompts: promptsList }),
  } as BackendTemplate;
}
