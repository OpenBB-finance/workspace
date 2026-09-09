import * as SelectPrimitive from "@radix-ui/react-select";
import React from "react";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import { cn } from "~/lib/utils";
import { SelectContent, SelectTrigger, SelectValue } from "./Select";

export interface EnhancedSelectOptionData {
  value: string;
  label: string;
  description?: string;
  subtitle?: string;
  icon?: string;
  disabled?: boolean;
  tooltip?: React.ReactNode;
  metadata?: Record<string, any>;
  // Enhanced tooltip data
  tooltipData?: {
    title?: string;
    backend?: string;
    source?: string;
    category?: string;
    subCategory?: string;
    endpoint?: string;
    details?: React.ReactNode;
  };
}

interface EnhancedSelectItemProps {
  option: EnhancedSelectOptionData;
}

// Compound tooltip component for flexible composition
export const EnhancedTooltip = {
  Root: function Root({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div className={cn("max-w-[296px]", className)} {...props}>
        {children}
      </div>
    );
  },

  Header: function Header({
    left,
    right,
    className,
    ...props
  }: {
    left?: React.ReactNode;
    right?: React.ReactNode;
    className?: string;
  }) {
    if (!(left || right)) return null;

    return (
      <div
        className={cn("flex justify-between items-start mb-2.5", className)}
        {...props}
      >
        {left && (
          <div className="bg-general-bg-secondary rounded-xl">
            <div className="px-1.5 py-0">
              <span className="text-2xs leading-[1.5] text-ds-text-caption">
                {left}
              </span>
            </div>
          </div>
        )}
        {right && (
          <span className="text-2xs leading-[1.5] text-ds-text-caption">{right}</span>
        )}
      </div>
    );
  },

  Title: function Title({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div
        className={cn(
          "font-bold text-[12px] leading-[18px] text-ds-text-heading mb-2",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },

  Divider: function Divider({ className, ...props }: { className?: string }) {
    return <hr className={cn("border-surface-divider mb-2", className)} {...props} />;
  },

  Badge: function Badge({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div
        className={cn(
          "text-2xs leading-[1.5] text-ds-text-caption mb-1 capitalize",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },

  Content: function Content({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div
        className={cn(
          "text-[12px] leading-[18px] text-ds-text-heading mt-2 max-h-[150px] overflow-y-auto",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },

  Section: function Section({
    title,
    children,
    className,
    ...props
  }: {
    title: string;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <>
        <div
          className={cn(
            "text-2xs leading-[1.5] text-ds-text-caption mb-2 mt-3 uppercase font-medium",
            className,
          )}
          {...props}
        >
          {title}
        </div>
        {children}
      </>
    );
  },

  Code: function Code({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div
        className={cn(
          "text-light-200 font-mono break-all bg-dark-800 px-2 py-1 rounded text-[11px]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },

  Details: function Details({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    );
  },
};

const createEnhancedTooltip = (option: EnhancedSelectOptionData): React.ReactNode => {
  const { tooltipData, description } = option;

  // If tooltipData is provided, create a composed tooltip
  if (tooltipData) {
    return (
      <EnhancedTooltip.Root>
        <EnhancedTooltip.Header left={tooltipData.backend} right={tooltipData.source} />
        <EnhancedTooltip.Title>
          {tooltipData.title || option.label}
        </EnhancedTooltip.Title>
        <EnhancedTooltip.Divider />
        {(tooltipData.category || tooltipData.subCategory) && (
          <EnhancedTooltip.Badge>
            {[tooltipData.category, tooltipData.subCategory]
              .filter(Boolean)
              .join(" • ")}
          </EnhancedTooltip.Badge>
        )}
        {description && (
          <EnhancedTooltip.Content>{description}</EnhancedTooltip.Content>
        )}
        {tooltipData.endpoint && (
          <EnhancedTooltip.Section title="ENDPOINT">
            <EnhancedTooltip.Code>{tooltipData.endpoint}</EnhancedTooltip.Code>
          </EnhancedTooltip.Section>
        )}
        {tooltipData.details && (
          <EnhancedTooltip.Details>{tooltipData.details}</EnhancedTooltip.Details>
        )}
      </EnhancedTooltip.Root>
    );
  }

  // Fallback to simple description tooltip
  if (description) {
    return (
      <div className="space-y-1">
        <div className="font-medium text-light-50">{option.label}</div>
        <div className="text-light-200 text-xs leading-relaxed">{description}</div>
      </div>
    );
  }

  return null;
};

const EnhancedSelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  EnhancedSelectItemProps
>(({ option }, ref) => {
  const { value, label, subtitle, icon, disabled, tooltip } = option;

  const itemContent = (
    <SelectPrimitive.Item
      ref={ref}
      value={value}
      disabled={disabled}
      className={cn(
        "py-1.5 h-full w-full cursor-pointer px-3 max-w-[400px]",
        "hover:bg-general-bg-secondary",
        "data-[highlighted]:bg-general-bg-secondary",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="text-left min-w-0 flex-1 flex items-baseline">
            <SelectPrimitive.ItemText asChild={true}>
              <span className="text-general-label text-xs font-medium truncate">
                {label}
              </span>
            </SelectPrimitive.ItemText>
            {subtitle && (
              <span className="text-ds-text-caption text-[11px] ml-2 truncate flex-1 min-w-0">
                {subtitle}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Icon id="check" className="size-4 text-main-100" />
          </SelectPrimitive.ItemIndicator>
        </div>
      </div>
    </SelectPrimitive.Item>
  );

  const tooltipContent = tooltip || createEnhancedTooltip(option);

  if (tooltipContent && !disabled) {
    return (
      <Tooltip
        id={`enhanced-select-item-tooltip-${value}`}
        message={tooltipContent}
        position="left"
        className="max-w-80 text-left"
      >
        {itemContent}
      </Tooltip>
    );
  }

  return itemContent;
});

EnhancedSelectItem.displayName = "EnhancedSelectItem";

export interface EnhancedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: EnhancedSelectOptionData[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  triggerClassName?: string;
  error?: boolean;
  message?: React.ReactNode;
  showSelectedIcon?: boolean;
}

export const EnhancedSelect = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  EnhancedSelectProps
>(
  (
    {
      value,
      onChange,
      options,
      placeholder,
      label,
      disabled,
      className,
      contentClassName,
      triggerClassName,
      error,
      message,
      showSelectedIcon = false,
      ...props
    },
    ref,
  ) => {
    const selectedOption = options.find((option) => option.value === value);

    return (
      <SelectPrimitive.Root
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        {...props}
      >
        <div className={cn("BB-Select group", className)} aria-disabled={disabled}>
          {label && (
            <label className="body-xs-medium text-ds-text-body mb-1.5 block">
              {label}
            </label>
          )}
          <SelectTrigger
            ref={ref}
            className={cn(
              "w-full",
              error && "border-alert-error focus-visible:ring-alert-error",
              triggerClassName,
            )}
          >
            <div className="flex items-center min-w-0 w-full">
              {showSelectedIcon && selectedOption?.icon && (
                <Icon
                  id={selectedOption.icon as any}
                  className="size-4 mr-2 text-ds-text-body flex-shrink-0"
                />
              )}
              <SelectValue placeholder={placeholder} className="flex-1 truncate" />
            </div>
          </SelectTrigger>
          {message && (
            <div
              className={cn(
                "mt-1.5 text-xs",
                error ? "text-alert-error" : "text-ds-text-body",
              )}
            >
              {message}
            </div>
          )}
        </div>
        <SelectContent
          className={cn("min-w-[280px]", contentClassName)}
          viewportClassName="space-y-0 p-0"
        >
          {options.map((option) => (
            <EnhancedSelectItem key={option.value} option={option} />
          ))}
        </SelectContent>
      </SelectPrimitive.Root>
    );
  },
);

EnhancedSelect.displayName = "EnhancedSelect";

// Convenience components for common use cases
export interface SimpleEnhancedSelectProps
  extends Omit<EnhancedSelectProps, "options"> {
  options: Array<{
    value: string;
    label: string;
    description?: string;
    subtitle?: string;
    icon?: string;
    disabled?: boolean;
  }>;
}

export const SimpleEnhancedSelect = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  SimpleEnhancedSelectProps
>(({ options, ...props }, ref) => {
  const enhancedOptions: EnhancedSelectOptionData[] = options.map((option) => ({
    ...option,
    tooltip: option.description ? (
      <EnhancedTooltip.Root>
        <EnhancedTooltip.Title>{option.label}</EnhancedTooltip.Title>
        <EnhancedTooltip.Divider />
        <EnhancedTooltip.Content>{option.description}</EnhancedTooltip.Content>
      </EnhancedTooltip.Root>
    ) : undefined,
  }));

  return <EnhancedSelect ref={ref} options={enhancedOptions} {...props} />;
});

SimpleEnhancedSelect.displayName = "SimpleEnhancedSelect";
