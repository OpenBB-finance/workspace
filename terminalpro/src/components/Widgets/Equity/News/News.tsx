import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import DraggableCard from "~/components/DraggableCard";
import { FormInput, Input } from "~/components/ds/atoms/Input";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import BrandedLogo from "~/components/General/BrandedLogo";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import { formatDate } from "~/components/General/Table/AgGridUtils";
import { DatePicker } from "~/components/ui/DatePicker";
import { useWidgetContext } from "~/components/Widget.context";
import { useNewsCompany, useNewsWorld } from "~/lib/api/sdkComponents";
import type { BenzingaCompanyNewsData as BenzingaCompanyNews } from "~/lib/api/sdkSchemas";
import { isParamDefArray } from "~/lib/types/app";
import { getJsonWidget } from "~/lib/utils";
import AdvancedSelectedTicker from "../../Helpers/AdvancedSelectTicker";
import { NewsList } from "./NewsList";
import {
  DateRangeSchema,
  type NewsData,
  type NewsQueryResults,
  type TDateRangeForm,
  useNewsStockData,
} from "./useNewsStockData";

const newsChannels = ["All", "Top Stories", "Exclusives", "Hot"] as const;
type NewsChannel = (typeof newsChannels)[number];
interface NewsWidgetParams {
  channels: NewsChannel;
  topics: string;
  start_date: string;
  end_date: string;
  limit: number;
}

type NewsWidgetState = {
  globalFilter: string;
  selectedChannel: NewsChannel;
};

