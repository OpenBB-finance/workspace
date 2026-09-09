import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import type { ReactNode } from "react";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";

export default function MoveGeneric({
  moveFunction,
  children,
  label,
  color,
  depth,
  moveInnerFunction,
}: {
  moveFunction: (value: string) => void;
  children: ReactNode;
  label: string;
  color: string;
  depth: number;
  moveInnerFunction: () => void;
}) {
  const setCreateFolderPopup = useShallowThemeStore(
    (state) => state.setCreateFolderPopup,
  );
  return (
    <DropdownMenuPrimitive.Sub>
      <DropdownMenuPrimitive.SubTrigger className="obb-dropdown-item justify-between overflow-auto">
        <span className={clsx("grow truncate", color)}>{label}</span>
        <ChevronRightIcon />
      </DropdownMenuPrimitive.SubTrigger>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          "origin-radix-context-menu radix-side-right:animate-scale-in",
          "w-fit text-xs z-[60] obb-dropdown-container",
        )}
      >
        {depth !== 0 && (
          <DropdownMenuPrimitive.Item
            onClick={() => {
              moveInnerFunction();
            }}
            className="obb-dropdown-item"
          >
            The sidebar
          </DropdownMenuPrimitive.Item>
        )}
        {children}
        <DropdownMenuPrimitive.Item
          onClick={() => setCreateFolderPopup((value) => moveFunction(value))}
          className="obb-dropdown-item"
        >
          A new folder
        </DropdownMenuPrimitive.Item>
      </DropdownMenuPrimitive.SubContent>
    </DropdownMenuPrimitive.Sub>
  );
}
