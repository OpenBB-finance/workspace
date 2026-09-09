import {
  type ForwardedRef,
  forwardRef,
  memo,
  type ReactElement,
  type ReactNode,
} from "react";
import { beautifySlug, cn } from "~/lib/utils";
import { Checkbox } from "./ds/atoms/Checkbox";
import Tooltip from "./Tooltip";

type ValueType = boolean;

type TValues = {
  label: string;
  value: ValueType;
};

type ToggleSelectProps = {
  label: string;
  values: TValues[];
  onSelect: (selected: ValueType) => void;
  selected: ValueType;
  toolTipMessage?: string | ReactNode;
  className?: string;
};

export const ToggleSelect = forwardRef<HTMLInputElement, ToggleSelectProps>(
  (props, _ref) => {
    const { values, onSelect, label, selected, toolTipMessage, className } = props;

    return (
      <div className={cn("h-5 flex items-center pr-1.5", className)}>
        <label className="flex items-center gap-1">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="scale-90"
          />
          {toolTipMessage ? (
            <Tooltip message={toolTipMessage} position="top">
              <span className="text-xs cursor-pointer whitespace-nowrap">
                {beautifySlug(label)}
              </span>
            </Tooltip>
          ) : (
            <span className="text-xs whitespace-nowrap">{beautifySlug(label)}</span>
          )}
        </label>
      </div>
    );
  },
) as (
  props: ToggleSelectProps & { ref?: ForwardedRef<HTMLInputElement> },
) => ReactElement;

export default memo(ToggleSelect);
