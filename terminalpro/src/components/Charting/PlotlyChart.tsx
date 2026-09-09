import type * as Plotly from "plotly.js-dist-min";
import { forwardRef, lazy, Suspense, useMemo, useRef } from "react";
import type { PlotParams } from "react-plotly.js";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import { useUpdateEffect } from "usehooks-ts";
import useIsMobile from "~/hooks/useIsMobile";
import { useShallowThemeStore } from "~/lib/state/theme";
import DARK_CHARTS_TEMPLATE from "~/lib/templates/dark.json";
import LIGHT_CHARTS_TEMPLATE from "~/lib/templates/light.json";
import { cn, mergeObjects } from "~/lib/utils";
import ResizeHandler from "./ResizeHandler";
import { lazyLoadPlotly } from "./utils";

const PlotLazy = lazy(async () => {
  const Plotly = await lazyLoadPlotly();
  return { default: createPlotlyComponent(Plotly) };
});

export const Plot = forwardRef<Plotly.PlotlyHTMLElement, PlotParams>((props, ref) => (
  <Suspense fallback={null}>
    {/* @ts-expect-error */}
    <PlotLazy {...props} ref={ref} />
  </Suspense>
));

function titleRemover(
  fig: any,
  removeTitle = false,
  margin: { b: number; t: number } = { b: 0, t: 10 },
) {
  if (removeTitle && fig?.layout) {
    fig.layout.title = "";
    // take height of the title into account
    fig.layout.margin = {
      ...fig.layout.margin,
      b: margin.b,
      t: margin.t,
    };

    fig.layout.legend = {
      ...fig.layout?.legend,
      x: 0.01,
      y: 1.1,
      xanchor: "left",
      yanchor: "middle",
      orientation: "h",
    };
  }
  return fig;
}

function PlotlyChart({
  initialData,
  setPlotDiv,
  reduceSize = 20,
  extraClassname = "",
  margin = { t: 10, b: 0 },
  resizeRate = 50,
  isExternal = false,
}: {
  initialData?: any;
  setPlotDiv?: (div: Plotly.PlotlyHTMLElement) => void;
  reduceSize?: number;
  extraClassname?: string;
  margin?: { t: number; b: number };
  resizeRate?: number;
  isExternal?: boolean;
}) {
  const theme = useShallowThemeStore((s) => s.theme);
  const isMobile = useIsMobile();
  const plotlyRef = useRef<Plotly.PlotlyHTMLElement>(null);
  const removeTitle = !isExternal;

  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: resizeRate,
  });

  const plotDataMemo = useMemo(() => {
    if (!initialData || initialData?.data?.length === 0) return null;
    const plotData = { ...titleRemover(initialData, removeTitle, margin) };

    const update = ResizeHandler({ plotData, width, height, isExternal });

    const layout_update = Object.keys(update.layout_update).reduce((acc, key) => {
      const split = key.split(".");
      const value = update.layout_update[key];
      const last = split.pop();
      const path = split.reduce((acc, key) => {
        if (!acc[key]) acc[key] = {};
        return acc[key];
      }, acc);
      path[last] = value;
      return acc;
    }, {}) as any;
    const newPlotData = update.plotData;

    if (Object.keys(layout_update).length > 0) {
      newPlotData.layout = mergeObjects(
        {
          ...newPlotData.layout,
        },
        layout_update,
      );
    }

    try {
      if (!isExternal) {
        const darkmode = theme === "dark";

        newPlotData.layout.font = {
          ...(newPlotData.layout.font || {}),
          color: darkmode ? "#fff" : "#000",
        };
        newPlotData.layout.legend.font = {
          ...(newPlotData.layout.legend.font || {}),
          color: darkmode ? "#fff" : "#000",
        };

        // @ts-expect-error
        newPlotData.layout.template = darkmode
          ? DARK_CHARTS_TEMPLATE
          : LIGHT_CHARTS_TEMPLATE;

        newPlotData.layout.margin = {
          ...(newPlotData?.layout?.margin || {}),
          b: margin.b,
          t: margin.t,
        };
      }
    } catch (e) {
      console.log("error", e);
    }

    newPlotData.layout.width = width - reduceSize;
    newPlotData.layout.height = height - reduceSize;
    newPlotData.layout.modebar = {
      bgcolor: "transparent",
      orientation: "v",
      ...(newPlotData.layout.modebar || {}),
    };

    return newPlotData;
  }, [theme, initialData, width, height, plotlyRef]);

  const config = useMemo(
    () => ({
      plotGlPixelRatio: 1,
      scrollZoom: isExternal || isMobile,
      responsive: true,
      displaylogo: false,
      displayModeBar: isExternal ? "hover" : false,
      ...(initialData?.config || {}),
    }),
    [initialData?.config, isExternal, isMobile],
  );

  useUpdateEffect(() => {
    if (plotlyRef?.current === null || plotlyRef?.current === null) return;
    if (plotDataMemo === null) return;
    if (initialData !== null) {
      if (setPlotDiv !== undefined) setPlotDiv(plotlyRef.current);
    }
  }, [plotlyRef?.current]);

  if (!plotDataMemo) return null;

  return (
    <div ref={ref} className={cn("flex h-[calc(98%)]", extraClassname)}>
      <Plot
        ref={plotlyRef}
        className="w-full h-full relative _widget-content"
        style={{ backgroundColor: "transparent" }}
        config={config}
        data={plotDataMemo.data || []}
        layout={plotDataMemo.layout || {}}
        frames={plotDataMemo.frames || []}
      />
    </div>
  );
}

export default PlotlyChart;
