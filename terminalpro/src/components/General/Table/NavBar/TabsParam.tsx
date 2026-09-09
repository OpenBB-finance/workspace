import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { memo, type ReactNode, useId, useMemo } from "react";
import Tooltip from "~/components/Tooltip";

interface TabsParamProps {
  id?: string;
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (value: string) => void;
  toolTipMessage?: string | ReactNode;
}

export const TabsParam = memo<TabsParamProps>(
  ({ id: propsId, value, options, onValueChange, toolTipMessage }) => {
    const uniqueId = useId();
    const id = propsId || `tabs-param-${uniqueId}`;

    const itemsMemo = useMemo(
      () =>
        options.map((option) => (
          <ToggleGroupPrimitive.Item
            key={`${id}-option-${option.value}`}
            value={option.value}
            className="px-4 py-0.5
            radix-state-on:bg-light-100 radix-state-on:text-brand-main
            dark:radix-state-on:bg-dark-500 dark:radix-state-on:text-brand-main
            text-light-500 dark:text-light-400 text-2xs rounded"
          >
            {option.label}
          </ToggleGroupPrimitive.Item>
        )),
      [options, id],
    );

    const toggleGroupMemo = useMemo(
      () => (
        <ToggleGroupPrimitive.Root
          key={`${id}-toggle-group`}
          type="single"
          value={value}
          onValueChange={(v) => v && onValueChange(v)}
          className="flex gap-0 items-center bg-light-50 p-0.5 dark:bg-dark-800 rounded"
        >
          {itemsMemo}
        </ToggleGroupPrimitive.Root>
      ),
      [value, onValueChange, itemsMemo, id],
    );

    return useMemo(() => {
      if (!toolTipMessage) return toggleGroupMemo;

      return (
        <Tooltip key={`${id}-tooltip`} id={id} message={toolTipMessage} position="top">
          {toggleGroupMemo}
        </Tooltip>
      );
    }, [id, toggleGroupMemo, toolTipMessage]);
  },
);

export default TabsParam;
