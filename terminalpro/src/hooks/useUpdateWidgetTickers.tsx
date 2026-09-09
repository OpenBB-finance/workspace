import { useEffect, useState } from "react";
import type { Ticker } from "~/components/types";
import { useWidgetContext } from "~/components/Widget.context";
import { resultsToTicker } from "~/components/Widgets/Helpers/AdvancedSelectTicker";
import { useQuerySymbols } from "~/lib/api/sdkComponents";
import type { FilterTypes } from "~/lib/api/sdkSchemas";
import { dispatchSaveState } from "~/lib/utils";

export function useUpdateWidgetTickers() {
  const { widget, updateWidget } = useWidgetContext(true);
  const [tickers, setTickers] = useState<Ticker[]>([]);

  useEffect(() => {
    if (!widget) return;

    const mainTicker = widget?.data?.mainTicker;
    const secondaryTickers = widget?.data?.secondaryTickers ?? [];
    if (!mainTicker) return;

    const newTickers = [mainTicker, ...secondaryTickers].filter(
      (ticker) =>
        (ticker?.currency === undefined || ticker?.has_options === undefined) &&
        ticker?.category !== "country",
    );

    if (newTickers?.length) {
      setTickers((prev) => Array.from(new Set([...prev, ...newTickers])));
    }
  }, []);

  const { data, isError } = useQuerySymbols(
    {
      queryParams: tickers?.reduce(
        (acc, ticker) => {
          acc.q += `${ticker?.symbol},`;
          if (ticker?.type && !acc.type.includes(ticker?.type))
            acc.type.push(ticker?.type as FilterTypes);
          return acc;
        },
        { q: "", type: [], limit: tickers?.length },
      ),
    },
    {
      staleTime: 1000 * 60 * 60 * 24 * 7,
      enabled: tickers?.map((ticker) => ticker?.symbol)?.filter(Boolean)?.length > 0,
    },
  );

  useEffect(() => {
    const results = resultsToTicker(data?.results);
    if (!(results?.length && tickers?.length) || isError) return;

    const { mainTicker, secondaryTickers } = results.reduce(
      (acc, ticker) => {
        if (ticker.symbol === widget?.data?.mainTicker?.symbol) {
          acc.mainTicker = ticker;
        }
        if (widget?.data?.secondaryTickers?.some((t) => t.symbol === ticker.symbol)) {
          const index = widget?.data?.secondaryTickers?.findIndex(
            (t) => t.symbol === ticker.symbol,
          );
          acc.secondaryTickers[index] = ticker;
        }
        return acc;
      },
      {
        mainTicker: widget?.data?.mainTicker,
        secondaryTickers: widget?.data?.secondaryTickers,
      },
    );

    if (mainTicker || secondaryTickers?.length) {
      const updateObj = {} as any;

      if (mainTicker) {
        updateObj.mainTicker = mainTicker;
      }
      if (secondaryTickers?.length) {
        updateObj.secondaryTickers = secondaryTickers;
      }

      if (updateObj.mainTicker || updateObj?.secondaryTickers?.length) {
        setTimeout(() => {
          updateWidget((prev) => ({
            ...prev,
            data: { ...prev.data, ...updateObj },
          }));
          setTickers([]);
          setTimeout(() => dispatchSaveState(), 200);
        }, 1000);
      }
    }
  }, [data, tickers, isError]);
}
