import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCallback } from "react";
import { toast } from "sonner";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox } from "~/components/Forms/Checkbox";
import { useWidgetContext } from "~/components/Widget.context";
import type { StateDispatch } from "~/hooks/useStateReducer";
import type { OldRSSFeed, RSSFeed } from "~/lib/constants";
import Icon from "../../Icon";
import Tooltip from "../../Tooltip";
import Dialog from "../Helpers/Dialog";
import type { RSSViewerState } from "../RssViewer";
import EditFeed from "./EditFeed";

export default function ManageFeedsTab({
  feeds,
  state,
  dispatch,
}: {
  feeds: (RSSFeed & OldRSSFeed)[];
  state: RSSViewerState;
  dispatch: StateDispatch<RSSViewerState>;
}) {
  const { updateWidget } = useWidgetContext();

  const onSubmit = useCallback(() => {
    const urlAlreadyExists = feeds.some((feed) => feed.url === state.url);

    if (urlAlreadyExists) {
      toast.error("Feed already exists", {
        description: "Try another feed URL",
      });
      return;
    }

    updateWidget(
      (prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          feeds: [
            ...feeds,
            {
              source: state.source,
              url: state.url,
              tag: state.tag,
              enabled: true,
            },
          ],
        },
      }),
      true,
    );
    dispatch({ openDialog: false, source: "", url: "", tag: "" });
  }, [state.source, state.url, state.tag, feeds, dispatch, updateWidget]);

  const feedsByTag = feeds.reduce(
    (acc, feed) => {
      const feedTag = feed?.tag || feed?.category;
      if (!acc[feedTag]) {
        acc[feedTag] = [];
      }
      acc[feedTag].push({
        tag: feedTag,
        url: feed.url,
        source: feed?.source || feed?.name,
        enabled: feed.enabled,
      });

      return acc;
    },
    {} as Record<string, RSSFeed[]>,
  );

  const hasFeeds = Object.keys(feedsByTag).length > 0;

  const addFeedDialog = (
    <Dialog
      open={state.openDialog}
      setOpen={(openDialog) => dispatch({ openDialog })}
      extraDialogClass="max-w-[440px]"
      title="Add RSS Feed"
      trigger={
        <Button variant="secondary" size="xs" className="w-fit">
          <Icon id="plus-icon" className="w-[14px] h-[14px]" />
          Add RSS Feed
        </Button>
      }
      bottomBar={
        <div className="mt-2 flex items-center justify-end gap-2">
          <DialogPrimitive.Close asChild>
            <Button type="button" variant="outlined" size="sm">
              Close
            </Button>
          </DialogPrimitive.Close>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={!(state.tag && state.url && state.source)}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="mt-4 flex flex-col gap-3 text-xs text-ds-text-caption">
        <label className="inline-flex flex-col gap-1.5">
          Tag
          <input
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="Market News"
            onChange={(e) => dispatch({ tag: e.target.value })}
          />
        </label>
        <label className="inline-flex flex-col gap-1.5">
          URL
          <input
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="https://feeds.bloomberg.com/markets/news.rss"
            onChange={(e) => dispatch({ url: e.target.value })}
          />
        </label>
        <label className="inline-flex flex-col gap-1.5">
          Source
          <input
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="Bloomberg"
            onChange={(e) => dispatch({ source: e.target.value })}
          />
        </label>
      </div>
    </Dialog>
  );

  if (!hasFeeds)
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-[calc(100%-4rem)] text-ds-text-caption">
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-medium">No RSS / Atom feeds added</p>
          <p className="text-2xs">Click "Add RSS Feed" to get started</p>
        </div>
        {addFeedDialog}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-2.5 py-2">
        <Checkbox
          rightLabel="Select All"
          checked={Object.values(feedsByTag).every((tag) =>
            tag.every((feed) => feed.enabled),
          )}
          onChange={(value) => {
            updateWidget(
              (prev) => ({
                ...prev,
                storage: {
                  ...prev.storage,
                  feeds: feeds?.map((f) => ({
                    ...f,
                    enabled: value,
                  })),
                },
              }),
              true,
            );
          }}
          id="select-all"
          labelClassname="capitalize font-medium ml-1"
        />
        <div className="ml-auto">{addFeedDialog}</div>
      </div>
      <div className="flex flex-col gap-3">
        {Object.keys(feedsByTag).map((tag) => {
          return (
            <div key={tag} className="flex flex-col gap-2">
              <h1 className="text-2xs uppercase tracking-wide text-light-400 dark:text-[#5A5961]">
                {tag}
              </h1>
              <div className="flex flex-col gap-1.5">
                {feedsByTag[tag].map((feed) => {
                  return (
                    <div
                      key={feed.url + feed.source}
                      className="flex items-center justify-between dark:bg-[#2A2A31] p-2.5 rounded"
                    >
                      <Tooltip message={feed.url}>
                        <div>
                          <Checkbox
                            rightLabel={feed.source}
                            checked={feed.enabled}
                            onChange={(value) => {
                              updateWidget(
                                (prev) => ({
                                  ...prev,
                                  storage: {
                                    ...prev.storage,
                                    feeds: feeds?.map((f) => {
                                      if (f.url === feed.url) {
                                        return {
                                          ...f,
                                          enabled: value,
                                        };
                                      }
                                      return f;
                                    }),
                                  },
                                }),
                                true,
                              );
                            }}
                            id={feed.url}
                            labelClassname="capitalize font-medium ml-1"
                          />
                        </div>
                      </Tooltip>{" "}
                      <div className="flex items-center gap-2">
                        <EditFeed
                          feed={feed}
                          updateFeed={(updatedFeed) => {
                            const urlAlreadyExists = feeds.some(
                              (existingFeed) =>
                                existingFeed.url === updatedFeed.url &&
                                existingFeed.url !== feed.url,
                            );
                            if (urlAlreadyExists) {
                              toast.error("Feed URL already exists", {
                                description: "Please use a different URL for the feed.",
                              });
                              return false;
                            }
                            updateWidget(
                              (prev) => ({
                                ...prev,
                                storage: {
                                  ...prev.storage,
                                  feeds: feeds?.map((f) => {
                                    if (f.url === feed.url) {
                                      return {
                                        ...f,
                                        ...updatedFeed,
                                      };
                                    }
                                    return f;
                                  }),
                                },
                              }),
                              true,
                            );
                            return true;
                          }}
                        />
                        <button
                          onClick={() => {
                            updateWidget(
                              (prev) => ({
                                ...prev,
                                storage: {
                                  ...prev.storage,
                                  feeds: feeds?.filter((f) => f.url !== feed.url),
                                },
                              }),
                              true,
                            );
                          }}
                          className="p-1 hover:bg-light-200 dark:hover:bg-[#36363F] rounded active:bg-light-300 dark:active:bg-[#36363F] transition-colors duration-200"
                        >
                          <Icon id="trash-icon" className="w-[14px] h-[14px]" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
