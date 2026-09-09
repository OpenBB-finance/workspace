import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { type Item, useAppStore } from "~/lib/state/app";
import MoveGeneric from "./MoveGeneric";

export default function MoveToFolder({
  label,
  color,
  depth,
  itemData,
}: {
  label: string;
  color: string;
  depth: number;
  itemData: Item;
}) {
  const { moveFolderToFolder, getAllFoldersFlat } = useAppStore();
  const folders = getAllFoldersFlat();
  return (
    <MoveGeneric
      moveFunction={(value) => moveFolderToFolder(itemData.index, "", value)}
      color={color}
      label={label}
      depth={depth}
      moveInnerFunction={() => moveFolderToFolder(itemData.index, "root", "")}
    >
      {folders
        .filter((folder) => {
          return (
            folder.index !== itemData?.index &&
            !itemData?.children.includes(folder.index)
          );
        })
        .map((folder) => (
          <DropdownMenuPrimitive.Item
            key={folder.index}
            onClick={() => {
              moveFolderToFolder(itemData.index, folder.index, "");
            }}
            className="obb-dropdown-item truncate"
          >
            {folder.data.name}
          </DropdownMenuPrimitive.Item>
        ))}
    </MoveGeneric>
  );
}
