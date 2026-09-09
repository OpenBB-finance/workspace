import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "~/lib/utils";

type TooltipProps = {
  message: string | ReactNode;
  children: any;
  position?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  alignOffset?: number;
  delayDuration?: number;
  hide?: boolean;
  className?: string;
  open?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  style?: any;
  hoverOnly?: boolean;
  preventOnDropdown?: boolean;
};

// added this special tooltip to be used in the GroupDropdown component because the default tooltip was opening the tooltip when the element inside triggered a dropdown
// https://openbbworkspace.slack.com/archives/C04EG3QND7X/p1740492578837219
const Tooltip = forwardRef((props: TooltipProps, _forwardedRef) => {
  const {
    message,
    children,
    position = "bottom",
    sideOffset = 5,
    align,
    alignOffset,
    delayDuration = 200,
    hide = false,
    className = "",
    style = {},
    open: controlledOpen,
    onMouseEnter,
    onMouseLeave,
    hoverOnly = false,
    preventOnDropdown = false,
  } = props;

  const [isHovering, setIsHovering] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const childrenRef = useRef<HTMLDivElement>(null);

  // Handle hover state with proper delay
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (isHovering) {
      // Check if a dropdown is open when hovering
      if (preventOnDropdown) {
        const dropdownOpen = !!document.querySelector(".obb-dropdown-container");
        if (dropdownOpen) {
          setShowTooltip(false);
          return;
        }
      }

      timeoutId = setTimeout(() => {
        setShowTooltip(true);
      }, delayDuration);
    } else {
      setShowTooltip(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isHovering, delayDuration, preventOnDropdown]);

  const open =
    controlledOpen !== undefined ? controlledOpen : hoverOnly ? showTooltip : undefined;

  if (hide) return children;

  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root delayDuration={hoverOnly ? 0 : delayDuration} open={open}>
        <TooltipPrimitive.Trigger asChild={true}>
          <div
            ref={childrenRef}
            onMouseEnter={() => {
              setIsHovering(true);
              onMouseEnter?.();
            }}
            onMouseLeave={() => {
              setIsHovering(false);
              onMouseLeave?.();
            }}
          >
            {children}
          </div>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            onMouseEnter={() => {
              setIsHovering(true);
              onMouseEnter?.();
            }}
            onMouseLeave={() => {
              setIsHovering(false);
              onMouseLeave?.();
            }}
            side={position}
            className={cn(
              "TooltipContent bg-light-50 p-2 text-xs group-hover:scale-100 w-fit rounded z-9000 dark:bg-dark-500 dark:text-white",
              className,
            )}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
            style={{
              boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
              ...style,
            }}
          >
            {message}
            <TooltipPrimitive.Arrow className="fill-tooltip-bg" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
});

export default Tooltip;
