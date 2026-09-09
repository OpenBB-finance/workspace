import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { forwardRef, memo, useMemo, type ReactNode } from "react";
import { twMerge } from "tailwind-merge";

type TooltipProps = {
  id?: string;
  message: string | ReactNode;
  children: ReactNode;
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
  style?: React.CSSProperties;
};

const Tooltip = forwardRef<HTMLButtonElement, TooltipProps>(
  (props: TooltipProps, ref) => {
    const {
      id,
      message,
      children,
      position = "bottom",
      sideOffset = 0,
      align,
      alignOffset,
      delayDuration = 200,
      hide = false,
      className = "",
      style = {},
      open,
      onMouseEnter,
      onMouseLeave,
    } = props;

    const childrenMemo = useMemo(() => children, [children]);
    const messageMemo = useMemo(() => message, [message]);

    const contentPropsMemo = useMemo(
      () => ({
        side: position,
        sideOffset,
        align,
        alignOffset,
        onMouseEnter,
        onMouseLeave,
      }),
      [position, sideOffset, align, alignOffset, onMouseEnter, onMouseLeave],
    );

    const triggerMemo = useMemo(
      () => (
        <TooltipPrimitive.Trigger
          ref={ref}
          asChild={true}
          key={`${id}-trigger`}
        >
          {childrenMemo}
        </TooltipPrimitive.Trigger>
      ),
      [id, ref, childrenMemo],
    );

    return useMemo(() => {
      if (hide) return childrenMemo;

      return (
        <TooltipPrimitive.Provider key={`${id}-provider`}>
          <TooltipPrimitive.Root delayDuration={delayDuration} open={open}>
            {triggerMemo}
            <TooltipPrimitive.Portal key={`${id}-portal`}>
              <TooltipPrimitive.Content
                key={`${id}-content`}
                {...contentPropsMemo}
                className={twMerge(
                  "TooltipContent bg-light-50 z-9000 w-fit rounded p-2 text-xs group-hover:scale-100 dark:bg-dark-500 dark:text-white",
                  className,
                )}
                style={{
                  boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)",
                  ...style,
                }}
              >
                {messageMemo}
                {/* <TooltipPrimitive.Arrow className="fill-grey-50 dark:fill-dark-500" /> */}
              </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
          </TooltipPrimitive.Root>
        </TooltipPrimitive.Provider>
      );
    }, [
      id,
      childrenMemo,
      Object.values(contentPropsMemo),
      messageMemo,
      className,
      style,
      delayDuration,
      open,
      hide,
      triggerMemo,
      contentPropsMemo,
    ]);
  },
);

Tooltip.displayName = "Tooltip";

export default memo(Tooltip);
