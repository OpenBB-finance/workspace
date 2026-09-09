import type {
  AgBaseAxisOptions,
  AgBaseSeriesOptions,
  AgChartThemeOverrides,
} from "ag-charts-community";
import type { AgChartProps } from "ag-charts-react";
import type {
  CellRangeParams,
  ChartModel,
  ChartOptionsChangedEvent,
} from "ag-grid-community";
import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash.isequal";
import merge from "lodash.merge";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ExtraAction, ExtraActionT } from "~/components/DraggableCard/NavBar";
import type { WidgetT } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useAgGridContext } from "../../hooks";
import {
  getCellRangeState,
  getStateKey,
  getStateStorage,
  getWidgetStorage,
} from "../../hooks/useUpdateColumnState";
import { getOpenBBChartTheme } from "../themes";
import {
  createDefaultAxis,
  createDefaultSeries,
  getFiscalPeriodString,
  getSeriesType,
} from "../utils";

export function getDefaultChartOptions(
  chartOptions: AgChartProps["options"] | any,
  chartType: ChartModel["chartType"],
) {
  const { axes, ...options } = chartOptions;
  const { connectMissingData, ...newSeries } = options.series ?? {};
  const { label, calloutLabel, marker, ...series } = newSeries;
  const pieTypes = {
    ...options,
    series: {
      ...series,
      calloutLabel: { ...label, enabled: true },
      sectorLabel: { ...label, enabled: true },
    },
  };

  const defaultOptions = {
    common: { axes },
    line: options,
    pie: pieTypes,
    donut: pieTypes,
    area: { ...options, series: newSeries },
    bubble: { ...options, series: newSeries },
    histogram: { ...options, series: { ...series, label } },
    bar: {
      ...options,
      series: {
        ...series,
        label: { ...label, placement: "outside-end" },
      },
    },
    scatter: {
      ...options,
      series: { ...series, label: { ...label, placement: "top" } },
    },
    treemap: {
      series: {
        group: {
          label: { ...label, enabled: true },
        },
        tile: {
          label: { ...label, enabled: true },
        },
        tooltip: series.tooltip,
      },
      padding: {
        bottom: 10,
      },
    },
    sunburst: {
      series: {
        tooltip: {
          ...series?.tooltip,
          position: { anchorTo: "pointer" },
          interaction: { enabled: true },
        },
        label: { ...label, enabled: true },
      },
      padding: {
        bottom: 10,
      },
    },
    heatmap: {
      series: {
        tooltip: series?.tooltip,
        label: { ...label, enabled: true },
      },
      padding: {
        bottom: 10,
      },
    },
    waterfall: { series },
  } as AgChartThemeOverrides;

  const polars = [
    "radar-line",
    "radar-area",
    "radial-bar",
    "radial-column",
    "nightingale",
  ];

  for (const type of polars) {
    defaultOptions[type] = {
      series: { ...series, label },
    };
  }

  const seriesType = getSeriesType(chartType);

  if (!defaultOptions[seriesType]) {
    defaultOptions[seriesType] = { ...options, series: { ...series, label } };
  }

  return defaultOptions as AgChartThemeOverrides;
}

export function useChartCloseButtonListener() {
  const updateWidget = useWidgetContext().updateWidget;
  const chartRef = useAgGridContext()?.chartRef;

  const setCloseButtonListener = useCallback(() => {
    const element = chartRef?.current?.chartElement;
    const closeButton = element?.getElementsByClassName(
      "ag-tabs-close-button ag-chart-tabbed-menu-close-button",
    )?.[0];
    if (!closeButton) return;
    closeButton?.addEventListener("click", () => {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          chartSettingsOpen: false,
        },
      }));
    });
  }, [updateWidget, chartRef]);

  return setCloseButtonListener;
}

