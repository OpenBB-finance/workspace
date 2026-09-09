import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Popover } from "~/components/ds/atoms/Popover";
import { Tag, type TagProps } from "~/components/ds/atoms/Tag";
import Tooltip from "~/components/Tooltip";
import { cn } from "../utils";

export interface OverflowTagsProps {
  /** Labels rendered as tags. Blank/whitespace-only entries are ignored. */
  items: string[];
  /** Optional hard cap on visible tags, applied on top of width-based fitting. */
  max?: number;
  color?: TagProps["color"];
  /** Rendered when there are no (non-blank) items. */
  emptyFallback?: ReactNode;
  className?: string;
}

/** px — must match the `gap-1` used on the tag rows below (see constraints). */
const TAG_GAP = 4;

/**
 * Renders tags on a single line, folding any that don't fit the available width
 * into a "+N" chip whose popover lists every tag. The visible count is measured
 * against the container width and recomputed on resize.
 *
 * Constraints when reusing:
 * - The container must get a bounded width from its parent (e.g. a table cell, or
 *   a flex item with `min-w-0`). In a width-auto / shrink-to-fit parent it cannot
 *   measure overflow and won't collapse.
 * - Tag rows use `gap-1`; `TAG_GAP` mirrors it. Don't override the gap via
 *   `className` or the fit math drifts.
 * - Items are plain strings rendered as same-colored tags. Per-item color, rich
 *   content, removable chips and multi-line wrapping are not supported.
 */
export function OverflowTags({
  items,
  max,
  color = "grey",
  emptyFallback = "-",
  className,
}: OverflowTagsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  // Blank labels render as nothing (Tag returns null for falsy children) and
  // would desync the measurement layer from `items`, so drop them up front.
  const tags = items.filter((item) => !!item?.trim());

  const [visibleCount, setVisibleCount] = useState(tags.length);
  const tagsKey = tags.join("");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      const available = container.clientWidth;
      const nodes = Array.from(measure.children) as HTMLElement[];
      if (nodes.length === 0) return;

      // Last measure node is the "+N" chip; the rest are the tags at natural width.
      const plusWidth = nodes[nodes.length - 1].offsetWidth;
      const tagEls = nodes.slice(0, -1);

      let used = 0;
      let count = 0;
      for (let i = 0; i < tagEls.length; i++) {
        const tagWidth = tagEls[i].offsetWidth + (i > 0 ? TAG_GAP : 0);
        const reserveForPlus = i < tagEls.length - 1 ? TAG_GAP + plusWidth : 0;
        if (used + tagWidth + reserveForPlus <= available) {
          used += tagWidth;
          count++;
        } else break;
      }

      const capped = max ? Math.min(count, max) : count;
      const fitted = Math.min(capped, tagEls.length);
      // Always render at least one tag when there are any: an oversized lone
      // tag truncates with an ellipsis (handled by the visible layer), which
      // reads better than collapsing everything into a bare "+N" count chip.
      setVisibleCount(tagEls.length > 0 ? Math.max(1, fitted) : 0);
    };

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tagsKey, max]);

  const visible = tags.slice(0, visibleCount);
  const overflowCount = tags.length - visible.length;

  return (
    <div
      ref={containerRef}
      className={cn("relative flex items-center gap-1 overflow-hidden", className)}
      data-testid="_overflow-tags"
    >
      {/* Hidden layer rendering every tag at natural width for measurement. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-1"
      >
        {tags.map((item, i) => (
          <Tag
            key={`${item}-${i}`}
            color={color}
            className="shrink-0 whitespace-nowrap"
          >
            {item}
          </Tag>
        ))}
        <Tag color={color}>+{tags.length}</Tag>
      </div>

      {tags.length === 0 && (
        <span className="text-ds-text-caption">{emptyFallback}</span>
      )}
      {/* Visible tags. Each may shrink and ellipsize so an oversized label
          degrades to "Long lab…" instead of being clipped at the cell edge. The
          fitted count is measured from the hidden layer above, so this layer is
          free to truncate without affecting the fold math. */}
      {visible.length > 0 && (
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          {visible.map((item, i) => (
            <Tooltip key={`${item}-${i}`} message={item} position="top">
              <Tag color={color} className="min-w-0 max-w-full">
                <span className="block min-w-0 truncate">{item}</span>
              </Tag>
            </Tooltip>
          ))}
        </div>
      )}
      {overflowCount > 0 && (
        <Popover
          content={
            <div className="flex max-w-[240px] flex-col gap-1 p-1">
              {tags.map((item, i) => (
                <span
                  key={`${item}-${i}`}
                  className="body-xs-regular text-ds-text-body"
                >
                  {item}
                </span>
              ))}
            </div>
          }
        >
          <button
            type="button"
            aria-label={`${overflowCount} more`}
            className="shrink-0"
          >
            <Tag color={color}>+{overflowCount}</Tag>
          </button>
        </Popover>
      )}
    </div>
  );
}
