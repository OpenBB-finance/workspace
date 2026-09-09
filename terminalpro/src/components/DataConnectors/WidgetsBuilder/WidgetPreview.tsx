import isEqual from "lodash.isequal";
import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { WidgetT } from "~/components/types";
import { WidgetComponent } from "~/components/Widget";
import { isAgGridWidget, type WidgetId } from "~/components/Widgets";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { TabProvider } from "~/lib/contexts/TabContext";
import { uuidv4 } from "~/lib/utils";
import RenderIfVisible from "../../RenderIfVisible";
import { WidgetProvider } from "../../Widget.context";
import type { WidgetConfiguration } from "./types";
import { useWidgetConfigContext, useWidgetConfigStore } from "./WidgetConfigContext";

function createWidget(
  config: WidgetConfiguration,
  endpoint: string,
  widgetUuid: string,
): WidgetT {
  const widgetId = (
    config.type === "table" ? "ag_grid_table" : config.type
  ) as WidgetId;
  const isTableWidget = isAgGridWidget(widgetId);

  const isLiveGrid = config.type === "live_grid";

  const chartView = {
    chartType: config.chartType || "line",
    enabled: config.chartViewEnabled || undefined,
  };

  return {
    id: widgetUuid,
    widgetId,
    name: config.name || "Preview Widget",
    description: config.description || "Preview of widget configuration",
    type: config.type || "table",
    category: config.category || "Preview",
    subCategory: config.subCategory || "Widget Builder",
    source: config.source || ["api"],
    external: true,
    endpoint: {
      url: endpoint,
      method: "GET" as const,
      headers: config.headers || {},
    },
    storage: {
      params:
        config.params?.reduce(
          (acc, param) => {
            if (param.paramName && param.value !== undefined && param.value !== null) {
              acc[param.paramName] = param.value;
            }
            return acc;
          },
          {} as Record<string, any>,
        ) || {},
      ...(isTableWidget && config.enableCharts && { chartView }),
    },

    data: {
      ...(config.dataKey && { dataKey: config.dataKey }),
      ...(isLiveGrid && config.wsEndpoint && { wsEndpoint: config.wsEndpoint }),
      ...(isLiveGrid &&
        config.wsRowIdColumn && { wsRowIdColumn: config.wsRowIdColumn }),
      ...(isTableWidget && {
        table: {
          enableCharts: config.enableCharts,
          showAll: config.showAll,
          ...(config.enableCharts && { chartView }),
          ...(config.columnsDefs?.length > 0 && {
            columnsDefs: config.columnsDefs.map((column) => ({
              field: column.field,
              headerName: column.headerName,
              chartDataType: column.chartDataType,
              cellDataType: column.cellDataType,
              formatterFn: column.formatterFn,
              ...(column.renderFn?.length > 0 && { renderFn: column.renderFn }),
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
    params: config.params || [],
    showTitle: true,
    runButton: config.runButton,
    disableRetrievalForCopilot: false,
    gridData: {
      w: config.gridData?.w || 20,
      h: config.gridData?.h || 9,
      minW: config.gridData?.minW || 10,
      minH: config.gridData?.minH || 5,
      maxW: config.gridData?.maxW || 40,
      maxH: config.gridData?.maxH || 100,
    },
    refetchInterval: config.refetchInterval ?? 900000,
    dataUpdateDisplay: config.dataUpdateDisplay,
    staleTime: config.staleTime || 300000,
  };
}

export default function WidgetPreview() {
  const store = useWidgetConfigStore();
  const widgetType = useWidgetConfigContext((state) => state.config.type);

  const widgetUuid = useMemo(() => uuidv4(), []);
  const [widget, setWidget] = useState<WidgetT>(() => {
    const { config, formState } = store.getState();
    return createWidget(config, formState.endpoint, widgetUuid);
  });

  useEffect(() => {
    const unsub = store.subscribe(
      (s) => ({ widgetConfig: s.config, endpoint: s.formState.endpoint }),
      (next, prev) => {
        if (
          prev.endpoint !== next.endpoint ||
          !isEqual(prev.widgetConfig, next.widgetConfig)
        ) {
          const newWidget = createWidget(next.widgetConfig, next.endpoint, widgetUuid);
          setWidget((prevWidget) => {
            const chartViewEnabled = prevWidget?.storage?.chartView?.enabled;
            if (chartViewEnabled === undefined) return newWidget;
            newWidget.storage.chartView.enabled = chartViewEnabled;

            return newWidget;
          });
        }
      },
      { fireImmediately: true },
    );
    return () => unsub();
  }, [store]);

  const updateWidget = useCallbackRef((newWidget: WidgetT) => {
    const chartViewEnabled = newWidget?.storage?.chartView?.enabled;
    if (chartViewEnabled === undefined) return;

    setWidget((prevWidget) => ({
      ...prevWidget,
      storage: {
        ...prevWidget.storage,
        chartView: {
          ...(prevWidget.storage.chartView || {}),
          enabled: chartViewEnabled,
        },
      },
    }));
  });

  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-red-600 dark:text-red-400">
          Failed to render widget preview: {widgetType}
        </div>
      }
    >
      <TabProvider
        currentTab="preview"
        tabId="preview"
        layouts={[]}
        setLayouts={() => {}}
      >
        <WidgetProvider
          uuid={widget?.id}
          activeDashboardId="preview"
          isShared={false}
          isPreview={true}
          contextOverride={{ widget, updateWidget }}
        >
          <RenderIfVisible>
            <WidgetComponent />
          </RenderIfVisible>
        </WidgetProvider>
      </TabProvider>
    </ErrorBoundary>
  );
}
