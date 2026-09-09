import * as SwitchPrimitive from "@radix-ui/react-switch";
import React from "react";
import { cn } from "../utils";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: React.ReactNode;
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>((props, ref) => {
  const { className, label, id: idProp, ...rest } = props;
  const idHook = React.useId();

  const id = idProp || idHook;

  return (
    <div className="flex items-center gap-2">
      <SwitchPrimitive.Root
        ref={ref}
        className={cn(
          "BB-Switch peer h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          "focus-visible:outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "bg-toggle-bg data-[state=checked]:bg-main-100",
          "hover:enabled:bg-toggle-bg hover:enabled:data-[state=checked]:bg-main-100",
          "disabled:bg-toggle-bg-disabled disabled:data-[state=checked]:bg-toggle-bg-disabled",
          className,
        )}
        id={id}
        {...rest}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full ring-0 transition-transform",
            "data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
            "bg-white shadow-sm",
          )}
        />
      </SwitchPrimitive.Root>
      {label && (
        <label
          className={cn(
            "body-xs-regular cursor-pointer",
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
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
