import { cva } from "class-variance-authority";
import React, { useEffect, useId, useImperativeHandle, useRef } from "react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../molecules/Form";
import { cn } from "../utils";
import { CopyButton } from "./CopyButton";
import { Label, Message } from "./Label";

const groupVariants = cva(
  [
    "BB-Textarea group body-xs-regular flex min-h-[80px] w-full rounded-sm border",
    "disabled:cursor-not-allowed",
    "transition",
    "bg-input-field-bg",
    "border-general-border-primary text-general-label-hover",
    "hover:bg-input-field-bg-hover hover:border-general-border-primary",
    "focus-within:text-general-label-hover",
    "group-aria-disabled:border-general-border-disabled group-aria-disabled:bg-input-field-bg-disabled group-aria-disabled:hover:bg-input-field-bg-disabled group-aria-disabled:text-general-label-disabled",
  ],
  {
    variants: {
      state: {
        error: "border-alert-error!",
        default: "",
      },
      size: {
        md: "gap-2",
      },
    },
    defaultVariants: {
      state: "default",
      size: "md",
    },
  },
);

const textareaVariants = cva(
  [
    "BB-TextareaInput flex min-h-[80px] w-full border-none bg-transparent",
    "resize-none",
    "focus-visible:outline-hidden",
    "disabled:cursor-not-allowed disabled:bg-transparent",
    "transition",

    "text-general-label-hover",
    "placeholder:text-ds-text-caption",
    "focus:placeholder:text-ds-text-caption",
    "disabled:text-general-label-disabled disabled:placeholder:text-general-label-disabled",
  ],
  {
    variants: {
      size: {
        md: "py-3 pl-3",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type ReactTextareaProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
>;

export interface TextareaProps extends ReactTextareaProps {
  /** Show copy icon appears to copy input value. */
  copiable?: boolean;
  /** Make its height auto expandable depending on value. Default is `true` */
  autoheight?: boolean;
  /** Add floating label. Requires `placeholder`. */
  label?: React.ReactNode;
  /** Text below input */
  message?: React.ReactNode;
  /** Make it red and display error message */
  error?: boolean;
  size?: "md";
  onChange?: (value: string) => void;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props, fwRef) => {
    const {
      autoheight = true,
      copiable,
      className,
      error,
      label,
      message,
      size = "md",
      onChange,
      ...rest
    } = props;

    const ref = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(fwRef, () => ref.current!);
    const autoId = useId();
    const textareaId = rest.id || autoId;

    const value = props.value ?? ref.current?.value ?? props.defaultValue ?? "";
    const hasValue = !!value;
    const canEdit = !(props.disabled || props.readOnly);

    const state = canEdit && error ? "error" : "default";

    function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
      onChange?.(event.target.value);
    }

    useEffect(() => {
      if (autoheight) {
        const textarea = ref?.current;
        if (textarea) {
          const borders = 2;
          textarea.style.height = "auto";
          textarea.style.height = `${textarea.scrollHeight + borders}px`;
        }
      }
    });

    const groupClasses = cn(groupVariants({ state, size }), className);
    const textareaClasses = cn(textareaVariants({ size }));

    return (
      <div aria-disabled={props.disabled} className="group">
        <Label htmlFor={textareaId}>{label}</Label>
        <div className={groupClasses}>
          <div className="relative h-full flex-1">
            <textarea
              id={textareaId}
              className={textareaClasses}
              ref={ref}
              onChange={handleChange}
              {...rest}
            />
          </div>
          {copiable && hasValue && (
            <CopyButton
              size="xs"
              className="absolute top-2 right-2 text-inherit transition-all hover:text-general-label-hover group-aria-disabled:bg-transparent"
              text={value as string}
              tabIndex={-1}
            />
          )}
        </div>
        <Message error={error}>{message}</Message>
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

/* Form */

export type FormTextareaProps = Omit<TextareaProps, "error">;

/** Input field used inside <Form> only. */
export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (props, ref) => {
    const { label, message, ...rest } = props;

    return (
      <FormItem className="BB-FormTextarea group" aria-disabled={props.disabled}>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Textarea ref={ref} {...rest} />
        </FormControl>
        <FormMessage>{message}</FormMessage>
      </FormItem>
    );
  },
);
FormTextarea.displayName = "FormTextarea";
