import * as SwitchPrimitive from "@radix-ui/react-switch";
import clsx from "clsx";
import { useThemeStore } from "~/lib/state/theme";
import ReactourItem from "./ReactourItem";

export default function SidebarOnboarding() {
  const { theme, toggleTheme } = useThemeStore();
  return (
    <ReactourItem
      title="Sidebar"
      content={
        <>
          This is the sidebar: You can switch between the different navigation menus at
          the bottom.
          <br />
          The main menu lets you quickly access tabs, news, or perform searches. In the
          secondary menu you can edit your user preferences, logout and switch between
          dark/light mode.
        </>
      }
    >
      <div className="flex flex-col justify-center items-center gap-4 mt-4">
        <div className="w-[254px] h-[165px] bg-light-500 shadow-sm rounded" />
        <div className="flex gap-4 items-center">
          <label htmlFor="s1" className="text-light-600 dark:text-light-300">
            Light Mode
          </label>
          <SwitchPrimitive.Root
            onCheckedChange={toggleTheme}
            checked={theme === "dark"}
            className={clsx(
              "group",
              "radix-state-checked:bg-light-800",
              "radix-state-unchecked:bg-gray-200 dark:radix-state-unchecked:bg-gray-800",
              "relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
              "focus:outline-hidden focus-visible:ring-3 focus-visible:ring-dark-50 focus-visible:ring-opacity-75",
            )}
          >
            <SwitchPrimitive.Thumb
              className={clsx(
                "group-radix-state-checked:translate-x-5",
                "group-radix-state-unchecked:translate-x-0",
                "pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
              )}
            />
          </SwitchPrimitive.Root>
          <label htmlFor="s1" className="text-light-600 dark:text-light-300">
            Dark Mode
          </label>
        </div>
      </div>
    </ReactourItem>
  );
}
