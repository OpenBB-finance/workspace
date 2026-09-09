import { Plot } from "./PlotlyChart";

export default function LineChart({ data, layout }: any) {
  const yMax = Math.max(...data[0].y);
  const yMin = Math.min(...data[0].y);

  const plotLayout = {
    ...layout,
    showlegend: false,
    xaxis: {
      showgrid: false,
      showticklabels: false,
      showline: false,
      visible: false,
      zeroline: false,
      rangeslider: {
        visible: false,
      },
      autorange: true,
      automargin: true,
    },
    yaxis: {
      showgrid: false,
      showticklabels: false,
      range: [yMin, yMax],
      rangeslider: {
        visible: false,
      },
      autorange: true,
      automargin: true,
    },
    margin: {
      l: 10,
      r: 10,
      t: 10,
      b: 10,
    },
    dragmode: false,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  };

  return (
    <div className="flex justify-between h-[calc(100%)] w-[calc(100%)]">
      <Plot
        data={data}
        className="w-full h-full relative"
        layout={plotLayout as any}
        config={{
          displaylogo: false,
          responsive: true,
          displayModeBar: false,
        }}
        useResizeHandler={true}
      />
    </div>
  );
}
