import { useCallback } from "react";
import { useParams } from "react-router-dom";
import type { WidgetT } from "~/components/types";
import type { InnerTab, InnerTabsT } from "~/lib/state/app";
import { useAppStore } from "~/lib/state/app";
import type { CopilotCommandResultT } from "~/lib/state/copilot";
import { getJsonWidget, slugify, triggerCustomEvent } from "~/lib/utils";
import type { ManageNavigationBarInputArgumentsT } from "~/lib/utils/ai";

/** Match a tab by slug or case-insensitive name. */
export function findTabMatch(
  tabs: { id: string; name: string }[],
  rawName: string,
): { id: string; name: string } | undefined {
  const slug = slugify(rawName);
  return tabs.find(
    (t) => t.id === slug || t.name.toLowerCase() === rawName.toLowerCase(),
  );
}

type NavBarContext = {
  dashboardId: string;
  existingNavBar: WidgetT | undefined;
};

type DashboardCommandOptions = {
  dashboardId?: string | null;
};

function handleCreateNavBar(
  args: { tabs?: { name?: string }[] },
  ctx: NavBarContext,
): CopilotCommandResultT[] | null {
  if (ctx.existingNavBar) {
    return [
      {
        status: "error",
        message:
          "Navigation bar already exists on this dashboard. Use 'add_tabs' to add new tabs.",
      },
    ];
  }
  if (args.tabs.length === 0) {
    return [
      {
        status: "error",
        message: "At least one tab is required to create a navigation bar.",
      },
    ];
  }

  const tabIds = new Set<string>();
  for (const t of args.tabs) {
    const id = slugify(t.name);
    if (tabIds.has(id)) {
      return [
        {
          status: "error",
          message: `Duplicate tab name detected: "${t.name}" produces the same ID as another tab.`,
        },
      ];
    }
    tabIds.add(id);
  }

  return null;
}

function handleAddTabs(
  args: { tabs?: { name?: string }[] },
  ctx: NavBarContext,
): CopilotCommandResultT[] | null {
  if (!ctx.existingNavBar) {
    return [
      {
        status: "error",
        message: "No navigation bar found. Use 'create' to create one first.",
      },
    ];
  }
  if (args.tabs.length === 0) {
    return [{ status: "error", message: "No tabs specified to add." }];
  }

  const existingTabs: InnerTab[] = ctx.existingNavBar.storage?.tabs || [];
  const existingIds = new Set(existingTabs.map((t) => t.id));

  for (const t of args.tabs) {
    const id = slugify(t.name);
    if (existingIds.has(id)) {
      return [{ status: "error", message: `Tab "${t.name}" already exists.` }];
    }
    existingIds.add(id);
  }

  return null;
}

function handleRemoveTabs(
  args: { tabs?: { name?: string }[] },
  ctx: NavBarContext,
): CopilotCommandResultT[] | null {
  if (!ctx.existingNavBar) {
    return [
      {
        status: "error",
        message: "No navigation bar found on this dashboard.",
      },
    ];
  }
  if (args.tabs.length === 0) {
    return [{ status: "error", message: "No tabs specified to remove." }];
  }
  return null;
}

function handleRenameTabs(
  args: { rename_map?: Record<string, string> },
  ctx: NavBarContext,
): CopilotCommandResultT[] | null {
  if (!ctx.existingNavBar) {
    return [
      {
        status: "error",
        message: "No navigation bar found on this dashboard.",
      },
    ];
  }
  if (Object.keys(args.rename_map).length === 0) {
    return [{ status: "error", message: "No rename_map provided." }];
  }
  return null;
}

