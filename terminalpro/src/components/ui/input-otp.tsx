import { OTPInput, OTPInputContext } from "input-otp";
import * as React from "react";
import { cn } from "../ds/utils";
import Icon from "../Icon";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center",
        "border border-solid text-sm transition-all outline-none rounded-md",
        "data-[active=true]:z-10",
        // Light theme
        "border-light-200 bg-light-50 text-light-600",
        "data-[active=true]:border-brand-main data-[active=true]:text-light-900",
        // Dark theme
        "dark:bg-dark-800 dark:border-dark-600 dark:text-light-400",
        "dark:data-[active=true]:border-brand-main dark:data-[active=true]:text-white",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    // biome-ignore lint/a11y/useAriaPropsForRole: separator role is appropriate here
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <Icon id="minus-icon" />
    </div>
  );
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot };
