import { forwardRef, memo, type ReactNode, useCallback, useState } from "react";
import { AnimatedChevron } from "~/components/ds/atoms/AnimatedChevron";
import { CollapsibleSection } from "~/components/ds/atoms/CollapsibleSection";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// LibraryRow – flat-row chrome (bottom divider + padding) shared by every
// library list. Wrap each top-level item so all tabs (Agents, Skills, Prompts,
// MCP, Widgets, Packaged) get identical spacing instead of ad-hoc cards/gaps.
// ---------------------------------------------------------------------------

interface LibraryRowProps {
  children: ReactNode;
  className?: string;
}

// Shared so non-div row wrappers (e.g. a framer-motion Reorder.Item that must be
// the direct sibling for `last:border-b-0` to work) can opt into the same chrome.
export const LIBRARY_ROW_CLASS = "border-b border-surface-divider last:border-b-0 py-2";

// Shared chrome for the leaf cards revealed when a row is expanded (MCP tools,
// My-Widgets widget cards, Packaged/Sandbox widget items). One definition keeps
// their bg/border/rounding/padding identical; `min-h-6` on the LibraryItem
// header (below) keeps their height identical too.
export const LIBRARY_CARD_CLASS =
  "rounded-md border border-general-border-secondary bg-general-bg-primary px-3.5";

export const LibraryRow = forwardRef<HTMLDivElement, LibraryRowProps>(
  function LibraryRow({ children, className }, ref) {
    return (
      <div ref={ref} className={cn(LIBRARY_ROW_CLASS, className)}>
        {children}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// LibrarySection – expandable group header backed by CollapsibleSection
// ---------------------------------------------------------------------------

interface LibrarySectionProps {
  title: string;
  count?: number;
  description?: ReactNode;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  tooltip?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Nested/sub-expand sections: 18px hug header instead of the 40px top-level row. */
  compact?: boolean;
}

export function LibrarySection({
  title,
  count,
  description,
  leftSection,
  rightSection,
  tooltip,
  open,
  onOpenChange,
  defaultOpen,
  disabled,
  children,
  className,
  contentClassName,
  compact,
}: LibrarySectionProps) {
  const titleArea = (
    <div className="flex items-center gap-2 min-w-0">
      {leftSection}
      <span className="body-xs-regular whitespace-nowrap">
        {title}
        {count !== undefined && <span> ({count})</span>}
      </span>
      {description && (
        <span className="text-light-500 dark:text-dark-50 body-xs-regular truncate min-w-0">
          {description}
        </span>
      )}
    </div>
  );

  return (
    <CollapsibleSection
      open={open}
      onOpenChange={onOpenChange}
      defaultOpen={defaultOpen}
      disabled={disabled}
      className={className}
      contentClassName={contentClassName}
      header={({ isOpen }) => (
        <div
          className={cn(
            "group flex items-center justify-between gap-2 select-none",
            compact ? "min-h-[18px]" : "min-h-6",
            {
              "cursor-pointer": !disabled,
            },
          )}
        >
          <div
            className={cn("flex items-center gap-2 min-w-0 flex-1", {
              "opacity-40": disabled,
            })}
          >
            <AnimatedChevron isOpen={isOpen} />
            {tooltip ? (
              <Tooltip message={tooltip} className="min-w-0">
                {titleArea}
              </Tooltip>
            ) : (
              titleArea
            )}
          </div>
          {rightSection && (
            <div
              className="flex items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {rightSection}
            </div>
          )}
        </div>
      )}
    >
      {children}
    </CollapsibleSection>
  );
}

// ---------------------------------------------------------------------------
// LibraryItem – leaf item, optionally expandable
// ---------------------------------------------------------------------------

interface LibraryItemProps {
  title?: string;
  description?: ReactNode;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  expandable?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children?: ReactNode;
  tooltip?: ReactNode;
  variant?: "card" | "row";
  className?: string;
}

export const LibraryItem = memo((props: LibraryItemProps) => {
  const {
    title,
    description,
    leftSection,
    rightSection,
    expandable = false,
    defaultExpanded = false,
    expanded: controlledExpanded,
    onExpandedChange,
    children,
    tooltip,
    variant = "row",
    className,
  } = props;

  const isControlled = controlledExpanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const handleToggle = useCallback(() => {
    if (!expandable) return;
    const next = !isExpanded;
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  }, [expandable, isExpanded, isControlled, onExpandedChange]);

  const isCard = variant === "card";

  const titleArea = (
    <div className="flex items-center gap-2.5 min-w-0">
      {title && (
        <span className="text-xs text-light-900 dark:text-white whitespace-nowrap">
          {title}
        </span>
      )}
      {description && (
        <span className="text-xs text-light-500 dark:text-dark-50 truncate min-w-0">
          {description}
        </span>
      )}
    </div>
  );

  const header = (
    <div
      className={cn(
        "group flex min-h-[18px] w-full items-center justify-between gap-2",
        expandable && "cursor-pointer select-none",
      )}
      onClick={expandable ? handleToggle : undefined}
      onKeyDown={
        expandable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleToggle();
              }
            }
          : undefined
      }
      role={expandable ? "button" : undefined}
      tabIndex={expandable ? 0 : undefined}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {expandable && (
          <AnimatedChevron
            isOpen={isExpanded}
            className="text-light-500 dark:text-light-400"
          />
        )}
        {leftSection}
        {tooltip ? (
          <Tooltip message={tooltip} className="min-w-0">
            {titleArea}
          </Tooltip>
        ) : (
          titleArea
        )}
      </div>
      {rightSection && (
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {rightSection}
        </div>
      )}
    </div>
  );

  const showChildren = children && (expandable ? isExpanded : true);

  const content = (
    <>
      {header}
      {showChildren && <div>{children}</div>}
    </>
  );

  if (isCard) {
    return (
      <div
        className={cn("flex flex-col gap-2.5 py-[11px]", LIBRARY_CARD_CLASS, className)}
      >
        {content}
      </div>
    );
  }

  return <div className={cn(className)}>{content}</div>;
});
