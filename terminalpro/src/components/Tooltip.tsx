import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  forwardRef,
  memo,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useSyncExternalStore,
} from "react";
import { twMerge } from "tailwind-merge";

const mobileQuery =
  typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)") : null;
const subscribe = (cb: () => void) => {
  mobileQuery?.addEventListener("change", cb);
  return () => mobileQuery?.removeEventListener("change", cb);
};
const getSnapshot = () => mobileQuery?.matches ?? false;

// Tracks whether a root <TooltipProvider> is mounted (see main.tsx). When present,
// each Tooltip renders a bare Root so Radix's skipDelayDuration is shared across all
// tooltips. When absent (e.g. isolated renders in tests), Tooltip falls back to its
// own provider so it stays self-sufficient.
const HasRootTooltipProvider = createContext(false);

export function TooltipProvider(
  props: ComponentProps<typeof TooltipPrimitive.Provider>,
) {
  return (
    <HasRootTooltipProvider.Provider value={true}>
      <TooltipPrimitive.Provider {...props} />
    </HasRootTooltipProvider.Provider>
  );
}

type TooltipProps = {
  id?: string;
  message: string | ReactNode;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  align?: "start" | "center" | "end";
  alignOffset?: number;
  collisionPadding?: number;
  delayDuration?: number;
  hide?: boolean;
  className?: string;
  open?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  style?: CSSProperties;
  /** Renders the trigger as a child element instead of wrapping it in a span. Defaults to `true` */
  asChild?: boolean;
};

const Tooltip = memo(
  forwardRef<HTMLButtonElement, TooltipProps>((props: TooltipProps, ref) => {
    const {
      id: idProp,
      message,
      children,
      position = "bottom",
      sideOffset = 5,
      align,
      alignOffset,
      collisionPadding,
      delayDuration,
      hide = false,
      className = "",
      style = {},
      open,
      asChild = true,
      onMouseEnter,
      onMouseLeave,
    } = props;

    const uniqueId = useId();
    const id = idProp || `tooltip-${uniqueId}`;

    const isMobile = useSyncExternalStore(subscribe, getSnapshot, () => false);
    const hasRootProvider = useContext(HasRootTooltipProvider);
    const childrenMemo = useMemo(() => children, [children]);
    const messageMemo = useMemo(() => message, [message]);

    const contentPropsMemo = useMemo(
      () => ({
        side: position,
        sideOffset,
        align,
        alignOffset,
        collisionPadding,
        onMouseEnter,
        onMouseLeave,
      }),
      [
        position,
        sideOffset,
        align,
        alignOffset,
        collisionPadding,
        onMouseEnter,
        onMouseLeave,
      ],
    );

    const triggerMemo = useMemo(
      () => (
        <TooltipPrimitive.Trigger ref={ref} asChild={asChild} key={`${id}-trigger`}>
          {childrenMemo}
        </TooltipPrimitive.Trigger>
      ),
      [id, ref, asChild, childrenMemo],
    );

    const contentClassName = twMerge(
      "TooltipContent bg-tooltip-bg text-general-label p-2 text-xs group-hover:scale-100 w-fit rounded z-9000",
      "shadow-[0px_2px_10px_0px_rgba(0,0,0,0.2)] dark:shadow-[0px_2px_10px_0px_rgba(0,0,0,0.4)]",
      className,
    );

    return useMemo(() => {
      if (hide) return childrenMemo;

      if (isMobile) {
        return (
          <PopoverPrimitive.Root key={`${id}-popover`}>
            <PopoverPrimitive.Trigger ref={ref} asChild={asChild} key={`${id}-trigger`}>
              {childrenMemo}
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal key={`${id}-portal`}>
              <PopoverPrimitive.Content
                key={`${id}-content`}
                side={contentPropsMemo.side}
                sideOffset={contentPropsMemo.sideOffset}
                align={contentPropsMemo.align}
                collisionPadding={contentPropsMemo.collisionPadding}
                className={contentClassName}
                style={style}
              >
                {messageMemo}
                <PopoverPrimitive.Arrow className="fill-tooltip-bg" />
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
        );
      }

      const root = (
        <TooltipPrimitive.Root
          delayDuration={delayDuration}
          open={open}
          key={`${id}-root`}
        >
          {triggerMemo}
          <TooltipPrimitive.Portal key={`${id}-portal`}>
            <TooltipPrimitive.Content
              key={`${id}-content`}
              {...contentPropsMemo}
              className={contentClassName}
              style={style}
            >
              {messageMemo}
              <TooltipPrimitive.Arrow className="fill-tooltip-bg" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      );

      return hasRootProvider ? (
        root
      ) : (
        <TooltipPrimitive.Provider key={`${id}-provider`}>
          {root}
        </TooltipPrimitive.Provider>
      );
    }, [
      id,
      childrenMemo,
      triggerMemo,
      contentPropsMemo,
      messageMemo,
      contentClassName,
      style,
      delayDuration,
      open,
      hide,
      asChild,
      isMobile,
      hasRootProvider,
    ]);
  }),
);

Tooltip.displayName = "Tooltip";

export default Tooltip;
