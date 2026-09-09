import { memo, type SyntheticEvent, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import TextStyle from "~/components/AI/TextStyle";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { LIBRARY_CARD_CLASS } from "~/components/ds/molecules/LibraryList";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";

export const PromptCard = memo(function PromptCard({
  prompt,
  onEdit,
  onDelete,
  onDuplicate,
  shared = false,
  selected = false,
  onToggleSelect,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}: {
  prompt: {
    id: string;
    prompt: string;
    widgets?: string[];
    createdAt: string;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (prompt: string) => void;
  shared?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setIsExpanded((p) => !p), []);

  const handleDuplicate = useCallback(() => {
    onDuplicate?.(prompt.prompt);
  }, [onDuplicate, prompt.prompt]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      toast.success("Prompt copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [prompt.prompt]);

  const handleEdit = useCallback(() => {
    onEdit(prompt.id);
  }, [onEdit, prompt.id]);

  const handleDelete = useCallback(() => {
    onDelete(prompt.id);
  }, [onDelete, prompt.id]);

  const handleToggleSelect = useCallback(() => {
    onToggleSelect?.(prompt.id);
  }, [onToggleSelect, prompt.id]);

  const handleMoveUp = useCallback(() => {
    onMoveUp?.(prompt.id);
  }, [onMoveUp, prompt.id]);

  const handleMoveDown = useCallback(() => {
    onMoveDown?.(prompt.id);
  }, [onMoveDown, prompt.id]);

  const stopPropagation = useCallback((e: SyntheticEvent) => e.stopPropagation(), []);

  const actionButtons = useMemo(
    () => (
      <div
        className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
      >
        {!shared && onMoveUp && onMoveDown && (
          <>
            <Tooltip message="Move up">
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={handleMoveUp}
                className={cn(
                  "obb-small-navbar-btn flex items-center justify-center",
                  !canMoveUp && "cursor-not-allowed opacity-40",
                )}
              >
                <Icon id="square-arrow-up" className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip message="Move down">
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={handleMoveDown}
                className={cn(
                  "obb-small-navbar-btn flex items-center justify-center",
                  !canMoveDown && "cursor-not-allowed opacity-40",
                )}
              >
                <Icon id="square-arrow-down" className="size-3.5" />
              </button>
            </Tooltip>
          </>
        )}
        {shared && onDuplicate && (
          <Tooltip message="Duplicate to My Prompts">
            <button
              type="button"
              onClick={handleDuplicate}
              className="obb-small-navbar-btn"
            >
              <Icon id="copy-03" className="size-3.5" />
            </button>
          </Tooltip>
        )}
        <Tooltip message="Copy to clipboard">
          <button type="button" onClick={handleCopy} className="obb-small-navbar-btn">
            <Icon id="clipboard-icon" className="size-3.5" />
          </button>
        </Tooltip>
        {!shared && (
          <>
            <Tooltip message="Edit">
              <button
                type="button"
                onClick={handleEdit}
                className="obb-small-navbar-btn"
              >
                <Icon id="edit" className="size-3.5" />
              </button>
            </Tooltip>
            <Tooltip message="Delete">
              <button
                type="button"
                onClick={handleDelete}
                className="obb-small-navbar-btn"
              >
                <Icon id="trash-02" className="size-3.5" />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    ),
    [
      shared,
      onMoveUp,
      onMoveDown,
      canMoveUp,
      canMoveDown,
      onDuplicate,
      handleMoveUp,
      handleMoveDown,
      handleDuplicate,
      handleCopy,
      handleEdit,
      handleDelete,
      stopPropagation,
    ],
  );

  return (
    <div className={cn("group flex flex-col", LIBRARY_CARD_CLASS)}>
      <div className="flex h-10 items-center gap-2.5">
        {!shared && onToggleSelect && (
          <Checkbox
            checked={selected}
            onCheckedChange={handleToggleSelect}
            onClick={stopPropagation}
            className="shrink-0"
          />
        )}
        <button
          type="button"
          onClick={toggleExpanded}
          className="min-w-0 flex-1 cursor-pointer truncate text-left text-xs text-light-900 dark:text-light-100"
        >
          <TextStyle content={prompt.prompt} singleLine />
        </button>
        {actionButtons}
      </div>
      {isExpanded && (
        <div className={cn("pb-[11px] flex flex-col gap-2", !shared && "ml-[26px]")}>
          <TextStyle
            content={prompt.prompt}
            className="text-xs text-light-900 dark:text-light-100"
          />
          {prompt.widgets && prompt.widgets.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prompt.widgets.map((widget) => (
                <span key={widget} className="obb-tag">
                  {widget}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
