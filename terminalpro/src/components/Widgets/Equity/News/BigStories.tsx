import * as Avatar from "@radix-ui/react-avatar";
import clsx from "clsx";
import dayjs from "dayjs";
import { useMemo } from "react";
import DraggableCard from "~/components/DraggableCard";
import Icon from "~/components/Icon";
import { useNewsWorld } from "~/lib/api/sdkComponents";
import type { BenzingaCompanyNewsData as CompanyNews } from "~/lib/api/sdkSchemas";
import { getRandomBenzingaImage, slugify } from "~/lib/utils";
import NewsDialog from "./NewsDialog";
import { type NewsData, useNewsStockData } from "./useNewsStockData";

export default function BigStories({
  channel,
  setOpenModalTitle,
}: {
  channel?: string;
  setOpenModalTitle?: any;
}) {
  const {
    isLoading,
    data: queryData,
    dataUpdatedAt,
  } = useNewsWorld(
    {
      queryParams: {
        provider: "benzinga",
        display: "full",
        limit: 50,
        ...(channel && {
          channels: channel,
          limit: 10,
        }),
        start_date: dayjs().subtract(4, "year").format("YYYY-MM-DD"),
        sort: "created",
      },
    },
    {
      enabled: true,
      retry: 2,
      staleTime: 1000 * 60 * 5,
    },
  );

  const data = useMemo(() => {
    return queryData?.results?.map((result: CompanyNews) => {
      const textHtml = result?.text ? result?.text : result?.teaser;
      const tickerRegex = /https:\/\/www\.benzinga\.com\/stock\/([A-Za-z0-9]+)/g;
      let match: any[];
      const symbolsFromTextHtml = [];
      while ((match = tickerRegex.exec(textHtml)) !== null) {
        symbolsFromTextHtml.push(match[1]);
      }
      const mergedSymbols = [
        ...(result?.stocks?.split(",")?.filter((s: string) => s !== "") ?? []),
        ...symbolsFromTextHtml,
      ];
      const uniqueSymbols = Array.from(new Set(mergedSymbols));

      return {
        ...result,
        channels: result?.channels?.split(","),
        stocks: uniqueSymbols,
        tags: result?.tags?.split(","),
      };
    }) as unknown as CompanyNews & { stocks: any; channels: any; tags: any }[];
  }, [queryData]);

  const newsWithImages = data
    ?.filter((news: CompanyNews & { stocks: any; channels: any; tags: any }) => {
      return news?.images?.length > 0;
    })
    .slice(0, 2);

  const { snapshotData } = useNewsStockData({ newsData: data });

  const newsData = useMemo(() => {
    const localnews = newsWithImages?.length > 0 ? newsWithImages : data?.slice(0, 2);
    if (!localnews) return [];
    return localnews.map(
      (news: CompanyNews & { stocks: any; channels: any; tags: any }) => {
        return {
          ...news,
          text: news?.text || "",
          teaser: news?.teaser || "",
          stocks: news?.stocks?.map((stock) => {
            let symbol = stock;
            if (symbol?.includes("$")) {
              symbol = `${symbol?.replace("$", "")}USD`;
            }

            const snapshot = snapshotData?.find(
              (snapshot) => snapshot?.symbol === symbol,
            );

            return {
              symbol: stock,
              hasSnapshot: true,
              ...(snapshot || {}),
            };
          }),
        };
      },
    ) as NewsData[];
  }, [snapshotData, newsWithImages]);

  const benzingaImage1 = useMemo(() => {
    return getRandomBenzingaImage();
  }, [channel]);

  const benzingaImage2 = useMemo(() => {
    return getRandomBenzingaImage();
  }, [channel]);

  return (
    <DraggableCard
      isBlocked={true}
      widgetIdFallback="news_headlines"
      showEllipsisMenu={false}
      loading={isLoading}
      lastUpdated={dataUpdatedAt}
      showClose={false}
      title="Headlines"
      extraClassName="grid grid-cols-2 gap-10 overflow-hidden"
      error={!isLoading && newsData?.length === 0}
    >
      {newsData.map((news, index) => {
        const slugifiedTitle = slugify(news?.title);
        return (
          <NewsDialog
            setOpenModalTitle={setOpenModalTitle}
            trigger={
              <div
                key={news?.id}
                className={clsx(
                  "flex h-[70%] cursor-pointer gap-2.5",
                  `_${slugifiedTitle}`,
                )}
                onClick={() => {
                  if (setOpenModalTitle) {
                    setOpenModalTitle(slugifiedTitle);
                  }
                }}
              >
                <Avatar.Root>
                  <Avatar.Image
                    className="aspect-auto w-[260px] h-full object-cover rounded"
                    alt={news?.title}
                    src={
                      news?.images?.length > 0
                        ? encodeURI(news?.images[0]?.url || "")
                        : index === 0
                          ? benzingaImage1
                          : benzingaImage2
                    }
                  />
                  <Avatar.Fallback>
                    <img
                      alt="benzinga fallback"
                      src={index === 0 ? benzingaImage1 : benzingaImage2}
                      className="aspect-auto w-[260px] h-full object-cover rounded"
                    />
                  </Avatar.Fallback>
                </Avatar.Root>
                <div className="w-[60%]">
                  <p className="inline-flex items-center gap-1 text-light-500 dark:text-[#5A5961]">
                    <Icon id="clock-icon" className="h-[14px] w-[14px]" />
                    {dayjs(news?.date).fromNow()}
                  </p>
                  <p className="mt-1 text-base font-bold text-light-800 dark:text-white">
                    {news?.title}
                  </p>
                  <p
                    className="text-light-600 dark:text-[#8A8A90]"
                    dangerouslySetInnerHTML={{
                      __html:
                        news?.teaser?.trim() !== ""
                          ? `${news?.teaser}${news?.teaser?.endsWith(".") ? "" : "..."}`
                          : news.text?.length > 40
                            ? `${news.text?.slice(0, 40)}...`
                            : news?.text,
                    }}
                  />
                </div>
              </div>
            }
            singleNews={news}
            key={news.title}
          />
        );
      })}
    </DraggableCard>
  );
}
