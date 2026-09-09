import type { Figure } from "react-plotly.js";

export default function ResizeHandler({
  plotData,
  width,
  height,
  isExternal,
}: {
  plotData: Figure;
  width: number;
  height: number;
  isExternal?: boolean;
}) {
  const layout_update: any = {};

  if (width < 500) layout_update.showlegend = false;

  if (isExternal) return { plotData, layout_update };

  const XAXIS = Object.keys(plotData.layout)
    .filter((x) => x.startsWith("xaxis"))
    .filter(
      (x) =>
        plotData.layout[x].showticklabels || plotData.layout[x].matches === undefined,
    );

  const TRACES = plotData.data.filter((trace) => trace?.name?.trim() === "Volume");

  const tick_size =
    height > 420 && width < 920 ? 8 : height > 420 && width < 500 ? 9 : 7;

  const nticks = width < 400 ? 4 : width > 500 ? 6 : 5;

  if (width < 750) {
    for (const trace of TRACES) {
      if (trace.type === "bar") {
        trace.opacity = 1;
        trace.marker = {
          ...(trace.marker || {}),
          line: { ...(trace.marker?.line || {}), width: 0.09 },
        };
        trace.yaxis = trace?.yaxis || "y";
        const yaxis = `yaxis${trace?.yaxis?.replace("y", "") || ""}`;
        layout_update[`${yaxis}.tickfont.size`] = tick_size;
      }
    }

    for (const x of XAXIS) {
      layout_update[`${x}.nticks`] = nticks;
    }
  } else {
    for (const trace of TRACES) {
      if (trace.type === "bar") {
        trace.opacity = 0.5;
        trace.marker = {
          ...(trace.marker || {}),
          line: { ...(trace.marker?.line || {}), width: 0.5 },
        };
        trace.yaxis = trace?.yaxis || "y";
        const yaxis = `yaxis${trace?.yaxis?.replace("y", "") || ""}`;
        layout_update[`${yaxis}.tickfont.size`] = tick_size;
      }
    }

    for (const x of XAXIS) {
      layout_update[`${x}.nticks`] = nticks;
    }
  }

  return { plotData, layout_update };
}
