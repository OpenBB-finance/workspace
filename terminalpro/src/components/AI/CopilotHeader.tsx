import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useCopilotContext } from "~/lib/contexts/CopilotChatContext";
import { useMobile } from "~/lib/providers/MobileProvider";
import { getConfig } from "~/lib/runtimeConfig";
import { type InnerTab, useShallowAppStore } from "~/lib/state/app";
import type { CopilotWidget } from "~/lib/state/copilot";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";
import { useShallowSharedAppStore } from "~/lib/state/sharedApp";
import { isTabPath } from "~/lib/utils/utils";
import widgetsMetadata from "~/lib/widgets.json";
import { Popover, PopoverTrigger } from "../ds/atoms/Popover";
import { cn } from "../ds/utils";
import Icon from "../Icon";
import { usePanelsState } from "../LayoutAuth/AppLayout/hooks/usePanelsState";
import Tooltip from "../Tooltip";
import type { WidgetT } from "../types";
import ChatSelection from "./ChatSelection";
import { useCopilotContextSuggestions } from "./hooks/useCopilotAddToContext";
import { createCopilotWidget } from "./hooks/useGetCopilotWidgets";
import { useMentions } from "./hooks/useMentions";
import { useShallowStreamingStore } from "./hooks/useStreaming";
import { dispatchCollapseCopilotPanel, dispatchCopilotCommand } from "./hooks/utils";

interface WidgetInfo {
  uuid: string;
  name: string;
  widget: CopilotWidget;
}

interface TabInfo {
  tabName: string;
  widgets: WidgetInfo[];
}

type WidgetDataWithTabs = {
  hasTabs: true;
  widgetsByTab: Record<string, TabInfo>;
};

type WidgetDataWithoutTabs = {
  hasTabs: false;
  widgets: WidgetInfo[];
};

type WidgetData = WidgetDataWithTabs | WidgetDataWithoutTabs;

