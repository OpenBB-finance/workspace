declare module "react-plotly.js" {
  import type React from "react";
  import type { Data, Layout, Config } from "plotly.js";
  import type {
    Figure as FigureType,
    FigureCallback,
    EventCallback,
    PlotParams as PlotParamsType,
  } from "react-plotly.js/dist/factory";

  interface PlotParams extends PlotParamsType {
    data?: Data[];
    layout?: Partial<Layout>;
    config?: Partial<Config>;
  }

  const Plot: React.ForwardRefExoticComponent<
    PlotParams & React.RefAttributes<HTMLDivElement>
  >;

  export default Plot;
  interface Figure extends FigureType {
    data: Data[];
    layout: Partial<Layout>;
  }

  export type { Figure, FigureCallback, EventCallback, PlotParams };
}
