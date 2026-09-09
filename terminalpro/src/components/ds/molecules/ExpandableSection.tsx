import type * as React from "react";
import Icon from "~/components/Icon";
import { cn } from "~/lib/utils";

interface ExpandableSectionProps {
  title: React.ReactNode;
  description: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  prefix?: React.ReactNode;
  rightSection?: React.ReactNode;
}

export function ExpandableSection({
  title,
  description,
  isExpanded,
  onToggle,
  children,
  disabled = false,
  className,
  prefix,
  rightSection,
}: ExpandableSectionProps) {
  return (
    <div
      className={cn("border-b border-surface-divider", className)}
      aria-disabled={disabled || undefined}
    >
      <div
        className={cn(
          "w-full flex gap-2.5 items-start group py-4",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
        onClick={disabled ? undefined : onToggle}
      >
        <Icon
          id="chevron-right"
          className={cn(
            "size-4 min-w-4 ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300",
            { "rotate-90": isExpanded },
            disabled && "text-general-label-disabled",
          )}
        />
        {prefix}
        <div className="flex flex-col gap-1 w-full min-w-0 -mt-0.5">
          <h3 className={cn("body-xs-bold", disabled && "text-general-label-disabled")}>
            {title}
          </h3>
          <p
            className={cn(
              "body-xs-regular",
              disabled ? "text-general-label-disabled" : "text-ds-text-caption",
            )}
          >
            {description}
          </p>
        </div>
        {rightSection}
      </div>
      {isExpanded && !disabled && <div className="pb-4 ml-6">{children}</div>}
    </div>
  );
}
