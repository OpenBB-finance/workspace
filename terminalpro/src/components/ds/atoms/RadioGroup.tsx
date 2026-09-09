import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import React from "react";
import Icon from "~/components/Icon";
import { cn } from "../utils";

export interface RadioGroupProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {}
const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  RadioGroupProps
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("BB-RadioGroup grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

export interface RadioGroupItemProps
  extends React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: React.ReactNode;
  error?: boolean;
}
const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioGroupItemProps
>((props, ref) => {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { className, children, label, id: _id, ...rest } = props;
  const randomId = React.useId();
  const id = _id ?? randomId;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RadioGroupPrimitive.Item
        ref={ref}
        className={cn(
          "peer aspect-square h-4 w-4 rounded-full border border-general-label text-general-label ring-offset-background",
          "flex items-center justify-center",
          "transition",
          "hover:radix-state-unchecked:border-general-label-hover hover:enabled:text-general-label-hover",
          "radix-state-checked:border-brand-main",
          "radix-state-unchecked:bg-general-bg-primary radix-state-unchecked:border-general-border-primary",
          "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",

          className,
        )}
        id={id}
        {...rest}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Icon id="circle" className="h-2 w-2 fill-current text-link-color" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      {label && (
        <label
          className={cn(
            "body-xs-regular cursor-pointer",
            "max-w-[calc(100%-1rem-0.5rem)]",
            "peer-disabled:cursor-not-allowed",
            "transition",
            "text-general-label",
            "peer-disabled:text-general-label-disabled",
          )}
          htmlFor={id}
        >
          {label}
        </label>
      )}
    </div>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export interface RadioGroupLabelProps extends React.ComponentPropsWithoutRef<"div"> {}
const RadioGroupLabel = React.forwardRef<
  React.ElementRef<React.FC>,
  RadioGroupLabelProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("body-xs-regular mb-1.5 text-ds-text-caption", className)}
    {...props}
  />
));
RadioGroupLabel.displayName = "RadioGroupLabel";

export { RadioGroup, RadioGroupItem, RadioGroupLabel };