export function useChartToolPanelAction() {
  const { gridRef, chartRef, chartViewElementRef } = useAgGridContext();

  const updateWidget = useWidgetContext().updateWidget;
  const setCloseButtonListener = useChartCloseButtonListener();

  const ChartToolPanelActions = useMemo(() => {
    const actions: ExtraActionT[] = [
      {
        icon: "chart-rounded",
        id: "open-chart-settings-button",
        label: "Chart settings",
        onClick: () => {
          const agChartMenuVisible =
            chartViewElementRef?.current?.getElementsByClassName(
              "ag-chart-menu-visible",
            )?.[0];

          const params = { chartId: chartRef.current?.chartId };

          if (agChartMenuVisible) {
            gridRef.current.api.closeChartToolPanel(params);
          } else {
            gridRef.current.api.openChartToolPanel(params);
            setTimeout(() => setCloseButtonListener(), 300);
          }

          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              chartSettingsOpen: agChartMenuVisible === undefined,
            },
          }));
        },
      },
    ];

    return actions;
  }, [chartRef, chartViewElementRef, gridRef, updateWidget, setCloseButtonListener]);

  return ChartToolPanelActions;
}

export function useChartBarFillQuickAction() {
  const updateWidget = useWidgetContext().updateWidget;
  const { chartView, totalSeries, chartType, chartBarFillEnabled } =
    useWidgetContext().widget?.storage || {};

  const isBarOrColumnChart = useMemo(() => {
    if (!chartType) return false;
    const seriesType = getSeriesType(chartType);
    return seriesType === "bar";
  }, [chartType]);

  const quickAction = useMemo<ExtraAction>(() => {
    const label = chartBarFillEnabled ? "Single bar color" : "Distinct bar colors";
    const disabled = totalSeries > 1;
    return {
      icon: "chart-icon",
      id: "distinct-bar-colors",
      label,
      disabled,
      tooltipMessage:
        disabled && "Cannot toggle bar colors with multiple series present.",
      onClick: () => {
        updateWidget((prev) => ({
          ...prev,
          storage: {
            ...prev.storage,
            chartBarFillEnabled: !chartBarFillEnabled,
          },
        }));
      },
    };
  }, [totalSeries > 1, chartBarFillEnabled]);

  return isBarOrColumnChart && chartView?.enabled ? quickAction : undefined;
}

export function useChartQuickActions() {
  const updateWidget = useWidgetContext().updateWidget;
  const {
    chartView,
    chartNavigatorEnabled = false,
    chartMiniChartEnabled = false,
  } = useWidgetContext().widget?.storage || {};

  const quickActions = useMemo<ExtraAction[]>(() => {
    return [
      {
        icon: "chart-icon",
        id: "toggle-chart-navigator",
        label: `${chartNavigatorEnabled ? "Hide" : "Show"} navigator`,
        onClick: () => {
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              chartNavigatorEnabled: !chartNavigatorEnabled,
              ...(!chartNavigatorEnabled && { chartMiniChartEnabled: false }),
            },
          }));
        },
      },
      {
        icon: "mini-chart-icon",
        id: "toggle-chart-mini-chart",
        label: `${chartMiniChartEnabled ? "Hide" : "Show"} mini chart`,
        onClick: () => {
          updateWidget((prev) => ({
            ...prev,
            storage: {
              ...prev.storage,
              chartMiniChartEnabled: !chartMiniChartEnabled,
              ...(!chartMiniChartEnabled && { chartNavigatorEnabled: false }),
            },
          }));
        },
      },
    ];
  }, [chartNavigatorEnabled, chartMiniChartEnabled, updateWidget]);

  return chartView?.enabled ? quickActions : [];
}

const getChartType = (widget: WidgetT, widgetFromJSON: Partial<WidgetT>) => {
  const stateStorage = getStateStorage(widget);
  const chartModel = stateStorage?.chartModel || widget?.storage?.chartModel;

  return chartModel?.chartType || widgetFromJSON?.data?.table?.chartView?.chartType;
};

