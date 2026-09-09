import clsx from "clsx";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { Plot } from "~/components/Charting/PlotlyChart";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import Icon from "~/components/Icon";
import { useWidgetContext } from "~/components/Widget.context";
import { useEquityPriceHistorical } from "~/lib/api/sdkComponents";
import { formatNumberMagnitude, US_EXCHANGES } from "~/lib/utils";
import AdvancedSelectedTicker from "../Helpers/AdvancedSelectTicker";

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
  type: "date",
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

export default function SingleBarOverview() {
  const { widget } = useWidgetContext();
  const [open, setOpen] = useState(false);

  const handleMouseEnter = () => {
    setOpen(true);
  };

  const handleMouseLeave = () => {
    setOpen(false);
  };

  const currentDate = dayjs().tz("America/New_York");

  const { data, dataUpdatedAt, error, isLoading } = useEquityPriceHistorical(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
        interval: currentDate.day() <= 3 ? "15m" : "1d",
        start_date:
          currentDate.day() <= 2
            ? currentDate.subtract(1, "week").startOf("week").format("YYYY-MM-DD")
            : currentDate.startOf("week").format("YYYY-MM-DD"),
        sort: "asc",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 5,
    },
  );

  const performanceQuery = useEquityPriceHistorical(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget.data?.mainTicker?.symbol ?? "AAPL",
        interval: "1d",
        start_date: currentDate
          .subtract(2, "week")
          .startOf("week")
          .format("YYYY-MM-DD"),
        sort: "asc",
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 60 * 24 * 7,
    },
  );

  const marketData = useMemo(() => {
    const performanceData = performanceQuery?.data?.results;
    if (data?.results?.length > 0 && performanceData?.length > 0) {
      const lastDay = performanceData?.at(-1);
      const previousDay = performanceData?.at(-2) || performanceData?.at(-1);

      const lastDayChange = lastDay?.close - previousDay?.close;
      const lastDayChangePercentage =
        ((lastDay?.close - previousDay?.close) / previousDay?.close) * 100;

      const minMax = data?.results.reduce(
        (acc, item) => {
          if (item.low < acc.min) acc.min = item.low;
          if (item.high > acc.max) acc.max = item.high;
          return acc;
        },
        { min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER },
      );

      return {
        history: data?.results,
        lastDayClose: lastDay?.close,
        lastDayChange,
        lastDayChangePercentage,
        prevClose: previousDay?.close,
        positive: lastDayChange > 0,
        lastDayVolume: lastDay?.volume,
        yRange: [minMax.min, minMax.max],
      };
    }
  }, [data, performanceQuery?.data]);

  const plotData = useMemo(() => {
    if (marketData?.history?.length === 0) return;
    if (!marketData?.history) return;

    const combined = marketData.history;
    const yRange = marketData.yRange;

    const tracedata = [
      {
        x: marketData.history.map((item) => item.date),
        y: marketData.history.map((item) => item.close),
        mode: "lines",
        line: {
          color: marketData.positive ? "#007500" : "#c80000",
          width: 2,
        },
        xhoverformat: "%b %d",
        fill: marketData.positive ? "tozeroy" : "tonexty",
        fillcolor: marketData.positive
          ? "rgba(22, 163, 74, 0.35)"
          : "rgba(239, 68, 68, 0.25)",
        type: "scatter",
        yaxis: "y",
        hovertemplate: "%{x}<br>%{y:,.2f}<extra></extra>",
        hoverlabel: {
          font: {
            size: 10,
          },
        },
        connectgaps: false,
        xaxis: "x",
      },
    ];

    const gaps = [];
    for (let i = 0; i < combined.length - 1; i++) {
      const current = dayjs(combined[i].date).tz("America/New_York");
      const next = dayjs(combined[i + 1].date).tz("America/New_York");
      if (dayjs(next).diff(current, "minute") > 15) {
        gaps.push({
          from: current.add(59, "second").format(),
          to: next.format(),
        });
      }
    }

    const plotLayout = {
      showlegend: false,
      margin: {
        l: 0,
        r: 0,
        t: 50,
        b: 0,
      },
      width: 200,
      height: 130,
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      xaxis: {
        ...defaultXaxis,
        rangebreaks: gaps.map((gap) => ({
          bounds: [gap.from, gap.to],
        })),
        // set range from first combined date to the same time the maxDay
        range: [combined[0].x, combined[combined.length - 1].x],
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
      // annotations: [
      //   {
      //     xref: "paper",
      //     yref: "paper",
      //     x: 0,
      //     xanchor: "left",
      //     y: 1.2,
      //     yanchor: "top",
      //     text: "Weekly",
      //     showarrow: false,
      //     font: {
      //       family: "Inter",
      //       size: 12,
      //       color: "#A2A2A2",
      //     },
      //   },
      // ],
    };

    return {
      data: tracedata,
      layout: plotLayout,
      marketData,
    };
  }, [marketData, dataUpdatedAt]);

  const memoizedLineChart = useMemo(() => {
    if (!(plotData?.data && plotData?.layout)) return null;
    return (
      <Plot
        data={plotData?.data as any}
        layout={plotData?.layout as any}
        config={{
          displaylogo: false,
          responsive: true,
          displayModeBar: false,
        }}
      />
    );
  }, [plotData?.data, plotData?.layout]);

  const aiData = useMemo(() => {
    if (marketData && widget?.data?.mainTicker) {
      return {
        symbol: widget?.data?.mainTicker?.symbol,
        last_quote: marketData.lastDayClose,
        prev_close: marketData.prevClose,
        day_change: marketData.lastDayChange,
        day_change_percent: marketData.lastDayChangePercentage,
        day_volume: marketData.lastDayVolume,
      };
    }
  }, [widget?.data?.mainTicker, marketData]);

  const memorizedElement = useMemo(() => {
    if (!memoizedLineChart) return null;

    const isETF = widget?.data?.mainTicker?.category === "etf";
    const properties = isETF
      ? ["market_cap_range", "sector", "country", "exchange"]
      : ["industry", "country", "exchange"];

    const tickerInfo = properties
      .filter((key) => widget?.data?.mainTicker?.[key])
      .map((key) => widget?.data?.mainTicker?.[key]);

    return (
      <div className="flex h-full w-full justify-between">
        <div className="flex gap-3">
          <div className="-mt-6">{memoizedLineChart}</div>

          <div className="mt-2 flex flex-col gap-2 _widget-content">
            {marketData?.history?.length > 0 && (
              <>
                <div className="flex gap-2">
                  <div className="text-xs">
                    <p>Price</p>
                    <span className="font-bold text-sm">
                      $
                      {marketData?.history[
                        marketData?.history.length - 1
                      ].close.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <p>Day's Change</p>
                    <span
                      className={clsx("inline-flex font-bold text-sm", {
                        "text-green-500": marketData?.lastDayChange > 0,
                        "text-red-500": marketData?.lastDayChange < 0,
                      })}
                    >
                      <span className="inline-flex items-center gap-1 mr-1">
                        <Icon
                          className="w-[14px] h-[14px] -mt-0.5"
                          id={
                            marketData?.lastDayChange > 0
                              ? "arrow-block-up"
                              : "arrow-block-down"
                          }
                        />
                        {marketData?.lastDayChange.toFixed(2)}
                      </span>
                      <span>
                        {`(${
                          marketData?.lastDayChange > 0 ? "+" : ""
                        }${marketData?.lastDayChangePercentage.toFixed(2)}%)`}
                      </span>
                    </span>
                  </div>
                </div>
                {/* ## only show for US exchanges, equity */}
                {US_EXCHANGES.includes(widget?.data?.mainTicker?.exchange) &&
                  widget?.data?.mainTicker?.category === "equity"}
                <p className="text-xs">
                  Volume:{" "}
                  <strong>{formatNumberMagnitude(marketData?.lastDayVolume)}</strong>
                </p>
              </>
            )}
            {tickerInfo && <p>{tickerInfo.join(" | ")}</p>}
          </div>
        </div>
      </div>
    );
  }, [memoizedLineChart, marketData, widget?.data?.mainTicker, open]);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={aiData}
      lastUpdated={dataUpdatedAt}
      elementRightNextToTitle={<AdvancedSelectedTicker triggerSize="sm" />}
      loading={isLoading}
      error={error || data?.results?.length === 0}
      settings={{
        showMove: true,
        showExport: true,
        showDuplicate: true,
      }}
      extraClassName="!mb-1"
    >
      <SetLoadingOnResize>{memorizedElement}</SetLoadingOnResize>
    </DraggableCard>
  );
}
