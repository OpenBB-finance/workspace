import Markdown from "markdown-to-jsx";
import { memo, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeMarkdownOptions } from "~/components/AI/MarkdownOverrides";
import { AnimatedChevron } from "~/components/ds/atoms/AnimatedChevron";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import { CollapsibleSection } from "~/components/ds/atoms/CollapsibleSection";
import { LibraryRow } from "~/components/ds/molecules/LibraryList";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";
import { sanitizeMarkdown } from "~/lib/utils/sanitize";
import type { Skill } from "~/types/auth.type";
import { isDefaultSkill } from "./skills";

export const SkillCard = memo(function SkillCard({
  skill,
  onEdit,
  onDelete,
  selected = false,
  onToggleSelect,
}: {
  skill: Skill;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const isDefault = isDefaultSkill(skill.id);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  const handleCopyContent = useCallback(() => {
    navigator.clipboard.writeText(skill.content);
    toast.success("Skill content copied to clipboard");
  }, [skill.content]);

  const handleEdit = useCallback(() => onEdit(skill.id), [onEdit, skill.id]);
  const handleDelete = useCallback(() => onDelete(skill.id), [onDelete, skill.id]);
  const handleToggleSelect = useCallback(
    () => onToggleSelect?.(skill.id),
    [onToggleSelect, skill.id],
  );

  const sanitizedContent = useMemo(
    () => sanitizeMarkdown(skill.content),
    [skill.content],
  );

  return (
    <LibraryRow>
      <CollapsibleSection
        open={isExpanded}
        onOpenChange={handleToggle}
        header={({ isOpen }) => (
          <div className="group flex cursor-pointer select-none items-start gap-2">
            <AnimatedChevron isOpen={isOpen} className="mt-0.5 shrink-0" />
            {onToggleSelect && (
              <Checkbox
                checked={selected}
                onCheckedChange={handleToggleSelect}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-xs font-medium text-ds-text-heading">
                {skill.slug}
              </span>
              <span className="text-xs text-ds-text-caption truncate">
                {skill.description}
              </span>
            </div>
            <div
              className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Tooltip message="Copy content">
                <button
                  type="button"
                  onClick={handleCopyContent}
                  className="obb-small-navbar-btn"
                >
                  <Icon id="clipboard-icon" className="size-3.5" />
                </button>
              </Tooltip>
              <Tooltip message={isDefault ? "Default skills can't be edited" : "Edit"}>
                <button
                  type="button"
                  onClick={isDefault ? undefined : handleEdit}
                  disabled={isDefault}
                  className={cn(
                    "obb-small-navbar-btn",
                    isDefault && "opacity-40 cursor-not-allowed",
                  )}
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
            </div>
          </div>
        )}
      >
        <div className="prose prose-xs max-w-none text-[11px] leading-4 dark:prose-invert [&_code]:text-[11px] [&_li]:text-[11px] [&_p]:text-[11px] [&_pre]:overflow-x-auto rounded p-3 max-h-96 overflow-y-auto mt-2.5 ml-6 border border-general-border-secondary bg-general-bg-primary">
          <Markdown options={CodeMarkdownOptions}>{sanitizedContent}</Markdown>
        </div>
      </CollapsibleSection>
    </LibraryRow>
  );
});
