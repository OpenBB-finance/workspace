import type {
  AgAxisCaptionOptions,
  AgBarSeriesItemStylerParams,
  AgBarSeriesStyle,
  AgChartBackground,
  AgChartLegendOptions,
  AgChartTheme,
  AgChartThemePalette,
  AgPieSeriesThemeableOptions,
  AgWaterfallSeriesItemOptions,
} from "ag-charts-enterprise";
import {
  colorSchemeDark,
  colorSchemeLight,
  type GridChartContext,
  iconSetAlpine,
  iconSetMaterial,
  iconSetQuartz,
  themeAlpine,
} from "ag-grid-enterprise";
import cloneDeep from "lodash/cloneDeep";
import { useCallback, useMemo, useRef } from "react";
import { useWidgetContext } from "~/components/Widget.context";
import {
  type ThemeSettings,
  useShallowTableChartThemesStore,
} from "~/lib/state/tableChartThemes";
import { formatNumber, formatNumberMagnitude } from "~/lib/utils";
import { customCssPart, getDefaultAgGridTheme } from "../hooks/constants";

const pieAndDonutSeries = {
  calloutLabel: {
    formatter: (params) => {
      if (typeof params.value === "number") {
        return formatNumber(params.value, 0);
      }
      return params.value;
    },
  },
  sectorLabel: {
    enabled: true,
    formatter: (params) => {
      if (typeof params.value === "number") {
        return formatNumber(params.value, 2);
      }
      return params.value;
    },
  },
} as AgPieSeriesThemeableOptions<any, GridChartContext>;

const numberAxisOptions = {
  label: {
    formatter: (params) => {
      if (typeof params.value === "number") {
        return formatNumberMagnitude(params.value, 2);
      }
      return params.value;
    },
  },
};

const titleOptions = {
  fontSize: 11,
  spacing: 10,
  enabled: true,
  text: "",
  formatter: (params) => {
    const { defaultValue, boundSeries } = params;

    if (defaultValue && defaultValue !== "Axis Title") return defaultValue;

    if (boundSeries.length > 1) return "";

    const title = new Set(boundSeries?.map((series) => series?.name));

    return Array.from(title).join(", ");
  },
} as AgAxisCaptionOptions;

type ThemeT = "dark" | "light";

const getLegend = (theme: ThemeT, decimalPlaces?: number) => {
  return {
    position: "top",
    maxHeight: 50,
    spacing: 20,
    item: {
      paddingX: 32,
      paddingY: 8,
      marker: { shape: "square", padding: 5, size: 11 },
      label: {
        color: theme === "dark" ? "#fff" : "#000",
        fontSize: 11,
        formatter: (params) => {
          if (typeof params.value === "number") {
            return formatNumber(params.value, decimalPlaces);
          }
          return params.value;
        },
      },
    },
  } as AgChartLegendOptions<GridChartContext>;
};

const waterfallLabel = {
  enabled: false,
  placement: "inside-center",
} as AgWaterfallSeriesItemOptions<any, GridChartContext>["label"];

const defaultFills = [
  "#fac858",
  "#91cc75",
  "#5470c6",
  "#ee6666",
  "#73c0de",
  "#3ba272",
  "#fc8452",
  "#9a60b4",
  "#ea7ccc",
  "#ffb347",
  "#87ceeb",
  "#32cd32",
  "#ff6347",
  "#4169e1",
  "#ff69b4",
];

