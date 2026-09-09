import { useRef, useState } from "react";
import { toast } from "sonner";
import { getConfig } from "~/lib/runtimeConfig";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowThemeStore, useThemeStore } from "~/lib/state/theme";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { validateFolderName } from "~/utils/validators";
import { Button } from "../ds/atoms/Button";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogClose, DialogTitle } from "../ds/dialogs/Dialog";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

export default function RenamePopup() {
  const { renamePopup, setRenamePopup, defaultRename, tabEditingId, editingType } =
    useThemeStore();
  const { updateItemName, getAllFoldersFlat } = useAppStore();
  const user = useShallowAuthStore((s) => s.user);

  const folders = getAllFoldersFlat();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isGeneratingName, setIsGeneratingName] = useState(false);

  const currentDashboardWidgetsPayload = useShallowAppStore(
    (state) => state.getTabById(tabEditingId)?.data?.widgets ?? [],
  );

  const { aiEnhancements } = useShallowThemeStore((state) => ({
    aiEnhancements: state.aiEnhancements,
  }));
  const { enabled: copilotEnabled, aiEnhancements: copilotAiEnhancements } =
    getConfig().copilot;
  const aiCopilotAiEnhancementsFF = copilotEnabled && copilotAiEnhancements;

  function handleSubmit() {
    if (inputRef.current) {
      const newName = inputRef.current.value;
      if (newName) {
        if (editingType === "folder") {
          if (!validateFolderName(newName)) {
            toast.error("Invalid folder name", {
              description: "Please enter a valid folder name",
            });
            return;
          }
          if (folders.find((item) => item?.data?.name === newName)) {
            toast.error("Folder already exists", {
              description: "Please enter a different folder name",
            });
            return;
          }
          updateItemName(tabEditingId, newName);
          setRenamePopup(false, "", "", editingType);
          toast.success("Folder renamed", {
            description: "Folder has been renamed, you can visualize it in the sidebar",
          });
          return;
        }

        updateItemName(tabEditingId, newName);
        setRenamePopup(false, "", "", editingType);
        showNotificationWithRememberMe({
          id: NotificationId.DashboardRenamed,
          message: "Dashboard renamed",
          description:
            "Dashboard has been renamed, you can visualize it in the sidebar",
          toastType: "success",
        });
      }
    }
  }

  async function handleRenameAI() {
    setIsGeneratingName(true);
    try {
      const payload = {
        widgets: currentDashboardWidgetsPayload
          .filter((widget) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              widget.id,
            ),
          )
          .map((widget) => ({
            uuid: widget.id,
            name: widget.name,
            description: widget.description ?? "",
            metadata: widget.metadata ?? widget?.storage?.params ?? {},
          })),
      };

      const response = await fetch(
        `${getConfig().urls.ai}/v1/generate/dashboard/title`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate dashboard title");
      }

      const generatedTitle = await response.text();
      const cleanedTitle = generatedTitle.replace(/^"|"$/g, "");

      if (inputRef.current) {
        inputRef.current.value = cleanedTitle;
      }
    } catch (error) {
      console.error("Error generating dashboard title:", error);
      toast.error("Failed to generate dashboard title", {
        description: "Please try again or enter a name manually",
      });
    } finally {
      setIsGeneratingName(false);
    }
  }

  return (
    <BaseDialog
      open={renamePopup}
      onClose={() => setRenamePopup(false, "", "", editingType)}
    >
      <DialogTitle>
        Rename {editingType === "folder" ? "folder" : "dashboard"}
      </DialogTitle>
      <div className="flex items-center gap-2">
        <div className="grow">
          <input
            onKeyUp={(e) => {
              if (e.key === "Enter") {
                handleSubmit();
              }
            }}
            ref={inputRef}
            defaultValue={defaultRename}
            className="obb-minimal-input-search h-[34px]! w-full"
          />
        </div>
        {aiEnhancements && aiCopilotAiEnhancementsFF && editingType === "tab" && (
          <Tooltip message="Generate a name based on the widgets on the dashboard">
            <Button
              variant="primary"
              size="sm"
              onClick={handleRenameAI}
              loading={isGeneratingName}
              disabled={isGeneratingName}
              loadingChildren={null}
            >
              <Icon id="sparkles-icon" className="w-4 h-4" />
            </Button>
          </Tooltip>
        )}
      </div>
      <div className="mt-auto flex items-center justify-end gap-2.5">
        <DialogClose className="obb-btn-secondary-v2 px-3 py-1 font-medium md:w-fit">
          Cancel
        </DialogClose>
        <button
          onClick={handleSubmit}
          className="obb-btn-blue px-3 py-1 font-medium md:w-fit"
        >
          Rename
        </button>
      </div>
    </BaseDialog>
  );
}
