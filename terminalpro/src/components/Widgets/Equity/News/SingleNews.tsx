import parse from "html-react-parser";
import { useMemo, useState } from "react";
import DraggableCard from "~/components/DraggableCard";
import { DecreaseFontSizeIcon, IncreaseFontSizeIcon } from "~/components/Icons";
import { useWidgetContext } from "~/components/Widget.context";
import { useEquityPriceQuote } from "~/lib/api/sdkComponents";
import { formatDate } from "~/lib/utils";
import TickerInfo from "../../Helpers/TickerInfo";
import type { SnapShot } from "./useNewsStockData";

export default function SingleNews() {
  const { widget } = useWidgetContext();
  const [fontSize, setFontSize] = useState(12);

  const { data } = useEquityPriceQuote(
    {
      queryParams: {
        provider: "fmp",
        symbol: widget?.storage?.stocks.join(","),
      },
    },
    {
      enabled:
        widget?.storage?.stocks?.length > 0 && widget?.storage?.stocks !== undefined,
      staleTime: 1000 * 60 * 5,
    },
  );

  const snapshotData = useMemo(() => {
    return data?.results?.map((item) => ({
      ...item,
      price: item?.last_price,
      change: item?.change,
      change_percent: item?.change_percent * 100,
      volume: item?.volume,
      day_range: [item?.low, item?.high],
      year_range: [item?.year_low, item?.year_high],
      market_cap: item?.market_cap,
      exchange: item?.exchange,
    })) as SnapShot[];
  }, [data]);

  return (
    <DraggableCard
      aiEnabled={true}
      aiData={widget?.storage?.text}
      showEllipsisMenu={false}
    >
      <p className="mb-2.5 font-bold text-sm">{widget?.storage?.title}</p>
      <div className="text-xs flex-col flex gap-8">
        <div className="flex justify-between gap-2 items-center">
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFontSize(fontSize - 1)}
                className="p-1 border-light-300 rounded border dark:border-light-600"
              >
                <DecreaseFontSizeIcon />
              </button>
              <button
                onClick={() => setFontSize(fontSize + 1)}
                className="p-1 border-light-300 rounded border dark:border-light-600"
              >
                <IncreaseFontSizeIcon />
              </button>
            </div>
            <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
              {formatDate(new Date(widget.storage.date))}
            </p>
            <p className="text-light-500 dark:text-light-400 whitespace-nowrap">
              Partner:{" "}
              <span className="text-brand-main dark:text-brand-lighter">Benzinga</span>
            </p>
          </div>
          {widget?.storage?.stocks?.length > 0 && (
            <div className="flex gap-2 text-light-500 dark:text-light-400">
              {widget?.storage?.stocks.length > 0 && (
                <>
                  <span className="whitespace-nowrap">In this article:</span>
                  <div className="flex gap-2 overflow-auto max-w-[400px]">
                    {widget?.storage?.stocks.map((stock: any) => {
                      const snapshot = snapshotData?.find(
                        (snapshot) => snapshot.symbol === stock,
                      );
                      if (!snapshot) return null;
                      return (
                        <TickerInfo
                          openOnClick={false}
                          symbol={stock}
                          key={stock}
                          snapshot={snapshot}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div
        className="space-y-4 leading-relaxed mt-4"
        style={{ fontSize: `${fontSize}px` }}
      >
        {parse(widget.storage.text, {
          replace: (domNode) => {
            // @ts-expect-error
            if (domNode.name === "a" && domNode.attribs?.class === "ticker") {
              // @ts-expect-error
              const href = domNode.attribs?.href;
              if (href?.includes("https://www.benzinga.com/stock/")) {
                // example of href https://www.benzinga.com/stock/META#NASDAQ
                const symbol = href.split("/").pop()?.split("#")[0];
                if (symbol) {
                  const snapshot = snapshotData?.find(
                    (snapshot) => snapshot.symbol === symbol,
                  );
                  if (snapshot) {
                    return (
                      <TickerInfo
                        openOnClick={false}
                        symbol={symbol}
                        key={symbol}
                        snapshot={symbol}
                      />
                    );
                  }
                }
              }
            }
          },
        })}
      </div>
    </DraggableCard>
  );
}
