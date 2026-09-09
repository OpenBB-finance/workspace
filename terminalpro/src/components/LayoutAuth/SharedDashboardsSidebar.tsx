import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { deleteDashboardShare } from "~/api/dashboard.api";
import { useShallowAuthStore } from "~/lib/state/auth";
import { useShallowSharedAppStore, useSharedAppStore } from "~/lib/state/sharedApp";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn, dispatchRefreshQuery, formatDate } from "~/lib/utils";
import { duplicateDashboard } from "~/lib/utils/shared";
import { NotificationId, showNotificationWithRememberMe } from "~/lib/utils/toast";
import Icon from "../Icon";
import Tooltip from "../Tooltip";

export default function SharedDashboardsSidebar() {
  const sharedItems = useShallowSharedAppStore((state) => state.sharedItems);
  const expandedShared = useShallowSidebarStore((state) => state.expandedShared);

  const sharedDashboardsMemo = useMemo(
    () =>
      Object.values(sharedItems ?? {}).map((item) => (
        <SharedDashboardItem key={item.index} item={item} />
      )),
    [sharedItems],
  );

  return useMemo(
    () =>
      Object.values(sharedItems ?? {}).length > 0 ? (
        <ul
          className={cn(
            "flex flex-col overflow-y-auto overflow-x-hidden @max-[100px]:items-center",
            {
              "max-h-[35vh] min-h-[48px] @max-[100px]:min-h-[32px] my-1":
                expandedShared, // we need my-1 to match the rct-root margin for my dashboards
            },
          )}
        >
          {sharedDashboardsMemo}
        </ul>
      ) : null,
    [sharedDashboardsMemo, sharedItems, expandedShared],
  );
}

