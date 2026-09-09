import clsx from "clsx";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type {
  FMPEquityHistoricalData as FMPEquityHistorical,
  FMPEquityQuoteData,
} from "~/lib/api/sdkSchemas";
import { type Ticker, useShallowAppStore } from "~/lib/state/app";
import { formatNumber } from "~/lib/utils";
import { createChartingTemplateTab } from "~/lib/utils/createTemplates";
import type { INDICES } from "~/seeds/randomSeed";
import { Plot } from "./PlotlyChart";

const defaultXaxis = {
  showgrid: false,
  showticklabels: false,
  showline: false,
  zeroline: false,
  hovertemplate: "%{x|%b %d, %Y}<br>%{y:,.2f}<extra></extra>",
  rangeslider: {
    visible: false,
  },
  anchor: "y",
  type: "category",
  autotick: true,
  autoticks: true,
  automargin: true,
};

const defaultYaxis = {
  showgrid: false,
  showticklabels: false,
  rangeslider: {
    visible: false,
  },
  anchor: "x",
  type: "linear",
};

export default function TopMarketOverviewItem({
  market,
  width,
  quote,
  data,
  regexs,
  dataUpdatedAt,
}: {
  market: Partial<(typeof INDICES)[0]>;
  width?: number;
  quote?: FMPEquityQuoteData;
  data?: FMPEquityHistorical[];
  regexs?: { prevDay: RegExp; currentDay: RegExp };
  dataUpdatedAt?: number;
}) {
  const { addTab, items } = useShallowAppStore((state) => ({
    addTab: state.addTab,
    items: state.items,
  }));
  const navigate = useNavigate();
  const { memoizedLineChart, quoteData } = useMemo(() => {
    const maxPrev = { maxDay: data?.at(-1)?.date, prevDay: null };
    if (data?.length > 0)
      for (let i = data?.length - 1; i >= 0; i--) {
        if (regexs.prevDay.test(data[i].date)) {
          maxPrev.prevDay = data[i].date;
          break;
        }
      }

    const marketData = data?.reduce(
      (acc, d) => {
        const date = dayjs(d.date);
        let key = null;
        if (regexs.prevDay.test(d.date)) {
          key = "prev";
        } else if (regexs.currentDay.test(d.date)) {
          key = "current";
        }

        if (key !== null) {
          acc[key].x.push(d.date);
          acc[key].y.push(Number(d.close));
          acc[key].customdata.push(date.format("MMM D h:mm:ss"));
          acc.yMax = Math.max(acc.yMax, Number(d.high));
          acc.yMin = Math.min(acc.yMin, Number(d.low));
        }

        return acc;
      },
      {
        prev: { x: [], y: [], high: [], low: [], customdata: [] },
        current: { x: [], y: [], high: [], low: [], customdata: [] },
        yMax: Number.MIN_SAFE_INTEGER,
        yMin: Number.MAX_SAFE_INTEGER,
        maxDay: dayjs(maxPrev.maxDay).valueOf(),
        prevMaxDay: dayjs(maxPrev.prevDay).valueOf(),
      },
    );

    if (
      !(
        quote?.last_price &&
        marketData?.prev?.x?.length &&
        marketData?.current?.x?.length
      )
    )
      return { memoizedLineChart: null, quoteData: null };

    const quoteData = {
      price: Number(quote.last_price),
      change: Number(quote.change),
      changes_percentage: Number(quote.change_percent * 100),
      previous_close: Number(quote.prev_close),
    };
    const { current, prev, maxDay, yMax, yMin } = marketData || {};

    // fixes gap
    current.x = [maxPrev.prevDay].concat(current.x);
    current.y = [quoteData.previous_close].concat(current.y);
    prev.x.push(maxPrev.prevDay);
    prev.y.push(prev.y[prev.y.length - 1]);

    let yRange = [yMin, yMax];
    if (quoteData.previous_close) {
      // make sure that prevClose is always in the middle of the chart
      const diff = Math.abs(yRange[1] - yRange[0]);
      yRange = [
        Math.min(quoteData.previous_close - diff / 2, yRange[0]),
        Math.max(quoteData.previous_close + diff / 2, yRange[1]),
      ];
    }

    const tracedata = [
      {
        x: prev.x,
        y: Array(prev.x.length).fill(yRange[1]),
        mode: "lines",
        line: { width: 0 },
        type: "scatter",
        yaxis: "y",
        hoverinfo: "none",
        connectgaps: false,
        xaxis: "x",
      },
      {
        x: prev.x,
        y: prev.y,
        mode: "lines",
        hovertemplate: "%{customdata}<br>%{y:,.2f}<extra></extra>",
        customdata: prev.customdata,
        line: {
          // transparent grey
          color: "rgba(200, 200, 200, 1)",
        },
        type: "scatter",
        fill: quoteData.change >= 0 ? "tozeroy" : "tonextx",
        fillcolor: "rgba(200, 200, 200, 0.25)",
        yaxis: "y",
        hoverlabel: {
          font: {
            size: 8,
          },
        },
        connectgaps: false,
        xaxis: "x",
      },
      {
        x: prev.x,
        y: Array(prev?.x?.length).fill(quoteData.previous_close),
        type: "scatter",
        mode: "lines",
        yaxis: "y",
        xaxis: "x",
        line: {
          color: "white",
          width: 1,
          dash: "dot" as const,
        },
        hovertemplate: "Prev Close:<br> %{y:,.2f}<extra></extra>",
        hoverlabel: {
          font: {
            size: 8,
          },
        },
        connectgaps: false,
      },
      ...((marketData.prevMaxDay < maxDay && [
        {
          x: [maxPrev.prevDay, maxPrev.prevDay],
          y: yRange,
          type: "scatter",
          mode: "lines",
          xaxis: "x",
          yaxis: "y",
          line: {
            color: "grey",
            width: 2,
          },
          hovertemplate: "Market Open: %{x|%b %d, %Y}<extra></extra>",
          hoverlabel: {
            font: {
              size: 8,
            },
          },
        },
      ]) ||
        []),
      {
        x: current.x,
        y: Array(current.x.length).fill(yRange[1]),
        mode: "lines",
        line: { width: 0 },
        type: "scatter",
        yaxis: "y",
        hoverinfo: "none",
        connectgaps: false,
        xaxis: "x",
      },
      {
        x: current.x,
        y: current.y,
        mode: "lines",
        line: {
          color: quoteData.change >= 0 ? "#007500" : "#c80000",
          width: 2,
        },
        customdata: current.customdata,
        fill: quoteData.change >= 0 ? "tozeroy" : "tonexty",
        fillcolor:
          quoteData.change >= 0 ? "rgba(22, 163, 74, 0.35)" : "rgba(239, 68, 68, 0.25)",
        type: "scatter",
        yaxis: "y",
        hovertemplate: "%{customdata}<br>%{y:,.2f}<extra></extra>",
        hoverlabel: {
          font: {
            size: 8,
          },
        },
        connectgaps: false,
        xaxis: "x",
      },
      {
        x: current.x,
        y: Array(current.x.length).fill(quoteData.previous_close),
        type: "scatter",
        mode: "lines",
        yaxis: "y",
        xaxis: "x",
        line: {
          color: "white",
          width: 1,
          dash: "dot" as const,
        },
        hovertemplate: "Prev Close:<br> %{y:,.2f}<extra></extra>",
        hoverlabel: {
          font: {
            size: 8,
          },
        },
        connectgaps: false,
      },
    ];

    const plotLayout = {
      showlegend: false,
      margin: {
        l: 0,
        r: 0,
        t: 0,
        b: 40,
      },
      width: (width ?? 200) - 10,
      height: 100,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        ...defaultXaxis,
        range: [prev.x[0], maxDay],
      },
      yaxis: { ...defaultYaxis, range: yRange },
      yaxis2: { ...defaultYaxis, overlaying: "y", range: yRange },
      yaxis3: { ...defaultYaxis, overlaying: "y", range: yRange },
      hoverlabel: {
        bgcolor: "rgba(0,0,0,0.8)",
        font: {
          size: 8,
        },
      },
      datarevision: dataUpdatedAt,
      dragmode: false,
      hoverdistance: 100,
      hovermode: "closest",
    };

    if (!tracedata?.length) return null;
    return {
      quoteData,
      memoizedLineChart: (
        <Plot
          key={market?.id + quoteData?.price}
          divId={market?.id + quoteData?.price}
          data={tracedata as any}
          layout={plotLayout as any}
          config={{
            displaylogo: false,
            responsive: true,
            displayModeBar: false,
          }}
        />
      ),
    };
  }, [quote, data]);

  if (!(quoteData?.price && memoizedLineChart)) return null;

  return memoizedLineChart ? (
    <div className="flex gap-1 _widget-content" key={market?.label + market?.id}>
      <div className="flex flex-col gap-[0.5] text-xs">
        <p
          className="font-bold dark:text-brand-lighter text-brand-main underline underline-offset-1"
          title={market?.name}
        >
          <button
            onClick={() => {
              createChartingTemplateTab({
                addTab: addTab,
                items: items,
                navigate,
                defaultTicker: {
                  id: market?.id,
                  symbol: market?.symbol,
                  category: market?.type === "index" ? "index" : "equity",
                } as Ticker,
              });
            }}
          >
            {market?.type === "index"
              ? market?.name
                  ?.replace(" Index", "")
                  .replace(" Average", "")
                  .replace(" Composite", "")
                  .replace("Total Return", "TR")
              : market?.symbol}
          </button>
        </p>
        <div className="flex flex-col gap-1">
          <p className="font-bold">{formatNumber(quoteData?.price, 2)}</p>
          <p
            className={clsx("whitespace-nowrap", {
              "text-green-500": quoteData?.change > 0,
              "text-red-500": quoteData?.change <= 0,
            })}
          >
            {quoteData?.change > 0 ? "+" : ""}
            {formatNumber(quoteData?.change, 2)} (
            {quoteData?.changes_percentage > 0 ? "+" : ""}
            {formatNumber(quoteData?.changes_percentage, 2)}
            %)
          </p>
        </div>
      </div>
      <div className="h-full w-full">{memoizedLineChart}</div>
    </div>
  ) : null;
}
