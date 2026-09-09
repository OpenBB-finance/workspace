import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import type { Widget, WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import SOURCES from "~/lib/sources.json";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { extractColumns, getJsonWidget, useWidgetDataSource } from "~/lib/utils";
import { handleWidgetMetadata } from "~/utils/dataConnectorsHelpers";

export function createCopilotDataWidget(params: {
  title?: string;
  widget: WidgetT | null;
  widgetFromJSON?: Partial<Widget>;
  widgetSource?: string[];
  additionalMetadata?: Record<string, any>;
}) {
  const {
    title,
    widget,
    widgetFromJSON = getJsonWidget(widget),
    widgetSource,
    additionalMetadata,
  } = params;

  const widgetMetadata = handleWidgetMetadata(widget);

  const name = title || widget?.name || widgetFromJSON?.name;
  const description = widget?.description || widgetFromJSON?.description;
  const source = widgetSource || widgetFromJSON?.source || widget?.source;
  const metadata = {
    ...(additionalMetadata || {}),
    ...(widgetMetadata || {}),
    ...(widget?.metadata || {}),
    ...{ params: widget?.storage?.params || {} },
  };

  return {
    name,
    description,
    source: Array.isArray(source) ? source[0] : source || "",
    metadata,
  };
}

function useCopilotDataWidget({
  aiData: data,
  title,
  aiEnabled,
  additionalMetadata,
  captureExecutedParams = true,
}: {
  aiData: any;
  title?: string;
  aiEnabled: boolean;
  lastUpdated?: number;
  additionalMetadata?: Record<string, any>;
  captureExecutedParams?: boolean;
}) {
  const { id: currentDashboardId = "" } = useParams();
  const { widget, widgetFromJSON } = useWidgetContext(true);
  const widgetSource = useWidgetDataSource();
  const filtered = typeof data === "boolean";

  const { name, description, source, metadata } = useMemo(() => {
    return createCopilotDataWidget({
      title,
      widget,
      widgetFromJSON,
      widgetSource,
      additionalMetadata,
    });
  }, [
    title,
    widgetSource,
    widget?.name,
    widget?.description,
    widget?.widgetId,
    widget?.metadata,
    widgetFromJSON,
    additionalMetadata,
  ]);

  const executedParamsSnapshot = useMemo(
    () => ({ ...(widget?.storage?.params || {}) }),
    [data, widget?.id],
  );
  const lastUpdated = useMemo(() => Date.now(), [data]);

  const addDataOnDashboardWidget = useShallowCopilotDataStore(
    (state) => state?.addDataOnDashboardWidget,
  );

  useEffect(() => {
    if (!(aiEnabled && widget?.id) || filtered) return;
    const fileType =
      widget?.connectionType === "file" && widget?.endpoint?.url?.split(".")?.pop();
    const columns = extractColumns(data);

    addDataOnDashboardWidget(widget.id, {
      data,
      captureExecutedParams,
      innerTab: widget.innerTab,
      title: name,
      description: description || "",
      endpointUrl: widget.endpoint?.url || "",
      metadata: {
        ...(metadata || {}),
        params: executedParamsSnapshot,
        ...(SOURCES?.[source]?.name ? { source: SOURCES[source].name } : {}),
        ...(lastUpdated ? { lastUpdated } : {}),
        ...(fileType ? { fileType } : {}),
        ...(columns ? { columns } : {}),
      },
      dashboardId: currentDashboardId,
    });
  }, [
    aiEnabled,
    widget?.id,
    data,
    name,
    description,
    source,
    metadata,
    lastUpdated,
    executedParamsSnapshot,
    captureExecutedParams,
  ]);
}

export default useCopilotDataWidget;
