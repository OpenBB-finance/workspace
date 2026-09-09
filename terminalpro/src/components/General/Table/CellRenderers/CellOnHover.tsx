import { memo, useCallback, useMemo, useRef } from "react";
import type { WidgetColumnDefT } from "~/components/types";
import { cn, getContrastColor } from "~/lib/utils";

export const colorVariants = {
  green: "#22c55e",
  red: "#ef4444",
  blue: "#0088CC",
};

export type CellOnHoverProps = {
  value: any;
  title?: string;
  color?: boolean;
  colorValue?: string | number | undefined;
  colorRules?: WidgetColumnDefT["renderFnParams"]["colorRules"];
};

const defaultColorRules = [
  { condition: "gt", value: 0, color: "green" },
  { condition: "lt", value: 0, color: "red" },
] as CellOnHoverProps["colorRules"];

export const CellOnHover = memo((props: CellOnHoverProps) => {
  const { value, title, color, colorValue, colorRules = defaultColorRules } = props;
  const elemRef = useRef<HTMLParagraphElement>(null);

  const style = useMemo(() => {
    return getColorStyle({ value, color, colorValue, colorRules });
  }, [colorRules, colorValue, value, color]);

  const onMouseEnter = useCallback(() => {
    const elem = elemRef?.current;
    if (!elem) return;

    const isDiff = title && title !== value;
    const hasTitle = elem.hasAttribute("title");
    const isOverflowing = elem.scrollWidth > elem.clientWidth;

    if (isOverflowing || isDiff) {
      return !hasTitle && elem.setAttribute("title", `${title ?? value}`);
    }

    if (hasTitle) elem.removeAttribute("title");
  }, [elemRef, title, value]);

  const cleanedValue = useMemo(() => {
    // Large strings cause performance issues in ag-Grid when scrolling (e.g. document texts)
    if (typeof value === "string" && value.length > 200) {
      return `${value.slice(0, 200)}...`;
    }
    return value;
  }, [value]);

  return (
    <p
      ref={elemRef}
      style={style}
      className={cn("relative w-full overflow-hidden text-ellipsis", {
        "hover:text-light-800!":
          color && !!style.backgroundColor && style.color !== "#000000",
        "pr-1": typeof colorValue === "number",
        "pl-1": typeof colorValue !== "number",
      })}
      onMouseEnter={onMouseEnter}
    >
      {cleanedValue}
    </p>
  );
});

CellOnHover.displayName = "CellOnHover";

export function getColorStyle(props: CellOnHoverProps) {
  const { color, colorValue, colorRules = defaultColorRules } = props;

  if (!color) return { color: undefined, backgroundColor: undefined };
  return colorRules.reduce<{ color: string; backgroundColor: string }>(
    (acc, rule) => {
      const { condition, fill = false, value: triggerValue } = rule;
      const { min, max } = rule?.range ?? {};
      const value = colorValue ?? props.value;
      const numValue = typeof value === "number" ? value : undefined;

      const styleColor: string = colorVariants[rule.color] ?? rule.color;
      const lowerValue = value?.toString()?.toLowerCase();
      const lowerTriggerValue = triggerValue?.toString()?.toLowerCase();

      const conditionalRules = {
        eq: value === triggerValue,
        ne: value !== triggerValue,
        between: numValue >= min && numValue <= max,
        contains: lowerValue?.includes(lowerTriggerValue),
        notContains: !lowerValue?.includes(lowerTriggerValue),
      };
      if (typeof numValue === "number" && typeof triggerValue === "number") {
        Object.assign(conditionalRules, {
          gt: numValue > triggerValue,
          lt: numValue < triggerValue,
          gte: numValue >= triggerValue,
          lte: numValue <= triggerValue,
        });
      }

      if (conditionalRules[condition]) {
        if (fill) {
          acc.backgroundColor = styleColor;
          acc.color = getContrastColor(styleColor);
          return acc;
        }
        acc.color = styleColor;
      }
      return acc;
    },
    { color: undefined, backgroundColor: undefined },
  );
}

export default CellOnHover;
