import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import {
  type MutableRefObject,
  memo,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { v4 as uuidv4 } from "uuid";
import { WidgetNameItem } from "~/components/AI/WidgetTooltipItem";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { WidgetT } from "~/components/types";
import type { WidgetId } from "~/components/Widgets";
import useIsMobile from "~/hooks/useIsMobile";
import { useCallbackRef } from "~/hooks/useRefHooks";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import {
  type CopilotWidget,
  type HierarchicalMention,
  type Mention,
  useShallowCopilotStore,
} from "~/lib/state/copilot";
import {
  type DashboardWidgetData,
  useShallowCopilotDataStore,
} from "~/lib/state/copilotData";
import { cn } from "~/lib/utils";
import type { TextAreaProps } from "../TextArea";
import { useShallowAppWidgetsStore } from "./useGetAppWidgets";
import { createCopilotWidget } from "./useGetCopilotWidgets";
import { useMentions } from "./useMentions";
import { dispatchCopilotCommand } from "./utils";

type ContextSuggestionsProps = {
  inputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement>;
  suggestionsRef?: RefObject<HTMLDivElement>;
  fromTextArea?: boolean;
  textAreatype?: TextAreaProps["type"];
  setIsDropdownOpen?: (isOpen: boolean) => void;
  onSuggestionClickRef?: MutableRefObject<(suggestion: HierarchicalMention) => void>;
  getSearchQuery?: () => string;
};

function focusCopilotInput() {
  const inputElement = document.getElementById("copilot-input");
  if (inputElement) inputElement.focus();
}

export function useCopilotContextSuggestions(props: ContextSuggestionsProps) {
  const {
    inputRef,
    suggestionsRef,
    fromTextArea = false,
    textAreatype,
    onSuggestionClickRef,
  } = props;
  const isMobile = useIsMobile();
  const setIsDropdownOpen = useCallbackRef((isOpen: boolean) =>
    props.setIsDropdownOpen?.(isOpen),
  );

  const { id: currentDashboardId } = useParams();
  const [searchParams] = useSearchParams();
  const lastInnerTab = useShallowAppStore((state) =>
    state.getLastInnerTab(currentDashboardId),
  );

  const currentInnerTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );
  const copilot = useShallowCopilotDataStore((state) => ({
    selectedWidgets: fromTextArea ? [] : state.copilotWidgets.selectedWidgets,
    toggleSelectedWidget: state.toggleSelectedWidget,
    getCopilotWidgets: state.getCopilotWidgets,
    addMentionTrackedWidget: state.addMentionTrackedWidget,
    setCopilotWidgets: state.setCopilotWidgets,
    addDataOnDashboardWidget: state.addDataOnDashboardWidget,
    getDashboardWidgetData: state.getDashboardWidgetData,
    addPreSelectedWidget: state.addPreSelectedWidget,
  }));

  const { lastUpdated, getAppWidget } = useShallowAppWidgetsStore((s) => ({
    lastUpdated: s.lastUpdated,
    getAppWidget: s.getAppWidget,
  }));

  // Get the tab highlighting function to highlight tabs on hover
  const setHovered = useShallowCopilotStore((state) => state.setHovered);
  // @ Dropdown state
  const [state, dispatch] = useStateReducer<DropdownState>({
    searchQuery: "",
    suggestions: [],
    selectionIndex: 0,
    isDropdownOpen: false,
    pendingSelection: false,
  });

  const resetState = useCallbackRef(() => {
    if (!state.pendingSelection) return;
    dispatch({
      searchQuery: "",
      selectionIndex: 0,
      isDropdownOpen: false,
      pendingSelection: false,
      ...(fromTextArea ? { suggestions: [] } : {}),
    });
    setIsDropdownOpen?.(false);
  });

  const getSearchQuery = useCallbackRef(() => {
    if (props.getSearchQuery) return props.getSearchQuery();

    return inputRef.current?.value || "";
  });

  const { search, removeMentionFromText } = useMentions();

  const searchDebounced = useDebouncedCallback((query: string) => {
    dispatch({ suggestions: search(`@${query}`) });
  }, 500);

  useEffect(() => {
    if (state.isDropdownOpen || fromTextArea) return;
    searchDebounced(state.searchQuery);
  }, [copilot.selectedWidgets, search, state.searchQuery]);

  const searchSuggestions = useCallback(
    (query: string, threshold = 0) => {
      if (query === null || query === undefined) {
        resetState();
        return [];
      }

      const searchQuery = fromTextArea ? query : `@${query}`;
      const suggestions = search(searchQuery, threshold);

      dispatch({
        searchQuery: searchQuery.replace(/^@/, ""),
        suggestions,
        selectionIndex: 0,
        pendingSelection: true,
        ...(!fromTextArea && { isDropdownOpen: true }),
      });
      setIsDropdownOpen?.(true);
      setHovered(); // Clear any previous hover state
      return suggestions;
    },
    [search],
  );

  // Helper function to remove a mention from text by widget UUID
  const handleRemoveMentionFromText = useCallback(
    (widgetUuid: string) => {
      dispatchCopilotCommand((prev) => {
        const updatedText = removeMentionFromText(prev, widgetUuid);
        if (updatedText === prev) return prev; // No change, return original
        return updatedText; // Update command with new text
      });
      queueMicrotask(focusCopilotInput);
    },
    [removeMentionFromText],
  );

  // Filter out widgets that are already selected in context
  const selectedWidgetUuids = useMemo(
    () =>
      new Set(
        copilot.selectedWidgets?.map((widget) => widget.uuid).filter(Boolean) || [],
      ),
    [copilot.selectedWidgets],
  );

  // --- Build lookup for dashboard widget suggestions and fallback builder ---

  // Create hierarchical suggestions when no search query, flat when searching
  const suggestions = useMemo(() => {
    const rawSuggestions = state.suggestions;
    if (rawSuggestions.length === 0) return [];

    const searchQuery = state.searchQuery || "";

    // Filter suggestions by type for hierarchical processing
    const filteredByType = rawSuggestions.filter(
      (suggestion) =>
        suggestion.group === "dashboard" ||
        suggestion.group === "all" ||
        suggestion.group === "tab",
    );

    // Filter out tabs with 0 widgets
    const baseFiltered = filteredByType.filter((suggestion) => {
      // Filter out already selected widgets
      if (
        !fromTextArea &&
        suggestion.content?.uuid &&
        selectedWidgetUuids.has(suggestion.content.uuid)
      ) {
        return false;
      }

      if (
        suggestion.group === "tab" &&
        suggestion.content?.metadata?.widgetCount === 0
      ) {
        return false;
      }
      return true;
    });

    const selectedTabWidgets = copilot.selectedWidgets?.filter((widget) =>
      widget.widget_id?.startsWith("tab_"),
    );

    // Helper: Check if a tab is already selected (as a whole tab entity)
    const selectedTabUuids = new Set(
      selectedTabWidgets.map((widget) => widget.uuid).filter(Boolean),
    );
    const isTabSelected = isTabSelectedFn(selectedTabUuids);
    const isTabFullySelected = isTabFullySelectedFn(selectedWidgetUuids);
    const isParentTabSelected = isParentTabSelectedFn(filteredByType, selectedTabUuids);

    // --- Search mode -----------------------------------------------------
    if (searchQuery.trim()) {
      let filteredResults = baseFiltered;
      if (fromTextArea) {
        filteredResults = baseFiltered.filter((suggestion) => {
          // Filter tabs: exclude if already selected or all widgets individually selected
          if (
            suggestion.group === "tab" &&
            (isTabSelected(suggestion) || isTabFullySelected(suggestion))
          )
            return false;

          // Filter dashboard widgets: exclude if parent tab is selected
          if (
            suggestion.group === "dashboard" &&
            suggestion.content?.uuid &&
            isParentTabSelected(suggestion.content.uuid)
          )
            return false;

          return true;
        });
      }

      const sortedResults = filteredResults.sort((a, b) => {
        // Prioritize tabs over widgets when scores are similar
        if (a.group === "tab" && b.group !== "tab") return -1;
        if (a.group !== "tab" && b.group === "tab") return 1;
        return 0;
      });

      return sortedResults;
    }

    // --- Hierarchical mode ----------------------------------------------
    const tabSuggestions = baseFiltered.filter((s) => {
      // Don't show tab if it's already selected
      // Don't show tab if all its widgets are individually selected
      if (
        s.group === "tab" &&
        !fromTextArea &&
        (isTabSelected(s) || isTabFullySelected(s))
      )
        return false;

      return s.group === "tab";
    });

    const hierarchicalSuggestions: HierarchicalMention[] = [];

    const createHierarchicalCopy = (tabSuggestion: Mention) => {
      hierarchicalSuggestions.push(tabSuggestion);

      // Add widgets from this tab
      const tabWidgets = tabSuggestion.content?.metadata?.tabWidgets || [];
      for (const tabWidget of tabWidgets) {
        if (!tabWidget.uuid) continue;
        // Skip if widget already selected in context
        if (!fromTextArea && selectedWidgetUuids.has(tabWidget.uuid)) continue;
        // Skip if the parent tab of this widget is already selected
        if (!fromTextArea && isParentTabSelected(tabWidget.uuid)) continue;

        const widgetSuggestion = {
          id: `widget_id=${tabWidget.widget_id}&uuid=${tabWidget.uuid}`,
          group: "dashboard" as const,
          trigger: "@",
          // Non-breaking space/hyphen to prevent textarea line breaks
          name: (tabWidget.name || tabWidget.widget_id || "Unnamed widget")
            .replace(/ /g, "\u00A0")
            .replace(/-/g, "\u2011"),
          description: tabWidget.description,
          content: {
            ...tabWidget,
            origin: tabWidget.origin || "OpenBB Sandbox", // Ensure origin is set
          },
          _isChildWidget: true,
          _parentTabId: tabSuggestion.content?.metadata?.innerTabId,
        } as HierarchicalMention;
        hierarchicalSuggestions.push(widgetSuggestion);
      }
    };

    // 2) current tab + its widgets
    const currentTabSuggestion = tabSuggestions.find(
      (tab) => tab.content?.metadata?.innerTabId === currentInnerTab,
    );

    if (currentTabSuggestion) createHierarchicalCopy(currentTabSuggestion);

    const otherTabs = tabSuggestions
      .filter((tab) => tab.content?.metadata?.innerTabId !== currentInnerTab)
      .sort((a, b) => a.name.localeCompare(b.name));

    // 3) other tabs + their widgets
    for (const tabSuggestion of otherTabs) createHierarchicalCopy(tabSuggestion);

    // Collect UUIDs of all widgets that are children of tabs to avoid duplication
    const tabChildWidgetUuids = new Set<string>();
    if (!fromTextArea) {
      const addTabChildWidgetUuids = addTabChildWidgetUuidsFn(tabChildWidgetUuids);

      // Add UUIDs from current tab widgets
      if (currentTabSuggestion) addTabChildWidgetUuids(currentTabSuggestion.content);

      // Add UUIDs from other tab widgets
      for (const suggestion of otherTabs) addTabChildWidgetUuids(suggestion.content);

      // CRITICAL: Also add UUIDs from selected tabs (which are not in suggestion lists anymore)
      // This prevents widgets from selected tabs appearing in dashboard widgets section
      for (const selectedTab of selectedTabWidgets) addTabChildWidgetUuids(selectedTab);
    }

    // 4) widgets from dashboard when there are no tabs (Overview widgets)
    let dashboardWidgetsNoTab: HierarchicalMention[] = [];
    if (tabSuggestions.length === 0 || !fromTextArea) {
      dashboardWidgetsNoTab = baseFiltered
        .filter((s) => {
          if (!fromTextArea && s.group === "dashboard") {
            if (!s.content?.uuid) return true;
            // Filter out widgets that are already included as children of tabs
            const notIncluded = !(
              s.content?.uuid && tabChildWidgetUuids.has(s.content.uuid)
            );
            return !isParentTabSelected(s.content.uuid) && notIncluded;
          }
          return s.group === "dashboard";
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const widget of dashboardWidgetsNoTab) {
        if (!hierarchicalSuggestions.some((s) => s.id === widget.id))
          hierarchicalSuggestions.push(widget);
      }
    }

    const allWidgets = baseFiltered
      .filter((s) => {
        if (!fromTextArea && s.group === "all")
          return !dashboardWidgetsNoTab.some((d) => d.id === s.id);
        return s.group === "all";
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    // 5) widgets not yet on dashboard (all group) – skip ones we already added above
    for (const widget of allWidgets) hierarchicalSuggestions.push(widget);

    return hierarchicalSuggestions;
  }, [state.suggestions, selectedWidgetUuids, state.searchQuery, currentInnerTab]);

  const getRichWidgetTooltip = useCallback(
    (data: CopilotWidget | HierarchicalMention, withTooltip = true) => {
      const { widget, name, isTab, isMention } = getSuggestionInfo(data);
      if (isMention && !widget) return name;

      // Check if this is a tab entity (widget_id starts with "tab_")
      const title = widget.name || "";

      if (isTab && widget.metadata) {
        // Handle tab tooltip - show widgets within the tab
        const id = widget.uuid || uuidv4();

        const element = (
          <TabGroupElement
            widget={widget}
            getAppWidget={getAppWidget}
            onMouseEnter={(tabId) => {
              // Highlight all widgets in the tab when hovering over the tab tooltip
              if (tabId) {
                setHovered({ tabId });
              }
            }}
            onMouseLeave={() =>
              // Clear highlighting when leaving tab tooltip
              setHovered()
            }
            onWidgetMouseEnter={(widgetUuid) => {
              // Highlight widget regardless of which tab is currently active (cross-tab highlighting)
              if (widgetUuid) {
                // Clear tab highlighting and set specific widget highlighting
                setHovered({ widgetUuid });
              }
            }}
            onWidgetMouseLeave={() => {
              // When leaving a widget: clear individual highlighting but DON'T restore tab highlighting
              // This prevents the flickering effect when moving between widgets
              setHovered();
            }}
          />
        );

        if (fromTextArea || !withTooltip) return element;

        return (
          <Tooltip
            id={`tab-tooltip-${id}`}
            key={`tab-tooltip-${id}`}
            position="top"
            message={element}
          >
            <div className="flex items-center gap-2" key={`tab-${id}`}>
              <Icon id="folder-closed" className="w-3 h-3" />
              <span className="truncate max-w-[10rem]">{title}</span>
            </div>
          </Tooltip>
        );
      }

      const description = widget.description || "";
      const widgetId = widget.widget_id || "";

      // Regular widget tooltip
      const widgetDefinition = getAppWidget(widgetId as WidgetId);

      // Check if this is a multi-file viewer widget
      const isMultiFileViewer = widgetDefinition?.type === "multi_file_viewer";
      let displayTitle = title;
      let extraElements: React.ReactNode = null;

      if (isMultiFileViewer) {
        // Find the file selector parameter
        const fileSelectorParam = widgetDefinition.params?.find((param) => {
          return param?.roles?.includes("fileSelector");
        });

        if (fileSelectorParam) {
          // Get the selected files from widget params
          const filesParam = widget.params?.find(
            (p) => p.name === fileSelectorParam.paramName,
          );
          const files = (filesParam?.current_value as string[]) || [];

          // Update display title to include file count
          if (files.length > 0) {
            displayTitle = `${title} (${files.length})`;
            extraElements = (
              <>
                <div className="text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90] mb-2 mt-3">
                  FILES ({files.length})
                </div>
                <hr className="border-[#EBEBED] dark:border-[#454550] mb-2" />
                <div className="max-h-[100px] overflow-y-auto">
                  <div className="text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90] flex flex-col gap-1">
                    {files.map((file, index) => (
                      <div key={index} className="truncate max-w-[10rem] text-ellipsis">
                        {file}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          }
        }
      }

      const element = title ? (
        <TabWidgetElement
          tabWidget={widget}
          widgetDefinition={widgetDefinition}
          extraElements={extraElements}
        />
      ) : (
        <span>{description || "Widget"}</span>
      );

      if (fromTextArea || !withTooltip) return element;

      return (
        <Tooltip
          id={`widget-tooltip-${widget.uuid || widgetId}`}
          key={`widget-tooltip-${widget.uuid || widgetId}`}
          position="top"
          message={element}
        >
          <span className="truncate max-w-[10rem]">{displayTitle}</span>
        </Tooltip>
      );
    },
    [getAppWidget, lastUpdated, currentDashboardId, currentInnerTab, fromTextArea],
  );

  // Virtualizer scroll handle — populated by VirtualizedSuggestionList on mount.
  // Lets keyboard navigation scroll the active suggestion into view without DOM lookups.
  const virtualizerScrollRef = useRef<((index: number) => void) | null>(null);

  // Enhanced handleSelection with verification
  const handleSelection = useCallbackRef(async (suggestion: HierarchicalMention) => {
    if (textAreatype === "promptDialog") return resetState();

    // Verify suggestion integrity
    if (!verifySuggestionIntegrity(suggestion, "Click selection")) return;

    // Clean up any hierarchical properties before processing
    suggestion._isChildWidget = undefined;
    suggestion._parentTabId = undefined;

    const selectedWidgets = copilot.getCopilotWidgets().selectedWidgets || [];

    const updates = {
      uuid: suggestion.content?.uuid,
      trackedWidget: null as Action | null,
      toggleSelected: false,
      preSelectedWidget: null as Action | null,
      addDataOnDashboardWidget: null as DashboardWidgetData | null,
      addSelectedWidget: null as CopilotWidget | null,
    };

    const isAlreadyInContext =
      suggestion.content?.uuid &&
      selectedWidgets?.some((w) => w.uuid === suggestion.content.uuid);

    // Handle tab mentions - add the tab itself as a single entity to context
    if (suggestion.group === "tab" && suggestion.content) {
      if (isAlreadyInContext && fromTextArea) {
        updates.preSelectedWidget = copilot.addPreSelectedWidget;
      } else if (!isAlreadyInContext) {
        // Add the tab widget directly to the selectedWidgets array for immediate UI display
        updates.addSelectedWidget = suggestion.content;
        // IMPORTANT: Also add to selectedWidgetIDs for persistence across messages
        updates.toggleSelected = true;
        // CRITICAL: Add tab widget to dashboardWidgetsData so it persists through useGetCopilotWidgets rebuilds
        updates.addDataOnDashboardWidget = {
          title: suggestion.content.name,
          description: suggestion.content.description,
          metadata: {
            ...suggestion.content.metadata,
            widgetId: suggestion.content.widget_id, // Include widgetId for tab detection
            name: suggestion.content.name,
          },
          data: null, // Tab widgets don't have data
        };
        if (fromTextArea) {
          // NOTE: We don't add to mention tracking here - tabs added via @ button persist after submit
          updates.trackedWidget = copilot.addMentionTrackedWidget;
        } else {
          // Mark tab as pre-selected since it was added via CopilotContext @ button
          updates.preSelectedWidget = copilot.addPreSelectedWidget;
        }
      }
    }
    // Handle widgets from "all" group (workspace widgets not on dashboard)
    else if (
      suggestion.group === "all" &&
      suggestion.content &&
      !suggestion.content.uuid
    ) {
      try {
        if (!currentDashboardId) {
          queueMicrotask(focusCopilotInput);
          resetState();
          return toast.warning("Not in a dashboard", {
            description:
              "Since you are not in a dashboard, you won't be able to add the tagged widget to one.",
          });
        }

        // Retrieve original widget definition
        const widgetId = suggestion.content.widget_id;
        const originalWidget = getAppWidget(widgetId as WidgetId);

        if (!originalWidget)
          throw new Error(`Widget definition not found for widgetId: ${widgetId}`);

        // Create real widget instance and add to dashboard
        const virtualWidgetUuid = uuidv4();
        updates.uuid = virtualWidgetUuid;

        const widgetToAdd = {
          ...originalWidget,
          id: virtualWidgetUuid,
          innerTab: currentInnerTab || "",
        } as WidgetT;

        // Build a Copilot-compatible widget object
        const virtualWidget = createCopilotWidget(virtualWidgetUuid, widgetToAdd);
        // 1. Surface it immediately in the Copilot context UI
        updates.addSelectedWidget = virtualWidget;
        // Track in copilot context
        updates.toggleSelected = true;
        if (fromTextArea) {
          // NOTE: We don't add to mention tracking here - tabs added via @ button persist after submit
          updates.trackedWidget = copilot.addMentionTrackedWidget;
        } else {
          // Mark tab as pre-selected since it was added via CopilotContext @ button
          updates.preSelectedWidget = copilot.addPreSelectedWidget;
        }
        updates.addDataOnDashboardWidget = {
          title: widgetToAdd.name,
          description: widgetToAdd.description || "",
          metadata: { widget_id: virtualWidget.widget_id, name: virtualWidget.name },
          data: null,
        };

        // Show badge immediately
        updates.addSelectedWidget = {
          origin: suggestion.content.origin ?? "OpenBB Sandbox",
          widget_id: suggestion.content.widget_id,
          uuid: virtualWidgetUuid,
          name: widgetToAdd.name,
          description: widgetToAdd.description ?? "",
          params: suggestion.content.params ?? [],
          metadata: widgetToAdd.metadata ?? {},
        };

        if (fromTextArea) {
          // Inform the user with an info toast & CTA to add widget
          toast.info("Add widget to dashboard", {
            description: `Add "${suggestion.content.name}" to your dashboard.`,
            action: {
              label: "Add widget",
              onClick: () => {
                if (!currentDashboardId) {
                  toast.warning("Not in a dashboard", {
                    description:
                      "Since you are not in a dashboard, you won't be able to add the tagged widget to one.",
                  });
                  return;
                }

                useAppStore.getState().addWidget(currentDashboardId, widgetToAdd);
                toast.success("Widget added to dashboard", {
                  id: `copilot-add-widget-${virtualWidgetUuid}`,
                  description: `"${suggestion.content.name}" has been added to your dashboard and Copilot context.`,
                });
              },
            },
          });
        } else {
          useAppStore.getState().addWidget(currentDashboardId, widgetToAdd);
          toast.success("Widget added to dashboard", {
            id: `copilot-add-widget-${virtualWidgetUuid}`,
            description: `"${widgetToAdd.name}" has been added to your dashboard and Copilot context.`,
          });
        }
      } catch (error) {
        toast.error("Failed to add widget", {
          description: "There was an error while adding the widget to the dashboard.",
        });
      }
    }
    // Handle regular widget selections (including hierarchical child widgets with UUIDs)
    else if (
      suggestion.content?.uuid &&
      (!fromTextArea || suggestion.group === "dashboard" || suggestion.group === "all")
    ) {
      if (isAlreadyInContext && fromTextArea) {
        // If widget was already in context, mark it as pre-selected so it persists after submit
        updates.preSelectedWidget = copilot.addPreSelectedWidget;
      } else if (!isAlreadyInContext) {
        // Check if widget has dashboardWidgetsData (for cross-tab widgets)
        const dashboardWidgetData = copilot.getDashboardWidgetData(
          suggestion.content.uuid,
        );

        // If widget doesn't have dashboardWidgetsData (widgets from other tabs), create it
        if (!dashboardWidgetData && (!fromTextArea || suggestion._isChildWidget)) {
          // Create dashboardWidgetsData entry for this widget
          updates.addDataOnDashboardWidget = {
            title: suggestion.content.name,
            description: suggestion.content.description || "",
            metadata: suggestion.content.metadata || {},
            data: null, // Widget data will be populated when needed
          };
        }

        // Also toggle it in the selectedWidgetIDs set
        updates.toggleSelected = true;
        if (fromTextArea) {
          // Track via mention-tracking ONLY if the widget wasn't already in context.
          updates.trackedWidget = copilot.addMentionTrackedWidget;
          // Add widget to selectedWidgets array for immediate UI display
          updates.addSelectedWidget = suggestion.content;
        } else {
          // Mark widget as pre-selected since it was added via CopilotContext @ button
          updates.preSelectedWidget = copilot.addPreSelectedWidget;
        }
      }
    }

    // If we have updates, apply them
    if (updates.addSelectedWidget)
      copilot.setCopilotWidgets({
        selectedWidgets: [
          ...(copilot.getCopilotWidgets().selectedWidgets || []),
          updates.addSelectedWidget,
        ],
      });

    if (updates.addDataOnDashboardWidget)
      copilot.addDataOnDashboardWidget(updates.uuid, updates.addDataOnDashboardWidget);

    updates.toggleSelected && copilot.toggleSelectedWidget(updates.uuid);
    updates.preSelectedWidget?.(updates.uuid);
    updates.trackedWidget?.(updates.uuid);

    queueMicrotask(focusCopilotInput); // Focus the input after selection
    resetState();
    setHovered(); // Clear hovered state after selection
  });

  const handleKeyDown = useCallbackRef((e: React.KeyboardEvent) => {
    const fromContextButton = !fromTextArea;
    if (!state.isDropdownOpen && fromContextButton) return;

    if (suggestions.length === 0) {
      if (e.key === "Escape") {
        e.preventDefault();
        resetState();
        setHovered();
      }
      return;
    }
    let newIndex = null;
    const currentIndex = state.selectionIndex % suggestions?.length;
    const arrLength = suggestions.length;
    if (e.key === "Space" && fromTextArea) return suggestions[currentIndex];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      newIndex = currentIndex === arrLength - 1 ? 0 : state.selectionIndex + 1;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      newIndex = currentIndex === 0 ? suggestions.length - 1 : state.selectionIndex - 1;
    } else if (e.key === "Enter" || (fromTextArea && e.key === "Tab")) {
      e.preventDefault();
      e.stopPropagation();

      if (suggestions[state.selectionIndex]) {
        const currentSuggestion = suggestions[state.selectionIndex];

        if (verifySuggestionIntegrity(currentSuggestion, "Keyboard selection")) {
          if (!fromTextArea) handleSelection(currentSuggestion);
          return currentSuggestion;
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      resetState();
      setHovered();
    }

    if (newIndex !== null) {
      const currentSuggestion = suggestions[newIndex];
      // Scroll the virtualized list to the new index
      virtualizerScrollRef.current?.(newIndex);
      // Update selection immediately
      dispatch({ selectionIndex: newIndex });
      const hoveredUpdate = { tabId: null, widgetUuid: null };
      // Handle highlighting based on suggestion type
      if (
        currentSuggestion?.group === "tab" &&
        currentSuggestion.content?.metadata?.innerTabId
      ) {
        hoveredUpdate.tabId = currentSuggestion.content.metadata.innerTabId;
      } else if (currentSuggestion?.content?.uuid) {
        hoveredUpdate.widgetUuid = currentSuggestion.content.uuid;
      }

      setHovered(hoveredUpdate);
    }
  });

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the button and the dropdown
      if (suggestionsRef.current && !suggestionsRef.current.contains(target)) {
        resetState();
        if (!fromTextArea && inputRef.current)
          // Focus the search input when closing dropdown
          inputRef.current.value = "";
      }
    },
    [inputRef, suggestionsRef, resetState],
  );

  // Reset state when clicking outside
  useEffect(() => {
    const ctrl = new AbortController();
    document.addEventListener("mousedown", handleClickOutside, {
      signal: ctrl.signal,
      passive: true,
    });
    return () => ctrl.abort();
  }, [inputRef, suggestionsRef]);

  const suggestionElements = useMemo(
    () => (
      <MentionVirtualList
        suggestions={suggestions}
        selectionIndex={state.selectionIndex}
        searchQuery={state.searchQuery}
        fromTextArea={fromTextArea}
        isMobile={isMobile}
        getRichWidgetTooltip={getRichWidgetTooltip}
        handleSelection={handleSelection}
        onSuggestionClickRef={onSuggestionClickRef}
        dispatch={dispatch}
        setHovered={setHovered}
        virtualizerScrollRef={virtualizerScrollRef}
      />
    ),
    [
      suggestions,
      state.selectionIndex,
      state.searchQuery,
      fromTextArea,
      isMobile,
      getRichWidgetTooltip,
      handleSelection,
      onSuggestionClickRef,
      dispatch,
      setHovered,
    ],
  );

  return {
    handleRemoveMentionFromText,
    searchSuggestions,
    getRichWidgetTooltip,
    suggestions,
    suggestionElements,
    handleKeyDown,
    handleSelection,
  };
}

type MentionVirtualListProps = {
  suggestions: HierarchicalMention[];
  selectionIndex: number;
  searchQuery: string;
  fromTextArea: boolean;
  isMobile: boolean;
  getRichWidgetTooltip: (
    data: CopilotWidget | HierarchicalMention,
    withTooltip?: boolean,
  ) => React.ReactNode;
  handleSelection: (suggestion: HierarchicalMention) => void;
  onSuggestionClickRef?: MutableRefObject<(suggestion: HierarchicalMention) => void>;
  dispatch: (update: Partial<DropdownState>) => void;
  setHovered: (update?: { tabId?: string | null; widgetUuid?: string | null }) => void;
  virtualizerScrollRef: MutableRefObject<((index: number) => void) | null>;
};

const MentionVirtualList = memo((props: MentionVirtualListProps) => {
  const {
    suggestions,
    selectionIndex,
    searchQuery,
    fromTextArea,
    isMobile,
    getRichWidgetTooltip,
    handleSelection,
    onSuggestionClickRef,
    dispatch,
    setHovered,
    virtualizerScrollRef,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: suggestions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 8,
    getItemKey: (index) => suggestions[index]?.id ?? index,
  });

  useEffect(() => {
    virtualizerScrollRef.current = (index) =>
      virtualizer.scrollToIndex(index, { align: "auto" });
    return () => {
      virtualizerScrollRef.current = null;
    };
  }, [virtualizer, virtualizerScrollRef]);

  if (suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-light-500 dark:text-dark-50 text-sm">
        No widgets or tabs found
      </div>
    );
  }

  const prefix = fromTextArea ? "" : "context-";
  const itemClassName = fromTextArea ? "suggestion-item" : "context-suggestion-item";
  const trimmedQuery = searchQuery.trim();

  return (
    <div ref={scrollRef} className="overflow-y-auto max-h-[300px]">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const suggestion = suggestions[virtualRow.index];
          if (!suggestion) return null;
          const previousSuggestion = suggestions[virtualRow.index - 1];

          let showDividerAbove = false;
          if (trimmedQuery) {
            if (
              virtualRow.index > 0 &&
              suggestion.group !== previousSuggestion?.group
            ) {
              showDividerAbove = true;
            }
          } else if (virtualRow.index > 0) {
            const prevIsChild = previousSuggestion?._isChildWidget;
            const currentIsChild = suggestion._isChildWidget;
            if (prevIsChild && !currentIsChild && suggestion.group !== "tab") {
              showDividerAbove = true;
            } else if (
              suggestion.group === "all" &&
              previousSuggestion?.group !== "all"
            ) {
              showDividerAbove = true;
            }
          }

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MentionSuggestionItem
                suggestion={suggestion}
                index={virtualRow.index}
                isSelected={virtualRow.index === selectionIndex}
                showDividerAbove={showDividerAbove}
                prefix={prefix}
                itemClassName={itemClassName}
                isMobile={isMobile}
                getRichWidgetTooltip={getRichWidgetTooltip}
                handleSelection={handleSelection}
                onSuggestionClickRef={onSuggestionClickRef}
                dispatch={dispatch}
                setHovered={setHovered}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

type MentionSuggestionItemProps = {
  suggestion: HierarchicalMention;
  index: number;
  isSelected: boolean;
  showDividerAbove: boolean;
  prefix: string;
  itemClassName: string;
  isMobile: boolean;
  getRichWidgetTooltip: (
    data: CopilotWidget | HierarchicalMention,
    withTooltip?: boolean,
  ) => React.ReactNode;
  handleSelection: (suggestion: HierarchicalMention) => void;
  onSuggestionClickRef?: MutableRefObject<(suggestion: HierarchicalMention) => void>;
  dispatch: (update: Partial<DropdownState>) => void;
  setHovered: (update?: { tabId?: string | null; widgetUuid?: string | null }) => void;
};

const MentionSuggestionItem = memo((props: MentionSuggestionItemProps) => {
  const {
    suggestion,
    index,
    isSelected,
    showDividerAbove,
    prefix,
    itemClassName,
    isMobile,
    getRichWidgetTooltip,
    handleSelection,
    onSuggestionClickRef,
    dispatch,
    setHovered,
  } = props;

  const icon = ICON_MAP[suggestion.group] ?? "question-circled-icon";
  const isChildWidget = suggestion._isChildWidget;

  const tooltipMessage = useMemo(
    () => getRichWidgetTooltip(suggestion, false),
    [suggestion, getRichWidgetTooltip],
  );

  return (
    <div className="relative w-full">
      {showDividerAbove && (
        <hr className="w-[calc(100%-0.75rem)] mx-auto h-px border-0 bg-surface-divider" />
      )}
      <Tooltip
        className="min-w-[8rem]"
        key={`${prefix}suggestion-tooltip-${index}`}
        id={`${prefix}suggestion-tooltip-${index}`}
        message={tooltipMessage}
        position="left"
        hide={isMobile}
      >
        <div
          id={`${prefix}suggestion-${index}`}
          className={cn(
            "py-1.5 h-full w-full cursor-pointer",
            itemClassName,
            "hover:bg-general-bg-secondary-hover",
            {
              "px-3": !isChildWidget,
              "px-3 pl-7": isChildWidget,
              "bg-general-bg-secondary-hover": isSelected,
            },
          )}
          onMouseEnter={(e) => {
            e.stopPropagation();
            dispatch({ selectionIndex: index });
            const hoveredUpdate: {
              tabId: string | null;
              widgetUuid: string | null;
            } = { tabId: null, widgetUuid: null };
            if (suggestion.group === "tab" && suggestion.content?.uuid) {
              hoveredUpdate.tabId = suggestion.content.metadata?.innerTabId ?? null;
            } else if (suggestion.content?.uuid) {
              hoveredUpdate.widgetUuid = suggestion.content.uuid;
            }
            setHovered(hoveredUpdate);
          }}
          onMouseLeave={() => setHovered()}
          onClick={(e) => {
            e.stopPropagation();
            if (onSuggestionClickRef?.current)
              return onSuggestionClickRef.current(suggestion);
            handleSelection(suggestion);
          }}
        >
          <WidgetNameItem
            name={suggestion.name}
            description={suggestion.description}
            icon={icon}
            iconClassName={cn("text-dark-50", {
              "text-brand-lighter":
                suggestion.group === "dashboard" || suggestion.group === "tab",
            })}
          />
        </div>
      </Tooltip>
    </div>
  );
});

interface SuggestionElementProps {
  onMouseEnter?: (tabId?: string) => void;
  onMouseLeave?: () => void;
}

interface TabGroupElementProps extends SuggestionElementProps {
  widget: CopilotWidget;
  getAppWidget: (widgetId: WidgetId) => WidgetT | undefined;
  onWidgetMouseEnter?: (widgetUuid?: string) => void;
  onWidgetMouseLeave?: () => void;
}

export const TabGroupElement = memo((props: TabGroupElementProps) => {
  const {
    widget,
    getAppWidget,
    onMouseEnter,
    onWidgetMouseEnter,
    onMouseLeave,
    onWidgetMouseLeave,
  } = props;

  const localId = useId();
  const id = widget.uuid || localId;
  const { widgetCount = 0, tabWidgets = [] } = useMemo(
    () => widget.metadata || {},
    [widget.metadata],
  );

  return (
    <div
      key={`tab-tooltip-content-${id}`}
      className="max-w-[320px]"
      onMouseEnter={(e) => {
        e.stopPropagation();
        onMouseEnter?.(widget.metadata?.innerTabId);
      }}
      onMouseLeave={onMouseLeave}
    >
      {/* Header with name and count - hovering here highlights all widgets */}
      <div
        className="flex items-center justify-between mb-4"
        onMouseEnter={() => onMouseEnter?.(widget.metadata?.innerTabId)}
      >
        <div className="font-bold text-[12px] leading-[18px] text-[#070707] dark:text-white">
          {widget.name}
        </div>
        <span className="text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#909094]">
          ({widgetCount} widget{widgetCount !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Widget list - hovering individual items highlights only that widget */}
      <div className="max-h-[200px] overflow-y-auto space-y-3">
        {tabWidgets.map((tabWidget, index) => (
          <TabWidgetElement
            key={`tab-widgets-${tabWidget.uuid || localId}-${index}`}
            className="text-xs bg-light-100 dark:bg-dark-700 rounded-sm p-3 transition-colors
            hover:bg-light-200 dark:hover:bg-dark-600"
            index={index}
            tabWidget={tabWidget}
            widgetDefinition={getAppWidget(tabWidget.widget_id as WidgetId)}
            onMouseEnter={onWidgetMouseEnter}
            onMouseLeave={onWidgetMouseLeave}
          />
        ))}
      </div>
    </div>
  );
});

interface TabWidgetElementProps extends SuggestionElementProps {
  tabWidget: CopilotWidget;
  className?: string;
  widgetDefinition?: WidgetT;
  index?: number;
  extraElements?: React.ReactNode;
}

export const TabWidgetElement = memo((props: TabWidgetElementProps) => {
  const {
    index = "",
    className = "max-w-[296px]",
    tabWidget,
    widgetDefinition,
    onMouseEnter,
    onMouseLeave,
    extraElements = null,
  } = props;
  const localId = useId();
  const id = tabWidget.uuid || localId;

  // Get widget definition if available
  const widgetInfo = useMemo(() => {
    const widgetId = tabWidget.widget_id || "";

    // Extract metadata
    const title = tabWidget.name || widgetId || "Unnamed widget";
    const description = tabWidget.description || "";
    const category = widgetDefinition?.category || "";

    const backend = widgetDefinition?.external
      ? widgetDefinition?.connectionType === "advanced-backend"
        ? widgetDefinition?.sourceName || "Unknown"
        : "OpenBB API"
      : tabWidget.origin || "OpenBB Sandbox";

    const subCategory = widgetDefinition?.subCategory || "";
    const source = widgetDefinition?.source || "";

    return {
      title,
      description,
      category,
      subCategory,
      backend,
      source,
    };
  }, [tabWidget, widgetDefinition]);

  return (
    <div
      key={`tab-widget-${id}-${index}`}
      className={className}
      onMouseEnter={(e) => {
        e.stopPropagation();
        onMouseEnter?.(tabWidget.uuid);
      }}
      onMouseLeave={onMouseLeave}
    >
      {/* Header row with backend tag and source */}
      <div className="flex justify-between items-center gap-2 mb-2.5 min-w-0">
        <Tooltip message={widgetInfo.backend} position="top">
          <div className="bg-[rgba(188,188,188,0.3)] dark:bg-[rgba(90,89,97,0.3)] rounded-xl min-w-0 max-w-[140px]">
            <div className="px-1.5 py-0">
              <span className="block truncate whitespace-nowrap text-2xs leading-[1.5] text-[#717177] dark:text-[#b8b9bc]">
                {widgetInfo.backend}
              </span>
            </div>
          </div>
        </Tooltip>
        {widgetInfo.source && (
          <Tooltip message={widgetInfo.source} position="top">
            <span className="block truncate whitespace-nowrap min-w-0 max-w-[140px] text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90]">
              {widgetInfo.source}
            </span>
          </Tooltip>
        )}
      </div>

      {/* Widget title/name */}
      <div className="font-bold text-[12px] leading-[18px] text-[#070707] dark:text-white mb-2">
        {widgetInfo.title}
      </div>

      {/* Horizontal line */}
      <hr className="border-[#EBEBED] dark:border-[#454550] mb-2" />

      {/* Category and subcategory */}
      {(widgetInfo.category || widgetInfo.subCategory) && (
        <div className="text-2xs leading-[1.5] text-[#6d6e74] dark:text-[#8a8a90] mb-1">
          {[widgetInfo.category, widgetInfo.subCategory].filter(Boolean).join(" • ")}
        </div>
      )}

      {/* Description */}
      {widgetInfo.description && (
        <div className="text-[12px] leading-[18px] text-[#151518] dark:text-white mt-2 max-h-[150px] overflow-y-auto">
          {widgetInfo.description}
        </div>
      )}

      {/* Extra elements (e.g. Multi-file viewer files section) */}
      {extraElements}
    </div>
  );
});

export const ICON_MAP = {
  all: "file-plus-03",
  dashboard: "file-check-03",
  web: "globe-01",
  sec: "search-refraction",
  tab: "folder-closed",
} as const;

type ExtraWidgetsSelectButtonProps = {
  enabled: boolean;
  onToggle: () => void;
  buttonEnabled?: boolean;
};
type Action = (uuid: string) => void;

export const ExtraWidgetsSelectButton = (props: ExtraWidgetsSelectButtonProps) => {
  const { enabled, onToggle, buttonEnabled = true } = props;
  return (
    <Tooltip
      message={
        buttonEnabled
          ? "Search across widgets and tabs"
          : "Searching across all widgets is not enabled for this copilot."
      }
    >
      <button
        disabled={!buttonEnabled}
        onClick={onToggle}
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded transition-colors duration-200 min-w-6",
          {
            "opacity-25": !buttonEnabled,
            "bg-brand-main border-brand-main text-white": enabled,
            "text-light-700 dark:text-light-300 hover:bg-light-100 dark:border-dark-400 dark:hover:bg-dark-400":
              !enabled && buttonEnabled,
          },
        )}
      >
        <Icon id="layout-top" className="text-lg" />
      </button>
    </Tooltip>
  );
};

interface DropdownState {
  searchQuery: string;
  suggestions: HierarchicalMention[];
  selectionIndex: number;
  isDropdownOpen: boolean;
  pendingSelection: boolean;
}

// Helper function to highlight the current selection in the dropdown
export const highlightSelection = (index: number, fromTextArea = false) => {
  const allElements = document.getElementsByClassName(
    `${fromTextArea ? "" : "context-"}suggestion-item`,
  );
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    el?.classList?.toggle("bg-light-100", i === index);
    el?.classList?.toggle("dark:bg-dark-500", i === index);
  }
};

// Helper function to scroll to the current selection - instant scrolling for responsive navigation
export const scrollToSuggestion = (index: number, fromTextArea = false) => {
  const element = document.getElementById(
    `${fromTextArea ? "" : "context-"}suggestion-${index}`,
  );
  element?.scrollIntoView?.({
    block: "nearest",
    behavior: "instant", // Changed from "smooth" to "instant" for rapid key navigation
    inline: "nearest",
  });

  highlightSelection(index, fromTextArea);
};

export function getSelectionIndex(fromTextArea: boolean) {
  const allElements = document.getElementsByClassName(
    `${fromTextArea ? "" : "context-"}suggestion-item`,
  );
  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i] as HTMLElement;
    if (
      el?.classList?.contains("bg-light-100") &&
      el?.classList?.contains("dark:bg-dark-500")
    ) {
      return i;
    }
  }

  return 0; // No selection found
}

// Verify that suggestions maintain proper data integrity for both mouse and keyboard interactions
const verifySuggestionIntegrity = (suggestion: any, _actionType: string) => {
  // Ensure suggestion has required properties
  if (!suggestion.content) return false;
  // Special case: "all" group widgets don't have UUIDs yet (they'll be created)
  if (suggestion.group === "all" && !suggestion.content.uuid) {
    // For "all" group widgets, we just need the widget_id to create them
    if (!suggestion.content.widget_id) return false;
    return true;
  }
  // For other groups (tab, dashboard), UUID is required
  if (!suggestion.content.uuid) return false;
  return true;
};

// Helper: Check if a widget is already selected (as an individual widget)
function isTabSelectedFn(selectedTabUuids: Set<string>) {
  return (suggestion: Mention) =>
    suggestion.content?.uuid && selectedTabUuids.has(suggestion.content.uuid);
}

// Helper: Check if all widgets from a tab are individually selected
function isTabFullySelectedFn(selectedWidgetUuids: Set<string>) {
  return (tabSuggestion: Mention) => {
    const tabWidgets = tabSuggestion.content?.metadata?.tabWidgets || [];
    if (tabWidgets.length === 0) return false;

    return tabWidgets.every(
      (tabWidget) => tabWidget.uuid && selectedWidgetUuids.has(tabWidget.uuid),
    );
  };
}

// Helper: Check if a widget's parent tab is already selected
function isParentTabSelectedFn(
  filteredByType: Mention[],
  selectedTabUuids: Set<string>,
) {
  return (widgetUuid: string) => {
    // Find which tab this widget belongs to - search in filteredByType not baseFiltered
    // because baseFiltered excludes selected tabs but we need to find them to check parent relationship
    const parentTab = filteredByType.find((suggestion) => {
      if (suggestion.group !== "tab") return false;
      const tabWidgets = suggestion.content?.metadata?.tabWidgets || [];
      return tabWidgets.some((tabWidget) => tabWidget.uuid === widgetUuid);
    });

    if (!parentTab?.content?.uuid) return false;
    return selectedTabUuids.has(parentTab.content.uuid);
  };
}

// Helper: Add UUIDs of widgets that are children of tabs
function addTabChildWidgetUuidsFn(tabChildWidgetUuids: Set<string>) {
  return (copilotWidget: CopilotWidget) => {
    const tabWidgets = copilotWidget?.metadata?.tabWidgets || [];
    for (const tabWidget of tabWidgets)
      if (tabWidget.uuid) tabChildWidgetUuids.add(tabWidget.uuid);
  };
}

function getSuggestionInfo(suggestion: CopilotWidget | HierarchicalMention) {
  if ("content" in suggestion && suggestion.content) {
    return {
      widget: suggestion.content,
      name: suggestion.content?.name || suggestion.name,
      isTab: suggestion.group === "tab",
      isMention: true,
    } as const;
  }

  const widget = suggestion as CopilotWidget;

  return {
    widget: widget,
    name: widget.name,
    isTab: widget.widget_id?.startsWith("tab_"),
    isMention: false,
  } as const;
}
