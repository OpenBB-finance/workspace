import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { validateFolderName } from "~/utils/validators";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";

export default function CreateFolderPopup() {
  const { createFolderPopup, createFolderParentId, setCreateFolderPopup } =
    useShallowThemeStore((state) => ({
      createFolderPopup: state.createFolderPopup,
      createFolderParentId: state.createFolderParentId,
      setCreateFolderPopup: state.setCreateFolderPopup,
    }));

  const inputRef = useRef<HTMLInputElement>(null);

  const { createFolder } = useShallowAppStore((state) => ({
    createFolder: state.createFolder,
  }));

  const handleSubmit = useCallback(() => {
    const value = inputRef.current?.value || "";
    if (!validateFolderName(value)) {
      toast.error("Invalid folder name", {
        description: "Please enter a valid folder name",
      });
      setCreateFolderPopup(false);
      return;
    }

    if (createFolderPopup instanceof Function) {
      createFolderPopup(value);
    } else {
      const newFolder = {
        index: uuidv4(),
        data: {
          name: value,
        },
        children: [],
      };

      createFolder(newFolder, createFolderParentId);
    }

    showNotificationWithRememberMe({
      id: NotificationId.FolderCreated,
      message: "Folder created",
      description: "Folder has been created, you can visualize it in the sidebar",
      toastType: "success",
    });
    setCreateFolderPopup(false);
  }, [
    inputRef,
    createFolderPopup,
    createFolder,
    createFolderParentId,
    setCreateFolderPopup,
  ]);

  return (
    <BaseDialog
      open={createFolderPopup as boolean}
      onClose={() => setCreateFolderPopup(false)}
      modal={true}
    >
      <DialogTitle>Create Folder</DialogTitle>
      <DialogDescription className="sr-only">
        Create a new folder to organize your dashboards.
      </DialogDescription>
      <input
        placeholder="Enter folder name"
        onKeyUp={(e) => {
          if (e.key === "Enter") {
            handleSubmit();
          }
        }}
        defaultValue=""
        ref={inputRef}
        onChange={(e) => {
          const value = e.target.value;
          if (inputRef.current) {
            inputRef.current.value = value;
          }
        }}
        className="obb-minimal-input-search h-[34px]! w-full my-4"
      />
      <div className="mt-auto flex items-center justify-end gap-2.5">
        <DialogClose className="obb-btn-secondary-v2 px-3 py-1 font-medium md:w-fit">
          Cancel
        </DialogClose>
        <button
          onClick={handleSubmit}
          className="obb-btn-tertiary h-8 px-3 py-1 font-medium md:w-fit"
        >
          Create
        </button>
      </div>
    </BaseDialog>
  );
}
