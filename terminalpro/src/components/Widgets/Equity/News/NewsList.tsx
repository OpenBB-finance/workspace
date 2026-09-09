import clsx from "clsx";
import parse from "html-react-parser";
import { type HTMLAttributes, useMemo } from "react";
import { SetLoadingOnResize } from "~/components/DraggableCard";
import Tooltip from "~/components/Tooltip";
import { cn, formatDate, slugify } from "~/lib/utils";
import TickerInfo from "../../Helpers/TickerInfo";
import NewsDialog from "./NewsDialog";
import type { NewsData } from "./useNewsStockData";

interface Props extends HTMLAttributes<HTMLDivElement> {
  news?: NewsData[];
  setOpenModalTitle: any;
}

export function NewsList(props: Props) {
  const { news, setOpenModalTitle, className, ...rest } = props;

  const items = useMemo(() => {
    if (!news) return [];
    const uniqueKeys = []; // To prevent duplicate news
    const newsComponents = [];

    for (const singleNews of news) {
      if (!(singleNews?.title && singleNews?.date)) continue;
      const key = singleNews.title + singleNews.date;

      if (uniqueKeys.includes(key)) continue;
      uniqueKeys.push(key);

      newsComponents.push(
        <NewsListItem
          setOpenModalTitle={setOpenModalTitle}
          news={singleNews}
          key={key}
        />,
      );
    }

    return newsComponents;
  }, [news, setOpenModalTitle]);

  return (
    <SetLoadingOnResize>
      <div
        className={cn(
          "flex flex-col divide-y divide-surface-divider overflow-y-auto",
          className,
        )}
        {...rest}
      >
        {items}
      </div>
    </SetLoadingOnResize>
  );
}

function NewsListItem({
  news,
  setOpenModalTitle,
}: {
  news?: NewsData;
  setOpenModalTitle: any;
}) {
  const triggerElement = useMemo(() => {
    const slugifiedTitle = slugify(news?.title);
    const headline = parse(news?.teaser ?? "");
    const hasDialog = news?.text?.length > 20;
    return (
      <div
        title=""
        className={clsx("overflow-x-auto p-0.5 rounded", `_${slugifiedTitle}`, {
          "hover:bg-light-100 dark:hover:bg-[#212126] cursor-pointer": hasDialog,
          "cursor-default": !hasDialog,
        })}
        onClick={() => {
          if (setOpenModalTitle) {
            setOpenModalTitle(slugifiedTitle);
          }
        }}
      >
        {news?.teaser && news?.teaser?.length > 10 ? (
          <Tooltip message={headline} className="max-w-[300px]">
            <p
              className={clsx("font-semibold underline", {
                "text-brand-main dark:text-brand-lighter": hasDialog,
                "text-light-500": !hasDialog,
              })}
            >
              {news?.title}
            </p>
          </Tooltip>
        ) : (
          <p
            className={clsx("font-semibold underline", {
              "text-brand-main dark:text-brand-lighter": hasDialog,
              "text-light-500": !hasDialog,
            })}
          >
            {news?.title}
          </p>
        )}
        <div className="mt-2 flex items-start gap-2 overflow-x-auto">
          <p className="whitespace-nowrap text-light-500 dark:text-[#A2A2A2]">
            {/*<span className="_tag !text-xs !bg-[#00AAFF4D] text-[#0AF] dark:text-[#9DF] mr-2">
        Benzinga
  </span>*/}
            {formatDate(new Date(news?.date))}
          </p>
          <div className="ml-0.5 -mt-px flex gap-2 pb-1 grow overflow-x-auto">
            {news?.stocks
              ?.filter((stock: any) => stock?.price)
              ?.slice(0, 5)
              ?.map((stock: any) => (
                <TickerInfo
                  variant="grey"
                  key={stock.symbol}
                  symbol={stock?.symbol}
                  snapshot={stock}
                />
              ))}
          </div>
        </div>
      </div>
    );
  }, [
    news?.date,
    news?.stocks,
    news?.teaser,
    news?.text,
    news?.title,
    setOpenModalTitle,
  ]);

  const contentMemo = useMemo(
    () =>
      news?.text?.length > 20 ? (
        <NewsDialog
          setOpenModalTitle={setOpenModalTitle}
          singleNews={news}
          trigger={triggerElement}
        />
      ) : (
        triggerElement
      ),
    [news, setOpenModalTitle, triggerElement],
  );

  return (
    <div className="cursor-pointer _widget-content py-2 first:pt-0">{contentMemo}</div>
  );
}
