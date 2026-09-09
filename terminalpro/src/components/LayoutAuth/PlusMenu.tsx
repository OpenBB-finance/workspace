import * as PopoverPrimitive from "@radix-ui/react-popover";
import clsx from "clsx";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import useDetectOS from "~/hooks/useDetectOS";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import { generateRandomName } from "~/lib/utils";
import Icon from "../Icon";

export default function PlusMenu({ isMobile = false }: { isMobile: boolean }) {
  const [open, setOpen] = useState(false);
  const setCreateFolderPopup = useShallowThemeStore(
    (state) => state.setCreateFolderPopup,
  );
  const addTab = useShallowAppStore((state) => state.addTab);
  const navigate = useNavigate();
  const { isMacOS } = useDetectOS();
  const OPTIONS = [
    {
      id: "Add Dashboard",
      shortcut: "Ctrl+⌥+T",
      onClick: () => {
        const id = uuidv4();
        addTab({
          index: id,
          data: {
            name: generateRandomName(),
            type: "custom",
            widgets: [],
          },
        });
        setTimeout(() => navigate(`/app/${id}`));
      },
      label: "New Dashboard",
    },
    {
      id: "Add Folder",
      shortcut: "Ctrl+⌥+F",
      onClick: () => setCreateFolderPopup(true),
      label: "New Folder",
    },
  ];
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger className="obb-icon-btn-v2 size-6">
        <Icon id="plus-icon" className="mx-auto size-4" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="bottom"
          sideOffset={5}
          align={isMobile ? "end" : "start"}
          className={clsx(
            "radix-side-top:animate-slide-up radix-side-bottom:animate-slide-down",
            "z-60 w-fit min-w-[186px] text-xs",
            "obb-dropdown-container",
          )}
        >
          {OPTIONS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={clsx("obb-dropdown-item justify-between")}
            >
              {item.label}
              <span>
                {`(${
                  isMacOS
                    ? item.shortcut
                    : item.shortcut.replace("⌘", "Ctrl").replace("⌥", "Alt")
                })`}
              </span>
            </button>
          ))}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