export function useManageNavigationBar() {
  const { id: currentDashboardId = "" } = useParams();

  const manageNavigationBar = useCallback(
    async (
      args: ManageNavigationBarInputArgumentsT,
      options: DashboardCommandOptions = {},
    ): Promise<CopilotCommandResultT[]> => {
      const dashboardId = options.dashboardId || currentDashboardId;
      const appState = useAppStore.getState();
      const tab = appState.items?.[dashboardId];
      if (!tab) {
        return [{ status: "error", message: "Dashboard not found" }];
      }

      const widgets = tab.data?.widgets || [];
      const existingNavBar = widgets.find((w) => w.widgetId === "navigation_bar");
      const ctx: NavBarContext = { dashboardId, existingNavBar };

      switch (args.operation) {
        case "create": {
          const error = handleCreateNavBar(args, ctx);
          if (error) return error;

          const tabs: InnerTab[] = args.tabs.map((t) => ({
            id: slugify(t.name),
            name: t.name,
          }));

          const navWidget = getJsonWidget("navigation_bar");
          if (!navWidget) {
            return [
              {
                status: "error",
                message: "Navigation bar widget definition not found.",
              },
            ];
          }

          const widgetWithTabs = {
            ...navWidget,
            innerTab: tabs[0].id,
            storage: { ...navWidget.storage, tabs },
          };

          await appState.addWidgets(dashboardId, [widgetWithTabs]);

          const innerTabs: InnerTabsT = {};
          for (const tab of tabs) {
            innerTabs[tab.id] = tab;
          }

          appState.updateInnerTabs(dashboardId, innerTabs);

          return [
            {
              status: "success",
              message: `Navigation bar created with tabs: ${tabs.map((t) => t.name).join(", ")}`,
              tabs: tabs.map((t) => ({ id: t.id, name: t.name })),
            },
          ];
        }

        case "add_tabs": {
          const error = handleAddTabs(args, ctx);
          if (error) return error;

          const navBar = existingNavBar!;
          const existingTabs: InnerTab[] = navBar.storage?.tabs || [];
          const newTabs: InnerTab[] = args.tabs.map((t) => ({
            id: slugify(t.name),
            name: t.name,
          }));

          const allTabs = [...existingTabs, ...newTabs];
          const innerTabs: InnerTabsT = {};
          for (const t of allTabs) {
            innerTabs[t.id] = t;
          }

          appState.updateInnerTabs(dashboardId, innerTabs);

          triggerCustomEvent(`updateWidget-${navBar.id}`, (prev) => ({
            ...prev,
            storage: { ...prev.storage, tabs: allTabs },
          }));

          return [
            {
              status: "success",
              message: `Added tabs: ${newTabs.map((t) => t.name).join(", ")}`,
              tabs: allTabs.map((t) => ({ id: t.id, name: t.name })),
            },
          ];
        }

        case "remove_tabs": {
          const error = handleRemoveTabs(args, ctx);
          if (error) return error;

          const navBar = existingNavBar!;
          const existingTabs: InnerTab[] = navBar.storage?.tabs || [];

          const matchedIds = new Set<string>();
          const removedNames: string[] = [];
          const notFoundNames: string[] = [];
          for (const t of args.tabs) {
            const match = findTabMatch(existingTabs, t.name);
            if (match) {
              matchedIds.add(match.id);
              removedNames.push(match.name);
            } else {
              notFoundNames.push(t.name);
            }
          }

          if (matchedIds.size === 0) {
            const skippedMsg = `Tabs not found (skipped): ${notFoundNames.join(", ")}.`;
            return [
              {
                status: "success",
                message: skippedMsg,
                tabs: existingTabs.map((t) => ({ id: t.id, name: t.name })),
              },
            ];
          }

          const remainingTabs = existingTabs.filter((t) => !matchedIds.has(t.id));

          if (remainingTabs.length === 0) {
            appState.removeWidget(dashboardId, navBar.id);
            return [
              {
                status: "success",
                message: "All tabs removed. Navigation bar has been deleted.",
                tabs: [],
              },
            ];
          }

          const innerTabs: InnerTabsT = {};
          for (const t of remainingTabs) {
            innerTabs[t.id] = t;
          }

          appState.updateInnerTabs(dashboardId, innerTabs);

          triggerCustomEvent(`updateWidget-${navBar.id}`, (prev) => ({
            ...prev,
            storage: { ...prev.storage, tabs: remainingTabs },
          }));

          let message = "";
          if (removedNames.length > 0) {
            message += `Removed tabs: ${removedNames.join(", ")}.`;
          }
          if (notFoundNames.length > 0) {
            message += ` Tabs not found (skipped): ${notFoundNames.join(", ")}.`;
          }
          return [
            {
              status: "success",
              message: message.trim(),
              tabs: remainingTabs.map((t) => ({ id: t.id, name: t.name })),
            },
          ];
        }

        case "rename_tabs": {
          const error = handleRenameTabs(args, ctx);
          if (error) return error;

          const navBar = existingNavBar!;
          const existingTabs: InnerTab[] = navBar.storage?.tabs || [];
          const innerTabs: InnerTabsT = {};

          const renameLookup: Record<string, string> = {};
          for (const [oldName, newName] of Object.entries(args.rename_map)) {
            renameLookup[oldName.toLowerCase()] = newName;
          }

          // Tab ids are stable identifiers: a rename only changes the display
          // name. Regenerating the id from the new name breaks every held
          // reference (widget.innerTab, current_tab_id, URLs) and lets the
          // stale id rematerialize as an empty phantom tab.
          const matchedOldNames = new Set<string>();
          for (const t of existingTabs) {
            const newName = renameLookup[t.name.toLowerCase()];
            if (newName) {
              matchedOldNames.add(t.name.toLowerCase());
            }
            innerTabs[t.id] = newName ? { id: t.id, name: newName } : t;
          }

          const notFoundNames = Object.keys(args.rename_map).filter(
            (oldName) => !matchedOldNames.has(oldName.toLowerCase()),
          );
          if (matchedOldNames.size === 0) {
            return [
              {
                status: "error",
                message: `No tabs matched the rename_map old names: ${notFoundNames.join(", ")}. Valid tab ids: ${existingTabs.map((t) => t.id).join(", ")}.`,
              },
            ];
          }

          // Names stay unique so name-based matching (findTabMatch, future
          // renames) remains unambiguous.
          const finalNames = new Set<string>();
          for (const t of Object.values(innerTabs)) {
            const nameKey = t.name.toLowerCase();
            if (finalNames.has(nameKey)) {
              return [
                {
                  status: "error",
                  message: `Renaming would create a duplicate tab name: "${t.name}" already exists on this dashboard.`,
                },
              ];
            }
            finalNames.add(nameKey);
          }

          appState.updateInnerTabs(dashboardId, innerTabs);

          const updatedTabs = Object.values(innerTabs).map((t) => ({
            id: t.id,
            name: t.name,
          }));
          triggerCustomEvent(`updateWidget-${navBar.id}`, (prev) => ({
            ...prev,
            storage: { ...prev.storage, tabs: updatedTabs },
          }));

          const renames = Object.entries(args.rename_map)
            .filter(([old]) => matchedOldNames.has(old.toLowerCase()))
            .map(([old, newName]) => `"${old}" → "${newName}"`)
            .join(", ");
          let message = `Renamed tabs: ${renames}.`;
          if (notFoundNames.length > 0) {
            message += ` Tabs not found (skipped): ${notFoundNames.join(", ")}.`;
          }
          return [
            {
              status: "success",
              message,
              tabs: updatedTabs,
            },
          ];
        }

        default:
          return [
            {
              status: "error",
              // @ts-expect-error -- Ignore --
              message: `Unknown operation: ${args.operation}`,
            },
          ];
      }
    },
    [currentDashboardId],
  );

  return manageNavigationBar;
}