export function createItemStyler(
  palette?: AgChartThemePalette,
  shouldFillBars = () => false,
) {
  const fills = palette?.fills || defaultFills;

  // Track unique categories and their assigned colors
  const categoryColorMap = new Map<string, number>();
  let nextColorIndex = 0;

  return (
    params: AgBarSeriesItemStylerParams<any, GridChartContext>,
  ): AgBarSeriesStyle => {
    if (!shouldFillBars?.()) return {};

    // Only apply custom colors for single series (non-stacked) charts
    // Check if this is a stacked chart by looking at datum structure
    // Stacked charts have multiple yKey values across different series
    const datumKeys = Object.keys(params.datum || {});
    const hasMultipleSeriesKeys =
      datumKeys.filter(
        (key) =>
          key !== params.xKey &&
          key !== "date" &&
          key !== "node" &&
          typeof params.datum[key] === "number",
      ).length > 1;

    // Let AG Charts handle stacked chart coloring
    if (hasMultipleSeriesKeys) return {};

    // Determine if this is a bar or column chart and get the appropriate value
    const isBarChart = params.seriesId?.includes("BarSeries");
    const valueToUse = isBarChart ? params.xValue : params.yValue;

    // Get category string for consistent mapping
    const categoryKey = valueToUse?.toString() || "";

    // Check if we've seen this category before
    let colorIndex = categoryColorMap.get(categoryKey);
    if (colorIndex === undefined) {
      // Assign next sequential color
      colorIndex = nextColorIndex % fills.length;
      categoryColorMap.set(categoryKey, colorIndex);
      nextColorIndex++;
    }

    return { fill: fills[colorIndex] };
  };
}

const defaultOverrides = {
  line: { series: { marker: { enabled: false }, connectMissingData: true } },
  pie: { series: pieAndDonutSeries },
  donut: { series: pieAndDonutSeries },
  scatter: { axes: { number: { title: titleOptions } } },
  waterfall: {
    series: {
      item: {
        negative: { label: waterfallLabel },
        positive: { label: waterfallLabel },
        total: { label: waterfallLabel },
      },
    },
  },
  funnel: { series: { label: { enabled: false } } },
  bar: { series: { itemStyler: createItemStyler() } },
  common: {
    axes: {
      number: numberAxisOptions,
      "angle-number": numberAxisOptions,
      "radius-number": numberAxisOptions,
    },
    // padding: { top: 20, bottom: 5, left: 20, right: 40 },
    zoom: {
      enabled: true,
      anchorPointX: "pointer",
      anchorPointY: "pointer",
      minVisibleItems: 4,
      autoScaling: { enabled: true },
    },
    navigator: {
      enabled: false,
      miniChart: { enabled: false },
    },
    legend: getLegend("dark"),
    title: { fontSize: 12 },
  },
} as AgChartTheme<any, GridChartContext>["overrides"];

export const AgChartDarkTheme = {
  baseTheme: "ag-default-dark",
  overrides: defaultOverrides,
  params: {
    backgroundColor: "#151518",
  },
} as AgChartTheme<any, GridChartContext>;

export const AgChartLightTheme = {
  baseTheme: "ag-default",
  overrides: {
    ...defaultOverrides,
    common: {
      ...defaultOverrides.common,
      legend: getLegend("light"),
    },
  },
  params: {
    backgroundColor: "#FFFFFF",
  },
} as AgChartTheme<any, GridChartContext>;

export const OpenBBChartThemes = { dark: AgChartDarkTheme, light: AgChartLightTheme };

export function getOpenBBChartTheme(theme: ThemeT) {
  return cloneDeep(OpenBBChartThemes[theme]);
}

export function getCustomChartTheme(
  themeSettings: ThemeSettings["chartTheme"],
  shouldFillBars?: () => boolean,
  navigatorEnabled?: boolean,
  miniChartEnabled?: boolean,
): AgChartTheme<any, GridChartContext> {
  const isDarkMode = themeSettings.baseTheme === "ag-default-dark";
  const baseTheme = isDarkMode ? AgChartDarkTheme : AgChartLightTheme;
  const overrides = cloneDeep(baseTheme.overrides);
  const { backgroundImage, palette, params } = themeSettings;

  const options = {
    ...baseTheme,
    palette,
    params,
    overrides,
  } as AgChartTheme<any, GridChartContext>;

  let background: AgChartBackground | undefined;
  if (backgroundImage?.enabled && backgroundImage?.url) {
    const { enabled, ...imageConfig } = { ...backgroundImage };

    background = { image: imageConfig };
  }

  options.overrides.common.background = background;
  options.overrides.common.navigator = {
    enabled: Boolean(navigatorEnabled || miniChartEnabled),
    miniChart: { enabled: Boolean(miniChartEnabled) },
  };

  // Add dynamic itemStyler with the theme's palette
  const itemStyler = createItemStyler(palette, shouldFillBars);
  options.overrides.bar.series.itemStyler = itemStyler;

  return options;
}

