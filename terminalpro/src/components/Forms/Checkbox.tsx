import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type { InputHTMLAttributes, MouseEvent } from "react";
import { forwardRef } from "react";
import { cn } from "../ds/utils";
import Icon from "../Icon";

interface DefaultProps {
  className?: string;
}

interface ICheckboxProps extends DefaultProps {
  error?: boolean;
  disabled?: boolean;
  active?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  labelClassname?: string;
  extraRootClassname?: string;
  checkboxClassname?: string;
  dontStopPropagation?: boolean;
  onChange?: (e: boolean) => void;
  rightLabelOnClick?: (e: MouseEvent<HTMLLabelElement>) => void;
  checked?: boolean | "indeterminate";
}
export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked">,
    ICheckboxProps {}

/** @deprecated use `~/components/ds/atoms/Checkbox` instead */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>((props, ref) => {
  const {
    id,
    disabled: _disabled,
    active,
    type,
    checked,
    onChange,
    onFocus,
    onBlur,
    leftLabel,
    checkboxClassname = "",
    rightLabel,
    rightLabelOnClick = () => {},
    children,
    className,
    labelClassname = "",
    required = false,
    error = false,
    extraRootClassname = "",
    dontStopPropagation = false,
    ..._rest
  } = props;
  const disabled = _disabled;

  return (
    <fieldset className={cn("flex items-center gap-1", extraRootClassname)}>
      {leftLabel ? (
        <label
          className={cn(labelClassname, {
            "text-black dark:text-white cursor-pointer": !disabled,
            "text-light-600": disabled,
          })}
          htmlFor={id}
        >
          {leftLabel}
        </label>
      ) : null}
      <div>
        <CheckboxPrimitive.Root
          disabled={disabled}
          checked={checked}
          onClick={(e) => {
            if (!dontStopPropagation) {
              e.stopPropagation();
            }
          }}
          onCheckedChange={onChange}
          onFocusCapture={onFocus as any}
          onBlurCapture={onBlur as any}
          id={id}
          data-testid={id}
          name={id}
          ref={ref}
          className={cn(
            "group-dropdown border w-4 h-4 rounded-sm flex items-center justify-center",
            "bg-general-bg-primary border-general-border-primary",
            "focus-visible:outline-hidden focus-visible:border-alert-informative",
            "disabled:bg-general-bg-primary-disabled disabled:border-general-border-primary disabled:cursor-not-allowed",
            "radix-state-checked:bg-main-100 radix-state-checked:border-main-100 radix-state-checked:text-btn-primary-label",
            "radix-state-checked:disabled:bg-general-bg-primary-disabled radix-state-checked:disabled:border-general-border-primary radix-state-checked:disabled:text-general-label-disabled",
            "data-[state=indeterminate]:bg-main-100 data-[state=indeterminate]:border-main-100 data-[state=indeterminate]:text-btn-primary-label",
            "data-[state=indeterminate]:disabled:bg-general-bg-primary-disabled data-[state=indeterminate]:disabled:border-general-border-primary data-[state=indeterminate]:disabled:text-general-label-disabled",
            checkboxClassname,
            {
              "border-alert-error! border-2": error,
            },
          )}
        >
          <CheckboxPrimitive.Indicator className="text-current">
            {checked === "indeterminate" ? (
              <Icon id="minus-icon" className="w-[12px] h-[12px] stroke-2" />
            ) : (
              <Icon id="check" className="w-[12px] h-[12px] stroke-2" />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
      </div>
      {rightLabel ? (
        <label
          className={cn(labelClassname, {
            "text-black dark:text-white cursor-pointer": !disabled,
            "text-light-600": disabled,
          })}
          htmlFor={id}
          onClick={rightLabelOnClick}
        >
          {rightLabel}
        </label>
      ) : null}
    </fieldset>
  );
});

Checkbox.displayName = "Checkbox";
