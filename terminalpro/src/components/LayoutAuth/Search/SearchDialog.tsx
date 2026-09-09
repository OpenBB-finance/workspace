import Fuse, { type FuseResult, type IFuseOptions } from "fuse.js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";
import { useShallowAppWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import { DataConnectionTabs } from "~/components/DataConnectors/AddConnectionModal";
import { DataConnectorProvider } from "~/components/DataConnectors/Providers/DataConnectorProvider";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogDescription, DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ds/molecules/Tabs";
import Icon from "~/components/Icon";
import WidgetMenu, { type WidgetItem } from "~/components/LayoutAuth/Search/WidgetMenu";
import { useStateReducer } from "~/hooks/useStateReducer";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { useShallowThemeStore } from "~/lib/state/theme";
import { cn } from "~/lib/utils";
import { useFilterWidgets } from "./hooks/useFilterWidgets";

const searchTabs = [
  {
    title: "Widgets Library",
    id: "widgets",
    shortcut: "⇧+1",
  },
  {
    title: "Data",
    id: "data",
    shortcut: "⇧+2",
  },
] as const;

export type SearchTabId = (typeof searchTabs)[number]["id"];

export type SearchDialogState = {
  selectedWidgets: WidgetItem[];
  selectedCategory: string;
  selectedOption: "all" | "external" | "shared";
  isShiftPressed: boolean;
  anchorWidgetId: string | null;
};

const fuseOptions = {
  keys: [
    "name",
    "description",
    "keywords",
    "source",
    "extension",
    "category",
    "subCategory",
    "sourceName",
  ],
  includeScore: true,
  useExtendedSearch: true,
  distance: 200,
  threshold: 0.2,
  minMatchCharLength: 1,
  findAllMatches: true,
  ignoreLocation: true,
} as IFuseOptions<WidgetItem>;

const SearchDialog = memo(({ isMobile }: { isMobile?: boolean }) => {
  const {
    search,
    changeSearch,
    initialSelectedSearchTab,
    setInitialSelectedSearchTab,
  } = useShallowThemeStore((state) => ({
    recentlyAddedWidgets: state.recentlyAddedWidgets,
    setRecentlyAddedWidgets: state.setRecentlyAddedWidgets,
    search: state.search,
    changeSearch: state.changeSearch,
    initialSelectedSearchTab: state.initialSelectedSearchTab?.replace(
      "all",
      "widgets",
    ) as SearchTabId,
    setInitialSelectedSearchTab: state.setInitialSelectedSearchTab,
  }));

  const [selectedOption, setSelectedOptions] = useLocalStorage<
    SearchDialogState["selectedOption"]
  >("selectedFilter", "all");

  const [inputValue, setInputValue] = useState("");

  const [deferredInput] = useDebounceValue(inputValue, 300);

  const [state, dispatch] = useStateReducer<SearchDialogState>({
    selectedWidgets: [],
    selectedCategory: "All",
    selectedOption,
    isShiftPressed: false,
    anchorWidgetId: null,
  });

  const [selectedOptionDebounced] = useDebounceValue(state.selectedOption, 300);

  useEffect(() => {
    setSelectedOptions(selectedOptionDebounced);
  }, [selectedOptionDebounced, setSelectedOptions]);

  const globalIndexRef = useRef(1);
  const itemRefs = useRef([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const { lastUpdated, getAllAppWidgets } = useShallowAppWidgetsStore((s) => ({
    lastUpdated: s.lastUpdated,
    getAllAppWidgets: s.getAllAppWidgets,
  }));

  const allWidgets = useMemo(() => {
    const widgets = getAllAppWidgets();
    if (state.selectedOption === "all") return widgets;
    const withShared = state.selectedOption === "shared";

    return withShared ? widgets : widgets.filter((widget) => !widget.isSharedWidget);
  }, [lastUpdated, getAllAppWidgets, state.selectedOption]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setInputValue("");
      }
      changeSearch(open);
    },
    [changeSearch],
  );

  const handleHighlight = useCallback(
    (e: KeyboardEvent, focusedIndex: number) => {
      if (!itemRefs.current) return;

      e.stopPropagation();
      e.preventDefault();

      focusedIndex = focusedIndex === -1 ? 0 : focusedIndex;
      const isDown = e.key === "ArrowDown";
      const index = isDown
        ? focusedIndex + 1
        : focusedIndex - 1 + itemRefs.current?.length;

      let nextIndex = index % itemRefs.current?.length;

      let nextItem: HTMLElement = itemRefs.current?.[nextIndex];

      while (
        nextItem?.tagName !== "BUTTON" &&
        nextItem?.id !== "_cancel-add-widgets-button"
      ) {
        nextIndex =
          (isDown ? nextIndex + 1 : nextIndex - 1 + itemRefs.current?.length) %
          itemRefs.current.length;
        nextItem = itemRefs.current?.[nextIndex];
      }

      if (nextItem) {
        nextItem.scrollIntoView({
          behavior: "smooth",
        });
        nextItem.focus();
      }
    },
    [itemRefs],
  );

  const flatData = useMemo(() => {
    return allWidgets.map((item) => {
      const uniqueId = [
        "widgetId",
        "category",
        "sourceName",
        "sourceId",
        "connectionType",
      ]
        .map((key) => item?.[key] ?? "unknown")
        .join("-");

      return { uniqueId, ...item };
    }) as WidgetItem[];
  }, [allWidgets]);

  const fuseInstance = useMemo(() => {
    if (flatData.length === 0) return null;
    return new Fuse(flatData, fuseOptions);
  }, [flatData, fuseOptions]);

  const searchQuery = useMemo(() => {
    const trimmedInput = deferredInput.trim();
    if (!trimmedInput) return null;
    if (trimmedInput.length < 2) return null;

    const searchTerms = trimmedInput.split(/\s+/);
    return {
      $and: searchTerms.map((term) => ({
        $or: (fuseOptions.keys as string[]).map((key) => ({
          [key]: term,
        })),
      })),
    };
  }, [deferredInput, fuseOptions.keys]);

  const results_flat = useMemo(() => {
    if (!(searchQuery && fuseInstance)) return [];

    try {
      return fuseInstance.search(searchQuery) as FuseResult<WidgetItem>[];
    } catch (e) {
      console.error("Fuse search error:", e);
      return [];
    }
  }, [fuseInstance, searchQuery]);

  const allCategories = useMemo(() => {
    const categories = new Set<string>();
    const lowerCaseCategories = new Set<string>();
    for (const widget of allWidgets) {
      const category = widget.category?.trim();
      const lowerCaseCategory = category?.toLowerCase();
      if (category && !lowerCaseCategories.has(lowerCaseCategory)) {
        categories.add(category);
        lowerCaseCategories.add(lowerCaseCategory);
      }
    }
    return Array.from(categories);
  }, [allWidgets]);

  const results = useMemo(() => {
    try {
      if (deferredInput === "") return flatData;

      return results_flat.map((r) => r.item);
    } catch (e) {
      console.error("Error processing search results:", e);
      return [];
    }
  }, [deferredInput, flatData, results_flat]);

  const widgetsArray = useFilterWidgets(results, state);

  const handleOnKeyDown = useCallback(
    (event: KeyboardEvent) => {
      function preventDefault(e: KeyboardEvent) {
        if (!search) return;
        e.preventDefault();
        e.stopPropagation();
      }

      const targetIsInput = event.target === inputRef.current;

      // Handle shift key
      if (event.key === "Shift" && !event.repeat) {
        dispatch({ isShiftPressed: true });
      }

      if (event.shiftKey && event.code >= "Digit1" && event.code <= "Digit5") {
        if (inSnowflakeNativeApp) return;
        preventDefault(event);

        setInitialSelectedSearchTab(
          searchTabs[Number.parseInt(event.code.slice(-1), 10) - 1].id,
        );
      }

      if (event.ctrlKey && event.code >= "Digit1" && event.code <= "Digit9") {
        const index = Number.parseInt(event.code.slice(-1), 10);
        const item = itemRefs.current[index];
        if (item) {
          item.focus();
        }
      }

      if (event.shiftKey && event.key === "Enter") {
        document.getElementById("_add-widgets-button")?.click();
        return;
      }

      if (itemRefs.current?.length > 0) {
        const focusedIndex = itemRefs?.current?.indexOf(document.activeElement);

        if (event.key === " ") {
          if (itemRefs.current[focusedIndex]) {
            const selectedElement = itemRefs.current[focusedIndex];
            const checkbox = selectedElement.querySelector(
              '[role="checkbox"]',
            ) as HTMLInputElement;
            if (checkbox) {
              checkbox.click();
            }
          }
        }

        if (["ArrowUp", "ArrowDown"].includes(event.key))
          return handleHighlight(event, focusedIndex);

        if (event.key === "Enter" && !event.shiftKey) {
          if (itemRefs.current[focusedIndex]) {
            itemRefs.current[focusedIndex].click();
          }
          return;
        }
      }
      if (event.shiftKey && event.key.toLowerCase() === "s" && !targetIsInput) {
        preventDefault(event);
        if (inputRef.current) {
          inputRef.current.focus();
        }
        return;
      }
    },
    [search, handleHighlight, itemRefs, inputRef, dispatch],
  );

  const handleOnKeyUp = useCallback(
    (event: KeyboardEvent) => {
      // Handle shift key release - only update shift state, don't clear anchor
      if (event.key === "Shift") {
        dispatch({
          isShiftPressed: false,
        });
      }
    },
    [dispatch],
  );

  useEffect(() => {
    if (!search) return;

    window.addEventListener("keydown", handleOnKeyDown);
    window.addEventListener("keyup", handleOnKeyUp);

    return () => {
      window.removeEventListener("keydown", handleOnKeyDown);
      window.removeEventListener("keyup", handleOnKeyUp);
    };
  }, [search, itemRefs?.current?.length, handleOnKeyDown, handleOnKeyUp]);

  useEffect(() => {
    const ctrl = new AbortController();
    if (!search || inSnowflakeNativeApp) return;

    function nextTab() {
      const currentIndex = searchTabs.findIndex(
        (tab) => tab.id === initialSelectedSearchTab,
      );
      const nextIndex = (currentIndex + 1) % searchTabs.length;
      setInitialSelectedSearchTab(searchTabs[nextIndex].id);
    }

    function prevTab() {
      const currentIndex = searchTabs.findIndex(
        (tab) => tab.id === initialSelectedSearchTab,
      );
      const prevIndex = (currentIndex - 1 + searchTabs.length) % searchTabs.length;
      setInitialSelectedSearchTab(searchTabs[prevIndex].id);
    }

    function handleKeyDown(event: KeyboardEvent) {
      const stopKeys = ["Tab"];
      if (stopKeys.includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.key === "Tab" && event.shiftKey) return prevTab();
      if (event.key === "Tab") return nextTab();
    }

    window.addEventListener("keydown", handleKeyDown, { signal: ctrl.signal });
    return () => ctrl.abort();
  }, [initialSelectedSearchTab, search]);

  const renderContent = useCallback(
    (tabId: SearchTabId) => {
      if (tabId === "widgets") return null;

      if (tabId === "data" && !inSnowflakeNativeApp) {
        return (
          <DataConnectorProvider onWidgetAdded={() => onOpenChange(false)}>
            <DataConnectionTabs showAppsSection={false} showIcons={false} />
          </DataConnectorProvider>
        );
      }

      return null;
    },
    [onOpenChange],
  );

  const onInputChange = useCallback(
    (filter: string) => {
      setInputValue(filter);
      if (!filter && inputRef.current) {
        inputRef.current.value = filter;
      }
    },
    [inputRef],
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full">
        {!inSnowflakeNativeApp && (
          <Tabs
            className="mt-2.5 mb-4"
            variant="filled_secondary"
            value={initialSelectedSearchTab}
            onValueChange={setInitialSelectedSearchTab}
            onKeyDownCapture={(event) => {
              const stopKeys = ["ArrowLeft", "ArrowRight"];
              if (stopKeys.includes(event.key)) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              {searchTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="inline-flex min-w-0 items-center justify-center gap-2 text-xs"
                >
                  <Icon
                    id={tab.id === "widgets" ? "grid-01" : "database-01"}
                    className="size-4 shrink-0"
                  />
                  <span className="truncate">{tab.title}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <div className="flex-1 min-h-0 flex flex-col gap-2.5">
          <WidgetMenu
            isFiltered={deferredInput !== ""}
            globalSearch={deferredInput}
            itemRefs={itemRefs}
            globalIndexRef={globalIndexRef}
            onOpenChange={onOpenChange}
            widgets={widgetsArray}
            allCategories={allCategories}
            state={state}
            dispatch={dispatch}
            inputValue={inputValue}
            onInputChange={onInputChange}
            inputRef={inputRef}
          />
          {renderContent(initialSelectedSearchTab)}
        </div>
      </div>
    );
  }

  return (
    <BaseDialog
      className="gap-0 max-w-[90vw] w-full
      sm:max-w-[90vw] md:max-w-[95vw] lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl
      h-[90vh] sm:h-[80vh] md:h-[70vh] lg:h-[800px] max-h-[90vh]"
      open={search}
      onClose={() => changeSearch(false)}
    >
      <DialogTitle>Widget Menu</DialogTitle>
      <DialogDescription className="sr-only">
        Search for widgets or add data to your dashboard
      </DialogDescription>
      {!inSnowflakeNativeApp && (
        <Tabs
          className="mt-2.5 mb-4"
          variant="filled_secondary"
          value={initialSelectedSearchTab}
          onValueChange={setInitialSelectedSearchTab}
          onKeyDownCapture={(event) => {
            const stopKeys = ["ArrowLeft", "ArrowRight"];
            if (stopKeys.includes(event.key)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <TabsList>
            {searchTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="inline-flex gap-2 items-center justify-center h-6 text-xs"
              >
                <Icon
                  id={tab.id === "widgets" ? "grid-01" : "database-01"}
                  className="size-4"
                />
                <span>{tab.title}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div
        className={cn("flex h-full flex-col gap-2.5 overflow-y-auto", {
          "pt-2.5": inSnowflakeNativeApp,
          "max-h-[calc(99%-5rem)]": !inSnowflakeNativeApp,
        })}
      >
        <WidgetMenu
          isFiltered={deferredInput !== ""}
          globalSearch={deferredInput}
          itemRefs={itemRefs}
          globalIndexRef={globalIndexRef}
          onOpenChange={onOpenChange}
          widgets={widgetsArray}
          allCategories={allCategories}
          state={state}
          dispatch={dispatch}
          inputValue={inputValue}
          onInputChange={onInputChange}
          inputRef={inputRef}
        />
        {renderContent(initialSelectedSearchTab)}
      </div>
    </BaseDialog>
  );
});

export default SearchDialog;
