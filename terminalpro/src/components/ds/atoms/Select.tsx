import * as SelectPrimitive from "@radix-ui/react-select";
import { cva, type VariantProps } from "class-variance-authority";
import React from "react";
import Icon from "~/components/Icon";
import type { CanBeImmutable } from "~/lib/types/global";
import { FormItem, FormLabel, FormMessage } from "../molecules/Form";
import { cn } from "../utils";
import { DropdownMenuContentVariants, DropdownMenuItemVariants } from "./DropdownMenu";
import { Label, Message } from "./Label";

export const SelectTriggerVariants = cva(
  [
    "BB-Select body-xs-regular flex w-full items-center justify-between rounded-sm border [&>span]:line-clamp-1",
    "transition",
    "border-general-border-primary text-general-label-hover data-placeholder:text-ds-text-caption bg-input-field-bg",
    "hover:enabled:text-general-label-hover",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-light-300",
    "disabled:cursor-not-allowed disabled:border-general-border-disabled disabled:bg-input-field-bg-disabled disabled:text-general-label-disabled disabled:data-placeholder:text-general-label-disabled",
  ],
  {
    variants: {
      size: {
        xs: "gap-1 px-1",
        sm: "gap-2 px-2 py-1",
        md: "gap-2 p-2",
        lg: "gap-2 p-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export const SelectContentVariants = cva(DropdownMenuContentVariants(), {
  variants: {
    position: {
      popper:
        "data-[side=left]:-translate-x-1 data-[side=top]:-translate-y-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1",
      "item-aligned": "",
    },
  },
});

const SelectRoot = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    VariantProps<typeof SelectTriggerVariants> {}

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, size = "md", ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(SelectTriggerVariants({ size }), className)}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild={true}>
      <Icon id="chevron-down" className="size-4 text-ds-text-body" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export interface SelectScrollUpButtonProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton> {}
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  SelectScrollUpButtonProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon id="chevron-down" className="size-4 text-ds-text-body" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export interface SelectScrollDownButtonProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton> {}
const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  SelectScrollDownButtonProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <Icon id="chevron-down" className="size-4 text-ds-text-body" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export interface SelectContentProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>,
    VariantProps<typeof SelectContentVariants> {
  viewportClassName?: string;
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", viewportClassName, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(SelectContentVariants({ position }), "space-y-0 p-0", className)}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "space-y-2 p-2",
          position === "popper" &&
            "h-radix-select-trigger-height w-full min-w-[var(--radix-select-trigger-width)]",
          viewportClassName,
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export interface SelectGroupLabelProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label> {}
const SelectGroupLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  SelectGroupLabelProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("body-xs-regular mb-1.5 text-ds-text-caption", className)}
    {...props}
  />
));
SelectGroupLabel.displayName = SelectPrimitive.Label.displayName;

export interface SelectItemProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> {}
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(DropdownMenuItemVariants(), className)}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Icon id="check" className="size-4 text-ds-text-body" />
      </SelectPrimitive.ItemIndicator>
    </span>

    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export interface SelectSeparatorProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator> {}
const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  SelectSeparatorProps
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

// Composed Select

export interface SelectOptionObject {
  label: string;
  value: string;
  disabled?: boolean;
}
export type SelectOption = SelectOptionObject | string;

export interface SelectOptionGroup {
  label: string;
  options: CanBeImmutable<SelectOption[]>;
}

export interface SelectProps<T extends string = string>
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
    VariantProps<typeof SelectTriggerVariants> {
  // Model
  options: CanBeImmutable<SelectOption[] | SelectOptionGroup[]>;
  value?: T;
  onChange?: (value: Exclude<T, "">) => void;
  // Trigger
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  // Other components
  label?: React.ReactNode;
  message?: React.ReactNode;
  error?: boolean;
  /** Force light mode styling regardless of theme */
  forceLight?: boolean;
}
/** Plain select component, can be used in form or outside it */
const Select = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  SelectProps
>((props, ref) => {
  const {
    // Model
    options,
    onChange,
    // Trigger
    className,
    placeholder,
    size,
    autoFocus,
    // Other components
    label,
    message,
    error,
    forceLight,
    ...rest
  } = props;

  const id = React.useId();
  const labelId = `${id}-label`;

  function renderGroup(group: SelectOptionGroup) {
    return (
      <SelectGroup key={group.label}>
        <SelectGroupLabel>{group.label}</SelectGroupLabel>
        {group.options.map((option) => renderOption(option))}
      </SelectGroup>
    );
  }

  function renderOption(option: SelectOption) {
    const value = typeof option === "string" ? option : option.value;
    const label = typeof option === "string" ? option : option.label;
    return (
      <SelectItem key={value} value={value}>
        {label}
      </SelectItem>
    );
  }

  return (
    <SelectRoot onValueChange={onChange} {...rest}>
      <div className="BB-Select group" aria-disabled={props.disabled}>
        <Label id={labelId}>{label}</Label>
        <SelectTrigger
          ref={ref}
          className={className}
          size={size}
          autoFocus={autoFocus}
          translate="no"
          aria-labelledby={label ? labelId : undefined}
          aria-label={!label && placeholder ? placeholder : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <Message error={error}>{message}</Message>
      </div>
      <SelectContent className={forceLight ? "force-light" : undefined}>
        {options.map((option) =>
          typeof option === "object" && "options" in option
            ? renderGroup(option)
            : renderOption(option),
        )}
      </SelectContent>
    </SelectRoot>
  );
}) as <T extends string = string>(
  props: SelectProps<T> & { ref?: React.ForwardedRef<HTMLInputElement> },
) => React.ReactElement;

// @ts-expect-error
Select.displayName = "Select";

/* Form */

type FormSelectProps = Omit<SelectProps, "error">;

/** Select field used inside <Form> only. */
const FormSelect = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Root>,
  FormSelectProps
>((props, ref) => {
  const { label, message, ...rest } = props;

  return (
    <FormItem className="BB-FormSelect group" aria-disabled={props.disabled}>
      <FormLabel>{label}</FormLabel>
      <Select ref={ref} {...rest} />
      <FormMessage>{message}</FormMessage>
    </FormItem>
  );
});
FormSelect.displayName = "FormSelect";

export {
  FormSelect,
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectRoot,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
