import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { DownloadIcon, Pencil1Icon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { Fragment, useCallback } from "react";
import type { TreeItem } from "react-complex-tree";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import MoveToFolder from "~/components/LayoutAuth/DropdownSubs/MoveToFolder";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { dispatchSaveState, generateRandomName } from "~/lib/utils";
import TrashIcon from "../../Icons/Trash";

export default function FolderPopup({
  item,
  deleteItem,
  depth,
  setOpen,
}: {
  item: TreeItem<any>;
  deleteItem: (item: TreeItem<any>) => void;
  depth: number;
  setOpen: (open: boolean) => void;
}) {
  const { getFolderById, createTabInsideFolder, createFolder } = useShallowAppStore(
    (state) => ({
      getFolderById: state.getFolderById,
      createTabInsideFolder: state.createTabInsideFolder,
      createFolder: state.createFolder,
    }),
  );
  const {
    setRenamePopup,
    setCreateFolderPopup,
    setExportFolderPopup,
    setExportFolderItem,
  } = useShallowThemeStore((state) => ({
    setRenamePopup: state.setRenamePopup,
    setCreateFolderPopup: state.setCreateFolderPopup,
    setExportFolderPopup: state.setExportFolderPopup,
    setExportFolderItem: state.setExportFolderItem,
  }));
  const itemData = getFolderById(item.index as string);
  const navigate = useNavigate();

  const handleCreate = useCallback(
    async (newFolder = false) => {
      if (newFolder) {
        setCreateFolderPopup(true, itemData.index);
        return setOpen(false);
      }

      const id = uuidv4();
      const tab = {
        index: id,
        data: {
          name: generateRandomName(),
          type: "custom",
          groups: [],
          widgets: [],
        },
      };
      createTabInsideFolder(itemData.index, tab as any);

      await dispatchSaveState();
      queueMicrotask(() => navigate(`/app/${id}`));

      setOpen(false);
    },
    [createTabInsideFolder, createFolder, itemData.index, setOpen, navigate],
  );

  const folderMenuItems = [
    {
      shortcut: "t",
      label: "Create dashboard",
      action: () => {
        handleCreate();
        setOpen(false);
      },
    },
    {
      shortcut: "t",
      label: "Create folder",
      action: () => {
        handleCreate(true);
        setOpen(false);
      },
    },
    {
      shortcut: "t",
      label: "Rename",
      icon: <Pencil1Icon className="mr-2 h-3.5 w-3.5" />,
      action: () => {
        setRenamePopup(true, itemData.data.name, itemData.index, "folder");
        setOpen(false);
      },
    },
    {
      shortcut: "t",
      label: "Delete",
      color: "text-red-500!",
      icon: <TrashIcon className="mr-2 h-3.5 w-3.5" />,
      action: () => {
        deleteItem(item);
        setOpen(false);
      },
    },
    {
      shortcut: "e",
      label: "Export PDF",
      icon: <DownloadIcon className="mr-2 h-3.5 w-3.5" />,
      action: () => {
        setExportFolderItem({ id: itemData.index, name: itemData.data?.name });
        setExportFolderPopup(true);
        setOpen(false);
      },
    },
  ];
  return (
    <div>
      {folderMenuItems.map(({ label, color }, i) =>
        label === "Move to" ? (
          <MoveToFolder
            key={`${label}-${i}`}
            label={label}
            color={color}
            depth={depth}
            itemData={itemData}
          />
        ) : (
          <Fragment key={`${label}-${i}`}>
            {label === "Export PDF" && (
              <DropdownMenuPrimitive.Separator className="my-1 h-px w-full bg-light-200 dark:bg-[#36363F]" />
            )}
            <DropdownMenuPrimitive.Item
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();

                folderMenuItems[i].action();
              }}
              className="obb-dropdown-item overflow-auto"
            >
              <span className={clsx("grow truncate", color)}>{label}</span>
            </DropdownMenuPrimitive.Item>
          </Fragment>
        ),
      )}
    </div>
  );
}
