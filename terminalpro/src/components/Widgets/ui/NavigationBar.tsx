import { Reorder } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useTabHighlight } from "~/components/AI/contexts/TabHighlightContext";
import { Button } from "~/components/ds/atoms/Button";
import { Input } from "~/components/ds/atoms/Input";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogFooter, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { type InnerTab, useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";
import {
  beautifySlug,
  cn,
  dispatchSaveState,
  isInputFocused,
  slugify,
} from "~/lib/utils";
import {
  NotificationId,
  showNotification,
  showNotificationWithRememberMe,
} from "~/lib/utils/toast";
import Icon from "../../Icon";
import Tooltip from "../../Tooltip";

const countWidgetsPerTab = (widgets: any[]) => {
  const count = {};
  for (const widget of widgets) {
    if (widget.widgetId !== "navigation_bar") {
      const tabId = widget.innerTab;
      if (!count[tabId]) {
        count[tabId] = 0;
      }
      count[tabId]++;
    }
  }
  return count;
};

type TabT = InnerTab & { new?: boolean };
type UpdatedTabs = Record<"deleted" | "newTabs", TabT[]> & { newIds: string[] };

type NavigationBarState = {
  isChanged: boolean;
  tabsInStorage: { [tabId: string]: TabT };
  open: boolean;
  inputValues: Record<string, string>;
  errorValues: Record<string, boolean>;
};

export default function NavigationBar() {
  const { widget, widgetRef, activeDashboardId, updateWidget, isShared } =
    useWidgetContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const { lastInnerTab, widgetCount, ...appStore } = useShallowAppStore((state) => ({
    lastInnerTab: state.getLastInnerTab(activeDashboardId),
    widgetCount: countWidgetsPerTab(
      state.getTabById(activeDashboardId)?.data?.widgets || [],
    ),
    removeWidget: state.removeWidget,
    addWidget: state.addWidget,
    updateInnerTabs: state.updateInnerTabs,
  }));

  const showWidgetControlsEllipsis = useShallowThemeStore(
    (state) => state.showWidgetControlsEllipsis,
  );

  // Get highlighted tab ID from context for cross-tab widget highlighting
  const { hoveredWidgetTabId } = useTabHighlight();

  const currentTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab,
    [lastInnerTab, searchParams.get("tab")],
  );

  const inputRef = useRef<Record<string, HTMLInputElement | null>>({});

  const [state, dispatch] = useStateReducer<NavigationBarState>({
    isChanged: false,
    tabsInStorage: {},
    open: false,
    inputValues: {},
    errorValues: {},
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(
    (e: any) => {
      const isLastTab = typeof e === "boolean" && e;
      const widget = widgetRef.current;
      if (!widget?.id) return;
      if (!activeDashboardId) return;
      const toastProps = {
        message: `Delete ${widget?.name}?`,
        description: `If you wish to proceed, all the widgets that are within the current tab - in this case '${beautifySlug(currentTab)}' - will remain. However, all the widgets on the other tabs (along with their grouping) will be lost. Do you wish to continue?`,
        toastType: "warning",
        cancel: { label: "Cancel", onClick: () => {} },
        action: {
          label: "Delete",
          onClick: () => {
            appStore.removeWidget(activeDashboardId, widget?.id);
            setSearchParams({});
            dispatch({ isChanged: false });
          },
        },
      } as const;

      if (isLastTab) {
        Object.assign(toastProps, {
          message: "Are you sure you want to delete this tab?",
          description: `This is the last tab remaining, so deleting it will remove the entire navigation bar widget. All the widgets that are within the current tab - in this case '${beautifySlug(currentTab)}' - will remain on the dashboard. Do you wish to continue?`,
        });
      }

      showNotification(toastProps);
    },
    [widgetRef, activeDashboardId, currentTab],
  );

  useEffect(() => {
    if (!state.open) {
      const tabs = Object.fromEntries(
        widget?.storage?.tabs?.map((tab: any) => [uuidv4(), tab]) || [],
      );
      const tabsInStorage = Object.fromEntries(
        Object.entries(tabs).filter(
          ([_, tab]) => tab.name !== "" && tab.name !== undefined,
        ),
      );

      dispatch({
        tabsInStorage,
        inputValues: Object.fromEntries(
          Object.entries(tabsInStorage).map(([id, tab]) => [id, tab.name || ""]),
        ),
      });
    }
  }, [state.open]);

  const handleSave = useCallback(() => {
    const innerTabs = {} as { [tabId: string]: InnerTab & { new?: boolean } };
    const updatedTabs = { deleted: [], newTabs: [], newIds: [] } as UpdatedTabs;

    for (let tab of Object.values(state.tabsInStorage)) {
      if (tab.name === "" || tab.name === undefined) continue;

      if (tab.new) {
        tab = { id: slugify(tab.name), name: tab.name, new: true };
      } else if (tab.newId) {
        updatedTabs.newIds.push(tab.id);
      }

      innerTabs[tab.id] = tab as InnerTab;
      updatedTabs.newTabs.push({ id: tab.id, name: tab.name });
    }

    for (const tab of widget?.storage?.tabs || []) {
      if (!innerTabs?.[tab.id]) {
        updatedTabs.deleted.push(tab);
      }
    }

    if (Object.values(updatedTabs).every((tab) => tab.length === 0)) {
      dispatch({ isChanged: false, open: false });
      return;
    }

    const newCurrentTabId = innerTabs[currentTab]?.newId;
    const newTabs = updatedTabs.newTabs.map((tab) => ({
      id: innerTabs[tab.id]?.newId || tab.id,
      name: tab.name,
    }));

    updateWidget((prev) => ({
      ...prev,
      storage: { ...prev.storage, tabs: newTabs },
    }));

    if (newCurrentTabId) dispatchSaveState();

    queueMicrotask(() => appStore.updateInnerTabs(activeDashboardId, innerTabs));

    if (updatedTabs.newIds.length > 0 || updatedTabs.deleted.length > 0) {
      setTimeout(() => {
        if (updatedTabs.deleted.length === 0) return;

        const deletedTabNames = updatedTabs.deleted.map((tab) => tab.name).join(", ");
        showNotificationWithRememberMe({
          id: NotificationId.NavTabsDeleted,
          message: "Deleted tabs",
          description: `The tabs ${deletedTabNames} were successfully deleted along with the widgets within.`,
          toastType: "success",
        });
      }, 100);
    }

    dispatch({ isChanged: false, open: false });
  }, [
    state.tabsInStorage,
    widget?.storage?.tabs,
    widgetRef,
    activeDashboardId,
    currentTab,
    setSearchParams,
    updateWidget,
  ]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isInputFocused(event.target)) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        (event.key === "ArrowRight" || event.key === "ArrowLeft")
      ) {
        const tabs = (widget?.storage?.tabs || []) as { id: string; name: string }[];

        const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);

        const index =
          event.key === "ArrowRight"
            ? currentIndex + 1
            : currentIndex - 1 + tabs.length;

        const nextIndex = index % tabs.length;

        const nextTab = tabs[nextIndex];
        if (nextTab) {
          setSearchParams({ tab: nextTab.id });
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress, { passive: true });
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [widget?.storage?.tabs, searchParams, setSearchParams]);

  return (
    <>
      <BaseDialog
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        open={state.open}
        onClose={() => dispatch({ open: false })}
      >
        <DialogTitle>Manage Tabs</DialogTitle>
        <Reorder.Group
          ref={scrollContainerRef}
          axis="y"
          values={Object.keys(state.tabsInStorage)}
          onReorder={(newOrder) => {
            dispatch({
              tabsInStorage: (prev) => {
                const newTabs = Object.fromEntries(
                  newOrder.map((id) => [id, prev[id]]),
                );
                return newTabs;
              },
              isChanged: true,
            });
          }}
          className="flex flex-col gap-2 items-start max-h-[300px] overflow-y-auto pr-4 py-2"
        >
          {Object.keys(state.tabsInStorage).map((tabUuid) => {
            const tab = state.tabsInStorage[tabUuid];
            return (
              <Reorder.Item
                value={tabUuid}
                key={tabUuid}
                layout="position"
                className="flex gap-2 items-center w-full"
              >
                <Tooltip message="Drag to reorder">
                  <button tabIndex={-1} className="obb-small-navbar-btn">
                    <Icon id="drag-handle" />
                  </button>
                </Tooltip>
                <div className="flex-1">
                  <Input
                    ref={(el) => (inputRef.current[tabUuid] = el)}
                    onChange={(value) => {
                      const valueId = slugify(value as string);
                      const updateState = { isChanged: true } as typeof state;

                      if (
                        Object.entries(state.tabsInStorage).find(([key, t]) => {
                          if (key === tabUuid) return false;
                          if (t.newId && t.newId !== valueId) return false;
                          if (!t.newId && t.id !== valueId) return false;

                          return [t.id, t.name, t.newId].some((t) => t === valueId);
                        })
                      ) {
                        showNotification({
                          message: "Duplicate tab name",
                          description: "Please choose a unique tab name.",
                          toastType: "error",
                        });
                        updateState.isChanged = false;
                      }
                      dispatch((prev) => ({
                        ...prev,
                        ...updateState,
                        inputValues: {
                          ...prev.inputValues,
                          [tabUuid]: value as string,
                        },
                        errorValues: {
                          ...prev.errorValues,
                          [tabUuid]: !updateState.isChanged,
                        },
                      }));

                      if (inputRef.current[tabUuid]) {
                        inputRef.current[tabUuid].value = value as string;
                      }
                    }}
                    onBlur={() => {
                      dispatch((prev) => {
                        const newTabs = { ...prev.tabsInStorage };

                        const newId = slugify(prev.inputValues[tabUuid]);

                        newTabs[tabUuid] = {
                          ...newTabs[tabUuid],
                          name: prev.inputValues[tabUuid],
                          newId: newId !== tab.id ? newId : undefined,
                        };

                        return { ...prev, tabsInStorage: newTabs };
                      });
                    }}
                    placeholder="Enter tab name"
                    type="text"
                    defaultValue={state.inputValues[tabUuid]}
                    className={cn("h-8 [&_input]:h-full", {
                      "error-border": state.errorValues[tabUuid],
                    })}
                  />
                </div>
                <Tooltip
                  message={`Delete ${tab.name} tab - contains ${widgetCount[tab.id] || 0} widget${
                    widgetCount[tab.id] === 1 ? "" : "s"
                  }`}
                >
                  <Button
                    onClick={() => {
                      const isLastTab = Object.keys(state.tabsInStorage).length === 1;

                      const toastProps = {
                        cancel: { label: "Cancel", onClick: () => {} },
                        action: {
                          label: "Delete",
                          onClick: () => {
                            dispatch((prev) => {
                              const tabsInStorage = { ...prev.tabsInStorage };
                              delete tabsInStorage[tabUuid];
                              delete prev.inputValues[tabUuid];
                              return { ...prev, tabsInStorage, isChanged: true };
                            });
                          },
                        },
                      };
                      if (widgetCount[tab.id] > 0) {
                        if (isLastTab) return handleClose(true);
                        showNotificationWithRememberMe({
                          id: NotificationId.NavTabRemoved,
                          message: "Are you sure you want to delete this tab?",
                          description: `This tab contains ${widgetCount[tab.id]} widget(s). If you wish to proceed, all the widgets within this tab will be lost. Do you wish to continue?`,
                          toastType: "warning",
                          ...toastProps,
                        });
                      } else {
                        toastProps.action.onClick();
                      }
                    }}
                    size="sm"
                    variant="secondary"
                    className="h-8"
                  >
                    <Icon id="trash-02" />
                  </Button>
                </Tooltip>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>
        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const id = uuidv4();
              dispatch((prev) => {
                return {
                  ...prev,
                  isChanged: true,
                  inputValues: { ...prev.inputValues, [id]: "" },
                  tabsInStorage: {
                    ...prev.tabsInStorage,
                    [id]: { id, name: "", new: true },
                  },
                };
              });

              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({
                    top: scrollContainerRef.current.scrollHeight,
                    behavior: "smooth",
                  });
                }

                if (inputRef.current[id]) {
                  inputRef.current[id]?.focus();
                }
              }, 0);
            }}
          >
            + Add New Tab
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outlined"
              size="sm"
              onClick={() => dispatch({ open: false })}
            >
              Cancel
            </Button>
            <Button
              disabled={!state.isChanged}
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </BaseDialog>
      <div className="group/widget flex overflow-auto h-full relative dark:bg-[#151518] bg-white shadow-xs rounded gap-3 text-sm p-2.5">
        {widget?.storage?.tabs.map((tab) => {
          const isCurrentTab = currentTab === tab.id;
          const isHighlighted = hoveredWidgetTabId === tab.id;

          return (
            <button
              onClick={() => {
                setSearchParams({ tab: tab.id });
              }}
              key={tab.id}
              className={cn(
                "whitespace-nowrap p-1.5 text-sm rounded transition-colors duration-200",
                {
                  "dark:bg-[#212126] dark:text-white font-medium bg-light-50 text-brand-main":
                    isCurrentTab,
                  "text-light-600 hover:border-light-900 hover:text-light-900 dark:text-light-400 dark:hover:text-light-200":
                    !isCurrentTab,
                  "outline-2 outline-brand-main": isHighlighted && !isCurrentTab,
                },
              )}
            >
              {tab.name}
            </button>
          );
        })}
        <div
          className={cn(
            "right-2 items-center flex gap-2.5 text-light-500 z-20 ml-auto",
            {
              "opacity-0 transition-opacity group-hover/widget:opacity-100":
                showWidgetControlsEllipsis,
            },
          )}
        >
          <button
            className={cn("obb-small-navbar-btn", {
              "opacity-40 cursor-not-allowed": isShared,
            })}
            disabled={isShared}
            onClick={() => {
              if (!isShared) {
                dispatch({ open: true });
              }
            }}
          >
            <Icon id="edit-05" />
          </button>
          <Tooltip
            message={
              isShared
                ? "You can't remove this widget"
                : "This widget will be removed from the dashboard"
            }
          >
            <button
              disabled={isShared}
              onClick={handleClose}
              className={cn("obb-small-navbar-btn", {
                "opacity-40 cursor-not-allowed": isShared,
              })}
            >
              <Icon id="cross-icon" className="" />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
