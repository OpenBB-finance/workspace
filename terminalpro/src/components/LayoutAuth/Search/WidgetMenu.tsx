import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import {
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import { v4 as uuidv4 } from "uuid";
import { Button } from "~/components/ds/atoms/Button";
import { Checkbox as DsCheckbox } from "~/components/ds/atoms/Checkbox";
import { Input } from "~/components/ds/atoms/Input";
import { Select } from "~/components/ds/atoms/Select";
import { Checkbox } from "~/components/Forms/Checkbox";
import BrandedLoadingState from "~/components/General/BrandedLoadingState";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";
import WidgetInfoTooltip from "~/components/General/WidgetInfoTooltip";
import Icon from "~/components/Icon";
import Tooltip from "~/components/Tooltip";
import type { WidgetT } from "~/components/types";
import type { StateDispatch } from "~/hooks/useStateReducer";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useMobile } from "~/lib/providers/MobileProvider";
import { useAppStore, useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowThemeStore } from "~/lib/state/theme";
import { useShallowTutorialStore } from "~/lib/state/tutorial";
import { beautifySlug, cn, generateRandomName, getWidgetSourceInfo } from "~/lib/utils";
import type { SearchDialogState, SearchTabId } from "./SearchDialog";
import CopilotPromptBanner from "./useCopilotPrompt";

export const connectorTypes = [
  "backend",
  "file",
  "single",
  "snowflake",
  "database",
  "copilot_table",
];
export type WidgetItem = Partial<Omit<WidgetT, "type">> & {
  uniqueId?: string;
  imgUrl?: string;
  type?: string;
  extension?: string;
  isChecked?: boolean;
};

export const CreateCheckbox = memo(
  ({
    innerRef,
    id,
    checked,
    onChange,
    parentId,
  }: {
    innerRef?: React.Ref<HTMLButtonElement>;
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    parentId: string;
  }) => {
    const isDarkMode = useShallowThemeStore((state) => state.theme === "dark");

    useEffect(() => {
      document.getElementById(parentId)?.style?.removeProperty?.("background-color");
    }, [isDarkMode, parentId]);

    const handleChange = useCallback(
      (checked: boolean) => {
        onChange(checked);
        document.getElementById(parentId)?.style.removeProperty("background-color");
      },
      [onChange, parentId],
    );

    const handleFocus = useCallback(() => {
      document
        .getElementById(parentId)
        .style.setProperty("background-color", isDarkMode ? "#303038" : "#CDCED0");
    }, [parentId, isDarkMode]);

    const handleBlur = useCallback(() => {
      document.getElementById(parentId).style.removeProperty("background-color");
    }, [parentId]);

    const handleRightLabelClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById(id)?.click();
      },
      [id],
    );

    return (
      <Checkbox
        key={id}
        id={id}
        checked={checked}
        onChange={handleChange}
        checkboxClassname="focus:outline-none dark:focus:outline-none bg-transparent"
        onFocus={handleFocus}
        onBlur={handleBlur}
        rightLabelOnClick={handleRightLabelClick}
        ref={innerRef}
      />
    );
  },
);

function initialExpandedSubCategories(
  initialState: Record<string, boolean>,
  widgets: WidgetItem[],
) {
  for (const widget of widgets) {
    if (widget.category && widget.subCategory) {
      const key = `${widget.category}-${widget.subCategory}`.toLowerCase();

      if (initialState[key] === undefined) {
        initialState[key] = true; // Set to true if not already set
      }
    }
  }
  return initialState;
}

const CategoryHeader = memo(
  ({
    category,
    isExpanded,
    onToggle,
    isSelected,
    onSelectionChange,
    showCheckbox = true,
    totalCount,
    groupKey,
  }: {
    category: string;
    isExpanded: boolean;
    onToggle: (category: string) => void;
    isSelected: boolean | "indeterminate";
    onSelectionChange: (groupKey: string, checked: boolean) => void;
    showCheckbox?: boolean;
    totalCount: number;
    groupKey: string;
  }) => {
    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(category);
      },
      [onToggle, category],
    );

    const handleSelectionChange = useCallback(
      (checked: boolean) => onSelectionChange(groupKey, checked),
      [onSelectionChange, groupKey],
    );

    return (
      <div className="flex min-w-0 items-center gap-2 pr-2.5 mb-2">
        <Icon
          id="chevron-right"
          className={cn(
            "size-4 min-w-4 cursor-pointer ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300",
            { "rotate-90": isExpanded },
          )}
          onClick={handleToggle}
        />
        {showCheckbox && (
          <DsCheckbox
            id={`category-${category}-checkbox`}
            checked={isSelected}
            onCheckedChange={handleSelectionChange}
            className="data-[state=unchecked]:bg-transparent"
          />
        )}
        <div
          className={cn("flex min-w-0 flex-1 cursor-pointer items-center gap-2", {
            uppercase: category?.toLowerCase() === "etf",
          })}
          onClick={handleToggle}
        >
          <p className="body-xs-medium truncate text-ds-text-heading capitalize">
            {category} ({totalCount})
          </p>
        </div>
      </div>
    );
  },
);

