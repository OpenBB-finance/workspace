import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { CaretRightIcon, FileIcon, Link2Icon } from "@radix-ui/react-icons";
import clsx from "clsx";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import { IcBaselineFolderOpen } from "~/components/Icons";
import Location from "~/components/Icons/Location";
import { useAppStore, type Widget } from "~/lib/state/app";
import { generateRandomName } from "~/lib/utils";

export default function MoveWidgetDropdown({ widget }: { widget: Partial<Widget> }) {
  const { getAllTabs, addWidget, addTab } = useAppStore();
  const tabs = getAllTabs();
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger>
        <Location />
      </DropdownPrimitive.Trigger>

      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className={clsx(
            "z-20 radix-side-top:animate-slide-up radix-side-bottom:animate-slide-down",
            "w-48 rounded-lg px-1.5 py-1 shadow-lg md:w-56",
            "bg-[#EAEAEA] dark:bg-[#151518]",
          )}
        >
          <DropdownPrimitive.Sub>
            <DropdownPrimitive.SubTrigger
              className={clsx(
                "flex w-full cursor-default select-none items-center rounded-md px-2 py-2 text-2xs outline-hidden",
                "text-light-400 focus:bg-light-50 dark:text-light-500 dark:focus:bg-light-900",
              )}
            >
              <Link2Icon className="mr-2 h-3.5 w-3.5" />
              <span className="grow text-light-700 dark:text-light-300">Add to</span>
              <CaretRightIcon className="h-3.5 w-3.5" />
            </DropdownPrimitive.SubTrigger>
            <DropdownPrimitive.Portal>
              <DropdownPrimitive.SubContent
                className={clsx(
                  "origin-radix-context-menu radix-side-right:animate-scale-in",
                  "w-full rounded-md px-1 py-1 text-xs shadow-lg",
                  "bg-[#EAEAEA] dark:bg-[#151518] z-50",
                )}
              >
                {tabs.map((tab, _i) => (
                  <DropdownPrimitive.Item
                    key={tab.index}
                    onClick={() => {
                      addWidget(tab.index, widget as Widget);
                      toast.success("Widget moved", {
                        description: `Widget ${widget.name} moved to tab named ${tab.data.name}`,
                      });
                    }}
                    className={clsx(
                      "flex w-full cursor-default select-none items-center rounded-md px-2 py-2 text-2xs outline-hidden",
                      "text-light-400 focus:bg-light-50 dark:text-light-500 dark:focus:bg-light-900 gap-2",
                    )}
                  >
                    <IcBaselineFolderOpen className="h-4 min-w-[16px] w-4" />
                    <span className="text-light-700 dark:text-light-300 truncate">
                      {tab.data.name}
                    </span>
                  </DropdownPrimitive.Item>
                ))}
                <DropdownPrimitive.Item
                  className={clsx(
                    "flex w-full cursor-default select-none items-center rounded-md px-2 py-2 text-2xs outline-hidden",
                    "text-light-400 focus:bg-light-50 dark:text-light-500 dark:focus:bg-light-900 gap-2",
                  )}
                  onClick={() => {
                    const id = uuidv4();
                    const name = generateRandomName();
                    addTab({
                      index: id,
                      data: {
                        name,
                        type: "custom",
                        widgets: [widget] as Widget[],
                      },
                    });
                    toast.success("Widget moved", {
                      description: `Widget ${widget.name} moved to new tab named ${name}`,
                    });
                  }}
                >
                  <FileIcon className="h-4 min-w-[16px] w-4" />
                  <span className="text-light-700 dark:text-light-300 truncate">
                    New tab
                  </span>
                </DropdownPrimitive.Item>
              </DropdownPrimitive.SubContent>
            </DropdownPrimitive.Portal>
          </DropdownPrimitive.Sub>
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
