import { type ReactNode, useMemo } from "react";
import type { IconId } from "~/components/Icon.types";
import Icon from "../../Icon";
import Tooltip from "../../Tooltip";
import { CollapsibleSection } from "../atoms/CollapsibleSection";
import { cn } from "../utils";

export type SettingsMenuProps = {
  title: string | ReactNode;
  children: ReactNode;
  canCollapse?: boolean;
  tooltip?: string | ReactNode;
  tooltipClassName?: string;
  icon?: IconId;
  rightElement?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Extra classes for the outer container. */
  className?: string;
  /** Extra classes for the collapsible content wrapper. */
  contentClassName?: string;
  /** Extra classes for the body (where children render). */
  bodyClassName?: string;
};

export default function SettingsMenu({
  title,
  children,
  canCollapse = false,
  tooltip,
  tooltipClassName = "max-w-[300px]",
  icon,
  rightElement,
  defaultOpen,
  open,
  onOpenChange,
  className,
  contentClassName,
  bodyClassName,
}: SettingsMenuProps) {
  const titleElement = useMemo(
    () => (
      <div className="flex items-center gap-1.5">
        {icon && <Icon id={icon} className="size-4 text-link-color" />}
        <h3
          className={cn("body-xs-medium text-general-label-hover select-none", {
            "cursor-help": tooltip && !canCollapse,
          })}
        >
          {title}
        </h3>
      </div>
    ),
    [title, tooltip, canCollapse, icon],
  );

  const headerContent = tooltip ? (
    <Tooltip message={tooltip} className={tooltipClassName}>
      {titleElement}
    </Tooltip>
  ) : (
    titleElement
  );

  if (!canCollapse) {
    return (
      <div
        className={cn(
          "rounded border border-surface-divider overflow-hidden",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 p-2.5 bg-general-bg-secondary">
          <div className="flex-1">{headerContent}</div>
          {rightElement && <div>{rightElement}</div>}
        </div>
        <div className={cn("p-4 space-y-4", bodyClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <CollapsibleSection
      className={cn(
        "bg-general-bg-primary rounded border border-general-border-primary overflow-hidden",
        className,
      )}
      contentClassName={cn("overflow-hidden", contentClassName)}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
      header={({ isOpen }) => (
        <div className="flex items-center gap-2.5 p-2.5 bg-general-bg-secondary cursor-pointer w-full">
          <div className="flex-1 flex items-center gap-2.5">
            <Icon
              id="chevron-right"
              className={cn("size-4 transition-transform text-ds-text-body", {
                "rotate-90": isOpen,
              })}
            />
            {headerContent}
          </div>
          {rightElement && (
            <div
              className="flex items-center"
              onClick={(e) => {
                // Prevent collapsible toggle when clicking right element
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              {rightElement}
            </div>
          )}
        </div>
      )}
    >
      <div className={cn("p-4 space-y-4", bodyClassName)}>{children}</div>
    </CollapsibleSection>
  );
}