const SubcategoryHeader = memo(
  ({
    category,
    subcategory,
    isExpanded,
    onToggle,
    isSelected,
    onSelectionChange,
    showCheckbox = true,
    totalCount,
    groupKey,
  }: {
    category: string;
    subcategory: string;
    isExpanded: boolean;
    onToggle: (category: string, subcategory: string) => void;
    isSelected: boolean | "indeterminate";
    onSelectionChange: (groupKey: string, checked: boolean) => void;
    showCheckbox?: boolean;
    totalCount: number;
    groupKey: string;
  }) => {
    const handleToggle = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(category, subcategory);
      },
      [onToggle, category, subcategory],
    );

    const handleSelectionChange = useCallback(
      (checked: boolean) => onSelectionChange(groupKey, checked),
      [onSelectionChange, groupKey],
    );

    return (
      <div className="flex min-w-0 items-center gap-2 py-2 pr-2.5 pl-4">
        <Icon
          id="chevron-right"
          className={cn(
            "size-3 min-w-3 cursor-pointer ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300",
            { "rotate-90": isExpanded },
          )}
          onClick={handleToggle}
        />
        {showCheckbox && (
          <DsCheckbox
            id={`subcategory-${category}-${subcategory}-checkbox`}
            checked={isSelected}
            onCheckedChange={handleSelectionChange}
            className="data-[state=unchecked]:bg-transparent"
          />
        )}
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
          onClick={handleToggle}
        >
          <p className="body-xs-regular truncate text-ds-text-subtitle capitalize">
            {subcategory} ({totalCount})
          </p>
        </div>
      </div>
    );
  },
);

type VirtualizedItem =
  | {
      type: "recently-added-header";
      isExpanded: boolean;
      recentWidgetIds: string[];
    }
  | { type: "divider" }
  | {
      type: "category";
      category: string;
      isExpanded: boolean;
      totalCount: number;
      showCheckbox: boolean;
      groupKey: string;
      index: number;
    }
  | {
      type: "subcategory";
      category: string;
      subcategory: string;
      isExpanded: boolean;
      totalCount: number;
      showCheckbox: boolean;
      groupKey: string;
      index: number;
    }
  | {
      type: "widget";
      widget: WidgetItem;
      currentIndex: number;
      hasSubcategory: boolean;
      index: number;
    };

type RendererData = {
  items: VirtualizedItem[];
  selectedWidgetIds: Set<string>;
  groupWidgets: Record<string, WidgetItem[]>;
  onWidgetChange: (checked: boolean, widget: WidgetItem) => void;
  onGroupSelectionChange: (groupKey: string, checked: boolean) => void;
  toggleCategory: (category: string) => void;
  toggleSubcategory: (category: string, subcategory: string) => void;
  toggleRecentlyAdded: () => void;
  onRecentlyAddedSelectionChange: (checked: boolean) => void;
  itemRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
  multiSelectState?: {
    isShiftPressed: boolean;
    onShiftClick: (widgetId: string) => void;
  };
};

const VirtualizedItemRenderer = memo(
  ({ index, data }: { index: number; data: RendererData }) => {
    const item = data.items[index];

    if (item.type === "recently-added-header") {
      const allSelected =
        item.recentWidgetIds.length > 0 &&
        item.recentWidgetIds.every((id) => data.selectedWidgetIds.has(id));
      const someSelected = item.recentWidgetIds.some((id) =>
        data.selectedWidgetIds.has(id),
      );
      const selectionState: boolean | "indeterminate" = allSelected
        ? true
        : someSelected
          ? "indeterminate"
          : false;

      const totalCountRA = item?.recentWidgetIds?.length;

      return (
        <div className="flex min-w-0 items-center gap-2 pr-2.5 pt-1 pb-2">
          <Icon
            id="chevron-right"
            className={cn(
              "size-4 min-w-4 cursor-pointer ease-[cubic-bezier(0.87,_0,_0.13,_1)] transition-transform duration-300",
              { "rotate-90": item.isExpanded },
            )}
            onClick={data.toggleRecentlyAdded}
          />
          <DsCheckbox
            id="recently-added-checkbox"
            checked={selectionState}
            onCheckedChange={data.onRecentlyAddedSelectionChange}
            className="data-[state=unchecked]:bg-transparent"
          />
          <div
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
            onClick={data.toggleRecentlyAdded}
          >
            <p className="body-xs-medium truncate text-ds-text-heading capitalize">
              Recently Added ({totalCountRA})
            </p>
          </div>
        </div>
      );
    }

    if (item.type === "divider") {
      return (
        <div className="pt-0.5 pb-2">
          <div className="obb-divider" />
        </div>
      );
    }

    if (item.type === "category") {
      const groupWidgetsList = data.groupWidgets[item.groupKey] || [];
      const selectedCount = groupWidgetsList.filter((w) =>
        data.selectedWidgetIds.has(w.uniqueId),
      ).length;
      const selectionState: boolean | "indeterminate" =
        selectedCount === groupWidgetsList.length
          ? true
          : selectedCount > 0
            ? "indeterminate"
            : false;

      return (
        <div className="pt-1">
          <CategoryHeader
            category={item.category}
            isExpanded={item.isExpanded}
            onToggle={data.toggleCategory}
            isSelected={selectionState}
            onSelectionChange={data.onGroupSelectionChange}
            showCheckbox={item.showCheckbox}
            totalCount={item.totalCount}
            groupKey={item.groupKey}
          />
        </div>
      );
    }

    if (item.type === "subcategory") {
      const groupWidgetsList = data.groupWidgets[item.groupKey] || [];
      const selectedCount = groupWidgetsList.filter((w) =>
        data.selectedWidgetIds.has(w.uniqueId),
      ).length;
      const selectionState: boolean | "indeterminate" =
        selectedCount === groupWidgetsList.length
          ? true
          : selectedCount > 0
            ? "indeterminate"
            : false;

      return (
        <SubcategoryHeader
          category={item.category}
          subcategory={item.subcategory}
          isExpanded={item.isExpanded}
          onToggle={data.toggleSubcategory}
          isSelected={selectionState}
          onSelectionChange={data.onGroupSelectionChange}
          showCheckbox={item.showCheckbox}
          totalCount={item.totalCount}
          groupKey={item.groupKey}
        />
      );
    }

    if (item.type === "widget") {
      const { widget: widgetItem, currentIndex, hasSubcategory } = item;
      const isSelected = data.selectedWidgetIds.has(widgetItem.uniqueId);

      return (
        <div
          className={cn("pb-2.5", {
            "pl-1 sm:pl-[26px]": hasSubcategory,
            "pl-1 sm:pl-3.5": !hasSubcategory,
          })}
        >
          <WidgetItem
            widgetItem={widgetItem}
            currentIndex={currentIndex}
            isSelected={isSelected}
            itemRefs={data.itemRefs}
            onWidgetChange={data.onWidgetChange}
            multiSelectState={data.multiSelectState}
          />
        </div>
      );
    }

    return null;
  },
);

