import dayjs from "dayjs";
import { round } from "lodash";
import type { Layout, PlotData } from "plotly.js";
import { fetchEquityPriceHistorical } from "~/lib/api/sdkComponents";
import type {
  FMPPriceTargetData as FMPPriceTarget,
  FMPPriceTargetConsensusData as FMPPriceTargetConsensus,
} from "~/lib/api/sdkSchemas";
import { formatNumberMagnitude } from "~/lib/utils";

export function CreatePieChart(data: any): { plotData: any; exportData: any[] } {
  try {
    const traceData = Object.keys(data).map((key) => {
      const titleCase = key.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(),
      );
      return {
        label: titleCase,
        value: data[key],
      };
    });

    const plotData = {
      data: [
        {
          labels: traceData.map((obj: any) => obj.label),
          marker: {
            line: {
              color: "white",
              width: 1,
            },
          },
          direction: "counterclockwise",
          showlegend: false,
          hoverinfo: "label+text",
          texttemplate: "%{label}<br>$%{text}",
          textinfo: "label+text",
          rotation: 90,
          textposition: "outside",
          hovertemplate: "%{label}<br>$%{text}<extra></extra>",
          text: traceData.map((obj: any) => formatNumberMagnitude(obj.value)),
          values: traceData.map((obj: any) => obj.value),
          type: "pie",
          domain: {
            x: [0.35, 0.65],
            y: [0, 1],
          },
          sort: false,
          outsidetextfont: {
            color: [
              "#005CA9",
              "#4ADE80",
              "#16A34A",
              "#33BBFF",
              "#F5B166",
              "#EF7D00",
              "#991B1B",
              "#FACCD8",
              "#E93361",
              "#CCBE00",
              "#005CA9",
              "#4ADE80",
              "#16A34A",
              "#33BBFF",
              "#F5B166",
              "#EF7D00",
              "#991B1B",
              "#FACCD8",
              "#E93361",
              "#CCBE00",
            ],
            size: 11,
          },
          textfont: {
            line: {
              color: "white",
              width: 1,
            },
            color: [
              "#005CA9",
              "#4ADE80",
              "#16A34A",
              "#33BBFF",
              "#F5B166",
              "#EF7D00",
              "#991B1B",
              "#FACCD8",
              "#E93361",
              "#CCBE00",
              "#005CA9",
              "#4ADE80",
              "#16A34A",
              "#33BBFF",
              "#F5B166",
              "#EF7D00",
              "#991B1B",
              "#FACCD8",
              "#E93361",
              "#CCBE00",
            ],
          },
        },
      ],
      layout: {
        autosize: true,
        hoverdistance: 2,
        margin: {
          autoexpand: false,
          t: 30,
          b: 30,
          l: 30,
          r: 30,
          pad: 20,
        },
        showlegend: false,
        automargin: false,
        autorange: false,
      },
    };

    return {
      plotData,
      exportData: traceData,
    };
  } catch (e) {
    // console.log(e);
    return { plotData: null, exportData: null };
  }
}

export async function CreateAnalystsPriceTargetPlot(
  analystsData: FMPPriceTarget[],
): Promise<{ plotData: any; exportData: any }> {
  let start_date = analystsData[analystsData.length - 1]?.published_date?.split("T")[0];

  if (dayjs().diff(dayjs(start_date), "month") < 5) {
    start_date = dayjs().subtract(5, "month").format("YYYY-MM-DD");
  }

  const stockData = await fetchEquityPriceHistorical({
    queryParams: {
      symbol: analystsData[0]?.symbol,
      provider: "fmp",
      start_date,
      end_date: dayjs().format("YYYY-MM-DD"),
    },
  }).then((x) => x.results);

  const groupedData = analystsData.reduce((acc: any, obj: FMPPriceTarget) => {
    const key = obj?.published_date?.split("T")[0];
    const priceTarget = round(obj.adj_price_target, 2);
    if (!acc[key]) {
      acc[key] = { [priceTarget]: [] };
    }
    if (!acc[key][priceTarget]) {
      acc[key][priceTarget] = [];
    }
    acc[key][priceTarget].push(obj.analyst_firm);
    return acc;
  }, {});

  const decimalPlaces = stockData.reduce((acc, x) => {
    if (x.close >= 5) return acc;
    const decimalPlaces = x.close.toString().split(".")[1]?.length || 0;
    return decimalPlaces > acc ? decimalPlaces : acc;
  }, 0);

  const tickFormat = decimalPlaces >= 2 ? `,.${decimalPlaces}f` : ",";

  if (!(stockData.length && analystsData.length)) {
    return { plotData: {}, exportData: null };
  }

  const indent = "&nbsp;".repeat(4);
  const indentAnalysts = "&nbsp;".repeat(16);

  const plotData = {
    data: [
      {
        x: stockData.map((x) => x.date),
        y: stockData.map((x) => x.close),
        type: "scatter",
        mode: "lines",
        name: "Close",
        hovertemplate: `<i>%{x}:</i><br>${indent}<b>Close: %{y:.2f}</b><extra></extra>`,
        yaxis: "y",
        xaxis: "x",
        hoverongaps: false,
        hoveron: "points",
        line: {
          width: 2,
        },
      },
      {
        x: analystsData.map((x) => x.published_date),
        y: analystsData.map((x) => x.adj_price_target),
        name: "Price Target",
        mode: "markers",
        yaxis: "y2",
        text: analystsData.map((x) => {
          const date = x.published_date.split("T")[0];

          const targets = Object.keys(groupedData[date])
            .filter((y) => y !== "averagePriceTarget")
            .sort((a, b) => Number(b) - Number(a))
            .map((y) => {
              const analysts = groupedData[date][y];
              return `${indent}<b>$${y}</b> - <b>${analysts.join(`,<br>${indentAnalysts}`)}</b>`;
            })
            .join("<br>");

          return `<i>${date}</i>:<br>${targets}`;
        }),
        hovertemplate: "%{text}<extra></extra>",
        hoverongaps: false,
        hoveron: "points",
        hoverinfo: "text",
        marker: {
          color: "#fb923c",
          line: {
            color: "#fb923c",
            width: 1,
          },
          size: 7,
        },
      },
    ] as PlotData[],
    layout: {
      margin: {
        autoexpand: true,
        l: 20,
        r: 35,
        b: 30,
        t: 10,
        pad: 0,
      },
      yaxis: {
        automargin: true,
        tickformat: tickFormat,
      },
      yaxis2: {
        matches: "y",
        overlaying: "y",
        automargin: true,
        tickformat: tickFormat,
      },
      hovermode: "x unified",
      xaxis: {
        tickformat: "%Y-%m-%d",
        tickangle: 0,
        type: "date",
        tick0: 0.5,
        ticklen: 5,
        tickmode: "auto",
      },
    } as Partial<Layout>,
  };

  return {
    plotData,
    exportData: analystsData.map((x) => ({
      date: x.published_date,
      priceTarget: x.adj_price_target,
      analyst: x.analyst_firm,
      close_price: stockData.find(
        (y) => y.date.split("T")[0] === x.published_date.split("T")[0],
      )?.close,
    })),
  };
}

