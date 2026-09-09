import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import TextStyle from "~/components/AI/TextStyle";
import { LIBRARY_CARD_CLASS } from "~/components/ds/molecules/LibraryList";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";

export const BackendPromptCard = memo(function BackendPromptCard({
  prompt,
  onDuplicate,
}: {
  prompt: string;
  onDuplicate: (prompt: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDuplicate = useCallback(() => {
    onDuplicate(prompt);
  }, [onDuplicate, prompt]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [prompt]);

  return (
    <div className={cn("group flex flex-col", LIBRARY_CARD_CLASS)}>
      <div className="flex h-10 items-center gap-2.5">
        <button
          type="button"
          onClick={() => setIsExpanded((p) => !p)}
          className="min-w-0 flex-1 cursor-pointer truncate text-left text-xs text-light-900 dark:text-light-100"
        >
          <TextStyle content={prompt} singleLine />
        </button>
        <div className="flex shrink-0 items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip message="Duplicate to My Prompts">
            <button onClick={handleDuplicate} className="obb-small-navbar-btn">
              <Icon id="copy-03" className="size-3.5" />
            </button>
          </Tooltip>
          <Tooltip message="Copy to clipboard">
            <button onClick={handleCopy} className="obb-small-navbar-btn">
              <Icon id="clipboard-icon" className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      {isExpanded && (
        <div className="pb-[11px]">
          <TextStyle
            content={prompt}
            className="text-xs text-light-900 dark:text-light-100"
          />
        </div>
      )}
    </div>
  );
});
