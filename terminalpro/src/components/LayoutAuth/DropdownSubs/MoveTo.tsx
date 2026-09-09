import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Fragment } from "react";
import type { TreeItem } from "react-complex-tree";
import { useShallowAppStore } from "~/lib/state/app";
import MoveGeneric from "./MoveGeneric";

export default function MoveTo({
  label,
  color,
  depth,
  itemData,
}: {
  label: string;
  color: string;
  depth: number;
  itemData: TreeItem<any> & { index: string };
}) {
  const { moveTabToFolder, folders } = useShallowAppStore((s) => ({
    moveTabToFolder: s.moveTabToFolder,
    folders: s.getAllFoldersFlat(),
  }));
  return (
    <MoveGeneric
      moveFunction={(value) => moveTabToFolder("", itemData.index, value)}
      label={label}
      color={color}
      depth={depth}
      moveInnerFunction={() => moveTabToFolder("root", itemData.index, "")}
    >
      {depth !== 0 && folders.length === 0 && (
        <DropdownMenuPrimitive.Separator className="my-1 h-px w-full bg-light-200 dark:bg-[#36363F]" />
      )}
      {folders.map((folder) => (
        <Fragment key={folder.index}>
          {!folder.children.includes(itemData.index) && (
            <DropdownMenuPrimitive.Item
              onClick={() => {
                moveTabToFolder(folder.index, itemData.index, "");
              }}
              key={folder.index}
              className="obb-dropdown-item truncate"
            >
              {folder.data.name}
            </DropdownMenuPrimitive.Item>
          )}
        </Fragment>
      ))}
      {folders.length > 0 && (
        <DropdownMenuPrimitive.Separator className="my-1 h-px w-full bg-light-200 dark:bg-[#36363F]" />
      )}
    </MoveGeneric>
  );
}
