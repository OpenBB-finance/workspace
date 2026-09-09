import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import FeatureLock from "~/components/General/FeatureLock";
import Icon from "~/components/Icon";
import type { AppCardDropdownItem } from "./types";

export function AppCardDropdown({ items }: { items: AppCardDropdownItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenuPrimitive.Root modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuPrimitive.Trigger
        className="size-6 flex items-center justify-center rounded-sm hover:bg-general-bg-primary-hover"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon id="vertical-ellipsis-icon" className="size-3.5 text-ds-text-body" />
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          onCloseAutoFocus={(e) => e.preventDefault()}
          align="end"
          side="bottom"
          sideOffset={5}
          className="obb-dropdown-container z-50 w-[172px]"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <FeatureLock key={item.label} isLocked={!!item.locked}>
              <DropdownMenuPrimitive.Item
                className="obb-dropdown-item"
                disabled={item.disabled}
                onSelect={() => {
                  if (item.locked) return;
                  item.onClick();
                  setOpen(false);
                }}
              >
                <span style={item.color ? { color: item.color } : undefined}>
                  {item.label}
                </span>
              </DropdownMenuPrimitive.Item>
            </FeatureLock>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}
