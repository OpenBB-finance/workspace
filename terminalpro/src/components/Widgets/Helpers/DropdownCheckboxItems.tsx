import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Checkbox } from "~/components/ds/atoms/Checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuTrigger,
} from "~/components/ds/atoms/DropdownMenu";

export default function DropdownCheckboxItems({
  items,
  triggerLabel,
  onSelect,
  selected,
}: {
  items: {
    label: string;
    value: string;
  }[];
  triggerLabel: string;
  onSelect: (value: string, checked: boolean) => void;
  selected: string[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="truncate obb-minimal-input flex items-center justify-center gap-1.5">
        {triggerLabel}
        <ChevronDownIcon className="h-[14px] w-[14px]" />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent className="max-h-[180px] overflow-y-auto space-y-1">
          {items.map((item) => (
            <div key={item.value}>
              <Checkbox
                checked={selected.includes(item.value)}
                label={item.label}
                onCheckedChange={(checked) => onSelect(item.value, !!checked)}
              />
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