const iconSetMap = {
  iconSetQuartz: iconSetQuartz(),
  iconSetAlpine: iconSetAlpine,
  iconSetMaterial: iconSetMaterial,
};

export function useAgThemes(theme: ThemeT) {
  const {
    chartBarFillEnabled = false,
    chartNavigatorEnabled = false,
    chartMiniChartEnabled = false,
  } = useWidgetContext(true)?.widget?.storage ?? {};

  const shouldFillBars = useCallback(() => chartBarFillEnabled, [chartBarFillEnabled]);

  const tableTheme = useShallowTableChartThemesStore(
    (state) => state[theme]?.tableTheme,
  );
  const agChartThemes = useShallowTableChartThemesStore((state) => ({
    "custom-dark": state.dark?.chartTheme,
    "custom-light": state.light?.chartTheme,
  }));

  const agTheme = useMemo(() => {
    if (tableTheme?.params) {
      return themeAlpine
        .withPart(theme === "dark" ? colorSchemeDark : colorSchemeLight)
        .withPart(iconSetMap[tableTheme?.iconSet ?? "iconSetAlpine"])
        .withPart(customCssPart)
        .withParams({
          // deconstruct params because we might need to override some of them in the future
          ...tableTheme.params,
        });
    }

    return getDefaultAgGridTheme(theme);
  }, [theme, tableTheme]);

  const defaultChartThemesRef = useRef({
    "openbb-dark": getOpenBBChartTheme("dark"),
    "openbb-light": getOpenBBChartTheme("light"),
  });

  const { themePalette, customChartThemes, chartThemes } = useMemo(() => {
    let themePalette: AgChartThemePalette | null = null;
    const updatedThemes = {} as Record<
      `custom-${ThemeT}` | `openbb-${ThemeT}`,
      AgChartTheme
    >;
    for (const [key, value] of Object.entries(agChartThemes ?? {})) {
      if (value?.baseTheme && value?.palette && value?.params) {
        themePalette = value.palette;
        updatedThemes[key] = getCustomChartTheme(
          value,
          shouldFillBars,
          chartNavigatorEnabled,
          chartMiniChartEnabled,
        );
        continue;
      }
      const obbKey = key.replace("custom-", "openbb-") as `openbb-${ThemeT}`;
      const obbTheme = defaultChartThemesRef.current[obbKey];
      obbTheme.overrides.bar.series.itemStyler = createItemStyler(null, shouldFillBars);
      obbTheme.overrides.common.navigator = {
        enabled: chartNavigatorEnabled || chartMiniChartEnabled,
        miniChart: { enabled: chartMiniChartEnabled },
      };

      updatedThemes[obbKey] = obbTheme;
    }

    let chartTheme = `custom-${theme}` as `custom-${ThemeT}` | `openbb-${ThemeT}`;
    if (!updatedThemes[chartTheme]) chartTheme = `openbb-${theme}`;

    return {
      themePalette,
      customChartThemes: updatedThemes,
      chartThemes: [chartTheme],
    };
  }, [
    defaultChartThemesRef,
    agChartThemes,
    theme,
    shouldFillBars,
    chartNavigatorEnabled,
    chartMiniChartEnabled,
  ]);

  return { themePalette, agTheme, chartThemes, customChartThemes };
}
