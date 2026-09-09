import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef } from "react";
import { useDebounceValue } from "usehooks-ts";
import DraggableCard, { SetLoadingOnResize } from "~/components/DraggableCard";
import { Button } from "~/components/ds/atoms/Button";
import { useIsFirstRender } from "~/components/General/Table/hooks/utils";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useEquityPriceHistorical, useEquityPriceQuote } from "~/lib/api/sdkComponents";
import type { FMPEquityHistoricalData, FMPEquityQuoteData } from "~/lib/api/sdkSchemas";
import type { Ticker } from "~/lib/state/app";
import { INDICES } from "~/seeds/randomSeed";
import TopMarketOverviewItem from "../../Charting/TopMarketOverviewItem";
import AdvancedSelectedTickers from "../Helpers/AdvancedSelectedTickers";

function validSymbolData<
  Quote extends FMPEquityQuoteData,
  Historical extends FMPEquityHistoricalData,
>(symbol: string, quote: Quote[], data: Historical[], dailyData: Historical[]) {
  return (
    quote?.find((q) => q.symbol === symbol) &&
    data?.find((d) => d.symbol === symbol) &&
    dailyData?.find((d) => d.symbol === symbol)
  );
}

export default function TopBarOverview({
  showClose = true,
  showEllipsisMenu = true,
}: {
  showClose?: boolean;
  showEllipsisMenu?: boolean;
}) {
  const { widget, updateWidget } = useWidgetContext();
  const ref = useRef<HTMLDivElement | null>(null);
  const isFirstRender = useIsFirstRender();

  const elements = useMemo(() => {
    return (
      widget?.storage?.securities?.filter((security) => security.active) ?? INDICES
    );
  }, [widget?.storage?.securities]);

  const [state, dispatch] = useStateReducer({
    scrollPosition: 0,
    disabledLeft: true,
    disabledRight: true,
    disabledChevron: true,
  });

  const [debouncedScrollPosition] = useDebounceValue(state.scrollPosition, 100, {
    leading: true,
    maxWait: 100,
  });

  useEffect(() => {
    const disabledLeft = debouncedScrollPosition === 0;
    const disabledRight =
      (ref.current?.scrollWidth || ref.current?.clientWidth) === undefined ||
      Math.ceil(debouncedScrollPosition + ref.current?.clientWidth) >=
        ref.current?.scrollWidth;

    const disabledChevron = disabledLeft && disabledRight;

    dispatch({ disabledLeft, disabledRight, disabledChevron });
  }, [
    ref.current?.scrollWidth,
    ref.current?.clientWidth,
    debouncedScrollPosition,
    elements?.length,
  ]);

  const symbol = useMemo(
    () => Array.from(new Set(elements.map((market) => market?.symbol))).join(","),
    [elements],
  );

  useEffect(() => {
    if (isFirstRender && !widget?.storage?.params?.symbol) {
      updateWidget((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          params: {
            ...(prev.storage?.params ?? {}),
            symbol: symbol,
          },
        },
      }));
    }
  }, [symbol, widget?.storage?.params?.symbol]);

  const { data: dailyData } = useEquityPriceHistorical(
    {
      queryParams: {
        symbol: symbol,
        provider: "fmp",
        interval: "1d",
        start_date: dayjs().subtract(1, "week").format("YYYY-MM-DD"),
        sort: "asc",
      },
    },
    {
      enabled: symbol.length > 0,
      staleTime: 1000 * 60 * 5,
    },
  );

  const {
    data: intraDayData,
    dataUpdatedAt,
    isLoading,
  } = useEquityPriceHistorical(
    {
      queryParams: {
        symbol: symbol,
        provider: "fmp",
        interval: "15m",
        start_date: dayjs().subtract(1, "week").format("YYYY-MM-DD"),
        sort: "asc",
      },
    },
    {
      enabled: symbol.length > 0,
      staleTime: 1000 * 60 * 5,
    },
  );

  const { isLoading: quoteLoading, data: quote } = useEquityPriceQuote(
    {
      queryParams: {
        provider: "fmp",
        symbol: symbol,
      },
    },
    {
      enabled: symbol.length > 0,
      staleTime: 1000 * 60 * 5,
    },
  );

  const memoElements = useMemo(() => {
    return elements
      .filter((market) =>
        validSymbolData(
          market?.symbol,
          quote?.results,
          intraDayData?.results,
          dailyData?.results,
        ),
      )
      .map((market) => {
        const dayData = dailyData?.results
          ?.filter((d) => d.symbol === market?.symbol)
          .slice(-2);
        const regexs = {
          prevDay: new RegExp(`${dayData?.at(-2)?.date?.split("T")?.[0]}`),
          currentDay: new RegExp(`${dayData?.at(-1)?.date?.split("T")?.[0]}`),
        };

        const stockData = intraDayData?.results?.filter(
          (d) =>
            (regexs.prevDay.test(d.date) || regexs.currentDay.test(d.date)) &&
            d.symbol === market?.symbol,
        );

        const quoteData =
          quote?.results?.find((q) => q.symbol === market?.symbol) ?? {};

        return (
          <TopMarketOverviewItem
            market={market}
            key={market?.id + widget?.id}
            regexs={regexs}
            width={140 - elements?.length * 5}
            data={stockData}
            quote={quoteData as FMPEquityQuoteData}
            dataUpdatedAt={dataUpdatedAt}
          />
        );
      });
  }, [dataUpdatedAt, intraDayData, quote, dailyData, elements, quoteLoading]);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollBy({
        left: 0,
        behavior: "smooth",
      });
    }
    dispatch({ scrollPosition: 0 });
  }, [elements?.length, memoElements]);

  const aiData = useMemo(() => {
    if (!quote?.results) return null;
    return quote.results.map((item) => {
      return {
        symbol: item.symbol,
        last_quote: item.last_price,
        prev_close: item.prev_close,
        day_change: item.change,
        day_change_percent: item.change_percent * 100,
        day_volume: item.volume,
      };
    });
  }, [quote?.results]);

  return (
    <DraggableCard
      widgetIdFallback={"market_indices"}
      aiEnabled={true}
      aiData={aiData}
      extraClassName="overflow-y-hidden h-[65%]!"
      showEllipsisMenu={showEllipsisMenu}
      showClose={showClose}
      loading={isLoading || quoteLoading}
      lastUpdated={dataUpdatedAt}
      elementNextToTitle={
        <AdvancedSelectedTickers
          tickers={elements as Ticker[]}
          setTickers={(tickers) => {
            const newTickers = tickers.map((ticker) => ({
              ...ticker,
              label: ticker.id,
              active: true,
            }));

            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                params: {
                  ...(prev.storage?.params ?? {}),
                  symbol: newTickers
                    .filter((t) => t.active)
                    .map((t) => t.symbol)
                    .join(","),
                },
                securities: newTickers,
              },
            }));
          }}
          triggerSize="sm"
        />
      }
    >
      <div className="flex justify-between gap-0">
        {!state.disabledChevron && (
          <div className="flex-col">
            <Button
              variant="secondary"
              disabled={state.disabledLeft}
              className="h-full max-h-[60px] w-[26px] p-0"
              onClick={() => {
                if (ref.current) {
                  ref.current.scrollBy({
                    left: -ref.current.clientWidth,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <ChevronLeftIcon />
            </Button>
          </div>
        )}
        <SetLoadingOnResize
          ref={(el) => (ref.current = el)}
          className="mx-2.5 flex w-full snap-x snap-mandatory gap-10 overflow-x-auto"
          // @ts-expect-error
          onScroll={(e) => dispatch({ scrollPosition: e.target.scrollLeft })}
        >
          {memoElements}
        </SetLoadingOnResize>
        {!state.disabledChevron && (
          <div className="flex-col">
            <Button
              variant="secondary"
              disabled={state.disabledRight}
              className="h-full max-h-[60px] w-[26px] p-0"
              onClick={() => {
                if (ref.current) {
                  ref.current.scrollBy({
                    left: ref.current.clientWidth,
                    behavior: "smooth",
                  });
                }
              }}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        )}
      </div>
    </DraggableCard>
  );
}