type UseChartOptionsProps = {
  chartSeries?: AgBaseSeriesOptions<any>;
  chartAxis?: { [key: string]: AgBaseAxisOptions };
};

export default function useChartOptions(props: UseChartOptionsProps = {}) {
  const { chartSeries = {}, chartAxis = {} } = useMemo(
    () => props,
    Object.values(props),
  );

  const { widget, getWidget, widgetFromJSON, updateWidget } = useWidgetContext();

  const theme = useShallowThemeStore((s) => s.theme);
  const globalDecimalDigits = useShallowThemeStore((s) => s.decimalDigits);

  const stateStorage = getStateStorage(widget);
  const chartOptionsRef = useRef<Partial<ChartModel["chartOptions"]>>(
    stateStorage?.chartModel?.chartOptions ?? widget?.storage?.chartOptions ?? {},
  );
  const chartModelRef = useRef<Partial<ChartModel>>(
    stateStorage?.chartModel ?? widget?.storage?.chartModel ?? {},
  );
  const navigatorRef = useRef({
    navigatorEnabled: widget?.storage?.chartNavigatorEnabled,
    miniChartEnabled: widget?.storage?.chartMiniChartEnabled,
  });

  const chartTypeRef = useRef<ChartModel["chartType"]>(
    getChartType(widget, widgetFromJSON),
  );

  // need this to avoid re-rendering when storage changes
  useEffect(() => {
    const chartModel = stateStorage?.chartModel;
    const hasChartModel = Object.keys(chartModel ?? {}).length > 0;
    if (hasChartModel && !isEqual(chartOptionsRef.current, chartModel?.chartOptions)) {
      chartOptionsRef.current = chartModel?.chartOptions ?? {};
    }
    if (hasChartModel && !isEqual(chartModelRef.current, chartModel)) {
      chartModelRef.current = chartModel ?? {};
    }
    const newChartType = chartModel?.chartType;
    if (newChartType && newChartType !== chartTypeRef.current) {
      chartTypeRef.current = newChartType;
    }

    navigatorRef.current = {
      navigatorEnabled: widget?.storage?.chartNavigatorEnabled,
      miniChartEnabled: widget?.storage?.chartMiniChartEnabled,
    };
  }, [
    stateStorage?.chartModel,
    chartOptionsRef,
    chartTypeRef,
    chartModelRef,
    widget?.storage?.chartNavigatorEnabled,
    widget?.storage?.chartMiniChartEnabled,
  ]);

  const getParsedPeriod = useCallbackRef(() => {
    const widget = getWidget();

    const storage = getWidgetStorage(widget);
    const period = storage?.period?.toLowerCase();
    const isQuarterly = period?.replace("ly", "") === "quarter";
    const isAnnual = period === "annual";

    return { isQuarterly, isAnnual };
  });

  const getDecimalPlaces = useCallbackRef(() => {
    const widget = getWidget();
    const storage = getWidgetStorage(widget);
    return storage?.decimalDigits ?? globalDecimalDigits;
  });

  const options = useMemo(() => {
    const chartType = chartTypeRef?.current || "line";

    const { xLabel, yLabel } = widgetFromJSON?.data?.table?.chartView ?? {};
    const createProps = {
      chartType,
      getParsedPeriod,
      title: { xLabel, yLabel },
      getDecimalPlaces,
    };

    const series = createDefaultSeries(createProps);
    const axes = createDefaultAxis(createProps);

    const mainTheme = getOpenBBChartTheme(theme);
    const legend = mainTheme.overrides.common.legend;
    legend.item.label.formatter = (params) => {
      return getFiscalPeriodString(params.value, getParsedPeriod);
    };

    const defaultOptions = getDefaultChartOptions(
      {
        series: merge(series, chartSeries),
        axes: merge(axes, chartAxis),
      },
      chartType,
    );
    const navigatorEnabled = navigatorRef.current.navigatorEnabled;
    const miniChartEnabled = navigatorRef.current.miniChartEnabled;

    defaultOptions.common.legend = legend;
    defaultOptions.common.navigator = {
      enabled: Boolean(navigatorEnabled || miniChartEnabled),
      miniChart: { enabled: Boolean(miniChartEnabled) },
    };

    return defaultOptions;
  }, [theme, chartTypeRef, getParsedPeriod, chartSeries, chartAxis, navigatorRef]);

  const chartThemeOverrides = useMemo(() => {
    const chartOptions = chartOptionsRef?.current ?? {};

    const cellRange = chartModelRef.current?.cellRange;

    if (chartOptions?.scatter?.axes?.number && cellRange) {
      const enabled = cellRange?.columns?.length <= 5;
      const numberAxis = chartOptions.scatter.axes.number;
      const hasTitleText = ["top", "right", "left", "bottom"].some(
        (key) => numberAxis?.[key]?.title?.text,
      );

      if (!hasTitleText) {
        const titleOptions = { enabled, spacing: 10, fontSize: 11 };

        chartOptions.scatter.axes.number = {
          ...numberAxis,
          top: { ...numberAxis.top, title: titleOptions },
          right: { ...numberAxis.right, title: titleOptions },
          left: { ...numberAxis.left, title: titleOptions },
          bottom: { ...numberAxis.bottom, title: titleOptions },
        };
      }
    }

    chartOptions.common = options.common;

    return merge(options, chartOptions) as AgChartThemeOverrides;
  }, [options, chartOptionsRef, chartModelRef]);

  const onChartOptionsChanged = useCallback(
    (params: ChartOptionsChangedEvent) => {
      const { chartType, chartOptions = {} } = params;

      const chartModel = params.api
        .getChartModels()
        .find((model) => model.chartId === params.chartId);

      const stateChartOptions = cloneDeep(chartOptionsRef.current || {});
      const isPivotMode = params.api.isPivotMode();

      updateWidget((prev) => {
        const stateKey = getStateKey(prev, isPivotMode);
        const {
          chartModel: prevChartModel,
          stateCellRange = prevChartModel?.cellRange,
        } = getCellRangeState(prev, chartType, isPivotMode);

        const prevChartType = prevChartModel?.chartType || chartType;

        if (prevChartType !== chartType && stateCellRange?.columns) {
          params.api.updateChart({
            type: "rangeChartUpdate",
            chartId: params.chartId,
            chartType,
            cellRange: stateCellRange,
            switchCategorySeries: chartModel?.switchCategorySeries,
          });
          if (chartModel) chartModel.cellRange = stateCellRange;
        }

        // @ts-expect-error
        const { theme, ...newChartOptions } = merge(stateChartOptions, chartOptions);

        const totalSeries = getTotalSeries(params, chartModel?.cellRange);

        return {
          ...prev,
          storage: {
            ...prev.storage,
            totalSeries,
            chartType,
            isPivotMode,
            [stateKey]: {
              ...(prev.storage?.[stateKey] ?? {}),
              chartModel: {
                ...(prev.storage?.[stateKey]?.chartModel ?? {}),
                ...(chartModel ?? {}),
                chartOptions: newChartOptions,
                chartType,
              },
            },
          },
        };
      });
    },
    [updateWidget, chartOptionsRef],
  );

  return { onChartOptionsChanged, chartThemeOverrides };
}

export function getTotalSeries(
  params: ChartOptionsChangedEvent,
  cellRange?: Partial<CellRangeParams>,
) {
  const { columns = [] } = cellRange ?? {};

  const selectedColumns = columns.map((col) => {
    if (typeof col === "string") return col;
    const showRowGroup = col.getColDef()?.showRowGroup;
    if (typeof showRowGroup === "string") return showRowGroup;
    return col.getColId();
  });

  const totalSeries = selectedColumns.filter((colId) => {
    const colDef = params?.api?.getColumn(colId)?.getColDef();
    return colDef?.chartDataType === "series" && colDef?.cellDataType === "number";
  }).length;

  return totalSeries;
}