export function CreatePriceTargetConsensusPlot(data: FMPPriceTargetConsensus): {
  plotData: any;
  exportData: any;
} {
  if (!data) return { plotData: null, exportData: null };
  const ptData = {
    consensus: round(data?.target_consensus || 0, 2),
    median: round(data?.target_median || 0, 2),
    high: round(data?.target_high || 0, 2),
    low: round(data?.target_low || 0, 2),
  };

  if (ptData.high === 0 || ptData.low === 0) {
    return { plotData: null, exportData: null };
  }

  const plotData = {
    data: [
      {
        type: "scatter",
        x: [ptData?.low, ptData?.high],
        showlegend: false,
        y: [0, 0],
        mode: "lines",
        line: {
          width: 2,
          color: "#c8c8c8",
        },
        hoverinfo: "none",
      },
      {
        type: "scatter",
        x: [ptData?.consensus, ptData?.consensus],
        y: [-1.5, 0],
        showlegend: false,
        mode: "lines+text",
        marker: {
          color: "#33BBFF",
          line: {
            width: 1,
          },
        },
        textfont: {
          color: "#33BBFF",
        },
        text: [`Consensus ${ptData?.consensus}`],
        textposition: "bottom center",
        hoverinfo: "none",
      },
      {
        type: "scatter",
        x: [ptData?.consensus],
        y: [0],
        showlegend: false,
        mode: "markers",
        marker: {
          line: {
            width: 1,
          },
          size: 10,
          color: "#33BBFF",
        },
        hovertemplate: "Consensus: %{x}<extra></extra>",
      },
      {
        type: "scatter",
        x: [ptData?.median, ptData?.median],
        y: [1.5, 0],
        showlegend: false,
        mode: "lines+text",
        marker: {
          color: "#fb923c",
          line: {
            width: 1,
          },
        },
        textfont: {
          color: "#fb923c",
        },
        text: [`Median ${ptData?.median}`],
        textposition: "top center",
        hoverinfo: "none",
      },
      {
        type: "scatter",
        x: [ptData?.median],
        y: [0],
        showlegend: false,
        mode: "markers",
        marker: {
          color: "#fb923c",
          line: {
            color: "black",
            width: 1,
          },
          size: 10,
        },
        hovertemplate: "Median: %{x}<extra></extra>",
      },
      {
        type: "scatter",
        x: [ptData?.low],
        y: [0],
        showlegend: false,
        mode: "markers+text",
        marker: {
          size: 10,
          color: "#c8c8c8",
        },
        text: [`Low ${ptData?.low}`],
        textposition: "bottom right",
        hovertemplate: "Low: %{x}<extra></extra>",
      },
      {
        type: "scatter",
        x: [ptData?.high],
        y: [0],
        showlegend: false,
        mode: "markers+text",
        marker: {
          size: 10,
          color: "#c8c8c8",
        },
        text: [`High ${ptData?.high}`],
        textposition: "bottom left",
        hovertemplate: "High: %{x}<extra></extra>",
      },
    ],
    layout: {
      title: "",
      margin: {
        l: 20,
        r: 20,
        b: 10,
        t: 20,
      },
      yaxis: {
        title: "",
        showgrid: false,
        zeroline: false,
        showline: false,
        fixedrange: true,
        showticklabels: false,
        ticklen: 0,
        range: [-3, 3],
      },
      xaxis: {
        title: "",
        autorange: true,
        automargin: false,
        showgrid: false,
        zeroline: false,
        showline: false,
        ticklen: 0,
        range: [ptData?.low, ptData?.high],
        fixedrange: true,
        showticklabels: false,
      },
    },
  };

  return {
    plotData,
    exportData: ptData,
  };
}

const callbacks = {
  CreateAnalystsPriceTargetPlot: CreateAnalystsPriceTargetPlot,
  CreatePriceTargetConsensusPlot: CreatePriceTargetConsensusPlot,
  CreatePieChart: CreatePieChart,
};

export type ChartCallback = keyof typeof callbacks;

export function getChartCallback<T extends ChartCallback>(
  name: T,
): (typeof callbacks)[T] {
  const callback = callbacks[name];
  if (!callback) return null;
  return callback;
}
