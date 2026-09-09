import React, { type ReactNode } from "react";
import Tooltip from "~/components/Tooltip";
import { cn } from "../utils";

export interface HintLabelProps {
  children: ReactNode;
  tooltip: string | ReactNode;
  disabled?: boolean;
  tooltipClassName?: string;
  tooltipPosition?: "top" | "bottom" | "left" | "right";
  tooltipAlign?: "start" | "center" | "end";
  tooltipSideOffset?: number;
  className?: string;
}

/**
 * A label with a dotted underline that signals hoverable tooltip content.
 * Use for settings/feature labels where the name alone isn't self-explanatory.
 */
export const HintLabel = React.forwardRef<HTMLSpanElement, HintLabelProps>(
  (
    {
      children,
      tooltip,
      disabled,
      tooltipClassName,
      tooltipPosition,
      tooltipAlign,
      tooltipSideOffset,
      className,
    },
    ref,
  ) => {
    return (
      <Tooltip
        message={tooltip}
        className={tooltipClassName}
        position={tooltipPosition}
        align={tooltipAlign}
        sideOffset={tooltipSideOffset}
      >
        <span
          ref={ref}
          aria-disabled={disabled || undefined}
          className={cn(
            "select-none",
            disabled
              ? "text-general-label-disabled"
              : "text-general-label underline decoration-dotted underline-offset-2 decoration-general-border-primary",
            className,
          )}
        >
          {children}
        </span>
      </Tooltip>
    );
  },
);
HintLabel.displayName = "HintLabel";