const WidgetItem = memo(
  ({
    widgetItem,
    currentIndex,
    isSelected,
    itemRefs,
    onWidgetChange,
    uniqueIdOverride,
    multiSelectState,
  }: {
    widgetItem: WidgetItem;
    currentIndex: number;
    isSelected: boolean;
    itemRefs: MutableRefObject<(HTMLButtonElement | null)[]>;
    onWidgetChange: (checked: boolean, widget: WidgetItem) => void;
    uniqueIdOverride?: string;
    multiSelectState?: {
      isShiftPressed: boolean;
      onShiftClick: (widgetId: string) => void;
    };
  }) => {
    const isMobile = useMobile((s) => s.isMobile);
    const displayId = uniqueIdOverride || widgetItem.uniqueId;
    const { source, sourceName } = useMemo(
      () => getWidgetSourceInfo(widgetItem as WidgetT),
      [widgetItem],
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey && multiSelectState) {
          multiSelectState.onShiftClick(displayId);
          return;
        }

        document.getElementById(`${displayId}-${currentIndex}-checkbox`)?.click();
      },
      [displayId, currentIndex, multiSelectState],
    );

    const handleCheckboxChange = useCallback(
      (checked: boolean) => {
        const updatedWidget = {
          ...widgetItem,
          defaultAssetClass: widgetItem?.category?.toLowerCase(),
        };

        if (multiSelectState?.isShiftPressed) {
          multiSelectState.onShiftClick(displayId);
          return;
        }

        onWidgetChange(checked, updatedWidget);
      },
      [widgetItem, onWidgetChange, multiSelectState, displayId],
    );

    return (
      <div
        id={`${displayId}-${currentIndex}`}
        className={cn(
          "flex w-full min-w-0 items-start gap-2.5 overflow-hidden px-2.5 py-2 sm:items-center sm:py-[7px]",
          "rounded",
          "bg-search-widget-bg",
          "cursor-pointer",
          `widget-${displayId}`,
        )}
        onClick={handleClick}
      >
        <CreateCheckbox
          innerRef={(el: HTMLButtonElement | null) =>
            (itemRefs.current[currentIndex] = el)
          }
          parentId={`${displayId}-${currentIndex}`}
          id={`${displayId}-${currentIndex}-checkbox`}
          checked={isSelected}
          onChange={handleCheckboxChange}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2.5">
          <Tooltip
            hide={isMobile}
            className="p-3"
            message={
              <WidgetInfoTooltip
                name={widgetItem.name}
                connectionType={widgetItem.connectionType}
                category={widgetItem.category}
                subCategory={widgetItem.subCategory}
                description={widgetItem.description}
                imgUrl={widgetItem.imgUrl}
                source={sourceName || widgetItem.sourceDatabase}
              />
            }
          >
            <p className="min-w-0 max-w-full truncate whitespace-nowrap capitalize">
              {widgetItem.name}
            </p>
          </Tooltip>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 sm:ml-auto sm:max-w-[50%] sm:flex-nowrap sm:shrink-0">
            {widgetItem.category && (
              <span className="block min-w-0 max-w-full truncate text-xs whitespace-nowrap text-ds-text-caption capitalize sm:hidden">
                {widgetItem.category}
                {widgetItem.subCategory ? ` · ${widgetItem.subCategory}` : ""}
              </span>
            )}
            {widgetItem.widgetType !== "copilot_table" && (
              <span className="body-xs-regular min-w-0 max-w-full truncate whitespace-nowrap text-ds-text-caption capitalize sm:max-w-none">
                {source}
              </span>
            )}
            {connectorTypes.includes(widgetItem.widgetType) && (
              <span
                className={cn(
                  "obb-tag inline-block max-w-full truncate whitespace-nowrap align-middle capitalize sm:max-w-none sm:shrink-0",
                  widgetItem.extension && "uppercase",
                )}
              >
                {widgetItem.widgetType === "backend"
                  ? widgetItem.sourceName
                  : widgetItem.widgetType === "copilot_table"
                    ? "OpenBB Workspace"
                    : widgetItem.extension || widgetItem.widgetType}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

type WidgetMenuProps = {
  isFiltered: boolean;
  widgets?: WidgetItem[];
  globalSearch?: string;
  globalIndexRef: MutableRefObject<number>;
  itemRefs?: MutableRefObject<(HTMLButtonElement | null)[]>;
  onOpenChange?: (open: boolean) => void;
  allCategories: string[];
  state: SearchDialogState;
  dispatch: StateDispatch<SearchDialogState>;
  inputValue?: string;
  onInputChange?: (filter: string) => void;
  inputRef?: MutableRefObject<HTMLInputElement | null>;
};

const WidgetMenu = memo((props: WidgetMenuProps) => {
  const {
    isFiltered,
    widgets,
    globalSearch,
    globalIndexRef,
    itemRefs,
    onOpenChange,
    allCategories,
    state,
    dispatch,
    inputValue,
    onInputChange,
    inputRef,
  } = props;

  const isLoading = useShallowBackendConnectorStore((s) => s.isLoadingBackends);

  const uniqueCategories = useMemo(
    () =>
      [
        "All",
        ...new Set(
          allCategories.filter(
            (category) =>
              !["My Data", "Others"].some((x) => x === category) && category,
          ),
        ),
      ]
        .sort((a, b) => {
          if (a === "All") return -1;
          if (b === "All") return 1;
          return a.localeCompare(b);
        })
        .concat(["Others"]),
    [allCategories],
  );

  const isMobile = useMobile((s) => s.isMobile);

  const { initialSelectedSearchTab, recentlyAddedWidgets, setRecentlyAddedWidgets } =
    useShallowThemeStore((state) => ({
      recentlyAddedWidgets: state.recentlyAddedWidgets,
      setRecentlyAddedWidgets: state.setRecentlyAddedWidgets,
      initialSelectedSearchTab: state.initialSelectedSearchTab?.replace(
        "all",
        "widgets",
      ) as SearchTabId,
    }));

  const { currentTutorial, goToStep, currentStep } = useShallowTutorialStore(
    (state) => ({
      currentTutorial: state.currentTutorial,
      goToStep: state.goToStep,
      currentStep: state.currentStep,
    }),
  );
  const { id: currentDashboardId } = useParams();
  const [searchParams] = useSearchParams();
  const { addWidgets, getTabById } = useShallowAppStore((state) => ({
    addWidgets: state.addWidgets,
    getTabById: state.getTabById,
  }));

  const lastInnerTab = useShallowAppStore((state) =>
    state?.getLastInnerTab(currentDashboardId),
  );
  const currentTab = useMemo(
    () => searchParams.get("tab") || lastInnerTab || "",
    [lastInnerTab, searchParams.get("tab")],
  );

  const navigate = useNavigate();
  const handleAdd = useCallback(async () => {
    const selectedWidgets = state.selectedWidgets;

    if (selectedWidgets.length > 0) {
      const newRecentlyAddedWidgets = Object.values(
        [...selectedWidgets, ...recentlyAddedWidgets].reduce(
          (acc, widget) => {
            const uniqueId = widget.uniqueId.replace("-recent", "");
            acc[uniqueId] = { uniqueId, name: widget.name };
            return acc;
          },
          {} as Record<string, WidgetItem>,
        ),
      );

      setRecentlyAddedWidgets(newRecentlyAddedWidgets.slice(0, 5));
      const hasNavigationBar = selectedWidgets.some(
        (widget) => widget.widgetId === "navigation_bar",
      );
      const widgetsToAdd = selectedWidgets.map((widget) => {
        widget.innerTab = currentTab;
        // If navigation_bar is present, add innerTab: "overview" to all widgets
        if (hasNavigationBar) {
          widget.innerTab = "overview";
        }
        return widget as WidgetT;
      });

      if (import.meta.env.DEV) console.log(widgetsToAdd);

      if (currentDashboardId) {
        const lastWidgetId = await addWidgets(currentDashboardId, widgetsToAdd);

        if (lastWidgetId) {
          setTimeout(() => {
            const element = document.querySelector(
              `[data-widget-id="${lastWidgetId}"]`,
            );
            if (element && !isMobile) {
              element.scrollIntoView({
                behavior: "smooth",
              });
            }
          }, 200);
        }
      } else {
        toast.warning("Not in a dashboard", {
          description: (
            <div className="mb-2">
              Would you like to add these widgets to a new dashboard?
            </div>
          ),
          action: {
            label: "Add to new dashboard",
            onClick: () => {
              const newDashboardId = uuidv4();
              useAppStore.getState().addTab({
                index: newDashboardId,
                data: {
                  name: generateRandomName(),
                  type: "custom",
                  widgets: widgetsToAdd,
                },
              });
              navigate(`/app/${newDashboardId}`);
            },
          },
        });
      }
    } else {
      toast.warning("Please select at least one widget to add.");
    }
    if (currentTutorial === "grouping") {
      if (currentStep === 4) {
        setTimeout(() => {
          goToStep(5);
        }, 500);
      }
    }
    onOpenChange(false);
  }, [
    state.selectedWidgets,
    currentTutorial,
    addWidgets,
    navigate,
    currentDashboardId,
    goToStep,
    onOpenChange,
    isMobile,
    currentTab,
    recentlyAddedWidgets,
    setRecentlyAddedWidgets,
  ]);

  const filteredRecentlyAddedWidgets = useMemo(() => {
    const widgetUniqueIds = new Set(recentlyAddedWidgets.map((w) => w.uniqueId));
    return widgets.filter((widget) => widgetUniqueIds.has(widget.uniqueId));
  }, [recentlyAddedWidgets, widgets]);

  // Memoize selected widget IDs for faster lookups
  const selectedWidgetIds = useMemo(() => {
    return new Set(state.selectedWidgets.map((w) => w.uniqueId));
  }, [state.selectedWidgets]);

  // Refs for values used inside callbacks to prevent callback chain rebuilds on selection change
  const selectedWidgetIdsRef = useRef(selectedWidgetIds);
  selectedWidgetIdsRef.current = selectedWidgetIds;
  const anchorWidgetIdRef = useRef<string | null>(state.anchorWidgetId);
  anchorWidgetIdRef.current = state.anchorWidgetId;
  const virtualizedItemsRef = useRef<VirtualizedItem[]>([]);
  const filteredRecentlyAddedWidgetsRef = useRef(filteredRecentlyAddedWidgets);
  filteredRecentlyAddedWidgetsRef.current = filteredRecentlyAddedWidgets;

  const handleChange = useCallback(
    (checked: boolean, widgetItem: WidgetItem) => {
      let innerTab = currentTab;
      widgetItem.uniqueId = widgetItem.uniqueId.replace("-recent", "");
      const tab = getTabById(currentDashboardId);

      if (checked && widgetItem.widgetId === "navigation_bar") {
        const navigationBarAlreadyExists = tab?.data?.widgets?.some(
          (widget) => widget.widgetId === "navigation_bar",
        );
        if (navigationBarAlreadyExists) {
          toast.warning("Navigation bar already exists", {
            description:
              "Please remove the existing navigation bar widget before adding another one",
          });
          return;
        }
        innerTab = "overview";
      }

      dispatch({
        selectedWidgets: (prevSelectedWidgets) => {
          if (!checked) {
            return prevSelectedWidgets.filter(
              (w) => w.uniqueId !== widgetItem.uniqueId,
            );
          }

          if (prevSelectedWidgets.some((w) => w.uniqueId === widgetItem.uniqueId)) {
            return prevSelectedWidgets;
          }

          const newWidget = {
            ...widgetItem,
            id: uuidv4(),
            innerTab,
            type: widgetItem.type ?? widgetItem.defaultViz,
            data: {
              dataKey: widgetItem.dataKey,
              ...widgetItem.data,
              table: {
                ...widgetItem.data?.table,
                transpose: Boolean(widgetItem.data?.table?.transpose),
              },
            } as WidgetT["data"],
          };

          return [...prevSelectedWidgets, newWidget];
        },
      });
    },
    [dispatch, currentTab, currentDashboardId, getTabById],
  );

  const [expandedCategories, setExpandedCategories] = useLocalStorage(
    "expandedCategories",
    uniqueCategories.reduce(
      (acc, category) => {
        acc[category.toLowerCase()] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    ),
  );
  const [expandedSubcategories, setExpandedSubcategories] = useLocalStorage(
    "expandedSubcategories",
    () => initialExpandedSubCategories({}, widgets),
  );
  const [localExpanded, setLocalExpanded] = useState({});
  const [isRecentlyAddedExpanded, setIsRecentlyAddedExpanded] = useState(true);
  const enableLocalExpanded = state.selectedCategory !== "All" || isFiltered;

  useEffect(() => {
    // Only reset local expanded state when not in filtered mode or when switching away from widgets tab
    if (!enableLocalExpanded) {
      setLocalExpanded({});
    }
    if (initialSelectedSearchTab !== "widgets" || state.selectedCategory !== "All")
      return;

    setExpandedCategories((prev) =>
      uniqueCategories.reduce((acc, category) => {
        const key = category.toLowerCase();
        acc[key] = prev[key] ?? true;
        return acc;
      }, {}),
    );
    setExpandedSubcategories((prev) => initialExpandedSubCategories(prev, widgets));
  }, [initialSelectedSearchTab, widgets, enableLocalExpanded]);

  const toggleCategory = useCallback(
    (category: string) => {
      const key = category.toLowerCase();

      if (!enableLocalExpanded)
        return setExpandedCategories((prev) => ({ ...prev, [key]: !prev[key] }));

      setLocalExpanded((prev) => ({
        ...prev,
        [key]: prev[key] !== undefined ? !prev[key] : false,
      }));
    },
    [enableLocalExpanded],
  );

  const toggleSubcategory = useCallback(
    (category: string, subcategory: string) => {
      const key = `${category}-${subcategory}`.toLowerCase();

      if (!enableLocalExpanded)
        return setExpandedSubcategories((prev) => ({ ...prev, [key]: !prev[key] }));

      setLocalExpanded((prev) => ({
        ...prev,
        [key]: prev[key] !== undefined ? !prev[key] : false,
      }));
    },
    [enableLocalExpanded],
  );

  const groupWidgets = useMemo(() => {
    const groups: Record<string, WidgetItem[]> = {};
    const onlyShared =
      state.selectedOption === "shared" || state.selectedCategory === "Shared Backends";

    for (const w of widgets) {
      const widget = { ...w };
      if (onlyShared) {
        widget.category = widget.subCategory || widget.category;
        widget.subCategory = undefined;
      }
      const category = widget.category?.toLowerCase();
      const subCategory = widget.subCategory?.toLowerCase();
      const subCatKey = `${category}-${subCategory}`;

      if (!groups[category]) groups[category] = [];
      if (!groups[subCatKey]) groups[subCatKey] = [];

      groups[category].push(widget);
      groups[subCatKey].push(widget);
    }

    return groups;
  }, [widgets, state.selectedOption, state.selectedCategory]);

  const showRecentlyAdded = !isFiltered && filteredRecentlyAddedWidgets.length > 0;

  const toggleRecentlyAdded = useCallback(() => {
    setIsRecentlyAddedExpanded((prev) => !prev);
  }, []);

  const handleGroupSelectionChange = useCallback(
    (groupKey: string, checked: boolean) => {
      const widgetsInGroup = groupWidgets[groupKey] || [];
      dispatch({
        selectedWidgets: (prev) => {
          if (checked) {
            const existingIds = new Set(prev.map((w) => w.uniqueId));
            const toAdd = widgetsInGroup
              .filter((w) => !existingIds.has(w.uniqueId))
              .map((w) => ({
                ...w,
                id: uuidv4(),
                type: w.type ?? w.defaultViz,
                data: {
                  dataKey: w.dataKey,
                  ...w.data,
                  table: {
                    ...w.data?.table,
                    transpose: Boolean(w.data?.table?.transpose),
                  },
                } as WidgetT["data"],
              }));
            return [...prev, ...toAdd];
          }
          const idsToRemove = new Set(widgetsInGroup.map((w) => w.uniqueId));
          return prev.filter((w) => !idsToRemove.has(w.uniqueId));
        },
      });
    },
    [groupWidgets, dispatch],
  );

  const handleRecentlyAddedSelectionChange = useCallback(
    (checked: boolean) => {
      const widgetMap = new Map(widgets.map((w) => [w.uniqueId, w]));
      dispatch({
        selectedWidgets: (prev) => {
          if (checked) {
            const existingIds = new Set(prev.map((w) => w.uniqueId));
            const toAdd = filteredRecentlyAddedWidgets
              .map((w) => widgetMap.get(w.uniqueId))
              .filter((w): w is WidgetItem => !!w && !existingIds.has(w.uniqueId))
              .map((w) => ({
                ...w,
                id: uuidv4(),
                type: w.type ?? w.defaultViz,
                data: {
                  dataKey: w.dataKey,
                  ...w.data,
                  table: {
                    ...w.data?.table,
                    transpose: Boolean(w.data?.table?.transpose),
                  },
                } as WidgetT["data"],
              }));
            return [...prev, ...toAdd];
          }
          const idsToRemove = new Set(
            filteredRecentlyAddedWidgets.map((w) => w.uniqueId),
          );
          return prev.filter((w) => !idsToRemove.has(w.uniqueId));
        },
      });
    },
    [filteredRecentlyAddedWidgets, widgets, dispatch],
  );

  // Build flattened virtualized items list — decoupled from selection state for O(1) selection updates
  const virtualizedItems = useMemo(() => {
    const items: VirtualizedItem[] = [];
    let currCategory: string | null = null;
    let currSubCategory: string | null = null;
    let isFirstCategory = true;
    let widgetIndex = 0;

    if (showRecentlyAdded) {
      const widgetMap = new Map(widgets.map((w) => [w.uniqueId, w]));

      items.push({
        type: "recently-added-header",
        isExpanded: isRecentlyAddedExpanded,
        recentWidgetIds: filteredRecentlyAddedWidgets.map((w) => w.uniqueId),
      });

      if (isRecentlyAddedExpanded) {
        for (const recentWidget of filteredRecentlyAddedWidgets) {
          const widgetItem = widgetMap.get(recentWidget.uniqueId);
          if (!widgetItem) continue;
          items.push({
            type: "widget",
            widget: widgetItem,
            currentIndex: widgetIndex++,
            hasSubcategory: false,
            index: -1,
          });
        }
      }

      items.push({ type: "divider" });
    }

    const widgetCategories = new Set(
      widgets.map((w) => w.category?.toLowerCase()).filter(Boolean),
    );
    const hasOnlyOneCategory = widgetCategories.size === 1;
    const onlyShared =
      state.selectedOption === "shared" || state.selectedCategory === "Shared Backends";

    for (const [index, w] of widgets.entries()) {
      const widgetItem = { ...w };
      if (onlyShared) {
        widgetItem.category = widgetItem.subCategory || widgetItem.category;
        widgetItem.subCategory = undefined;
      }
      const category = widgetItem.category?.toLowerCase();
      const subCategory = widgetItem.subCategory?.toLowerCase();
      const isNewCategory = category !== currCategory;
      const isNewSubCategory = subCategory !== currSubCategory;

      currCategory = category || currCategory;
      currSubCategory = subCategory || currSubCategory;
      const subCatKey = `${currCategory}-${currSubCategory}`;

      const isFilteredView = state.selectedCategory !== "All" || !!globalSearch;
      const forceExpanded = isFilteredView || state.selectedCategory !== "All";

      const isCategoryExpanded =
        localExpanded[currCategory] ??
        (forceExpanded
          ? true
          : (expandedCategories[currCategory] ?? hasOnlyOneCategory));
      const isSubcategoryExpanded =
        localExpanded[subCatKey] ??
        (forceExpanded
          ? true
          : (expandedSubcategories[subCatKey] ?? hasOnlyOneCategory));

      const parentWidgets = groupWidgets[currCategory] || [];
      const childWidgets = groupWidgets[subCatKey] || [];

      if (isNewCategory && widgetItem.category) {
        const categoryWidgets = parentWidgets;
        const subcategoriesInCategory = [
          ...new Set(categoryWidgets.map((w) => w.subCategory).filter(Boolean)),
        ];
        const shouldShowCategoryCheckbox =
          !isCategoryExpanded ||
          (categoryWidgets.length > 1 &&
            !(subcategoriesInCategory.length === 1 && categoryWidgets.length === 1));

        if (!isFirstCategory) {
          items.push({ type: "divider" });
        }
        items.push({
          type: "category",
          category: widgetItem.category,
          isExpanded: isCategoryExpanded,
          totalCount: parentWidgets.length,
          showCheckbox: shouldShowCategoryCheckbox,
          groupKey: currCategory,
          index,
        });
        isFirstCategory = false;
      }

      if (isCategoryExpanded && isNewSubCategory && widgetItem.subCategory) {
        const subcategoryWidgets = childWidgets;
        const shouldShowSubcategoryCheckbox =
          !isSubcategoryExpanded || subcategoryWidgets.length > 1;

        items.push({
          type: "subcategory",
          category: widgetItem.category,
          subcategory: widgetItem.subCategory,
          isExpanded: isSubcategoryExpanded,
          totalCount: childWidgets.length,
          showCheckbox: shouldShowSubcategoryCheckbox,
          groupKey: subCatKey,
          index,
        });
      }

      if (isCategoryExpanded && (!widgetItem.subCategory || isSubcategoryExpanded)) {
        items.push({
          type: "widget",
          widget: widgetItem,
          currentIndex: widgetIndex++,
          hasSubcategory: !!widgetItem.subCategory,
          index,
        });
      }
    }

    globalIndexRef.current = widgetIndex;
    return items;
  }, [
    widgets,
    state.selectedOption,
    state.selectedCategory,
    globalSearch,
    localExpanded,
    expandedCategories,
    expandedSubcategories,
    groupWidgets,
    globalIndexRef,
    showRecentlyAdded,
    isRecentlyAddedExpanded,
    filteredRecentlyAddedWidgets,
  ]);
  virtualizedItemsRef.current = virtualizedItems;

  /**
   * Shift+click range selection: selects or deselects all widgets between the
   * last-clicked anchor and the newly clicked widget. Direction (select vs deselect)
   * is determined by the anchor's current selection state — if the anchor is selected
   * the range is added, otherwise the range is removed. Widget IDs are cleaned of the
   * "-recent" suffix so that Recently Added duplicates map to the same underlying widget.
   */
  const handleRangeSelection = useCallback(
    (clickedWidgetId: string) => {
      const anchorId = anchorWidgetIdRef.current;
      if (!anchorId) return;

      const cleanClickedId = clickedWidgetId.replace("-recent", "");
      const cleanAnchorId = anchorId.replace("-recent", "");

      if (cleanAnchorId === cleanClickedId) return;

      const allVisibleWidgets = [];

      if (!isFiltered) {
        allVisibleWidgets.push(
          ...filteredRecentlyAddedWidgetsRef.current.map((w) => ({
            ...w,
            displayId: `${w.uniqueId}-recent`,
            cleanId: w.uniqueId,
          })),
        );
      }

      for (const item of virtualizedItemsRef.current) {
        if (item.type !== "widget") continue;
        allVisibleWidgets.push({
          ...item.widget,
          displayId: item.widget.uniqueId,
          cleanId: item.widget.uniqueId,
        });
      }

      const anchorIndex = allVisibleWidgets.findIndex((w) => w.displayId === anchorId);
      const clickedIndex = allVisibleWidgets.findIndex(
        (w) => w.displayId === clickedWidgetId,
      );

      if (anchorIndex === -1 || clickedIndex === -1) return;

      const startIndex = Math.min(anchorIndex, clickedIndex);
      const endIndex = Math.max(anchorIndex, clickedIndex);
      const widgetsInRange = allVisibleWidgets.slice(startIndex, endIndex + 1);

      const currentSelectedIds = selectedWidgetIdsRef.current;
      const isAnchorSelected = currentSelectedIds.has(cleanAnchorId);

      const widgetsToAdd = [];
      const widgetIdsToRemove = [];

      for (const widget of widgetsInRange) {
        const isCurrentlySelected = currentSelectedIds.has(widget.cleanId);

        if (isAnchorSelected) {
          if (!isCurrentlySelected) {
            widgetsToAdd.push({
              ...widget,
              uniqueId: widget.cleanId,
              id: uuidv4(),
              type: widget.type ?? widget.defaultViz,
              data: {
                dataKey: widget.dataKey,
                ...widget.data,
                table: {
                  ...widget.data?.table,
                  transpose: Boolean(widget.data?.table?.transpose),
                },
              } as WidgetT["data"],
            });
          }
        } else if (isCurrentlySelected) {
          widgetIdsToRemove.push(widget.cleanId);
        }
      }

      if (widgetsToAdd.length > 0 || widgetIdsToRemove.length > 0) {
        dispatch({
          selectedWidgets: (prevSelectedWidgets) => {
            if (widgetIdsToRemove.length > 0) {
              prevSelectedWidgets = prevSelectedWidgets.filter(
                (w) => !widgetIdsToRemove.includes(w.uniqueId),
              );
            }
            return [...prevSelectedWidgets, ...widgetsToAdd];
          },
        });
      }
    },
    [dispatch, isFiltered],
  );

  const handleChangeWithAnchor = useCallback(
    (checked: boolean, widgetItem: WidgetItem) => {
      dispatch({ anchorWidgetId: widgetItem.uniqueId });
      handleChange(checked, widgetItem);

      if (
        checked &&
        currentTutorial === "grouping" &&
        currentStep === 3 &&
        state.selectedOption !== "external"
      ) {
        setTimeout(() => goToStep(4), 500);
      }
    },
    [
      handleChange,
      dispatch,
      currentTutorial,
      currentStep,
      goToStep,
      state.selectedOption,
    ],
  );

  const multiSelectState = useMemo(
    () => ({
      isShiftPressed: state.isShiftPressed,
      onShiftClick: handleRangeSelection,
    }),
    [state.isShiftPressed, handleRangeSelection],
  );

  const handleFilterSelectChange = useCallback(
    (value: SearchDialogState["selectedOption"]) => {
      dispatch({ selectedOption: value });
    },
    [dispatch],
  );

  const rendererData = useMemo(
    () => ({
      items: virtualizedItems,
      selectedWidgetIds,
      groupWidgets,
      onWidgetChange: handleChangeWithAnchor,
      onGroupSelectionChange: handleGroupSelectionChange,
      toggleCategory,
      toggleSubcategory,
      toggleRecentlyAdded,
      onRecentlyAddedSelectionChange: handleRecentlyAddedSelectionChange,
      itemRefs,
      multiSelectState,
    }),
    [
      virtualizedItems,
      selectedWidgetIds,
      groupWidgets,
      handleChangeWithAnchor,
      handleGroupSelectionChange,
      toggleCategory,
      toggleSubcategory,
      toggleRecentlyAdded,
      handleRecentlyAddedSelectionChange,
      itemRefs,
      multiSelectState,
    ],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const estimateSize = useCallback(
    (index: number) => {
      const item = virtualizedItems[index];
      if (!item) return 44;
      switch (item.type) {
        case "recently-added-header":
          return 36;
        case "divider":
          return 18;
        case "category":
          return 36;
        case "subcategory":
          return 36;
        case "widget":
          return isMobile ? 66 : 46;
        default:
          return 44;
      }
    },
    [isMobile, virtualizedItems],
  );

  const virtualizer = useVirtualizer({
    count: virtualizedItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize,
    overscan: 15,
    getItemKey: (index) => {
      const item = virtualizedItems[index];
      if (item.type === "category") return `category-${item.category}-${item.index}`;
      if (item.type === "subcategory")
        return `subcategory-${item.category}-${item.subcategory}-${item.index}`;
      if (item.type === "widget") return `widget-${item.widget.uniqueId}-${item.index}`;
      if (item.type === "recently-added-header") return "recently-added-header";
      if (item.type === "divider") return `divider-${index}`;
      return index;
    },
  });

  if (initialSelectedSearchTab !== "widgets") return null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2.5 text-xs h-full">
        <div className="flex items-center justify-center bg-tab-group-bg overflow-hidden h-full rounded border border-secondary/20">
          <BrandedLoadingState message="Loading widgets..." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 text-xs h-full">
      <div className="flex flex-col flex-1 min-h-0 bg-tab-group-bg overflow-hidden rounded border border-secondary/20">
        <div
          className={cn(
            "flex flex-shrink-0 gap-2 sm:justify-between p-2.5 border-b border-surface-divider",
            isMobile && "flex-col",
          )}
        >
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            {inputRef && onInputChange && (
              <div className={cn(isMobile ? "min-w-0 flex-1" : "w-[312px]")}>
                <Input
                  ref={inputRef}
                  size="sm"
                  className="w-full"
                  placeholder="Search for widgets"
                  defaultValue={inputValue}
                  onChange={onInputChange}
                  prefix={<Icon id="search" className="size-4" />}
                />
              </div>
            )}
            <div
              className={cn(
                isMobile ? "w-[140px] max-w-[40%] shrink-0" : "min-w-[140px]",
              )}
            >
              <Select
                size="sm"
                value={state.selectedOption || "all"}
                onChange={handleFilterSelectChange}
                options={[
                  { value: "all", label: "All Widgets" },
                  { value: "external", label: "My Widgets" },
                  { value: "shared", label: "Shared With Me" },
                ]}
                className="w-full"
              />
            </div>
          </div>
          {isMobile && (
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbars">
              {uniqueCategories.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex-shrink-0 rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors capitalize",
                    state.selectedCategory === key
                      ? "bg-btn-primary-bg text-btn-primary-label"
                      : "bg-general-bg-secondary text-ds-text-body",
                  )}
                  onClick={() => {
                    if (!enableLocalExpanded) {
                      setLocalExpanded({});
                    }
                    dispatch({ selectedCategory: key });
                  }}
                >
                  {key === "All" ? "All" : beautifySlug(key)}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {!isMobile && (
            <div className="sm:min-w-[180px] sm:max-w-[200px] p-2.5 flex flex-col border-r border-surface-divider overflow-y-auto">
              {uniqueCategories.map((key) => (
                <div
                  key={key}
                  className={cn(
                    "w-full text-left body-xs-regular p-2.5 transition rounded capitalize cursor-pointer",
                    state.selectedCategory === key
                      ? "bg-general-bg-secondary-hover font-medium"
                      : "hover:bg-general-bg-primary-hover",
                  )}
                  onClick={() => {
                    if (!enableLocalExpanded) {
                      setLocalExpanded({});
                    }
                    dispatch({ selectedCategory: key });
                  }}
                >
                  {key === "All" ? "All" : beautifySlug(key)}
                </div>
              ))}
            </div>
          )}
          <div
            ref={scrollContainerRef}
            className={cn(
              "h-full w-full p-2.5 overflow-y-auto",
              isMobile && "flex flex-col",
            )}
          >
            {widgets.length === 0 ? (
              <SearchResultsNotFound
                icon={true}
                extraClassName="max-w-[300px] h-[70%] mx-auto"
              >
                {globalSearch && (
                  <CopilotPromptBanner
                    query={globalSearch}
                    onOpenChange={onOpenChange}
                  />
                )}
                {state.selectedOption === "external" && !inSnowflakeNativeApp && (
                  <Button variant="outlined" size="sm" className="mt-2">
                    <Link to="/app/data-connectors" onClick={() => onOpenChange(false)}>
                      Add an external source
                    </Link>
                  </Button>
                )}
              </SearchResultsNotFound>
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => (
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
                    <VirtualizedItemRenderer
                      index={virtualRow.index}
                      data={rendererData}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 _add-widget-menu-footer mt-auto">
        <div className="flex gap-2.5 ml-auto">
          <Button
            variant="outlined"
            size="sm"
            onClick={() => {
              dispatch({ selectedWidgets: [] });
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            id="_add-widgets-button"
            variant="primary"
            size="sm"
            disabled={state.selectedWidgets.length === 0}
            onClick={handleAdd}
          >
            Add widgets
          </Button>
        </div>
      </div>
    </div>
  );
});

export default WidgetMenu;
