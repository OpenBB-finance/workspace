import { useQueries } from "@tanstack/react-query";
import { uniqueId } from "lodash";
import { useRef } from "react";
import { useDebounceValue, useUpdateEffect } from "usehooks-ts";
import { useStateReducer } from "~/hooks/useStateReducer";
import { type OldRSSFeed, RSS_FEEDS, type RSSFeed } from "~/lib/constants";
import { getConfig } from "~/lib/runtimeConfig";
import { parseFeedXml } from "~/lib/utils/feedParser";
import DraggableCard from "../DraggableCard";
import { Input } from "../ds/atoms/Input";
import { Tabs, TabsList, TabsTrigger } from "../ds/molecules/Tabs";
import Icon from "../Icon";
import { useWidgetContext } from "../Widget.context";
import ContentTab from "./RssViewerHelpers/ContentTab";
import ManageFeedsTab from "./RssViewerHelpers/ManageFeedsTab";

const rssTabs = ["Content", "Manage Feeds"] as const;
type RssTab = (typeof rssTabs)[number];
const servicesCloudflareWorkerFF = getConfig().services.cloudflareWorker;

const RSSViewer = ({ filter = "" }: { filter?: string }) => {
  const { widget, updateWidget } = useWidgetContext();
  const [state, dispatch] = useStateReducer<RSSViewerState>({
    openDialog: false,
    globalFilter: filter,
    selectedTab: rssTabs[0],
    source: "",
    url: "",
    tag: "",
  });

  const [debouncedGlobalFilter] = useDebounceValue(state.globalFilter, 500);
  const inputRef = useRef<HTMLInputElement>(null);

  useUpdateEffect(() => {
    dispatch({ globalFilter: filter });
    // if (inputRef.current) {
    //   inputRef.current.value = filter;
    // }
  }, [filter]);

  const feeds = widget?.storage?.feeds as (RSSFeed & OldRSSFeed)[] | undefined;
  const enabledFeeds = feeds?.filter((feed) => feed.enabled) ?? [];

  const queries = enabledFeeds?.map((feed) => {
    return {
      queryKey: ["feed", feed.url],
      queryFn: () =>
        fetch(
          servicesCloudflareWorkerFF ? `https://openbbrss.com/${feed.url}` : feed.url,
        )
          .then((res) => res.text())
          .then((data) => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(data, "text/xml");
            const parsedItems = parseFeedXml(xmlDoc);

            return parsedItems.map((item) => {
              // Generate a unique ID for each item, fixes the react duplicate key issue
              const id = uniqueId(`${feed.name}-${feed.url}-${item.title}`);
              return { ...item, feed, id };
            });
          }),
    };
  });

  const results = useQueries({ queries: queries ?? [] });

  const allData = results
    .filter((result) => result.data)
    .reduce((acc, { data }) => acc.concat(data), [] as FeedData[])
    .sort((a, b) => {
      const aDate = new Date(a.pubDate);
      const bDate = new Date(b.pubDate);
      return bDate.getTime() - aDate.getTime();
    });

  function addRssFeedHandler() {
    dispatch({
      selectedTab: "Manage Feeds",
      openDialog: true,
    });
  }

  const aiEnabled = !widget.storage?.disableAI;

  return (
    <DraggableCard
      title={widget.name}
      aiData={allData}
      aiEnabled={aiEnabled}
      showClose={aiEnabled}
      showEllipsisMenu={aiEnabled}
      extraClassName="h-[calc(100%-48px)]!"
      elementNextToTitle={
        <Input
          ref={inputRef}
          size="xs"
          placeholder="Search"
          prefix={<Icon id="search" />}
          value={state.globalFilter}
          onChange={(val) => dispatch({ globalFilter: val.toString() })}
        />
      }
    >
      <Tabs
        variant="filled"
        value={state.selectedTab}
        onValueChange={(selectedTab: RssTab) => dispatch({ selectedTab })}
        className="mb-2 flex gap-1 overflow-auto"
      >
        <TabsList>
          {rssTabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {state.selectedTab === "Content" ? (
        <ContentTab
          addRssFeedHandler={addRssFeedHandler}
          addDefaults={() =>
            updateWidget((prev) => ({
              ...prev,
              storage: {
                ...prev.storage,
                feeds: RSS_FEEDS,
              },
            }))
          }
          allData={allData}
          feeds={widget?.storage?.feeds ?? []}
          globalFilter={debouncedGlobalFilter}
        />
      ) : (
        <ManageFeedsTab
          feeds={widget?.storage?.feeds ?? []}
          state={state}
          dispatch={dispatch}
        />
      )}
    </DraggableCard>
  );
};

export type RSSViewerState = {
  openDialog: boolean;
  globalFilter: string;
  selectedTab: RssTab;
  source: string;
  url: string;
  tag: string;
};

export type FeedData = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  description: string;
  feed: RSSFeed & OldRSSFeed;
  isAtomFeed: boolean;
};

export default RSSViewer;

/*

  const [structuredContent, setStructuredContent] = useState([]);

  useEffect(() => {
    if (!widget?.data?.schemaData?.url) {
      return;
    }

    fetch(`https://dev.openbbrss.com/${widget?.data?.schemaData?.url}`)
      .then((response) => response.text())
      .then((data) => {
        const parser = new DOMParser();
        const rssDoc = parser.parseFromString(data, "text/xml");
        const feedTitleElement = rssDoc.getElementsByTagName("title")[0];
        const items = Array.from(rssDoc.getElementsByTagName("item"));

        const feedName = feedTitleElement
          ? feedTitleElement.textContent
          : "RSS Feed";

        const feedItems = items.map((item) => {
          const titleElement = item.getElementsByTagName("title")[0];
          const contentElement = item.getElementsByTagName("description")[0];
          const pubDateElement = item.getElementsByTagName("pubDate")[0];
          const linkElement = item.getElementsByTagName("link")[0];

          const title = titleElement
            ? titleElement.textContent
            : "No title available";
          const content = contentElement
            ? contentElement.textContent
            : "No content available";
          const pubDate = pubDateElement
            ? pubDateElement.textContent
            : "No publication date available";
          const link = linkElement
            ? linkElement.textContent
            : "No link available";

          return { title, content, pubDate, feedName, link };
        });
        setStructuredContent(feedItems);
      })
      .catch((error) => {
        console.error("Error loading RSS feed:", error);
      });
  }, [widget?.data?.schemaData?.url]);

      <div className="flex flex-col overflow-y-auto divide-y divide-surface-divider">
        {structuredContent?.slice(0, 10).map((rss) => {
          return (
            <div className="flex flex-col gap-2 py-2"
              key={rss.title}
            >
              <a
                href={rss.link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#0088CC] dark:text-[#33BBFF] text-left"
                title={rss.title}
              >
                {rss?.title}
              </a>
              <p
                className="text-[#808080]"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(rss?.content
                    ? rss?.content
                    : rss.content?.length > 40
                      ? `${rss.content?.slice(0, 40)}...`
                      : rss?.content)
                }}
              />
              <p className="whitespace-nowrap text-[#808040]">
                {formatDate(new Date(rss?.pubDate))}
              </p>
                  </div>
                  );
                })}
              </div>*/
