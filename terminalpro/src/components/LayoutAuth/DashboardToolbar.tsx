import { ChevronDownIcon } from "@radix-ui/react-icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { type Item, useShallowAppStore } from "~/lib/state/app";
import { useShallowSharedAppStore, useSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { duplicateDashboard } from "~/lib/utils/shared";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import { Button } from "../ds/atoms/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ds/atoms/DropdownMenu";
import SnowflakeHide from "../General/SnowflakeHide";
import Icon from "../Icon";
import Tooltip from "../Tooltip";
import { GroupPanelHeader, GroupRow } from "../Widgets/Helpers/GroupRow";

dayjs.extend(relativeTime);

const formatDistanceToNow = (date: number) => {
  return dayjs(date).fromNow();
};

function getDashboardInfo(item: Item & { created_by?: string }, isShared = false) {
  if (!item) return undefined;
  if (isShared)
    return {
      name: item?.data?.name,
      created_by: item?.created_by,
    };

  return {
    name: item?.data?.name,
    lastUpdated: item?.data?.lastUpdated,
    isShared: item?.isShared,
  };
}

export default function DashboardToolbar() {
  const { id } = useParams();
  const { tabGroups, deleteGroup, getWidgetsFromGroup } = useShallowAppStore(
    (state) => ({
      tabGroups: state?.getAllTabActiveGroups(id),
      deleteGroup: state.deleteGroup,
      getWidgetsFromGroup: state.getWidgetsFromGroup,
    }),
  );

  const { groupingVisible, setGroupingVisible } = useShallowThemeStore((state) => ({
    groupingVisible: state.groupingVisible,
    setGroupingVisible: state.setGroupingVisible,
  }));

  const sharedDashboardInfo = useShallowSharedAppStore((state) =>
    getDashboardInfo(state?.sharedItems?.[id], true),
  );
  const isShared = !!sharedDashboardInfo;

  const { quickAddButtonVisible, toggleSearch, setInitialSelectedSearchTab } =
    useShallowThemeStore((state) => ({
      toggleSearch: state.toggleSearch,
      setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
      quickAddButtonVisible: state.quickAddButtonVisible,
    }));

  const navigate = useNavigate();

  const onDeleteGroupClick = useCallback(
    (groupId: string) => {
      const widgetsInGroup = getWidgetsFromGroup(groupId, id);

      if (widgetsInGroup?.length > 0) {
        // If there are, show a warning message
        return showNotificationWithRememberMe({
          id: NotificationId.GroupNotEmpty,
          message: "Group not empty",
          description:
            "There are one or more widgets associated with this group. By deleting this group all widgets within this group will become unlinked. Do you wish to proceed?",
          toastType: "error",
          cancel: {
            label: "Cancel",
            onClick: () => {},
          },
          action: {
            label: "Yes, delete",
            onClick: () => deleteGroup(id, groupId),
          },
        });
      }

      // If there are no widgets in the group, delete the group
      deleteGroup(id, groupId);
    },
    [id, deleteGroup, getWidgetsFromGroup],
  );

  const handleClickWidget = useCallback(() => {
    setInitialSelectedSearchTab("widgets");
    toggleSearch();
  }, [setInitialSelectedSearchTab, toggleSearch]);

  const SharedDashboardTooltipMessage = useMemo(() => {
    if (!isShared) return "Share";
    return (
      <div className="max-w-[457px]">
        <p className="body-xs-regular max-w-md break-words whitespace-normal">
          <strong>This dashboard is shared</strong> — You're allowed to change tickers
          and switch tabs. You don't have permission to add, remove or resizing widgets.
          Duplicate the template first before applying any modifications.
        </p>
        <Button
          variant="primary"
          className="w-fit mt-2"
          size="xs"
          onClick={() => {
            const sharedDashboard = useSharedAppStore.getState().getDashboardById(id);
            const newId = duplicateDashboard(sharedDashboard);
            navigate(`/app/${newId}`);
          }}
        >
          Duplicate dashboard
        </Button>
      </div>
    );
  }, [id, isShared]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Check if mouse is over dropdown content or tooltip content - we need a delay to allow for the mouse to enter the dropdown content
    setTimeout(() => {
      const dropdownContent = document.querySelector("._dropdown-menu-content");
      const tooltipContent = document.querySelector(".TooltipContent");

      if (!(dropdownContent?.matches(":hover") || tooltipContent?.matches(":hover"))) {
        setIsExpanded(false);
        setIsDropdownOpen(false);
      }
    }, 50);
  }, []);

  if (!quickAddButtonVisible) return null;

  return (
    <motion.div
      data-testid="dashboard-toolbar"
      initial="closed"
      animate={isExpanded && !inSnowflakeNativeApp ? "open" : "closed"}
      onMouseEnter={inSnowflakeNativeApp ? undefined : handleMouseEnter}
      onMouseLeave={inSnowflakeNativeApp ? undefined : handleMouseLeave}
      variants={{
        open: {
          width: "auto",
          minWidth: 40,
        },
        closed: {
          width: 40,
          minWidth: 40,
        },
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={cn(
        "absolute bottom-6 right-[28px] z-30 h-10",
        "bg-brand-darker rounded-md",
        "shadow-md dark:shadow-[0px_2px_10px_0px_rgba(0,0,0,0.4)]",
        "flex items-center",
        "overflow-hidden",
      )}
    >
      <motion.div
        data-testid="dashboard-toolbar-info"
        className="flex items-center whitespace-nowrap pl-2 pr-10"
        variants={{
          open: {
            opacity: 1,
            x: 0,
            transition: { duration: 0.2, ease: "easeInOut", delay: 0.1 },
          },
          closed: {
            opacity: 0,
            x: -20,
            transition: { duration: 0.15, ease: "easeInOut" },
          },
        }}
      >
        <SnowflakeHide>
          <div className="rounded flex items-center gap-1.5">
            <Tooltip
              className={cn({
                "w-[356px] p-3": !groupingVisible,
              })}
              message={
                isExpanded ? (
                  groupingVisible ? (
                    <p className="body-xs-regular">
                      Hide group labels and indicators in the dashboard.
                    </p>
                  ) : (
                    <>
                      <p className="body-xs-regular mb-2.5">
                        Show group labels and indicators in the dashboard to visualize
                        widget groupings.
                      </p>
                      <div className="dark:bg-dark-300 bg-light-100 rounded p-2">
                        <p className="inline-flex items-center gap-1">
                          <Icon
                            id="info-circled-icon"
                            className="min-w-3 size-3 dark:text-white"
                          />
                          <span className="body-xs-bold dark:text-light-50 text-dark-800">
                            Note:
                          </span>
                        </p>
                        <img
                          src="/assets/images/features/Grouping.gif"
                          alt="Group info"
                          className="w-[318px] h-[206px] mt-2.5"
                        />
                      </div>
                    </>
                  )
                ) : (
                  ""
                )
              }
            >
              <button
                onClick={() => setGroupingVisible(!groupingVisible)}
                className={cn(
                  "size-6 flex items-center justify-center rounded",
                  groupingVisible && "bg-brand-main",
                )}
              >
                <Icon id="grouping" className="min-w-4 size-4 text-white" />
              </button>
            </Tooltip>
            <DropdownMenu
              modal={false}
              open={isDropdownOpen}
              onOpenChange={setIsDropdownOpen}
            >
              <Tooltip
                hide={!isExpanded}
                position="top"
                message={
                  isExpanded
                    ? tabGroups.length === 0
                      ? "No groups available"
                      : "Manage groups"
                    : ""
                }
              >
                <DropdownMenuTrigger className="w-2.5 h-6 flex items-center justify-center rounded-[2px] radix-state-open:bg-brand-main hover:bg-brand-main/50">
                  <ChevronDownIcon className="min-w-2.5 size-2.5 text-white" />
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent
                sideOffset={10}
                className="_dropdown-menu-content min-w-[180px] flex flex-col gap-2"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <GroupPanelHeader />
                {tabGroups.length === 0 ? (
                  <p className="body-xs-regular text-ds-text-caption py-1">
                    No groups available
                  </p>
                ) : (
                  <div className="py-1 space-y-1">
                    {tabGroups.map((group) => {
                      //TODO: we need to update types because they dont match reality?
                      //@ts-expect-error
                      let label = group.groupBy ?? group.paramName ?? group.type;
                      if (
                        group.type === "ticker" &&
                        group?.value?.category === "country"
                      ) {
                        label = "country";
                      }
                      return (
                        <GroupRow
                          key={group.id}
                          name={group.name}
                          color={group.color}
                          valueLabel={<span className="capitalize">{label}</span>}
                          onDelete={() => onDeleteGroupClick(group.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SnowflakeHide>
      </motion.div>

      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center"
        data-testid="dashboard-toolbar-widget-button"
      >
        <Tooltip
          position="top"
          message={isShared ? SharedDashboardTooltipMessage : "Add widgets"}
          {...(isShared ? { align: "end", alignOffset: -4 } : {})}
        >
          <button
            data-testid="dashboard-toolbar-add-widget-button"
            disabled={isShared}
            className="disabled:opacity-50 size-6 hover:bg-brand-main flex items-center justify-center rounded"
            onClick={handleClickWidget}
          >
            <Icon id="widget" className="min-w-4 size-4 text-white" />
          </button>
        </Tooltip>
      </div>
    </motion.div>
  );
}
