import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import {
  type Item,
  type MoveToTabs,
  useAppStore,
  useShallowAppStore,
} from "~/lib/state/app";
import {
  beautifySlug,
  cn,
  dispatchSaveState,
  generateRandomName,
  getInnerTabsGridLayout,
} from "~/lib/utils";
import Icon from "../Icon";
import { useWidgetContext } from "../Widget.context";
import type { InnerTabsMenuProps } from "./types";
import { AddWidgetOnSelect } from "./utils";

export const TabDropdownMenu = (props: Omit<InnerTabsMenuProps, "gridLayout">) => {
  const { uniqueKey, tab } = props;
  const { widget, activeDashboardId, isShared } = useWidgetContext();
  const navigate = useNavigate();

  const gridLayout = getInnerTabsGridLayout(tab?.data?.gridLayout);
  const isCurrentDashboard = tab?.index === activeDashboardId;

  if (Object.keys(gridLayout).length > 1) {
    return <InnerTabsMenu {...{ uniqueKey, tab }} gridLayout={gridLayout} />;
  }

  return (
    <DropdownMenu.Item
      key={uniqueKey}
      className={cn("obb-dropdown-item", {
        "opacity-30": isShared,
        "bg-light-50 dark:bg-[#303038]": isCurrentDashboard,
      })}
      onSelect={async () => {
        await dispatchSaveState();

        const w = { ...widget, innerTab: "" };

        await AddWidgetOnSelect({ widget: w, tab, activeDashboardId, navigate });
      }}
      disabled={isShared}
    >
      <span className="truncate grow">{tab?.data.name}</span>
    </DropdownMenu.Item>
  );
};

TabDropdownMenu.displayName = "TabDropdownMenu";

const InnerTabsMenu = (props: InnerTabsMenuProps) => {
  const { uniqueKey, tab, gridLayout } = props;
  const { widget, activeDashboardId, isShared } = useWidgetContext();
  const key = `${uniqueKey}-inner-tab`;
  const isCurrentDashboard = tab?.index === activeDashboardId;

  const navigate = useNavigate();
  const tabsInStorage = useShallowAppStore((s) => {
    const dashboard = s.getTabById(tab?.index);
    const navigationBar = dashboard?.data?.widgets?.find(
      (w) => w.widgetId === "navigation_bar",
    );

    if (!navigationBar) return {};

    return Object.fromEntries(
      navigationBar?.storage?.tabs?.map((tab) => [tab.id, tab]) || [],
    );
  });

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        key={`${key}-trigger`}
        className={cn("obb-dropdown-item", {
          "bg-light-50 dark:bg-[#303038]": isCurrentDashboard,
        })}
      >
        <span className="truncate grow">
          {isCurrentDashboard ? `Current (${tab?.data.name})` : tab?.data.name}
        </span>
        <Icon id="chevron-right" className="ml-auto min-w-[12px] w-[12px] h-[18px]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent
        key={`${key}-content`}
        className="obb-dropdown-container z-50 w-[172px] overflow-y-auto max-h-[70vh]!"
        style={{ boxShadow: "0px 4px 8px 0px rgba(0, 0, 0, 0.25)" }}
      >
        {Object.keys(gridLayout ?? {}).map((innerTab) => (
          <DropdownMenu.Item
            key={`${key}-${innerTab}-item`}
            className={cn("obb-dropdown-item truncate", {
              "opacity-30": isShared,
              "bg-light-50 dark:bg-[#303038]":
                isCurrentDashboard && innerTab === widget.innerTab,
            })}
            onSelect={async () => {
              await dispatchSaveState();

              const w = { ...widget, innerTab };
              await AddWidgetOnSelect({ widget: w, tab, activeDashboardId, navigate });
            }}
            disabled={isShared}
          >
            {tabsInStorage?.[innerTab]?.name || beautifySlug(innerTab)}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
};

InnerTabsMenu.displayName = "InnerTabsMenu";

const NewDashMenuItem = (props: { tab?: MoveToTabs; separator?: boolean }) => {
  const { separator, tab = null } = props;
  const { widget, activeDashboardId } = useWidgetContext();
  const navigate = useNavigate();

  return (
    <>
      {separator && (
        <DropdownMenu.Separator
          key={`separator-${widget?.id}`}
          className="h-px bg-light-300 dark:bg-dark-500"
        />
      )}
      <DropdownMenu.Item
        key={`new-dashboard-${widget?.id}`}
        className="obb-dropdown-item"
        onSelect={async () => {
          const id = uuidv4();
          const name = generateRandomName();
          await dispatchSaveState();

          const newTab = {
            index: id,
            parentId: tab?.index,
            data: { name, type: "custom", groups: [], widgets: [], currentTab: "" },
          } as Item;

          useAppStore.getState().addTab(newTab);

          await AddWidgetOnSelect({
            widget: { ...widget, innerTab: "" },
            tab: newTab,
            activeDashboardId,
            navigate,
          });
        }}
      >
        New Dashboard
      </DropdownMenu.Item>
    </>
  );
};

NewDashMenuItem.displayName = "NewDashMenuItem";

const FolderSubmenu = ({ tab }: { tab: MoveToTabs }) => {
  const moveToKey = `move-to-tab-${tab.index}`;

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        key={`${moveToKey}-trigger`}
        className="obb-dropdown-item"
      >
        <Icon id="folder-open" />
        <span className="truncate grow">{tab?.data.name}</span>
        <Icon id="chevron-right" className="ml-auto w-[12px] h-[18px]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent
        key={`move-to-tab-${tab.index}-content`}
        className="obb-dropdown-container z-50 w-[172px] overflow-y-auto max-h-[70vh]!"
      >
        {tab.children?.map((child) =>
          child.isFolder ? (
            <FolderSubmenu key={`move-to-tab-${child.index}`} tab={child} />
          ) : (
            <TabDropdownMenu
              uniqueKey={`${moveToKey}-${child.index}-tab`}
              key={`${moveToKey}-${child.index}-root`}
              tab={child as Item}
            />
          ),
        )}
        <NewDashMenuItem tab={tab} separator={tab.children.length !== 0} />
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
};

FolderSubmenu.displayName = "FolderSubmenu";

const MoveToTabsDropdownMenu = forwardRef<HTMLElement, {}>((_, _ref) => {
  const { activeDashboardId, isShared } = useWidgetContext();
  const getMoveToTabs = useShallowAppStore((state) => state.getMoveToTabs);
  const moveToTabs = getMoveToTabs(activeDashboardId);

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger
        key="move-to-tab-trigger"
        className={cn("obb-dropdown-item", {
          "opacity-30": isShared,
        })}
        disabled={isShared}
      >
        <Icon id="move-icon" />
        Copy to
        <Icon id="chevron-right" className="ml-auto w-[12px] h-[18px]" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent
        key="move-to-tab-content"
        className="obb-dropdown-container z-50 w-[172px] overflow-y-auto max-h-[70vh]!"
      >
        {moveToTabs.map((tab) =>
          tab.isFolder ? (
            <FolderSubmenu key={`move-to-tab-${tab.index}`} tab={tab} />
          ) : (
            <TabDropdownMenu
              uniqueKey={`move-to-tab-${tab.index}`}
              key={tab.index}
              tab={tab as Item}
            />
          ),
        )}
        <NewDashMenuItem separator={moveToTabs.length !== 0} />
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>
  );
});

MoveToTabsDropdownMenu.displayName = "MoveToTabsDropdownMenu";

export default MoveToTabsDropdownMenu;
