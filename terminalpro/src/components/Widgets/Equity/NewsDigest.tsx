import dayjs from "dayjs";
import { useMemo, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "~/components/ds/molecules/Tabs";
import { DecreaseFontSizeIcon, IncreaseFontSizeIcon } from "~/components/Icons";
import { useWidgetContext } from "~/components/Widget.context";
import {
  useEquityPriceHistorical,
  useEquityPriceQuote,
  useNewsCompany,
} from "~/lib/api/sdkComponents";
import type { FMPEquityQuoteData as EquityQuote } from "~/lib/api/sdkSchemas";
import { useShallowAppStore } from "~/lib/state/app";
import { cn, formatDate } from "~/lib/utils";
import TickerInfo from "../Helpers/TickerInfo";
import { ExternalLinkDialog } from "./News/NewsDialog";
import type { SnapShot, StockData } from "./News/useNewsStockData";

type GroupData = {
  companies: { [key: string]: any[] };
  sectors: { [key: string]: any[] };
};

export default function NewsDigest() {
  const { activeDashboardId, widget } = useWidgetContext();
  const tab = useShallowAppStore((state) => state.getTabById(activeDashboardId));

  const watchlistTickers = tab?.data?.widgets?.find(
    (widget) => widget.widgetId === "watchlist",
  )?.data?.secondaryTickers;

  const secondaryTickers = useMemo(() => {
    if (widget?.data?.secondaryTickers && widget?.data?.secondaryTickers?.length > 0) {
      return widget?.data?.secondaryTickers;
    }

    return watchlistTickers ?? [];
  }, [widget?.data?.secondaryTickers, watchlistTickers]);

  const secondaryTickersSymbols = useMemo(() => {
    return secondaryTickers.map((ticker) => ticker.symbol).join(",");
  }, [secondaryTickers]);

  const { data, isLoading, dataUpdatedAt, error } = useNewsCompany(
    {
      queryParams: {
        provider: "fmp",
        symbol: secondaryTickersSymbols,
      },
    },
    {
      enabled: secondaryTickersSymbols && secondaryTickersSymbols.length > 0,
      staleTime: 1000 * 60 * 5,
      select: (data) => {
        return data?.results;
      },
    },
  );

  const groupedData = useMemo(() => {
    if (!data) return null;
    return data?.reduce(
      (acc, item) => {
        const { symbols, symbol_type } = item;

        if (symbol_type === "Company") {
          if (!acc.companies[symbols]) acc.companies[symbols] = [];
          acc.companies[symbols].push(item);
        } else if (symbol_type === "Industry") {
          if (!acc.sectors[symbols]) acc.sectors[symbols] = [];
          acc.sectors[symbols].push(item);
        }

        return acc;
      },
      {
        companies: {},
        sectors: {},
      } as GroupData,
    );
  }, [data]);

  const { data: snapshotData } = useEquityPriceQuote(
    {
      queryParams: {
        provider: "fmp",
        symbol: secondaryTickersSymbols,
      },
    },
    {
      enabled: secondaryTickersSymbols && secondaryTickersSymbols.length > 0,
      staleTime: 1000 * 60 * 5,
      select: (data) => {
        return data?.results;
      },
    },
  ) as { data: EquityQuote[]; isLoading: boolean; error: any };

  const { data: stockData } = useEquityPriceHistorical(
    {
      queryParams: {
        provider: "fmp",
        symbol: secondaryTickersSymbols,
        interval: "15m",
        start_date: dayjs().subtract(1, "week").format("YYYY-MM-DD"),
        sort: "asc",
      },
    },
    {
      enabled: secondaryTickersSymbols && secondaryTickersSymbols.length > 0,
      staleTime: 1000 * 60 * 5,
      retry(failureCount: number, error: any) {
        if (error.status === 400) return false;
        if (failureCount < 3) return true;
        return false;
      },
      select: (data: any) => {
        return data?.results as StockData[];
      },
    },
  ) as { data: StockData[]; isLoading: boolean; error: any };

  const combinedData = useMemo(() => {
    if (!(secondaryTickers && snapshotData && stockData)) return null;
    return secondaryTickers?.map((ticker) => {
      const symbol = ticker.symbol;
      const snapshot = snapshotData?.find((snapshot) => snapshot?.symbol === symbol);
      const stockDataForSymbol = stockData?.filter(
        (d) => d?.symbol?.replace("X:", "").replace(".", "-") === symbol,
      );
      const maxDate = Math.max(
        ...(stockDataForSymbol?.map((d) => new Date(d.date).setHours(0, 0, 0, 0)) ??
          []),
      );

      return {
        symbol: ticker.symbol,
        ...(snapshot && {
          price: snapshot?.last_price,
          change: snapshot?.change,
          change_percent: snapshot?.change_percent * 100,
          volume: snapshot?.volume,
          day_range: [snapshot?.low, snapshot?.high],
          year_range: [snapshot?.year_low, snapshot?.year_high],
          market_cap: snapshot?.market_cap,
          exchange: snapshot?.exchange,
          history: stockDataForSymbol?.filter(
            (d) => new Date(d.date).setHours(0, 0, 0, 0) === maxDate,
          ),
        }),
      } as SnapShot;
    });
  }, [secondaryTickers, snapshotData, stockData]);

  // @ts-expect-error - ignored for now
  if (widget.widgetId === "news_digest") {
    return (
      <DraggableCard
        aiEnabled={true}
        aiData={groupedData}
        title={widget.name}
        lastUpdated={dataUpdatedAt}
        loading={isLoading}
        error={error}
      >
        <NewsDialogContent
          isInsideWidget={true}
          isLoading={isLoading}
          dataUpdatedAt={dataUpdatedAt}
          groupedData={groupedData}
          combinedData={combinedData}
        />
      </DraggableCard>
    );
  }
  return (
    <NewsDialogContent
      isLoading={isLoading}
      dataUpdatedAt={dataUpdatedAt}
      groupedData={groupedData}
      combinedData={combinedData}
    />
  );
}

export function NewsDialogContent({
  isInsideWidget = false,
  isLoading,
  dataUpdatedAt,
  groupedData,
  combinedData,
}: {
  isInsideWidget?: boolean;
  isLoading: boolean;
  dataUpdatedAt: any;
  groupedData: GroupData;
  combinedData: SnapShot[];
}) {
  const [fontSize, setFontSize] = useState(12);
  return (
    <div
      className={cn({
        "mb-6": !isInsideWidget,
      })}
      style={{
        fontSize,
      }}
    >
      <Tabs defaultValue="companies">
        <div
          className={cn({
            "pt-4 pb-3": !isInsideWidget,
          })}
        >
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="sectors">Sectors</TabsTrigger>
          </TabsList>
          {!isInsideWidget && (
            <div className="flex gap-2 items-center mt-2.5">
              <button
                onClick={() => setFontSize(fontSize - 1)}
                className="flex items-center justify-center bg-light-100 p-2 rounded dark:bg-[#303038]"
              >
                <DecreaseFontSizeIcon />
              </button>
              <button
                onClick={() => setFontSize(fontSize + 1)}
                className="flex items-center justify-center bg-light-100 p-2 rounded dark:bg-[#303038]"
              >
                <IncreaseFontSizeIcon />
              </button>
              <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
                {formatDate(new Date(dataUpdatedAt))}
              </p>
            </div>
          )}
        </div>
        <TabsContent value="companies">
          <div
            className={cn("bg-light-50 dark:bg-[#24242A] rounded p-2.5", {
              "max-h-[400px] overflow-auto": !isInsideWidget,
            })}
          >
            {isLoading && <p>Loading...</p>}
            {groupedData?.companies &&
              Object.entries(groupedData.companies).map(([ticker, items]) => (
                <div key={ticker} className="my-6 first:mt-0">
                  <TickerInfo
                    snapshot={combinedData?.find((d) => d.symbol === ticker)}
                    symbol={ticker}
                    extraTriggerClass="body-sm-bold mb-3"
                  />
                  {items.map((item, index) => (
                    <p key={index} className="my-3 first:mt-0">
                      <span
                        className="font-medium text-[#EF7D00] dark:text-[#FB923C]"
                        dangerouslySetInnerHTML={{ __html: item.title }}
                      />
                      <span className="dark:text-light-100 text-light-900 mr-1">
                        {` — ${item.text}`}
                      </span>
                      <ExternalLinkDialog
                        text={`See more in ${item.publisher}`}
                        href={item.url}
                      />
                    </p>
                  ))}
                </div>
              ))}
          </div>
        </TabsContent>
        <TabsContent
          value="sectors"
          style={{
            fontSize,
          }}
        >
          <div
            className={cn("bg-light-50 dark:bg-[#24242A] rounded p-2.5", {
              "max-h-[400px] overflow-auto": !isInsideWidget,
            })}
          >
            {isLoading && <p>Loading...</p>}
            {groupedData?.sectors &&
              Object.entries(groupedData.sectors).map(([ticker, items]) => (
                <div key={ticker} className="my-6 first:mt-0">
                  <h2 className="body-sm-bold mb-3">{ticker}</h2>
                  {items.map((item, index) => (
                    <p key={index} className="my-3 first:mt-0">
                      <span
                        className="font-medium text-[#EF7D00] dark:text-[#FB923C]"
                        dangerouslySetInnerHTML={{ __html: item.title }}
                      />
                      <span className="dark:text-light-100 text-light-900 mr-1">
                        {` — ${item.text}`}
                      </span>
                      <ExternalLinkDialog
                        text={`See more in ${item.publisher}`}
                        href={item.url}
                      />
                    </p>
                  ))}
                </div>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