export function News({
  setOpenModalTitle,
  title = "News",
  // showMain = true, // TODO: Not implemented
  // showFilter = false, // TODO: Not implemented
  showTickersChange = false,
  handleTickerChange,
  // showGroupDropdown = true,
  showClose = true,
  newsChannel,
  showEllipsis = true,
  isGlobal = false,
  aiEnabled = true,
}: {
  setOpenModalTitle?: (title: string) => void;
  title?: string;
  showMain?: boolean;
  showFilter?: boolean;
  showTickersChange?: boolean;
  handleTickerChange?: (ticker: any) => void;
  showGroupDropdown?: boolean;
  showClose?: boolean;
  newsChannel?: string;
  showEllipsis?: boolean;
  isGlobal?: boolean;
  aiEnabled?: boolean;
}) {
  const { widget, updateWidget } = useWidgetContext(true);
  // @ts-expect-error
  const isGlobalNews = widget?.widgetId === "global_news" || isGlobal;
  const useSdkQuery = isGlobalNews ? useNewsWorld : useNewsCompany;
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultParams: NewsWidgetParams = useMemo(() => {
    if (isParamDefArray(widget?.params) && widget?.params?.length > 0)
      return widget.storage.params as NewsWidgetParams;

    // @ts-expect-error
    return getJsonWidget(widget || "global_news")?.storage?.params as NewsWidgetParams;
  }, [widget?.widgetId]);

  const paramMap = useMemo(() => {
    const params = widget?.storage?.params ?? {};

    return Object.keys(defaultParams).reduce(
      (acc, key) => {
        if (params?.[key] === undefined) return acc;

        // we need to clear topics for first mount
        acc[key] = key === "topics" ? "" : params?.[key];
        return acc;
      },
      { ...defaultParams },
    );
  }, [widget?.storage?.params, defaultParams]);

  const [globalFilter, setGlobalFilter] = useState(paramMap.topics);

  const debouncedSetGlobalFilter = useDebouncedCallback((value: string) => {
    setGlobalFilter(value);
    updateWidget((prev) => ({
      ...prev,
      storage: {
        ...(prev?.storage ?? {}),
        params: {
          ...(prev?.storage?.params ?? {}),
          topics: value,
        },
      },
    }));
  }, 500);

  const form = useForm<TDateRangeForm>({
    resolver: zodResolver(DateRangeSchema),
    defaultValues: {
      startDate: paramMap.start_date,
      endDate: paramMap.end_date,
    },
  });

  useEffect(() => {
    form.setValue("startDate", paramMap.start_date);
    form.setValue("endDate", paramMap.end_date);
  }, [paramMap.end_date, paramMap.start_date]);

  const {
    isLoading,
    data: queryData,
    error,
    dataUpdatedAt,
  } = useSdkQuery(
    {
      queryParams: {
        provider: "benzinga",
        display: "full",
        topics: globalFilter,
        channels: newsChannel ?? paramMap.channels,
        limit: paramMap.limit ?? 50,
        ...(widget?.widgetId === "company_news" && {
          symbol: widget?.data?.mainTicker?.symbol ?? "AAPL",
        }),
        start_date: paramMap.start_date,
        end_date: paramMap.end_date,
      },
    },
    {
      enabled: true,
      staleTime: 1000 * 60 * 5,
    },
  );

  const onSaveFilters = useCallback(() => {
    if (widget) {
      const startDateForm = form.getValues("startDate");
      const endDateForm = form.getValues("endDate");
      const startDateUTC = startDateForm && formatDate(startDateForm);
      const endDateUTC = endDateForm && formatDate(endDateForm);

      // TODO: move validation to form schema
      const isValidDateRange =
        startDateUTC && endDateUTC && dayjs(startDateUTC).isBefore(endDateUTC);

      if (isValidDateRange || !(startDateForm || endDateForm)) {
        updateWidget((prev) => ({
          ...prev,
          storage: {
            ...(prev?.storage ?? {}),
            params: {
              ...(prev?.storage?.params ?? {}),
              start_date: startDateUTC || undefined,
              end_date: endDateUTC || undefined,
            },
          },
        }));
      } else {
        toast.error("Invalid date range", {
          description: "Please make sure the start date is before the end date.",
        });

        return false;
      }
    }
  }, [form.getValues, updateWidget]);

  const { aiData, newsData } = useMemo(() => {
    if (!queryData) return { aiData: null, newsData: null as NewsQueryResults };

    return queryData?.results?.reduce(
      (acc, result: BenzingaCompanyNews) => {
        const textHtml = result?.text ? result?.text : result?.teaser;
        const tickerRegex = /https:\/\/www\.benzinga\.com\/stock\/([A-Za-z0-9]+)/g;
        let match: any[];
        const symbolsFromTextHtml: string[] = [];
        while ((match = tickerRegex.exec(textHtml)) !== null) {
          symbolsFromTextHtml.push(match[1]);
        }
        const mergedSymbols = [
          ...(result?.stocks?.split(",")?.filter((s: string) => s !== "") ?? []),
          ...symbolsFromTextHtml,
        ];
        const uniqueSymbols = Array.from(new Set(mergedSymbols));

        const articleData = {
          ...result,
          channels: result?.channels?.split(",") ?? [],
          stocks: uniqueSymbols,
          tags: result?.tags?.split(",") ?? [],
        };

        acc.newsData.push(articleData);
        acc.aiData.push({
          date: result?.date,
          title: articleData?.title,
          description: articleData?.teaser,
          text: articleData?.text,
          stocks: articleData?.stocks
            .map((stock) =>
              stock.includes("$") ? `${stock.replace("$", "")}USD` : stock,
            )
            .join(","),
        });

        return acc;
      },
      { aiData: [] as any[], newsData: [] as NewsQueryResults },
    );
  }, [queryData]);

  const { snapshotData } = useNewsStockData({ newsData });

  const newsDataMemo = useMemo(() => {
    return newsData?.map((news) => {
      return {
        ...news,
        stocks: (news?.stocks as string[])?.map((stock, index) => {
          let symbol = stock;
          if (symbol?.includes("$")) {
            symbol = `${symbol?.replace("$", "")}USD`;
          }

          const snapshot = snapshotData?.find(
            (snapshot) => snapshot?.symbol === symbol,
          );

          return {
            symbol: stock,
            hasSnapshot: index < 6,
            ...(snapshot || {}),
          };
        }),
      } as NewsData;
    });
  }, [newsData, snapshotData]);

  const newsListElement = useMemo(
    () =>
      newsData &&
      newsDataMemo?.length > 0 && (
        <NewsList
          setOpenModalTitle={setOpenModalTitle}
          key={widget?.widgetId ?? "global_news"}
          news={newsDataMemo || []}
          className="mt-2"
        />
      ),
    [newsData, newsDataMemo, widget?.widgetId, setOpenModalTitle],
  );

  return (
    <DraggableCard
      isBlocked={true}
      widgetIdFallback={aiEnabled ? "" : "global_news"}
      aiEnabled={aiEnabled}
      aiData={aiData}
      showClose={showClose}
      lastUpdated={dataUpdatedAt}
      title={title}
      showEllipsisMenu={showEllipsis}
      extraClassName="h-[calc(100%-48px)]!"
      showActionsSettings={true}
      onSaveSettings={onSaveFilters}
      settingsModalChildren={
        <Form {...form}>
          <form className="mt-2 grid max-h-[400px] grid-cols-2 gap-2 overflow-auto">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => {
                return (
                  <FormInput type="date" label="Start date" size="sm" {...field} />
                );
              }}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => {
                return <FormInput type="date" label="End date" size="sm" {...field} />;
              }}
            />
          </form>
        </Form>
      }
      elementRightNextToTitle={
        showTickersChange && (
          <AdvancedSelectedTicker
            triggerSize="sm"
            setTicker={(ticker) => {
              if (!ticker) return;
              if (handleTickerChange) handleTickerChange(ticker.symbol);
              else {
                updateWidget((prev) => ({
                  ...prev,
                  data: {
                    ...prev.data,
                    mainTicker: ticker,
                  },
                  storage: {
                    ...(prev?.storage ?? {}),
                    params: {
                      ...(prev?.storage?.params ?? {}),
                      symbol: ticker.symbol,
                    },
                  },
                }));
              }
            }}
          />
        )
      }
      elementNextToTitle={
        <>
          <Input
            size="xs"
            className="obb-parameter h-5 py-0"
            placeholder="Search"
            ref={inputRef}
            defaultValue={globalFilter}
            onChange={(value: string) => {
              debouncedSetGlobalFilter(value);

              if (inputRef?.current && !value) {
                inputRef.current.value = "";
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          />
          <DatePicker />
        </>
      }
      exportFns={{}}
    >
      {isGlobalNews && (
        <Tabs
          variant="filled"
          value={paramMap.channels}
          onValueChange={(selectedChannel: NewsChannel) => {
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...(prev?.storage ?? {}),
                params: {
                  ...(prev?.storage?.params ?? {}),
                  channels: selectedChannel,
                },
              },
            }));
          }}
        >
          <TabsList>
            {newsChannels.map((channel) => (
              <TabsTrigger key={channel} value={channel}>
                {channel}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {isLoading ? (
        <div className="-mt-7 flex h-full w-full items-center justify-center">
          <BrandedLogo />
        </div>
      ) : (
        (error || (newsData && newsDataMemo?.length === 0)) && (
          <SearchResultsNotFound
            icon={true}
            firstMessage="We couldn't find any results. Try another search."
            secondMessage={null}
          />
        )
      )}
      {newsListElement}
    </DraggableCard>
  );
}

export default memo(News);
