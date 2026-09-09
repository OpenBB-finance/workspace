import {
  type ForwardedRef,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { HexColorPicker } from "react-colorful";
import type { ButtonProps } from "../atoms/Button";
import { Input } from "../atoms/Input";
import { Popover, PopoverTrigger } from "../atoms/Popover";
import { cn } from "../utils";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  clearable?: boolean;
}

function useForwardedRef<T>(ref: ForwardedRef<T>) {
  const innerRef = useRef<T>(null);

  useEffect(() => {
    if (!ref) return;
    if (typeof ref === "function") {
      ref(innerRef.current);
    } else {
      ref.current = innerRef.current;
    }
  });

  return innerRef;
}

const ColorPicker = forwardRef<
  HTMLInputElement,
  Omit<ButtonProps, "value" | "onChange" | "onBlur" | "onClick"> & ColorPickerProps
>(
  (
    { disabled, value, onChange, onBlur, name, className, size, clearable, ..._props },
    forwardedRef,
  ) => {
    const ref = useForwardedRef(forwardedRef);
    const [showPicker, setShowPicker] = useState(false);

    const parsedValue = useMemo(() => {
      return (value || "#FFFFFF").toUpperCase();
    }, [value]);

    useEffect(() => {
      if (ref.current) {
        ref.current.value = parsedValue;
      }
    }, [parsedValue, ref]);

    return (
      <Popover
        open={showPicker}
        onOpenChange={setShowPicker}
        side="bottom"
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-full text-sm p-2 min-w-[200px] max-h-[calc(100vh-16px)]"
        content={
          <HexColorPicker color={parsedValue} onChange={onChange} className="!w-full" />
        }
      >
        <PopoverTrigger asChild={true} disabled={disabled}>
          <div className={cn("w-full text-left", className)} role="group">
            <Input
              aria-label="Hex color"
              inputClassName="font-mono text-ds-text-body focus:text-ds-text-heading"
              maxLength={7}
              onChange={onChange}
              ref={ref}
              defaultValue={parsedValue}
              clearable={clearable}
              prefix={
                <div
                  className={cn(
                    "w-4 h-4 rounded border border-general-border-primary",
                    "flex-shrink-0 cursor-pointer",
                    disabled && "opacity-50 cursor-not-allowed",
                  )}
                  style={{ backgroundColor: parsedValue }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!disabled && ref.current) ref.current.focus();
                  }}
                />
              }
              onKeyDown={(e) => {
                if (e.key === "Tab" || e.key === "Escape") {
                  setShowPicker(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onFocus={() => setShowPicker(true)}
              onBlur={onBlur}
            />
          </div>
        </PopoverTrigger>
      </Popover>
    );
  },
);
ColorPicker.displayName = "ColorPicker";

export { ColorPicker };
