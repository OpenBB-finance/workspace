import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import React from "react";
import Icon from "~/components/Icon";
import { cn } from "../utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: React.ReactNode;
  error?: boolean;
  checked?: boolean | "indeterminate";
  labelPosition?: "left" | "right";
  labelClassName?: string;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>((props, ref) => {
  const {
    className,
    label,
    error,
    id: idProp,
    labelPosition = "right",
    labelClassName,
    ...rest
  } = props;
  const idHook = React.useId();

  const id = idProp || idHook;

  return (
    <div
      className={cn(
        "flex items-center gap-1",
        labelPosition === "left" && "flex-row-reverse",
      )}
    >
      <CheckboxPrimitive.Root
        ref={ref}
        className={cn(
          "BB-Checkbox group peer h-4 w-4 shrink-0 rounded-sm border",
          "transition",
          "disabled:cursor-not-allowed",

          // Unchecked default
          "bg-general-bg-primary border-general-border-primary",
          // Unchecked focus
          "focus-visible:outline-hidden focus-visible:border-alert-informative",
          // Unchecked disabled
          "disabled:bg-general-bg-primary-disabled disabled:border-general-border-primary",
          // Unchecked error
          "data-error:border-alert-error!",

          // Checked default
          "data-[state=checked]:bg-main-100 data-[state=checked]:border-main-100 data-[state=checked]:text-btn-primary-label",
          // Checked focus
          "data-[state=checked]:focus-visible:border-alert-informative",
          // Checked disabled
          "data-[state=checked]:disabled:bg-general-bg-primary-disabled data-[state=checked]:disabled:border-general-border-primary data-[state=checked]:disabled:text-general-label-disabled",
          // Checked error
          "data-[state=checked]:data-error:border-alert-error!",

          // Indeterminate default
          "data-[state=indeterminate]:bg-main-100 data-[state=indeterminate]:border-main-100 data-[state=indeterminate]:text-btn-primary-label",
          // Indeterminate focus
          "data-[state=indeterminate]:focus-visible:border-alert-informative",
          // Indeterminate disabled
          "data-[state=indeterminate]:disabled:bg-general-bg-primary-disabled data-[state=indeterminate]:disabled:border-general-border-primary data-[state=indeterminate]:disabled:text-general-label-disabled",
          // Indeterminate error
          "data-[state=indeterminate]:data-error:border-alert-error!",

          className,
        )}
        id={id}
        data-error={error}
        {...rest}
      >
        <CheckboxPrimitive.Indicator
          className={cn("flex items-center justify-center text-current")}
        >
          <Icon
            id="check"
            className="hidden size-[12px] stroke-2 group-data-[state=checked]:block"
          />
          <Icon
            id="minus-icon"
            className="hidden size-[12px] stroke-2 group-data-[state=indeterminate]:block"
          />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label && (
        <label
          className={cn(
            "body-xs-regular cursor-pointer",
            "max-w-[calc(100%-1rem-0.5rem)]",
            "peer-disabled:cursor-not-allowed",
            "transition",
            "text-general-label",
            "peer-disabled:text-general-label-disabled",
            labelClassName,
          )}
          htmlFor={id}
        >
          {label}
        </label>
      )}
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
