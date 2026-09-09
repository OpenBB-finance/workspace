import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { useParams } from "react-router";
import Icon from "~/components/Icon";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { cn, triggerCustomEvent } from "~/lib/utils";

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  actions?: ReactNode;
  tooltipMessage?: string;
  id?: "dev" | "library" | "tabs" | "shared-tabs";
  "data-section"?: string;
}

const variants = {
  exit: { opacity: 0, height: 0 },
  enter: { opacity: 1, height: "auto" },
};

export function SidebarSection({
  title,
  children,
  disabled = false,
  className,
  actions,
  tooltipMessage,
  id,
  ...props
}: SidebarSectionProps) {
  const { id: activeDashboardId } = useParams();
  const isSharedDashboard = useShallowSharedAppStore(
    (s) => s.getDashboardById(activeDashboardId) !== undefined,
  );
  const { isExpanded, toggleExpanded } = useShallowSidebarStore((state) => ({
    isExpanded: state.sectionIsExpanded(id) && !disabled,
    toggleExpanded: state.toggleExpanded,
  }));

  const onToggle = useCallback(() => toggleExpanded(id), [id, toggleExpanded]);

  const overrides = useMemo(
    () => ({ tabs: activeDashboardId && !isSharedDashboard }),
    [activeDashboardId, isSharedDashboard],
  );

  useEffect(() => {
    if (isExpanded && overrides[id]) {
      triggerCustomEvent("scrollToTabItem", { tabId: activeDashboardId });
    }
  }, [isExpanded]);

  return (
    <div id={id} className={className} {...props}>
      <div
        data-section-header={true}
        className="w-full flex items-center overflow-hidden
        @max-[100px]:justify-center @max-[100px]:flex-col @max-[100px]:gap-0.5 @min-[100px]:justify-between"
      >
        <div
          className={cn(
            "flex w-full items-center gap-0.5 justify-between @max-[100px]:justify-center",
            {
              "pb-1.5": isExpanded && id === "tabs",
            },
          )}
        >
          <div
            onClick={onToggle}
            className={cn(
              "flex items-center gap-0.5 min-w-0 overflow-hidden @max-[100px]:justify-center cursor-pointer",
              {
                "opacity-50 cursor-not-allowed": disabled,
              },
            )}
          >
            <div
              className="obb-icon-btn-v2
              @max-[100px]:mx-auto size-6 flex-shrink-0"
            >
              <Icon
                id="chevron-right"
                className={cn(
                  "duration-200 transform transition-transform size-4 text-light-500",
                  { "rotate-90": isExpanded },
                )}
              />
            </div>

            <span className="@max-[100px]:hidden flex flex-col gap-0.5 overflow-hidden select-none min-w-0">
              <span className="truncate text-2xs uppercase tracking-widest text-light-500 dark:text-light-600 whitespace-nowrap">
                {title}
              </span>
            </span>
          </div>

          {actions && (
            <span
              className="flex items-center flex-shrink-0 @max-[100px]:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {actions}
            </span>
          )}
        </div>

        {actions && (
          <span
            className="@min-[100px]:hidden flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
      </div>
      <AnimatePresence initial={false}>
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          transition={{
            duration: 0.3,
            ease: [0.87, 0, 0.13, 1], // cubic-bezier easing
          }}
          style={{ overflow: "hidden" }}
          className={cn({
            "flex flex-col flex-1 min-h-0": id === "tabs" || id === "shared-tabs",
          })}
          variants={variants}
          animate={isExpanded || overrides[id] ? "enter" : "exit"}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
