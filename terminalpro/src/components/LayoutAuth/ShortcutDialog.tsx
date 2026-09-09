import { useCallback, useMemo, useState } from "react";
import { useCopilotAvailable } from "~/components/AI/hooks/useCopilotAvailable";
import useDetectOS from "~/hooks/useDetectOS";
import { useThemeStore } from "~/lib/state/theme";
import { RadioGroup, RadioGroupItem } from "../ds/atoms/RadioGroup";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "../ds/dialogs/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ds/molecules/Tabs";

export default function ShortcutDialog() {
  const { shortcutSidebarOpen, setShortcutSidebarOpen } = useThemeStore();
  const { isMacOS } = useDetectOS();
  const [os, setOs] = useState<"windows" | "macos">(isMacOS ? "macos" : "windows");

  const copilotAvailable = useCopilotAvailable();

  const SHORTCUTS = useMemo(
    () => [
      {
        title: "Navigation",
        items: [
          {
            title: "Create new dashboard",
            shortcut: "⌘ + ⌥ + T",
          },
          {
            title: "Go to previous dashboard",
            shortcut: "⌘ + ↑",
          },
          {
            title: "Go to next dashboard",
            shortcut: "⌘ + ↓",
          },
          {
            title: "Go to previous tab in a dashboard",
            shortcut: "⌘ + ←",
          },
          {
            title: "Go to next tab in a dashboard",
            shortcut: "⌘ + →",
          },
        ],
      },
      {
        title: "Widgets",
        items: [
          {
            title: "Toggle grouping visibility",
            shortcut: "⌘ + G",
          },
        ],
      },
      {
        title: "Actions",
        items: [
          {
            title: "Open shortcuts menu",
            shortcut: "⌘ + H",
          },
          {
            title: "Toggle search bar",
            shortcut: "⌘ + K",
          },
          {
            title: "Open Add Connection menu",
            shortcut: "⌘ + ⇧ + C",
          },
          {
            title: "Toggle dark mode",
            shortcut: "⌘ + M",
          },
          ...(copilotAvailable
            ? [
                {
                  title: "Toggle OpenBB Copilot",
                  shortcut: "⌘ + L",
                },
                {
                  title: "Maximize/Minimize OpenBB Copilot",
                  shortcut: "⌘ + U",
                },
              ]
            : []),
          {
            title: "Toggle Left Sidebar",
            shortcut: "⌘ + B",
          },
          {
            title: "Toggle full screen mode",
            shortcut: "⌘ + ⇧ + F",
          },
          {
            title: "Sync dashboards",
            shortcut: "⌘ + ⇧ + S",
          },
        ],
      },
    ],
    [copilotAvailable],
  );

  const getShortcutKey = useCallback(
    (shortcut) => {
      return os === "macos"
        ? shortcut
        : shortcut.replace("⌘", "Ctrl").replace("⌥", "Alt");
    },
    [os],
  );

  return (
    <BaseDialog
      open={shortcutSidebarOpen}
      onClose={() => setShortcutSidebarOpen(false)}
      className="min-h-[400px]"
    >
      <DialogTitle>Shortcuts</DialogTitle>
      <DialogDescription className="sr-only">
        Use the following shortcuts to navigate and interact with the OpenBB Workspace.
      </DialogDescription>
      <RadioGroup
        className="flex gap-4 items-center my-0"
        value={os}
        onValueChange={(value) => setOs(value as "windows" | "macos")}
      >
        <RadioGroupItem value="windows" label="Windows" />
        <RadioGroupItem value="macos" label="MacOS" />
      </RadioGroup>
      <Tabs variant="filled" defaultValue={SHORTCUTS[0].title}>
        <TabsList>
          {SHORTCUTS.map((group) => (
            <TabsTrigger className="w-full" key={group.title} value={group.title}>
              {group.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {SHORTCUTS.map((group) => (
          <TabsContent key={group.title} value={group.title}>
            <ul className="mt-2 space-y-4">
              {group.items.map((item) => (
                <li key={item.title} className="flex items-center justify-between">
                  <span className="dark:text-light-100">{item.title}</span>
                  <kbd className="obb-code px-1 py-0 dark:bg-dark-400">
                    {getShortcutKey(item.shortcut)}
                  </kbd>
                </li>
              ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>
    </BaseDialog>
  );
}
