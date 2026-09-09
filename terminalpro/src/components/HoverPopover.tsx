import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from "react";
import { TOOLTIP_OPEN_DELAY_MS } from "~/lib/constants";
import { PopoverContent, PopoverRoot, PopoverTrigger } from "./ds/atoms/Popover";
import { cn } from "./ds/utils";

interface HoverPopoverProps {
  id?: string;
  trigger: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  content: ReactNode;
  triggerClassName?: string;
  contentClassName?: string;
  onClick?: (event: MouseEvent) => void;
  openDelay?: number;
}

/**TODO: move this one to components/ds/atoms/HoverPopover.tsx */
export function HoverPopover({
  trigger,
  content,
  side = "bottom",
  triggerClassName,
  contentClassName,
  onClick,
  openDelay = TOOLTIP_OPEN_DELAY_MS,
  ...props
}: HoverPopoverProps) {
  const [open, setOpen] = useState(false);
  const openTimeoutRef = useRef<number>();
  const closeTimeoutRef = useRef<number>();
  const uniqueId = useId();
  const id = props.id ?? uniqueId;

  const handleMouseEnter = useCallback(() => {
    window.clearTimeout(closeTimeoutRef.current);
    if (open) return;
    window.clearTimeout(openTimeoutRef.current);
    openTimeoutRef.current = window.setTimeout(() => setOpen(true), openDelay);
  }, [open, openDelay]);

  const handleMouseLeave = useCallback(
    (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget as HTMLElement;
      const isLeavingForPopover = relatedTarget?.closest?.(
        `[data-hover-popover='${id}']`,
      );

      if (!isLeavingForPopover) {
        window.clearTimeout(openTimeoutRef.current);
        closeTimeoutRef.current = window.setTimeout(() => {
          setOpen(false);
        }, 100);
      }
    },
    [id],
  );

  return (
    <div
      data-hover-popover={id}
      onMouseLeave={handleMouseLeave}
      key={id}
      onClick={onClick}
    >
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          key={`hover-popover-trigger-${id}`}
          onMouseEnter={handleMouseEnter}
          className={cn("h-6", triggerClassName)}
        >
          {trigger}
        </PopoverTrigger>
        <PopoverContent
          key={`hover-popover-content-${id}`}
          className={cn("relative pr-0.5 h-full w-full", contentClassName)}
          side={side}
          onMouseEnter={handleMouseEnter}
        >
          {content}
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
