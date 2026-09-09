import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import React from "react";
import { cn } from "../utils";
import { DropdownMenuContentVariants } from "./DropdownMenu";

export const tooltipContentClasses = cn([
  "body-xs-regular z-50 max-w-xs overflow-hidden rounded-sm px-2 py-1 shadow-1 outline-hidden",
  "bg-tooltip-bg text-ds-text-body",
  "fade-in-0 zoom-in-95 animate-in",
  "data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out",
  "data-[side=bottom]:slide-in-from-top-2",
  "data-[side=left]:slide-in-from-right-2",
  "data-[side=right]:slide-in-from-left-2",
  "data-[side=top]:slide-in-from-bottom-2",
]);

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> {}

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>((props, ref) => {
  const { className, sideOffset = 4, ...rest } = props;
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn("BB-Tooltip", tooltipContentClasses, className)}
      {...rest}
    />
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;
export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps
  extends Omit<React.ComponentProps<typeof TooltipContent>, "content">,
    Pick<
      React.ComponentProps<typeof TooltipProvider>,
      "delayDuration" | "skipDelayDuration"
    > {
  content: React.ReactNode;
  arrow?: boolean;
}

export const tooltipArrowClasses = cn(["fill-tooltip-bg"]);

export const PopoverRoot = PopoverPrimitive.Root;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverPortal = PopoverPrimitive.Portal;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export interface ContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {}

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  ContentProps
>((props, ref) => {
  const { className, align = "center", sideOffset = 4, ...rest } = props;

  return (
    <PopoverPortal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn("BB-Popover", DropdownMenuContentVariants(), className)}
        {...rest}
      />
    </PopoverPortal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export interface PopoverArrowProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow> {}

export const PopoverArrow = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Arrow>,
  PopoverArrowProps
>((props, ref) => {
  const { className, ...rest } = props;
  return (
    <PopoverPrimitive.Arrow
      ref={ref}
      className={cn(
        "BB-PopoverArrow",
        tooltipArrowClasses,
        "bg-dropdown-bg text-general-label",
        className,
      )}
      {...rest}
    />
  );
});
PopoverArrow.displayName = PopoverPrimitive.Arrow.displayName;

/* Composed Component */

export interface PopoverProps extends TooltipProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenAutoFocus?: (event: FocusEvent) => void;
  onCloseAutoFocus?: (event: FocusEvent) => void;
}

/** `Popover` is a hint, same as `Tooltip`, but appears on click or manually */
export const Popover = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  PopoverProps
>((props, ref) => {
  const {
    children,
    content,
    arrow = false,
    open,
    onOpenChange,
    ...contentProps
  } = props;
  return (
    <PopoverRoot {...{ open, onOpenChange }}>
      <PopoverTrigger asChild={true}>{children}</PopoverTrigger>
      <PopoverPortal>
        <PopoverContent ref={ref} {...contentProps}>
          {content}
          {arrow && <PopoverArrow />}
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  );
});
Popover.displayName = "Popover";
