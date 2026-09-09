import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useQueriesEquityPriceQuote } from "~/lib/api/sdkQueries";
import type {
  BenzingaCompanyNewsData as BenzingaCompanyNews,
  FMPEquityHistoricalData as FMPEquityHistorical,
} from "~/lib/api/sdkSchemas";
import { useTickersContext } from "~/lib/contexts/CachedTickers";

export const DateRangeSchema = z.object({
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
});
export type TDateRangeForm = z.infer<typeof DateRangeSchema>;

export type StockData = FMPEquityHistorical & {
  symbol: string;
};

export type SnapShot = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  day_range: [number, number];
  year_range: [number, number];
  market_cap: number;
  exchange: string;
  history: StockData[];
  hasSnapshot: boolean;
  asset_type: string;
};

export type NewsData = BenzingaCompanyNews & {
  stocks: SnapShot[];
  images: {
    [key: string]: string;
  }[];
};

export type NewsQueryResults = BenzingaCompanyNews &
  { stocks: any; channels: any; tags: any }[];

function getUniqueSymbols(
  newsData: BenzingaCompanyNews & { stocks: any; channels: any; tags: any }[],
  slice?: number,
): string[] {
  return newsData
    ?.flatMap((news) =>
      slice ? news?.stocks?.slice(0, slice) : (news?.stocks as string[]),
    )
    ?.reduce((acc, stock) => {
      // if $ symbol is present, we remove it and add USD to the end
      let symbol = stock.replace("/", "-").replace(".", "-");
      if (symbol?.includes("$")) {
        symbol = `${symbol?.replace("$", "")}USD`;
      }
      if (!acc.includes(symbol)) {
        acc.push(symbol);
      }
      return acc;
    }, [] as string[]);
}

export function useNewsStockData({ newsData }: { newsData: NewsQueryResults }) {
  const [uniqueSymbols, setUniqueSymbols] = useState<string[]>([]);

  const queryTickers = useTickersContext((store) => store.queryTickers);

  useEffect(() => {
    if (!newsData?.length) return;
    setUniqueSymbols((prev) => {
      const newSymbols = getUniqueSymbols(newsData, 5);
      if (newSymbols.every((symbol) => prev.includes(symbol))) return prev;
      return newSymbols;
    });
  }, [newsData]);

  useEffect(() => {
    if (!(uniqueSymbols?.length && newsData?.length)) return;

    queryTickers({
      tickers: getUniqueSymbols(newsData)?.join(","),
      filter: "stock",
    });
  }, [uniqueSymbols]);

  const snapshotResults = useQueriesEquityPriceQuote(
    {
      queryParams: {
        provider: "fmp",
        symbol: uniqueSymbols?.join(","),
      },
    },
    {
      enabled: uniqueSymbols?.length > 0,
      staleTime: 1000 * 60 * 5,
      placeholderData: keepPreviousData,
    },
  );

  const snapshotData =
    snapshotResults
      ?.filter((result) => result.data)
      ?.flatMap(
        ({ data }) =>
          data.results?.map((snapshot) => ({
            symbol: snapshot?.symbol,
            price: snapshot?.last_price,
            change: snapshot?.change,
            change_percent: snapshot?.change_percent * 100,
            volume: snapshot?.volume,
            day_range: [snapshot?.low, snapshot?.high],
            year_range: [snapshot?.year_low, snapshot?.year_high],
            market_cap: snapshot?.market_cap,
            exchange: snapshot?.exchange,
          })) as SnapShot[],
      ) || [];

  return { snapshotData };
}
