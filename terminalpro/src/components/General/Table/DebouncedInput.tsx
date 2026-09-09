import {
  type ComponentProps,
  forwardRef,
  type InputHTMLAttributes,
  type MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebouncedCallback } from "use-debounce";
import Tooltip from "~/components/Tooltip";
import { measureTextWidth } from "./AgSQL";

type DebouncedInputProps = {
  value: string | number;
  onChange: (value: string | number) => void;
  sizeToContent?: boolean;
  debounce?: number;
  toolTipProps?: Omit<ComponentProps<typeof Tooltip>, "children">;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">;

function getMeasuredWidth(text: string | number = "") {
  const textWidth = measureTextWidth(text?.toString(), "14px", "monospace");
  return `${0.8 * textWidth + 25}px`;
}

const DebouncedInput = forwardRef<HTMLInputElement, DebouncedInputProps>(
  (
    {
      value: initialValue,
      onChange,
      debounce = 1000,
      sizeToContent = false,
      toolTipProps = { message: "", hide: true },
      ...props
    },
    _forwardedRef,
  ) => {
    const [value, setValue] = useState(initialValue);
    const debouncedChange = useDebouncedCallback(onChange, debounce);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      setValue(initialValue);
      if (inputRef.current) {
        inputRef.current.value = initialValue?.toString() ?? "";
      }
    }, [initialValue, inputRef]);

    const onChangeCb = useCallback(
      (e) => {
        if (sizeToContent) {
          e.target.style.width = getMeasuredWidth(e.target.value || props.placeholder);
        }
        setValue(e.target.value);
        debouncedChange(e.target.value);
      },
      [debouncedChange, sizeToContent, props.placeholder],
    );

    const onKeyDown = useCallback(
      (e) => {
        if (e.key === "Enter") {
          debouncedChange.cancel();
          onChange(value);
        }
      },
      [debouncedChange, onChange, value],
    );

    const style = useMemo(() => {
      const propsStyle = props.style ?? {};
      propsStyle.fontVariantLigatures = "none";
      propsStyle.fontFeatureSettings = `"liga" 0`;

      if (sizeToContent) {
        return {
          ...propsStyle,
          width: getMeasuredWidth(value || props.placeholder),
          maxWidth: "200px",
        };
      }
      return propsStyle;
    }, [sizeToContent, value, props.placeholder, props.style]);

    const onBlur = useCallback(() => debouncedChange.flush(), [debouncedChange]);

    const onMouseDown: MouseEventHandler<HTMLInputElement> = useCallback((e) => {
      e.stopPropagation();
    }, []);

    return (
      <Tooltip {...toolTipProps}>
        <input
          {...props}
          ref={inputRef}
          defaultValue={value}
          onMouseDown={onMouseDown}
          onChange={onChangeCb}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          style={style}
        />
      </Tooltip>
    );
  },
);

export default DebouncedInput;