export function SharedDashboardItem({ item }: { item: any }) {
  const { id } = useParams();
  const { user } = useShallowAuthStore((state) => ({
    user: state.user,
  }));
  const { toggleExportPopup } = useShallowThemeStore((s) => ({
    toggleExportPopup: s.toggleExportPopup,
  }));
  const collapsed = useShallowSidebarStore((state) => !state.expandedShared);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  useEffect(() => {
    if (pendingNavigation) {
      setTimeout(() => navigate(pendingNavigation));
      setPendingNavigation(null);
    }
  }, [pendingNavigation, navigate]);

  return (
    <Tooltip position="right" message={<TooltipContent item={item} />}>
      <li
        key={item.index}
        className={cn(
          "obb-navigation-item group relative w-full justify-between title-container flex-1",
          "h-8 max-h-8 @max-[100px]:w-8!",
          {
            "obb-navigation-item-active": id === item.index && !item.isFolder,
            hidden: collapsed && !item.isFolder,
          },
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onClick={() => {
          navigate(`/app/${item.index}`);
          setOpen(false);
        }}
      >
        <span
          className={cn("flex items-center gap-0.5 w-full overflow-hidden", {
            hidden: collapsed,
          })}
        >
          <Icon
            id="dashboard-shared"
            className="min-w-[16px] flex-shrink-0 text-[#F97316]! dark:text-[#F97316]!"
          />
          <span className="flex flex-col gap-0.5 pl-1 w-full overflow-hidden @max-[100px]:hidden">
            <span
              className={cn(
                "truncate w-full text-light-700 dark:text-light-300 select-none",
                "@min-[100px]:mr-4 max-w-[calc(100%-10px)]",
                { "text-black! dark:text-white!": id === item.index && !item.isFolder },
              )}
            >
              {item.data?.name || "Unnamed Item"}
            </span>
            {/*tabGroups.length > 0 && (
                <span className="flex gap-1 overflow-x-auto pb-0.5">
                  {tabGroups.map((group) => (
                    <span key={group.id} className={clsx("obb-tag")}>
                      {getGroupLabel(group)}
                    </span>
                  ))}
                </span>
                  )*/}
          </span>
          <span className="absolute right-1 flex gap-1 z-50 @max-[100px]:hidden">
            <DropdownMenuPrimitive.Root modal={true} open={open} onOpenChange={setOpen}>
              <DropdownMenuPrimitive.Trigger
                className={
                  "opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                }
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(true);
                }}
              >
                <Icon
                  id="dots-horizontal"
                  className="w-4 text-light-600! dark:text-white!"
                />
              </DropdownMenuPrimitive.Trigger>
              <DropdownMenuPrimitive.Portal>
                <DropdownMenuPrimitive.Content
                  align="start"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                  className={cn(
                    "z-20 radix-side-bottom:animate-slide-down radix-side-top:animate-slide-up",
                    "w-48",
                    "obb-dropdown-container",
                  )}
                >
                  <div>
                    <DropdownMenuPrimitive.Item
                      onClick={() => {
                        const sharedDashboard = useSharedAppStore
                          .getState()
                          .getDashboardById(item.index);
                        const newId = duplicateDashboard(sharedDashboard);
                        setPendingNavigation(`/app/${newId}`);
                      }}
                      className="obb-dropdown-item"
                    >
                      <span className="grow">Duplicate</span>
                    </DropdownMenuPrimitive.Item>
                    <DropdownMenuPrimitive.Item
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        showNotificationWithRememberMe({
                          id: NotificationId.DeleteSharedDashboard,
                          message: "Delete Shared Dashboard",
                          description:
                            "Are you sure you want to delete this dashboard? This action is permanent and cannot be undone.",
                          action: {
                            label: "Yes, delete",
                            onClick: async () => {
                              await deleteDashboardShare(item.index, [user.email]);
                              setPendingNavigation("/app");
                            },
                          },
                          cancel: {
                            label: "Cancel",
                            onClick: () => {},
                          },
                        });
                      }}
                      className="obb-dropdown-item"
                    >
                      <span className="grow">Delete</span>
                    </DropdownMenuPrimitive.Item>

                    <DropdownMenuPrimitive.Separator className="my-1 h-px w-full bg-light-200 dark:bg-[#36363F]" />
                    {item.index === id ? (
                      <>
                        <DropdownMenuPrimitive.Item
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExportPopup();
                          }}
                          className="obb-dropdown-item"
                        >
                          <span className="grow">Export PDF</span>
                        </DropdownMenuPrimitive.Item>
                        <DropdownMenuPrimitive.Item
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dispatchRefreshQuery();
                          }}
                          className="obb-dropdown-item"
                        >
                          <span className="grow">Refresh data</span>
                        </DropdownMenuPrimitive.Item>
                      </>
                    ) : (
                      <>
                        <Tooltip
                          message="You need to be inside the dashboard to be able to use this feature."
                          position="right"
                        >
                          <DropdownMenuPrimitive.Item className="obb-dropdown-item hover:bg-transparent! dark:hover:bg-transparent! opacity-50 cursor-not-allowed">
                            <span className="grow">Export PDF</span>
                          </DropdownMenuPrimitive.Item>
                        </Tooltip>
                        <Tooltip
                          message="You need to be inside the dashboard to be able to use this feature."
                          position="right"
                        >
                          <DropdownMenuPrimitive.Item className="obb-dropdown-item hover:bg-transparent! dark:hover:bg-transparent! opacity-50 cursor-not-allowed">
                            <span className="grow">Refresh data</span>
                          </DropdownMenuPrimitive.Item>
                        </Tooltip>
                      </>
                    )}
                  </div>
                </DropdownMenuPrimitive.Content>
              </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
          </span>
        </span>
      </li>
    </Tooltip>
  );
}

function TooltipContent({ item }: { item: any }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div>
        <strong>Shared by:</strong> {item.created_by}
      </div>
      <div>
        <strong>Share date:</strong>{" "}
        {item.created_date ? formatDate(new Date(item.created_date)) : "N/A"}
      </div>
      <div>
        <strong>Last update:</strong>{" "}
        {item.updated_date ? formatDate(new Date(item.updated_date)) : "N/A"}
      </div>
    </div>
  );
}