function DashboardButton() {
  const { pathname } = useLocation();
  const { id: currentDashboardId = "" } = useParams();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  const dummyRef = useRef(null);

  const { getRichWidgetTooltip } = useCopilotContextSuggestions({
    inputRef: dummyRef,
    suggestionsRef: dummyRef,
    setIsDropdownOpen: () => {},
  });

  // Only show dashboard button on actual dashboard pages
  const isDashboardPage = useMemo(() => isTabPath(pathname), [isTabPath(pathname)]);

  const appStore = useShallowAppStore((state) => ({
    getTabById: state.getTabById,
    lastUpdated: state.getTabById(currentDashboardId)?.data?.lastUpdated || null,
    finalDashboardName: state.getTabById(currentDashboardId)?.data?.name || "Dashboard",
  }));

  const { getTabById, lastUpdated, finalDashboardName } = useShallowSharedAppStore(
    (state) => {
      const sharedItem = state?.sharedItems?.[currentDashboardId];
      // If no shared item, fallback to app store
      if (!sharedItem) return appStore;
      return {
        getTabById: state.getDashboardById,
        lastUpdated: sharedItem.data?.lastUpdated || null,
        finalDashboardName: sharedItem.data?.name || "Dashboard",
      };
    },
  );

  const { toggleSelectedWidget, isWidgetSelected, addDataOnDashboardWidget } =
    useShallowCopilotDataStore((state) => ({
      toggleSelectedWidget: state.toggleSelectedWidget,
      isWidgetSelected: state.isWidgetSelected,
      addDataOnDashboardWidget: state.addDataOnDashboardWidget,
    }));

  // Extract widget info with names and UUIDs, grouped by tabs
  const getWidgetsByTabs = useCallback((): WidgetData => {
    const dashboard = getTabById(currentDashboardId);
    if (!dashboard?.data?.widgets) return { hasTabs: false, widgets: [] };

    const finalWidgets = dashboard.data?.widgets || [];
    const navWidget = finalWidgets.find((w) => w.widgetId === "navigation_bar");
    const tabs = (navWidget?.storage?.tabs || []) as InnerTab[];

    const nonNavWidgets = finalWidgets.filter((w) => w.widgetId !== "navigation_bar");

    const validTabs = tabs.filter((tab) => tab.name && tab.name.trim() !== "");

    const createWidgetData = (widget: WidgetT) => {
      const customName = widget.name;
      const widgetId = widget.widgetId;
      const metadataName = widgetsMetadata[widgetId]?.name;
      const name = customName || metadataName || widgetId || "Unnamed Widget";
      const copilotWidget = createCopilotWidget(widget.id, widget);

      return { uuid: widget.id, name, widget: copilotWidget };
    };

    if (validTabs.length === 0)
      return { hasTabs: false, widgets: nonNavWidgets.map(createWidgetData) };

    const widgetsByTab: Record<string, TabInfo> = {};

    for (const tab of validTabs)
      widgetsByTab[tab.id] = { tabName: tab.name, widgets: [] };

    for (const widget of nonNavWidgets) {
      const widgetInfo = createWidgetData(widget);
      const tabId = widget.innerTab || validTabs[0]?.id || "overview";

      if (widgetsByTab[tabId]) {
        widgetsByTab[tabId].widgets.push(widgetInfo);
      } else if (validTabs[0]) {
        widgetsByTab[validTabs[0].id].widgets.push(widgetInfo);
      }
    }

    return { hasTabs: true, widgetsByTab };
  }, [getTabById, isWidgetSelected, widgetsMetadata, currentDashboardId]);

  const { widgetData, totalWidgetCount, tabIds } = useMemo(() => {
    const widgetData = getWidgetsByTabs();
    if (widgetData.hasTabs === true) {
      return {
        widgetData,
        totalWidgetCount: Object.values(widgetData.widgetsByTab).reduce(
          (sum, tab) => sum + tab.widgets.length,
          0,
        ),
        tabIds: Object.keys(widgetData.widgetsByTab),
      };
    }

    return {
      widgetData,
      totalWidgetCount: widgetData.widgets.length,
      tabIds: [],
    };
  }, [getWidgetsByTabs, lastUpdated]);

  // Initialize all tabs as expanded when widget data changes

  useEffect(() => {
    if (widgetData.hasTabs) {
      setExpandedTabs((prev) => {
        const newState = { ...prev };
        tabIds.forEach((tabId) => {
          // Only set to true if not already defined (preserve user's collapse/expand state)
          if (!(tabId in newState)) {
            newState[tabId] = true;
          }
        });
        return newState;
      });
    }
  }, [currentDashboardId, tabIds, widgetData.hasTabs]);

  const toggleTab = useCallback(
    (tabId: string) => {
      setExpandedTabs((prev) => ({
        ...prev,
        [tabId]: !prev[tabId],
      }));
    },
    [setExpandedTabs],
  );

  const handleAddWidgetToContext = useCallback(
    (widgetUuid: string) => {
      const wasSelected = isWidgetSelected(widgetUuid);

      if (!wasSelected) {
        const dashboard = getTabById(currentDashboardId);
        const finalWidgets = dashboard.data?.widgets || [];
        const widget = finalWidgets.find((w) => w.id === widgetUuid);
        if (widget) {
          const widgetDataForContext = {
            title:
              widget.name || widgetsMetadata[widget.widgetId]?.name || "Unnamed Widget",
            description: widgetsMetadata[widget.widgetId]?.description || "",
            endpointUrl: widgetsMetadata[widget.widgetId]?.endpoint_url || "",
            data: widget.data || null,
            lastUpdate: Date.now(),
            source: "header-button",
          };

          addDataOnDashboardWidget(widgetUuid, widgetDataForContext);
        }
      }

      toggleSelectedWidget(widgetUuid);

      if (!wasSelected) {
        window.dispatchEvent(new Event("expandCopilotIfHidden"));
      }
    },
    [
      isWidgetSelected,
      toggleSelectedWidget,
      addDataOnDashboardWidget,
      getTabById,
      currentDashboardId,
      widgetsMetadata,
    ],
  );

  if (!isDashboardPage) {
    return <div className="min-h-[32px]" />; // Maintain height when not on dashboard
  }

  return (
    <Popover
      open={isExpanded}
      onOpenChange={setIsExpanded}
      side="top"
      align="start"
      id="obb-copilot-dashboard-button"
      className="p-0! bg-general-bg-primary border border-general-border-secondary rounded-lg shadow-lg z-50 max-h-90 overflow-y-auto"
      style={{ minWidth: "16rem", maxWidth: "32rem" }} // min-w-64, max-w-[512px]
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      content={
        widgetData.hasTabs === true ? (
          <div className="p-2 space-y-1">
            {Object.entries(widgetData.widgetsByTab).map(([tabId, tabData]) => (
              <div key={tabId}>
                <div
                  className="flex items-center justify-between px-2 py-1 text-xs font-medium text-ds-text-caption border-b border-general-border-secondary mb-1 cursor-pointer hover:text-ds-text-body transition-colors"
                  onClick={() => toggleTab(tabId)}
                >
                  <span>{tabData.tabName}</span>
                  <Icon
                    id="chevron-right"
                    className={`w-3 h-3 transition-transform duration-200 ${
                      expandedTabs[tabId] ? "rotate-90" : ""
                    }`}
                  />
                </div>
                {expandedTabs[tabId] &&
                  (tabData.widgets.length === 0 ? (
                    <div className="pl-2.5 py-2 text-xs text-ds-text-caption ml-2">
                      No widgets
                    </div>
                  ) : (
                    tabData.widgets.map((widget, index) => {
                      const widgetTooltipElement = getRichWidgetTooltip(
                        widget.widget,
                      ) as any;
                      const tooltipMessage =
                        widgetTooltipElement?.props?.message ?? widget.name;
                      return (
                        <Tooltip
                          id={`widget-badge-tooltip-${widget.uuid}`}
                          key={`${tabId}-${index}`}
                          message={tooltipMessage}
                          position="right"
                        >
                          <div className="flex items-center gap-2 pl-2.5 py-1 text-xs text-ds-text-body hover:bg-general-bg-primary-hover transition-colors">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAddWidgetToContext(widget.uuid);
                              }}
                              className={cn(
                                "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all",
                                isWidgetSelected(widget.uuid)
                                  ? "pulse-box-shadow bg-brand-main! text-white"
                                  : "hover:bg-general-bg-primary-hover active:bg-general-bg-secondary",
                              )}
                              title={
                                isWidgetSelected(widget.uuid)
                                  ? "Remove from AI context"
                                  : "Add to AI context"
                              }
                            >
                              <Icon id="message-plus" className="w-3 h-3" />
                            </button>
                            <span className="flex-1 truncate">{widget.name}</span>
                          </div>
                        </Tooltip>
                      );
                    })
                  ))}
              </div>
            ))}
          </div>
        ) : totalWidgetCount > 0 ? (
          <div className="p-2 space-y-1">
            {widgetData.widgets.map((widget, index) => {
              const widgetTooltipElement = getRichWidgetTooltip(widget.widget) as any;
              const tooltipMessage =
                widgetTooltipElement?.props?.message ?? widget.name;
              return (
                <Tooltip
                  id={`widget-badge-tooltip-${widget.uuid}`}
                  key={index}
                  message={tooltipMessage}
                  position="right"
                >
                  <div className="flex items-center gap-2 px-2 py-1 text-xs text-ds-text-body hover:bg-general-bg-primary-hover transition-colors">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleAddWidgetToContext(widget.uuid);
                      }}
                      className={cn(
                        "flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-all",
                        isWidgetSelected(widget.uuid)
                          ? "pulse-box-shadow bg-brand-main! text-white"
                          : "hover:bg-general-bg-primary-hover active:bg-general-bg-secondary",
                      )}
                      title={
                        isWidgetSelected(widget.uuid)
                          ? "Remove from AI context"
                          : "Add to AI context"
                      }
                    >
                      <Icon id="message-plus" className="w-3 h-3" />
                    </button>
                    <span className="flex-1 truncate">{widget.name}</span>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <div className="p-3 text-center text-xs text-ds-text-caption">
            No widgets in this dashboard
          </div>
        )
      }
    >
      <PopoverTrigger asChild={true}>
        <button className="flex items-center gap-2 px-2 py-1 rounded hover:bg-general-bg-secondary-hover transition-colors">
          <span className="font-medium text-ds-text-heading truncate max-w-32">
            {finalDashboardName}
          </span>
          <span className="text-xs text-ds-text-heading">({totalWidgetCount})</span>
          <Icon
            id="chevron-right"
            className={`w-3 h-3 text-ds-text-heading transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </button>
      </PopoverTrigger>
    </Popover>
  );
}

export function CopilotHeader() {
  const isMobile = useMobile((state) => state.isMobile);
  const expandedHeader = usePanelsState("right");
  const stopSubmitRef = useCopilotContext()?.stopSubmitRef;
  const { removeMentionFromText } = useMentions();
  const { dispatch, loading } = useShallowStreamingStore((state) => ({
    dispatch: state.dispatch,
    loading: state.loading,
  }));
  const copilot = useShallowCopilotStore((state) => ({
    currentChat: state.currentChat,
    getCurrentChat: state.getCurrentChat,
    selectedCopilot: state.selectedCopilot,
    resetContent: state.resetContent,
    addChat: state.addChat,
    setCurrentChat: state.setCurrentChat,
    getChatsData: state.getChatsData,
    setTitleNeedsUpdate: state.setTitleNeedsUpdate,
    updateCopilotLabel: state.updateCopilotLabel,
    removeUnreachableArtifacts: state.removeUnreachableArtifacts,
    isFullscreen: state.isFullscreen,
    toggleFullscreen: state.toggleFullscreen,
    setLastPanelState: state.setLastPanelState,
    setIsButtonTriggered: state.setIsButtonTriggered,
    setIsIntentionallyCollapsed: state.setIsIntentionallyCollapsed,
  }));

  const copilotData = useShallowCopilotDataStore((state) => ({
    clearSelectedWidgets: state.clearSelectedWidgets,
    toggleSelectedWidget: state.toggleSelectedWidget,
    getCopilotWidgets: state.getCopilotWidgets,
    removeDataFromDashboardWidget: state.removeDataFromDashboardWidget,
    setCopilotWidgets: state.setCopilotWidgets,
    isMentionTrackedWidget: state.isMentionTrackedWidget,
    removeMentionTrackedWidget: state.removeMentionTrackedWidget,
  }));

  const clearChatContext = useCallback(() => {
    dispatch({ files: [] });

    // Get current widgets before clearing them to handle text cleanup
    const currentWidgets = copilotData.getCopilotWidgets().selectedWidgets || [];

    // Clear all widgets and data
    copilotData.clearSelectedWidgets();

    // Clear the UI state of selected widgets
    copilotData.setCopilotWidgets({ selectedWidgets: [] });

    // Remove each widget's data and its mention from the text
    for (const widget of currentWidgets) {
      if (widget?.uuid) {
        copilotData.removeDataFromDashboardWidget(widget.uuid, true);

        // If this widget was added via @ mention, we need to remove the mention from the text
        if (copilotData.isMentionTrackedWidget?.(widget.uuid)) {
          // Update the command using the global dispatch
          dispatchCopilotCommand((prev) => {
            const updatedText = removeMentionFromText(prev, widget.uuid);
            if (updatedText !== prev) return updatedText;
            return prev;
          });

          copilotData.removeMentionTrackedWidget(widget.uuid);
        }
      }
    }
  }, [dispatch, copilotData, removeMentionFromText]);

  const buttons = useMemo(
    () => (
      <div className="flex gap-0.5 items-center" id="obb-copilot-header-buttons">
        <Tooltip
          message={
            loading
              ? "A new chat cannot be started while the agent is in use. To create a new chat, either stop Ada's messages or wait for Ada to finish responding."
              : "Create a new chat"
          }
          hide={isMobile}
        >
          <button
            disabled={loading}
            onClick={() => {
              const date = Date.now();
              clearChatContext();

              copilot.addChat({
                uuid: uuidv4(),
                label: (() => {
                  const baseLabel = "New Chat";
                  let label = baseLabel;
                  let counter = 1;
                  const existingLabels = copilot
                    .getChatsData()
                    .map((chat) => chat.label);
                  while (existingLabels.includes(label)) {
                    label = `${baseLabel} (${counter})`;
                    counter++;
                  }
                  return label;
                })(),
                createdAt: date,
                messages: [],
                titleManuallyUpdated: false,
                titleNeedsUpdate: true,
                lastOpened: date,
              });
              copilot.setCurrentChat(date);
            }}
            className="obb-small-navbar-btn flex items-center justify-center"
          >
            <Icon id="plus" className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        <Tooltip message="Clear messages from this chat" hide={isMobile}>
          <button
            onClick={() => {
              stopSubmitRef.current?.();
              copilot.resetContent();
              copilot.setTitleNeedsUpdate(copilot.currentChat, true);
              copilot.removeUnreachableArtifacts();

              const currentChatData = copilot.getCurrentChat();
              // only update the title if it hasn't been manually updated by the user
              // and if it's not a new chat already
              if (
                !(
                  currentChatData.titleManuallyUpdated ||
                  currentChatData.label.includes("New Chat")
                )
              ) {
                copilot.updateCopilotLabel(
                  copilot.currentChat,
                  (() => {
                    const baseLabel = "New Chat";
                    let label = baseLabel;
                    let counter = 1;
                    const existingLabels = copilot
                      .getChatsData()
                      .map((chat) => chat.label);
                    while (existingLabels.includes(label)) {
                      label = `${baseLabel} (${counter})`;
                      counter++;
                    }
                    return label;
                  })(),
                );
              }
            }}
            className="obb-small-navbar-btn flex items-center justify-center"
          >
            <Icon id="trash-02" className="h-3.5 w-3.5" />
          </button>
        </Tooltip>
        {!isMobile && (
          <Tooltip
            message={
              copilot.isFullscreen ? "Exit fullscreen (Ctrl+L)" : "Maximize (Ctrl+U)"
            }
          >
            <button
              onClick={() => {
                // Signal that this is a button-triggered change
                // Had to do this to avoid a race condition with the onResize event
                copilot.setIsButtonTriggered(true);
                setTimeout(() => {
                  copilot.setIsButtonTriggered(false);
                }, 1000);

                if (copilot.isFullscreen) {
                  copilot.setIsIntentionallyCollapsed(false);
                }

                // Store last panel state
                copilot.setLastPanelState(copilot.isFullscreen ? "fullscreen" : "open");
                copilot.toggleFullscreen();
              }}
              className="obb-small-navbar-btn flex items-center justify-center"
            >
              <Icon
                id={copilot.isFullscreen ? "minimize-01" : "maximize-01"}
                className="w-3.5 h-3.5"
              />
            </button>
          </Tooltip>
        )}
        <Tooltip
          message={copilot.isFullscreen ? "Close (Ctrl+U)" : "Close (Ctrl+L)"}
          hide={isMobile}
        >
          <button
            onClick={() => dispatchCollapseCopilotPanel()}
            className="obb-small-navbar-btn flex items-center justify-center"
          >
            <Icon id="x-close" className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>
    ),
    [clearChatContext, stopSubmitRef, copilot, loading, isMobile],
  );

  const effectiveFullscreen = copilot.isFullscreen || isMobile;

  return useMemo(
    () => (
      <div
        className={cn(
          "relative z-10",
          effectiveFullscreen && "border-b border-general-border-secondary",
        )}
      >
        <div className="flex flex-col gap-2 px-3 py-[11px]">
          <div
            className={cn(
              "w-full justify-between",
              (expandedHeader || effectiveFullscreen) && "flex items-center gap-2",
            )}
          >
            {effectiveFullscreen ? (
              <div
                className="w-full flex items-center justify-between gap-2"
                id="obb-copilot-header"
              >
                {/* Left: Dashboard Button */}
                <div className="flex items-center gap-2 min-h-[32px] flex-shrink-0 min-w-0">
                  <DashboardButton />
                </div>

                {/* Center: Copilot and Chat */}
                <div className="flex items-center justify-center min-w-0 flex-1">
                  <ChatSelection />
                </div>

                {/* Right: Action Buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0">{buttons}</div>
              </div>
            ) : (
              <div
                className={cn(
                  expandedHeader ? "flex gap-2 w-full" : "",
                  "justify-between",
                )}
                id="obb-copilot-header"
              >
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-1">
                    <ChatSelection />
                  </div>
                  {!expandedHeader && buttons}
                </div>
                <div
                  className={cn(
                    !expandedHeader && "mt-2",
                    "flex gap-1 items-center overflow-x-auto flex-shrink-0",
                  )}
                >
                  {expandedHeader && buttons}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    [buttons, expandedHeader, effectiveFullscreen],
  );
}
const aiCopilotSecFilingsFF = getConfig().copilot.secFilings;

export function CopilotWidgetContext() {
  const copilot = useShallowCopilotDataStore((state) => ({
    selectedWidgets: state.getSelectedWidgetsData(),
    toggleSelectedWidget: state.toggleSelectedWidget,
  }));

  const removeSelectedWidget = useCallback(
    (widgetId: string) => {
      copilot.toggleSelectedWidget(widgetId);
    },
    [copilot.toggleSelectedWidget],
  );

  const elementMemo = useMemo(
    () => (
      <>
        {copilot.selectedWidgets && Object.keys(copilot.selectedWidgets).length > 0 ? (
          <div className="flex gap-2 items-center text-xs">
            <span className="text-ds-text-caption">Context</span>
            <div className="flex gap-1">
              {Object.keys(copilot.selectedWidgets).map((widgetId) => {
                const widget = copilot.selectedWidgets[widgetId];
                if (!widget) return null;
                return (
                  <div
                    key={widgetId}
                    className="p-1.5 rounded bg-general-bg-secondary flex items-center justify-center gap-1 min-w-fit"
                  >
                    {widget.title}
                    <Tooltip message="Remove widget from context">
                      <button onClick={async () => removeSelectedWidget(widgetId)}>
                        <Icon id="circled-cross-icon" className="h-4 w-4 -mb-0.5" />
                      </button>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex gap-2 h-full w-full">
            <Icon
              id="info-circled-icon"
              className="mt-0.5 w-3 h-3 text-extra-purple-100 flex-none"
            />
            <span className="text-ds-text-caption overflow-auto">
              Enable the <Icon id={"message-plus"} className="h-3 w-3 inline" /> icon to
              query specific widgets
              {aiCopilotSecFilingsFF && ", or use @sec to query SEC filings"}.
            </span>
          </div>
        )}
      </>
    ),
    [copilot.selectedWidgets, removeSelectedWidget],
  );

  return elementMemo;
}

export default CopilotHeader;
