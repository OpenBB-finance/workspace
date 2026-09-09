import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import clsx from "clsx";
import dayjs from "dayjs";
import {
  type Dispatch,
  forwardRef,
  memo,
  type SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useResizeDetector } from "react-resize-detector";
import { useNavigate } from "react-router-dom";
import LineChart from "~/components/Charting/LineChart";

import { useEquityPriceHistorical, useEquityPriceQuote } from "~/lib/api/sdkComponents";
import type { FMPEquityQuoteData } from "~/lib/api/sdkSchemas";
import { useTickersContext } from "~/lib/contexts/CachedTickers";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { createEquityTemplateTab } from "~/lib/utils/createTemplates";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { formatNumber, formatNumberMagnitude, formatNumbers } from "~/lib/utils/utils";
import type { SnapShot, StockData } from "../Equity/News/useNewsStockData";

type TickerInfoProps = {
  symbol: string;
  snapshot?: SnapShot;
  variant?: "orange" | "grey";
  openOnClick?: boolean;
  extraTriggerClass?: string;
  inArticle?: boolean;
  invalidTickerInfos?: string[];
  setInvalidTickerInfos?: Dispatch<SetStateAction<string[]>>;
};

export const TickerInfo = forwardRef<HTMLDivElement, TickerInfoProps>(
  (props, _forwardedRef) => {
    const {
      symbol,
      snapshot,
      variant = "grey",
      openOnClick = false,
      extraTriggerClass = "",
      inArticle = false,
      invalidTickerInfos,
      setInvalidTickerInfos,
    } = props;

    const { width, ref } = useResizeDetector({
      refreshMode: "debounce",
      refreshRate: 50,
    });

    const addTab = useShallowAppStore((state) => state.addTab);

    const navigate = useNavigate();

    const [isHovered, setIsHovered] = useState(false);

    const cachedTicker = useTickersContext((state) => state.cachedTickers?.[symbol]);

    const { data } = useEquityPriceQuote(
      {
        queryParams: {
          provider: "fmp",
          symbol: cachedTicker?.symbol,
        },
      },
      {
        enabled:
          !(snapshot?.price || snapshot?.hasSnapshot) &&
          cachedTicker?.symbol !== undefined,
        staleTime: 1000 * 60 * 5,
      },
    );

    const snapshotData = useMemo(() => {
      return data?.results?.map((item) => ({
        ...item,
        symbol,
        price: item?.last_price,
        change: item?.change,
        change_percent: item?.change_percent * 100,
        volume: item?.volume,
        day_range: [item?.low, item?.high],
        year_range: [item?.year_low, item?.year_high],
        market_cap: item?.market_cap,
        exchange: item?.exchange,
      })) as FMPEquityQuoteData[];
    }, [data]);

    const { data: queryData } = useEquityPriceHistorical(
      {
        queryParams: {
          provider: "fmp",
          symbol: symbol.startsWith("$") ? `${symbol.slice(1)}USD` : symbol,
          interval: "15m",
          start_date: dayjs().subtract(1, "week").format("YYYY-MM-DD"),
          sort: "asc",
        },
      },
      {
        enabled: isHovered && cachedTicker?.symbol !== undefined,
        staleTime: 1000 * 60 * 5,
        retry: false,
      },
    ) as { data: { results: StockData[] }; isLoading: boolean; error: any };

    const newSnapshot = useMemo(() => {
      if (snapshot?.price || !snapshotData?.length) return snapshot;
      return snapshotData?.[0];
    }, [snapshotData, snapshot]);

    const memoizedLineChart = useMemo(() => {
      const stockData = queryData?.results;
      if (!stockData?.length) return null;

      const maxDate = Math.max(
        ...(stockData?.map((d) => new Date(d.date).setUTCHours(0, 0, 0, 0)) ?? []),
      );
      const history = stockData?.filter(
        (d) => new Date(d.date).setUTCHours(0, 0, 0, 0) === maxDate,
      );

      return (
        history?.length > 2 && (
          <LineChart
            data={[
              {
                x: history?.map((item) => item?.date),
                y: history?.map((item) => item?.close),
                mode: "lines",
                line: {
                  color: newSnapshot?.change > 0 ? "#16A34A" : "#EF4444",
                },
                type: "scatter",
                hovertemplate: "%{x}<br><b>$%{y:.2f}</b><extra></extra>",
              },
            ]}
            layout={{
              width: width,
              height: 100,
            }}
          />
        )
      );
    }, [queryData, newSnapshot?.change]);

    useEffect(() => {
      if (!(symbol && (memoizedLineChart || newSnapshot?.price))) {
        setInvalidTickerInfos?.((prev) => Array.from(new Set([...prev, symbol])));
      }
      if (symbol && memoizedLineChart && invalidTickerInfos?.includes(symbol)) {
        setInvalidTickerInfos?.((prev) => prev.filter((item) => item !== symbol));
      }
    }, [symbol, memoizedLineChart, newSnapshot?.price]);

    const hoverContentMemo = useMemo(
      () =>
        newSnapshot && (
          <HoverCardPrimitive.Portal>
            <HoverCardPrimitive.Content
              ref={(e) => ref(e)}
              sideOffset={5}
              className="z-60 flex min-w-[262px] animate-fade-in flex-col gap-1 rounded bg-light-50 p-2 text-xs shadow-sm dark:bg-[#24242A] dark:shadow-[0_2px_10px_0_rgba(0,0,0,0.80)]"
            >
              <p className="flex justify-between font-bold">
                <span>
                  {newSnapshot?.exchange}: {symbol}
                </span>
                <span>${formatNumber(newSnapshot?.price, 2)}</span>
              </p>
              <div className="flex justify-between">
                <p className="whitespace-nowrap">
                  {snapshot?.name?.length > 40
                    ? `${snapshot.name?.slice(0, 40)}...`
                    : snapshot?.name}
                </p>
                <p
                  className={clsx("whitespace-nowrap", {
                    "text-green-500": newSnapshot?.change > 0,
                    "text-red-500": newSnapshot?.change < 0,
                  })}
                >
                  {newSnapshot?.change?.toFixed(2)} (
                  {newSnapshot?.change_percent?.toFixed(2)}%)
                </p>
              </div>
              <div className="flex justify-between">
                <p className="whitespace-nowrap">Vol:</p>
                <p>{formatNumber(newSnapshot?.volume)}</p>
              </div>
              <div className="flex justify-between">
                <p className="whitespace-nowrap">Market Cap:</p>
                <p>{formatNumberMagnitude(newSnapshot?.market_cap)}</p>
              </div>
              <div className="flex justify-between">
                <p className="whitespace-nowrap">Day Range:</p>
                <p>{formatNumbers(newSnapshot?.day_range || [], 2).join(" - ")}</p>
              </div>
              <div className="flex justify-between">
                <p className="whitespace-nowrap">52 week range:</p>
                <p>{formatNumbers(newSnapshot?.year_range || [], 2).join(" - ")}</p>
              </div>
              <button
                onClick={() => {
                  if (!symbol) return;
                  if (symbol.startsWith("$")) return;
                  navigate(`/app/charting?ticker=${symbol}`);
                }}
                className="flex h-[calc(100%)] w-[calc(100%)] justify-between"
              >
                {memoizedLineChart}
              </button>
              {cachedTicker?.type === "stock" && (
                <button
                  className="text-left font-bold text-brand-main dark:text-brand-lighter"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const items = useAppStore.getState().items;
                    createEquityTemplateTab(
                      {
                        name: symbol,
                      },
                      {
                        addTab,
                        navigate: null,
                        items,
                        defaultTicker: cachedTicker || {
                          symbol,
                          category: "equity",
                          id: symbol,
                          type: "stock",
                          name: newSnapshot?.name,
                        },
                      },
                    );
                    showNotificationWithRememberMe({
                      id: NotificationId.DashboardCreated,
                      message: "Dashboard created",
                      description: `Created dashboard for ${symbol} you can navigate to it from the sidebar.`,
                      toastType: "success",
                    });
                  }}
                >
                  {`Create dashboard for ${symbol}`}
                </button>
              )}
            </HoverCardPrimitive.Content>
          </HoverCardPrimitive.Portal>
        ),
      [newSnapshot, cachedTicker, memoizedLineChart, ref, symbol],
    );

    if (!symbol) return null;
    if (memoizedLineChart && !newSnapshot?.price)
      return inArticle ? <span>{symbol}</span> : null;

    return (
      <HoverCardPrimitive.Root openDelay={300} key={symbol}>
        <HoverCardPrimitive.Trigger
          onClick={() => {
            if (!openOnClick) return;
            if (symbol.startsWith("$")) return;
            const items = useAppStore.getState().items;
            createEquityTemplateTab(
              {
                name: symbol,
              },
              {
                addTab,
                navigate,
                items,
                defaultTicker: cachedTicker || {
                  symbol,
                  category: "equity",
                  id: symbol,
                  type: "stock",
                  name: newSnapshot?.name,
                },
              },
            );
          }}
          className={clsx(
            "w-fit not-prose whitespace-nowrap rounded px-1 py-px text-2xs tracking-wide text-[#474747] dark:text-[#A2A2A2]",
            {
              "bg-[#FED7AA] tracking-wide text-light-700 dark:bg-[#7C2D12] dark:text-[#A2A2A2]":
                variant === "orange",
              "bg-light-100 tracking-wide text-light-700 dark:bg-[#2A2A31] dark:text-[#A2A2A2]":
                variant === "grey",
            },
            extraTriggerClass,
          )}
          onMouseEnter={() => !isHovered && setIsHovered(true)}
        >
          {symbol}
          {!!newSnapshot?.change_percent && (
            <span
              className={clsx("ml-1 tracking-wide", {
                "text-green-500": newSnapshot?.change > 0,
                "text-red-500": newSnapshot?.change < 0,
              })}
            >
              {`(${newSnapshot?.change_percent?.toFixed(2)}%)`}
            </span>
          )}
        </HoverCardPrimitive.Trigger>
        {hoverContentMemo}
      </HoverCardPrimitive.Root>
    );
  },
);

export default memo(TickerInfo);
