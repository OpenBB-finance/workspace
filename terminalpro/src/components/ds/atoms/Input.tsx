import { CalendarIcon } from "@radix-ui/react-icons";
import { cva } from "class-variance-authority";
import React, {
  type ForwardedRef,
  type ReactElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Icon from "~/components/Icon";
import { FormControl, FormItem, FormLabel, FormMessage } from "../molecules/Form";
import { cn } from "../utils";
import { CopyButton } from "./CopyButton";
import { Label, Message } from "./Label";

export const groupVariants = cva(
  [
    "BB-Input group body-xs-regular flex w-full items-center gap-2 rounded-sm border",
    "disabled:cursor-not-allowed",
    "transition",
    "bg-input-field-bg",
    "border-general-border-primary text-ds-text-body",
    "hover:data-enabled:bg-input-field-bg-hover hover:data-enabled:border-general-border-primary",
    "data-focused:text-general-label-hover",
    "group-aria-disabled:border-general-border-disabled group-aria-disabled:bg-input-field-bg-disabled group-aria-disabled:text-general-label-disabled",
  ],
  {
    variants: {
      state: {
        error: "border-alert-error!",
        default: "",
      },
      size: {
        //! Keep pl and pr, don't use px! It's overriding below.
        xs: "gap-1 pr-1 pl-1 [&_.BB-Icon]:size-3 [&_button]:max-h-3",
        sm: "gap-1 pr-2 pl-2 [&_button]:max-h-4",
        md: "gap-2 pr-3 pl-3 [&_button]:max-h-6",
        lg: "gap-2 pr-3 pl-3 [&_button]:max-h-8",
      },
    },
    defaultVariants: {
      state: "default",
      size: "md",
    },
  },
);

export const inputVariants = cva(
  [
    "BB-Input flex w-full border-none bg-transparent",
    "file:border-0 file:bg-transparent file:font-medium file:text-sm",
    "disabled:cursor-not-allowed disabled:bg-transparent",
    "focus-visible:outline-hidden",
    "transition",

    "text-general-label-hover",
    "placeholder:text-ds-text-caption",
    "focus:placeholder:text-ds-text-caption",
    "disabled:text-general-label-disabled disabled:placeholder:text-general-label-disabled",
  ],
  {
    variants: {
      size: {
        xs: "py-0 pl-1",
        sm: "py-1 pl-2 only-sm:text-base",
        md: "py-2 pl-3 only-sm:text-base",
        lg: "py-3 pl-3 only-sm:text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type ReactInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "prefix" | "size" | "value"
>;

type InputValue = string | number;

export interface InputProps<
  T extends InputValue = string,
  TValue = T extends `${infer V}` ? V : T,
> extends Omit<ReactInputProps, "defaultValue"> {
  /** Add floating label. Requires `placeholder`. */
  label?: React.ReactNode;
  /** When value is not empty, x icon appears to clear input. */
  clearable?: boolean;
  /** Show copy icon appears to copy input value. */
  copiable?: boolean;
  /** Show eye icon to reveal and hide password. Password is hidden by default. */
  revealable?: boolean;
  /** Add React element inside border before input. */
  prefix?: React.ReactNode;
  /** Add React element inside border after input. */
  suffix?: React.ReactNode;
  size?: "xs" | "sm" | "md" | "lg";
  value?: T;
  defaultValue?: T;
  /** Text below input */
  message?: React.ReactNode;
  /** Make it red and display error message */
  error?: boolean;
  /** TODO: Replace password with 🦋. */
  // butterflies?: boolean;
  onChange?: (value: TValue) => void;
  /** Input className */
  inputClassName?: string;
  /** Prevent browsers from prompting to save password. Only applies when type="password". */
  noPasswordSave?: boolean;
}

/** Plain input component, can be used in form or outside it */
export const Input = React.forwardRef<HTMLInputElement, InputProps>((props, fwRef) => {
  const {
    // default props
    className,
    type: defaultType = "text",
    placeholder,
    onFocus,
    onBlur,
    // custom props
    label,
    prefix,
    suffix,
    size = "md",
    message,
    onChange,
    disabled,
    readOnly,
    clearable = !(readOnly || disabled),
    copiable = false,
    revealable = defaultType === "password",
    error,
    inputClassName,
    noPasswordSave,
    // butterflies = revealable,
    ...rest
  } = props;

  // Uncontrolled state support
  const localRef = useRef<HTMLInputElement>(null);
  const ref = (fwRef as React.RefObject<HTMLInputElement>) ?? localRef;
  const autoId = useId();
  const inputId = rest.id || autoId;

  const [type, setType] = useState(defaultType ?? "text");
  const [isFocused, setFocused] = useState(false);
  const isHidden = type === "password";

  const value = props.value ?? ref.current?.value ?? props.defaultValue ?? "";
  const hasValue = !!value;
  const canEdit = !(props.disabled || props.readOnly);

  const state = canEdit && error ? "error" : "default";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e.target.value);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(true);
    onFocus?.(e);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false);
    onBlur?.(e);
  }

  function switchReveal() {
    setType(type === "password" ? "text" : "password");
  }

  function clear() {
    const onChange = props.onChange! as (value: string) => void;
    if (onChange) {
      onChange("");
    } else {
      const input = ref.current;
      if (input) {
        input.value = "";
      }
    }
  }

  useEffect(() => {
    setType(defaultType ?? "text");
  }, [defaultType]);

  const groupClasses = cn(groupVariants({ state, size }), className, !prefix && "pl-0");

  const inputClasses = cn(
    inputVariants({ size }),
    type === "date" && "cursor-text",
    prefix && "pl-0",
    inputClassName,
    { "no-password-save": type === "password" && noPasswordSave },
  );

  return (
    <div aria-disabled={props.disabled} className="group">
      <Label htmlFor={inputId}>{label}</Label>
      <div
        className={groupClasses}
        data-focused={isFocused || null}
        data-enabled={canEdit || null}
      >
        {prefix && <div className="inline-flex flex-0">{prefix}</div>}
        <div className="relative h-full min-w-[3rem] flex-1">
          <input
            key="qwe"
            id={inputId}
            type={type === "password" && noPasswordSave ? "text" : type}
            className={cn("peer", inputClasses)}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            aria-invalid={error}
            ref={ref}
            defaultValue={props.defaultValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              fontSize: "inherit",
              lineHeight: "inherit",
              fontVariantLigatures: "none",
              fontFeatureSettings: `"liga" 0`,
            }}
            {...rest}
          />

          {defaultType === "date" && (
            <CalendarIcon className="-mb-2 pointer-events-none absolute right-0 bottom-1/2 size-4" />
          )}
        </div>
        {copiable && hasValue && (
          <CopyButton
            className="text-inherit transition-all hover:text-general-label-hover group-aria-disabled:bg-transparent bg-transparent border-none p-0.5"
            text={value as string}
            tabIndex={-1}
          />
        )}
        {revealable && (
          <button
            type="button"
            aria-label={isHidden ? "Show password" : "Hide password"}
            className="inline-flex flex-0 bg-transparent text-inherit transition-all hover:text-general-label-hover"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              switchReveal();
            }}
          >
            {isHidden ? (
              <Icon id="eye-opened-icon" className="size-4" />
            ) : (
              <Icon id="eye-closed-icon" className="size-4" />
            )}
          </button>
        )}
        {suffix && <div className="inline-flex flex-0 items-center">{suffix}</div>}
        {clearable && hasValue && canEdit && (
          <button
            type="button"
            aria-label="Clear"
            className="inline-flex flex-0 bg-transparent text-inherit transition-all hover:text-general-label-hover"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
          >
            <Icon id="x" className="size-4" />
          </button>
        )}
      </div>
      <Message error={error}>{message}</Message>
    </div>
  );
}) as <T extends InputValue = string>(
  props: InputProps<T> & { ref?: ForwardedRef<HTMLInputElement> },
) => ReactElement;

// @ts-expect-error
Input.displayName = "Input";

/* Form */

type FormInputProps<T extends InputValue = string> = InputProps<T>;

/** Input field used inside <Form> only. */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (props, ref) => {
    const { label, message, ...rest } = props;

    return (
      <FormItem className="BB-FormInput group" aria-disabled={props.disabled}>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input ref={ref} {...rest} />
        </FormControl>
        <FormMessage>{message}</FormMessage>
      </FormItem>
    );
  },
) as <T extends InputValue = string>(
  props: FormInputProps<T> & { ref?: ForwardedRef<HTMLInputElement> },
) => ReactElement;

// @ts-expect-error
FormInput.displayName = "FormInput";
