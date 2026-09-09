import { useRef, useState } from "react";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogClose, DialogTitle } from "~/components/ds/dialogs/Dialog";
import Icon from "~/components/Icon";
import type { RSSFeed } from "~/lib/constants";

export default function EditFeed({
  feed,
  updateFeed,
}: {
  feed: Omit<RSSFeed, "enabled">;
  updateFeed: (feed: Omit<RSSFeed, "enabled">) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const sourceRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const updatedFeed = {
      source: sourceRef.current?.value,
      url: urlRef.current?.value,
      tag: tagRef.current?.value,
    };
    const close = updateFeed(updatedFeed);
    if (close) setOpen(false);
  };

  return (
    <BaseDialog
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          onClick={() => setOpen(true)}
          className="p-1 hover:bg-light-200 dark:hover:bg-[#36363F] rounded active:bg-light-300 dark:active:bg-[#36363F] transition-colors duration-200"
        >
          <Icon id="edit-05" className="w-[14px] h-[14px]" />
        </button>
      }
    >
      <DialogTitle>Edit Feed</DialogTitle>
      <div className="mb-6 flex flex-col gap-2 text-xs text-[#A2A2A2] dark:text-[#8A8A90]">
        <label className="my-3 inline-flex flex-col gap-2">
          Tag
          <input
            ref={tagRef}
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="Market News"
            defaultValue={feed.tag}
          />
        </label>
        <label className="my-3 inline-flex flex-col gap-2">
          URL
          <input
            ref={urlRef}
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="https://feeds.bloomberg.com/markets/news.rss"
            defaultValue={feed.url}
          />
        </label>
        <label className="my-3 inline-flex flex-col gap-2">
          Source
          <input
            ref={sourceRef}
            className="obb-minimal-input-search h-[34px]! w-full"
            placeholder="Bloomberg"
            defaultValue={feed.source}
          />
        </label>
      </div>
      <div className="mt-auto flex justify-end">
        <div className="flex items-center gap-2.5">
          <DialogClose className="obb-btn-outlined border px-3 py-1 font-medium md:w-fit">
            Close
          </DialogClose>
          <button
            onClick={handleSubmit}
            className="obb-btn-tertiary h-8 px-3 py-1 font-medium md:w-fit"
          >
            Save Changes
          </button>
        </div>
      </div>
    </BaseDialog>
  );
}
