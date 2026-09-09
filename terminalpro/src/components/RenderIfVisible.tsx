import { forwardRef, type MutableRefObject, type ReactNode } from "react";
import { useIntersectionObserver } from "usehooks-ts";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import BrandedLogo from "./General/BrandedLogo";
import { useWidgetContext } from "./Widget.context";

type Props = {
  /**
   * Whether the element should be visible initially or not.
   * Useful e.g. for always setting the first N items to visible.
   * Default: false
   */
  initialVisible?: boolean;
  /** How far outside the viewport in pixels should elements be considered visible?  */
  visibleOffset?: number;
  /** Should the element stay rendered after it becomes visible? */
  stayRendered?: boolean;
  /** Class to apply to the root element */
  rootElementClass?: string;
  children: ReactNode;
};

export const InitialVisibleWidgetIds = ["navigation_bar", "market_indices"];

const RenderIfVisible = forwardRef(
  (
    {
      initialVisible = false,
      visibleOffset = 400,
      stayRendered = true,
      rootElementClass = "widgetContent w-full h-full rounded bg-white text-xs shadow-xs dark:bg-[#151518]",
      children,
    }: Props,
    _forwardedRef: MutableRefObject<HTMLDivElement>,
  ) => {
    const widgetId = useWidgetContext(true)?.widget?.widgetId;
    const isMinimized = useWidgetContext(true)?.widget?.isMinimized;

    const pendingExport = useShallowThemeStore((state) => state.pendingExport);

    initialVisible = initialVisible || pendingExport;

    const { ref, isIntersecting } = useIntersectionObserver({
      root: document.getElementById("workarea"),
      rootMargin: `${visibleOffset}px 0px ${visibleOffset}px 0px`,
      threshold: 0.5,
      freezeOnceVisible: stayRendered,
      initialIsIntersecting:
        isMinimized || InitialVisibleWidgetIds.includes(widgetId) || initialVisible,
    });

    const renderChildren = isIntersecting || initialVisible;

    return (
      <div ref={(el) => ref(el)} className={cn("renderIfVisible", rootElementClass)}>
        {renderChildren ? (
          children
        ) : (
          <div className="flex w-full h-full items-center justify-center overflow-hidden p-4">
            <BrandedLogo />
          </div>
        )}
      </div>
    );
  },
);

RenderIfVisible.displayName = "RenderIfVisible";

export default RenderIfVisible;
