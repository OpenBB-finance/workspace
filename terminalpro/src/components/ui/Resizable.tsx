import {
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import Icon from "../Icon";
import { usePanelsState } from "../LayoutAuth/AppLayout/hooks/usePanelsState";
import Tooltip from "../Tooltip";

type PanelElementRef = ElementRef<typeof Panel>;
type GroupElementRef = ElementRef<typeof PanelGroup>;
type GroupProps = ComponentPropsWithoutRef<typeof PanelGroup>;
type PanelProps = ComponentPropsWithoutRef<typeof Panel>;
type ResizeHandleProps = ComponentProps<typeof PanelResizeHandle> & {
  withHandle?: boolean;
  collapsed?: boolean;
  type?: "left" | "right";
  edgeHovered?: boolean;
};

const ResizablePanelGroup = memo(
  forwardRef<GroupElementRef, GroupProps>(
    ({ className, style, children, ...props }, ref) => {
      const childrenArray = useMemo(() => children, [children]);
      const propsMemo = useMemo(() => props, [Object.values(props)]);

      return useMemo(
        () => (
          <PanelGroup
            ref={ref}
            {...propsMemo}
            className={cn(
              "flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
              className,
            )}
            children={childrenArray}
          />
        ),
        [childrenArray, propsMemo, ref],
      );
    },
  ),
);
ResizablePanelGroup.displayName = "ResizablePanelGroup";

const ResizablePanel = memo(
  forwardRef<PanelElementRef, PanelProps>(
    ({ className, style, children, ...props }, ref) => {
      const childrenArray = useMemo(() => children, [children]);
      const propsMemo = useMemo(() => props, [Object.values(props)]);
      const styleMemo = useMemo(() => style, [style]);
      return useMemo(
        () => (
          <Panel
            ref={ref}
            className={className}
            {...propsMemo}
            children={childrenArray}
            style={{ overflow: "auto", ...styleMemo }}
          />
        ),
        [className, childrenArray, propsMemo, styleMemo, ref],
      );
    },
  ),
);
ResizablePanel.displayName = "ResizablePanel";

const ResizableHandle = memo(
  ({
    withHandle,
    className,
    collapsed,
    type = "left",
    edgeHovered = false,
    hitAreaMargins = { coarse: 5, fine: 2 },
    style,
    onClick,
    ...props
  }: ResizeHandleProps) => {
    const collapsedState = usePanelsState(
      type === "left" ? "collapsedLeft" : "collapsedRight",
    );
    const isCollapsed = collapsed ?? collapsedState;

    // Get fullscreen state for AI chat priority
    const { isFullscreen } = useShallowCopilotStore((state) => ({
      isFullscreen: state.isFullscreen,
    }));

    // Get setting for expand button visibility on collapsed panels
    const collapsedPanelExpandOnHover = useShallowThemeStore(
      (state) => state.collapsedPanelExpandOnHover,
    );

    const [isDragging, setIsDragging] = useState(false);
    const draggingTimeoutRef = useRef<NodeJS.Timeout>(null);

    const drag = useMemo(
      () => (
        <div
          data-testid={`resizable-handle-${type}`}
          onClick={() => {
            if (isCollapsed) {
              onClick?.();
            }
          }}
          className={cn("z-50 flex h-5 w-5 items-center justify-center rounded-sm", {
            "border border-[#c1c3c5b4] dark:border-[#5a5a5ab4] hidden group-hover:flex":
              !isCollapsed ||
              (isCollapsed && collapsedPanelExpandOnHover && !edgeHovered),
            "!flex": (!collapsed && isDragging) || (isCollapsed && edgeHovered),
            "h-[40px] w-[40px] absolute cursor-pointer": isCollapsed,
            "bg-brand-main text-light-100 pr-4": isCollapsed && type === "right",
            "bg-brand-main text-light-100 pl-4": isCollapsed && type === "left",
            // Hide left sidebar drag handle visually when AI chat is maximized, but keep resize functional
            "opacity-0": type === "left" && isFullscreen && !isCollapsed,
          })}
        >
          {isCollapsed ? (
            type === "right" ? (
              <Icon id="sparkles-icon" className="h-4 w-4" />
            ) : (
              <Icon id="layout" className="h-4 w-4 stroke-1.5" />
            )
          ) : (
            <Icon id="align-horizontal-centre-01" className="h-4 w-4 text-light-300" />
          )}
        </div>
      ),
      [
        isCollapsed,
        type,
        isDragging,
        collapsedPanelExpandOnHover,
        isFullscreen,
        edgeHovered,
      ],
    );

    const onDragging = useCallback(
      (e: boolean) => {
        setIsDragging(e);
        if (draggingTimeoutRef.current) clearTimeout(draggingTimeoutRef.current);

        draggingTimeoutRef.current = setTimeout(() => {
          props.onDragging?.(e);
        }, 100);
      },
      [props.onDragging, draggingTimeoutRef],
    );

    return (
      <PanelResizeHandle
        className={cn(
          "group pointer-events-auto relative flex items-center justify-center",
          "bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-1",
          "after:-translate-x-1/2 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
          "focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px",
          "data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0",
          "data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full",
          "data-[panel-group-direction=vertical]:after:-translate-y-1/2",
          "data-[panel-group-direction=vertical]:after:translate-x-0",
          "[&[data-panel-group-direction=vertical]>div]:rotate-90",
          className,
          {
            "bg-light-200 dark:bg-dark-500":
              ((type === "right" || type === "left") && !isCollapsed) ||
              (isCollapsed && !edgeHovered),
            "hover:bg-brand-lighter dark:hover:bg-brand-lighter":
              !isDragging && (type === "right" || type === "left"),
            // Highlight bar when edge hover zone is active
            "bg-brand-lighter dark:bg-brand-lighter": edgeHovered && isCollapsed,
            // add some styles when dragging to the bar
            "bg-brand-darker dark:bg-brand-darker": isDragging,
            "w-px": withHandle,
            // Ensure resize handle is above EdgeHoverZone (z-40) when collapsed
            "z-50": isCollapsed,
            // Hide left sidebar resize handle visually when AI chat is maximized, but keep resize functional
            "after:opacity-0": type === "left" && isFullscreen,
            // hide right side because we only need left side on full screen
            "w-0": type === "right" && isFullscreen,
          },
        )}
        hitAreaMargins={hitAreaMargins}
        {...props}
        onDragging={onDragging}
      >
        {isCollapsed && withHandle && (
          <Tooltip
            message={
              isCollapsed
                ? type === "left"
                  ? "Click to expand sidebar"
                  : "Click to expand Copilot"
                : "Drag to resize"
            }
            position={type === "left" ? "right" : "left"}
            hide={isDragging}
          >
            {drag}
          </Tooltip>
        )}
      </PanelResizeHandle>
    );
  },
);

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
