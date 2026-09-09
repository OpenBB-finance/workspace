import { ContextMenuTrigger } from "@radix-ui/react-context-menu";
import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Button } from "~/components/ds/atoms/Button";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
} from "~/components/ui/ContextMenu";
import type { OldRSSFeed, RSSFeed } from "~/lib/constants";
import { useAppStore } from "~/lib/state/app";
import { formatDate } from "~/lib/utils";
import { sanitizeHtml } from "~/lib/utils/sanitize";
import type { FeedData } from "../RssViewer";

export function GetFilteredRssFeeds(allData: any[], globalFilter: string): FeedData[] {
  return allData?.filter((rss) => {
    return (
      (rss.title?.toLowerCase() || "").includes(globalFilter.toLowerCase()) ||
      (rss.link?.toLowerCase() || "").includes(globalFilter.toLowerCase()) ||
      (rss.pubDate?.toLowerCase() || "").includes(globalFilter.toLowerCase()) ||
      (rss.description?.toLowerCase() || "").includes(globalFilter.toLowerCase()) ||
      (rss.feed?.name?.toLowerCase() || "").includes(globalFilter.toLowerCase())
    );
  });
}

export default function ContentTab({
  allData,
  globalFilter,
  addRssFeedHandler,
  addDefaults,
  feeds,
}: {
  allData: FeedData[];
  globalFilter: string;
  addRssFeedHandler: () => void;
  addDefaults: () => void;
  feeds: (RSSFeed & OldRSSFeed)[];
}) {
  const { id } = useParams();
  const filteredRssFeeds = GetFilteredRssFeeds(allData, globalFilter);

  const getFeedTag = useCallback(
    (url: string) => {
      const feed = feeds.find((feed) => feed.url === url);
      const feedTag = feed?.tag || feed?.category;
      const feedSource = feed?.source || feed?.name;

      return `${feedTag} - ${feedSource}`;
    },
    [feeds],
  );

  if (!(allData?.length && filteredRssFeeds?.length))
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100%-4rem)]">
        <SearchResultsNotFound
          icon={true}
          firstMessage={allData?.length ? "No results found" : "No RSS Feeds available"}
          secondMessage={
            allData?.length
              ? ""
              : "You need to add RSS Feed to your Feeds library by clicking on the button below."
          }
        >
          {!allData?.length && (
            <div className="flex items-center gap-2 justify-center">
              <Button
                onClick={() => addDefaults()}
                variant="primary"
                size="xs"
                className="mt-2"
              >
                <Icon id="plus-icon" className="w-[14px] h-[14px]" />
                Fill with Defaults
              </Button>
              <Button
                onClick={() => addRssFeedHandler()}
                variant="secondary"
                size="xs"
                className="mt-2"
              >
                <Icon id="plus-icon" className="w-[14px] h-[14px]" />
                Add RSS Feed
              </Button>
            </div>
          )}
        </SearchResultsNotFound>
      </div>
    );

  return (
    <div className="flex flex-col divide-y divide-surface-divider overflow-y-auto">
      {filteredRssFeeds?.map((rss) => {
        const descriptionText = rss?.description || rss?.title || "";
        // For Atom feeds, use sandboxed iframe for security (content can be full HTML)
        // For RSS feeds, use simple text tooltip (descriptions are typically plain text)
        const tooltipContent = rss.isAtomFeed ? (
          <iframe
            key={`${rss.id}-tooltip-iframe`}
            srcDoc={sanitizeHtml(descriptionText)}
            className="w-[600px] h-[400px] border-0"
            sandbox=""
            title={`Preview: ${rss?.title || "RSS item"}`}
          />
        ) : (
          <span
            key={`${rss.id}-tooltip-text`}
            className="break-words whitespace-normal"
          >
            {descriptionText}
          </span>
        );
        const tooltipClassName = rss.isAtomFeed
          ? "!p-0 overflow-hidden"
          : "max-w-md max-h-96 overflow-y-auto break-words whitespace-normal";
        const content = (
          <a
            className="cursor-pointer _widget-content py-2 first:pt-0"
            href={rss.link}
            target="_blank"
            rel="noreferrer noopener"
            key={`${rss.id}-content`}
          >
            <div className="overflow-x-auto hover:bg-light-100 dark:hover:bg-[#212126] p-0.5 rounded">
              {rss?.description && rss?.description?.length > 10 ? (
                <Tooltip message={tooltipContent} className={tooltipClassName}>
                  <p className="text-brand-main font-semibold dark:text-brand-lighter underline">
                    {rss?.title}
                  </p>
                </Tooltip>
              ) : (
                <p className="text-brand-main font-semibold dark:text-brand-lighter underline">
                  {rss?.title}
                </p>
              )}
              <div className="mt-2 flex items-start gap-2 overflow-x-auto">
                <Tooltip message={rss.feed.url}>
                  <p className="obb-tag">{getFeedTag(rss.feed.url)}</p>
                </Tooltip>
                {rss.pubDate && (
                  <p className="whitespace-nowrap text-light-500 dark:text-[#A2A2A2]">
                    {formatDate(new Date(rss.pubDate))}
                  </p>
                )}
              </div>
            </div>
          </a>
        );
        return id ? (
          <ContextMenu key={`${rss.id}-context`}>
            <ContextMenuTrigger asChild={true}>{content}</ContextMenuTrigger>
            <ContextMenuPortal>
              <ContextMenuContent
                style={{
                  boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
                }}
                className="obb-dropdown-container z-50"
              >
                <ContextMenuItem
                  className="obb-dropdown-item text-xs"
                  onSelect={() => {
                    useAppStore.getState().addWidget(id, {
                      widgetId: "iframe",
                      name: rss.title,
                      description: rss.description || rss.title || "",
                      type: "custom",
                      storage: {
                        html: rss.link,
                      },
                    } as any);
                  }}
                >
                  Open in embedded page widget
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenuPortal>
          </ContextMenu>
        ) : (
          content
        );
      })}
    </div>
  );
}
