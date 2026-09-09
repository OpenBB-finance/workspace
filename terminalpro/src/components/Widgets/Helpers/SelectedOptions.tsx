import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import { useUpdateEffect } from "usehooks-ts";
import { Input } from "~/components/ds/atoms/Input";
import { RadioGroup, RadioGroupItem } from "~/components/ds/atoms/RadioGroup";
import Icon from "~/components/Icon";
import ChevronDownIcon from "~/components/Icons/ChevronDown";
import Tooltip from "~/components/Tooltip";
import { useStateReducer } from "~/hooks/useStateReducer";

export default function SelectedOptions({
  title = "Select an option",
  selectedOption,
  setSelectedOption,
  optionsList,
}: {
  title: string;
  selectedOption: any;
  setSelectedOption: (option: any) => void;
  optionsList: any[];
}) {
  const [state, dispatch] = useStateReducer({ open: false, input: "" });

  const _handleClearSearch = useCallback(() => {
    dispatch({ input: "" });
  }, []);

  useUpdateEffect(() => {
    if (!state.open) dispatch({ input: "" });
  }, [state.open]);

  const filteredOptions = useMemo(() => {
    return (
      <RadioGroup
        value={selectedOption}
        onValueChange={setSelectedOption as any}
        className="flex flex-col gap-1 max-h-[320px] overflow-y-auto mt-2 p-0.5"
      >
        {optionsList
          ?.filter((option) =>
            option?.toString().toLowerCase().includes(state.input.toLowerCase()),
          )
          .map((option) => (
            <RadioGroupItem
              id={`selectedOption${option}`}
              key={option}
              value={option as any}
              label={option.toString()}
            />
          ))}
      </RadioGroup>
    );
  }, [optionsList, state.input, selectedOption, setSelectedOption]);

  return (
    <DropdownMenu.Root
      open={state.open}
      onOpenChange={(open) => dispatch({ open, input: "" })}
    >
      <DropdownMenu.Trigger className="obb-minimal-input flex gap-1 items-center px-1 py-0 justify-between h-[20px]">
        <Tooltip message={title} position="top">
          <span
            className={clsx(
              "w-[69px] truncate text-left",
              !selectedOption && "capitalize",
            )}
          >
            {selectedOption ? selectedOption : title.replace(/_/g, " ")}
          </span>
        </Tooltip>
        <ChevronDownIcon className="w-2" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-60 obb-dropdown-container w-[186px]
          p-2 max-h-[calc(100vh/2)] overflow-y-auto"
        >
          <Input
            size="xs"
            className="w-full"
            prefix={<Icon id="search" />}
            value={state.input}
            onChange={(value) => dispatch({ input: String(value) })}
            placeholder="Search"
          />
          <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto mt-2 p-0.5">
            {filteredOptions}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
