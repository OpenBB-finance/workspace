import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useDebounceValue } from "usehooks-ts";
import WidgetInfoTooltip from "~/components/General/WidgetInfoTooltip";
import { useStateReducer } from "~/hooks/useStateReducer";
import { inSnowflakeNativeApp } from "~/lib/constants";
import {
  findSelectedWidgets,
  getTypeToUse,
  useMyDataConnectors,
} from "~/lib/contexts/MyDataConnectorsContext";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowBackendConnectorStore } from "~/lib/state/backendConnector";
import { useShallowFeatureFlagsStore } from "~/lib/state/featureFlags";
import { useTutorialStore } from "~/lib/state/tutorial";
import { cn, handleWidgetDeletion } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { Checkbox } from "../ds/atoms/Checkbox";
import { ConfirmDialog } from "../ds/dialogs/ConfirmDialog";
import {
  LIBRARY_CARD_CLASS,
  LibraryItem,
  LibraryRow,
  LibrarySection,
} from "../ds/molecules/LibraryList";
import BrandedLoadingState from "../General/BrandedLoadingState";
import SearchResultsNotFound from "../General/SearchResultsNotFound";
import SnowflakeHide from "../General/SnowflakeHide";
import { someTruthy } from "../General/Table/utils";
import Icon from "../Icon";
import {
  TabPageEmptyState,
  TabPageLayout,
  TabPageSearchInput,
  TabPageToolbar,
  TabPageToolbarActions,
  TabPageToolbarDivider,
} from "../shared/TabPage";
import Tooltip from "../Tooltip";
import AddToDashboardDropdownMenu from "./AddToDashboardDropdownMenu";
import { RightSideActions } from "./NewComponents/RightSideActions";
import {
  type ItemType,
  type POSSIBLE_SOURCES,
  SourceMeta,
  type WidgetCardItem,
} from "./NewComponents/types";
import { type DcTabT, useDataConnectorContext } from "./Providers/DataConnectorContext";

export function MyWidgetsTab() {
  const [searchParams] = useSearchParams();
  const defaultExpandedBackendId = searchParams.get("backend");

  const {
    isGroupSelected,
    selectedWidgets,
    allElems,
    handleAddToDashboard,
    isLoading,
  } = useMyDataConnectors();

  const backendConnector = useShallowBackendConnectorStore((s) => ({
    setSingleWidgets: s.setSingleWidgets,
    updateApiSources: s.updateApiSources,
    setStoredFiles: s.setStoredFiles,
    setWidgetMetadata: s.setWidgetMetadata,
  }));
  const { removeWidget, getWidgetsByAttribute } = useShallowAppStore((s) => ({
    removeWidget: s.removeWidget,
    getWidgetsByAttribute: s.getWidgetsByAttribute,
  }));
  const { currentTutorial, currentStep, goToStep } = useTutorialStore();
  const { setOpen } = useDataConnectorContext();

  const [state, dispatch] = useStateReducer(null, () => ({
    filter: "",
    isDeleting: false,
    deleteConfirmOpen: false,
  }));
  const [debouncedFilter] = useDebounceValue(state.filter, 300);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredElems = useMemo(() => {
    const searchTerm = debouncedFilter.toLowerCase().trim();

    const filterOutEmptyItems = (items: (typeof allElems)[0]["items"]) =>
      items
        .map((item) => {
          if ("widgets" in item && item.widgets) {
            return {
              ...item,
              widgets: item.widgets.filter((widget) => widget.name?.trim()),
            };
          }
          return item;
        })
        .filter((item) => {
          if (!item.name?.trim()) return false;
          if ("widgets" in item && item.widgets) {
            return item.widgets.length > 0;
          }
          return true;
        }) as typeof items;

    if (!searchTerm) {
      return allElems
        .map((elem) => ({
          ...elem,
          items: filterOutEmptyItems(elem.items),
        }))
        .filter((elem) => elem.items.length > 0);
    }

    return allElems
      .map((elem) => ({
        ...elem,
        items: elem.items.filter((item) => {
          if (item.name?.toLowerCase().includes(searchTerm)) return true;

          if (item.description?.toLowerCase().includes(searchTerm)) return true;

          if ("widgets" in item && item.widgets) {
            return item.widgets.some((widget) => {
              return (
                widget.name?.toLowerCase().includes(searchTerm) ||
                widget.description?.toLowerCase().includes(searchTerm) ||
                widget.source?.toString().toLowerCase().includes(searchTerm) ||
                widget.category?.toLowerCase().includes(searchTerm) ||
                widget.subCategory?.toLowerCase().includes(searchTerm)
              );
            });
          }

          return false;
        }),
      }))
      .filter((elem) => elem.items.length > 0);
  }, [allElems, debouncedFilter]);

  const hasResults = someTruthy(...filteredElems.map((elem) => elem.items));

  const allWidgetIds = useMemo(() => {
    return filteredElems.flatMap((elem) =>
      elem.items.flatMap((item) => {
        if (
          elem.type === "backend" &&
          "widgets" in item &&
          item.widgets?.length === 0
        ) {
          return [item.selectionId];
        }
        if ("widgets" in item && item.widgets) {
          return item.widgets.map((widget) => widget.selectionId);
        }
        return [item.selectionId];
      }),
    );
  }, [filteredElems]);

  const selectionState = isGroupSelected(allWidgetIds);

  const onlyBackendSelected = useMemo(() => {
    if (!selectionState) return false;
    const foundWidgets = findSelectedWidgets(allElems, selectedWidgets);
    const deletableWidgets = foundWidgets.filter(
      (elem) => !(elem.shared || elem.selectionId.startsWith("backend,")),
    );
    return foundWidgets.length > 0 && deletableWidgets.length === 0;
  }, [allElems, selectedWidgets, selectionState]);

  const deleteWidgets = useCallback(
    (key: string) => {
      const selectedWidgets = getWidgetsByAttribute("widgetId", key);
      for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
        for (const widget of widgets) {
          removeWidget(dashId, widget.id);
        }
      }
    },
    [getWidgetsByAttribute, removeWidget],
  );

  const handleDelete = useCallback(async () => {
    const foundWidgets = findSelectedWidgets(allElems, selectedWidgets);

    const elemsToDelete: {
      type: string;
      id: string;
      parentName: string;
      uuid: string;
    }[] = [];

    for (const elem of foundWidgets) {
      if (elem.shared || elem.selectionId.startsWith("backend,")) {
        continue;
      }

      if (elem.widgetType) elem.type = elem.widgetType;

      elemsToDelete.push(elem);
    }

    if (elemsToDelete.length === 0) return;

    dispatch({ deleteConfirmOpen: true });
  }, [allElems, selectedWidgets]);

  const confirmDelete = useCallback(async () => {
    const foundWidgets = findSelectedWidgets(allElems, selectedWidgets);

    const elemsToDelete: {
      type: string;
      id: string;
      parentName: string;
      uuid: string;
      selectionId: string;
    }[] = [];

    for (const elem of foundWidgets) {
      if (elem.shared || elem.selectionId.startsWith("backend,")) {
        continue;
      }

      if (elem.widgetType) elem.type = elem.widgetType;

      elemsToDelete.push(elem);
    }

    if (elemsToDelete.length === 0) {
      return dispatch({ deleteConfirmOpen: false });
    }

    try {
      dispatch({ isDeleting: true });

      const settled = await Promise.allSettled(
        elemsToDelete.map(async (widget) => {
          const { type, id, uuid, selectionId } = widget;

          const typeToRemove = getTypeToUse(type, selectionId);
          return await handleWidgetDeletion({
            type: typeToRemove,
            id: id ?? uuid,
            backendConnector,
            deleteWidgets,
          });
        }),
      );

      const { successCount, failCount } = settled.reduce(
        (acc, result) => {
          const key = result.status === "fulfilled" ? "successCount" : "failCount";
          acc[key] += 1;
          return acc;
        },
        { successCount: 0, failCount: 0 },
      );

      if (successCount > 0 && failCount === 0) {
        return toast.success(
          <>
            <strong>Widget(s) successfully deleted</strong>
            <p className="mt-2">
              Widget(s) successfully deleted and removed from all dashboards where it
              was used.
            </p>
          </>,
        );
      }

      toast.error(
        <>
          <strong>{failCount} widget(s) failed to delete</strong>
          <p className="mt-2">
            {successCount > 0 && `${successCount} widget(s) successfully deleted. `}
            {failCount} widget(s) failed to delete and may still appear in your library
            and dashboards.
          </p>
        </>,
      );
    } catch (error) {
      toast.error("Failed to delete widget(s)");
    } finally {
      dispatch({ isDeleting: false, deleteConfirmOpen: false });
    }
  }, [allElems, selectedWidgets, backendConnector, deleteWidgets]);

  const onInputChange = useCallback(
    (filter: string) => {
      dispatch({ filter });

      if (inputRef.current && !filter) {
        inputRef.current.value = filter;
      }
    },
    [inputRef],
  );

  return (
    <>
      <TabPageLayout className="text-xs h-full">
        <TabPageToolbar>
          <TabPageSearchInput
            ref={inputRef}
            placeholder="Search for widgets"
            defaultValue={debouncedFilter}
            onChange={onInputChange}
          />
          <div className="flex gap-2 items-center flex-wrap">
            <TabPageToolbarActions>
              <Tooltip
                position="top"
                message={
                  onlyBackendSelected
                    ? "Backend widgets must be managed from the Apps page"
                    : "Delete widgets"
                }
              >
                <button
                  className="obb-small-navbar-btn rounded flex items-center justify-center size-7"
                  disabled={!selectionState || onlyBackendSelected}
                  onClick={handleDelete}
                >
                  <Icon id="trash-04" className="size-3.5" />
                </button>
              </Tooltip>
              <TabPageToolbarDivider />
              <AddToDashboardDropdownMenu
                onAddToDashboard={handleAddToDashboard}
                mainButton={true}
                disabled={!selectionState}
              />
            </TabPageToolbarActions>
            <SnowflakeHide>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (currentTutorial === "data_connectors" && currentStep === 1) {
                    setTimeout(() => goToStep(2), 500);
                  }
                  setOpen(true, {
                    dcTab: "backend",
                    mode: "create",
                  });
                }}
              >
                Add Data
              </Button>
            </SnowflakeHide>
          </div>
        </TabPageToolbar>

        <div className="overflow-y-auto only-sm:max-h-[calc(40vh)]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-8">
              <BrandedLoadingState message="Loading widgets..." />
            </div>
          ) : (
            <div className="flex flex-col">
              {hasResults || debouncedFilter ? (
                !hasResults && debouncedFilter ? (
                  <SearchResultsNotFound
                    extraClassName="rounded-lg bg-general-bg-primary p-12 h-[200px]"
                    icon={true}
                  />
                ) : (
                  <>
                    <hr className="border-surface-divider mt-2" />
                    {filteredElems.map((elem) => (
                      <LibraryRow key={elem.type}>
                        <SourceTypeSection
                          type={elem.type}
                          items={elem.items}
                          filter={debouncedFilter}
                          defaultExpandedBackendId={defaultExpandedBackendId}
                        />
                      </LibraryRow>
                    ))}
                  </>
                )
              ) : (
                <TabPageEmptyState
                  title="No widgets added"
                  description="You haven't added any widgets yet."
                  action={
                    <SnowflakeHide>
                      <Button
                        size="sm"
                        variant="primary"
                        className="mt-2"
                        onClick={() => {
                          setOpen(true, {
                            dcTab: "backend",
                            mode: "create",
                          });
                        }}
                      >
                        Add Data
                      </Button>
                    </SnowflakeHide>
                  }
                />
              )}
            </div>
          )}
        </div>
      </TabPageLayout>

      <ConfirmDialog
        open={state.deleteConfirmOpen}
        onClose={() => dispatch({ deleteConfirmOpen: false })}
        title="Delete Widget(s)"
        description={
          <span className="block">
            Are you sure you want to delete{" "}
            <span className="font-bold">
              {
                findSelectedWidgets(allElems, selectedWidgets).filter(
                  (elem) => !(elem.shared || elem.selectionId.startsWith("backend,")),
                ).length
              }
            </span>{" "}
            selected widget(s)?
          </span>
        }
        content={
          <>
            <span className="block mt-2 max-h-40 overflow-y-auto">
              <span className="block text-light-600 dark:text-dark-50 text-xs font-medium mb-1">
                Widgets to be deleted:
              </span>
              <ul className="text-xs space-y-1">
                {findSelectedWidgets(allElems, selectedWidgets)
                  .filter(
                    (elem) => !(elem.shared || elem.selectionId.startsWith("backend,")),
                  )
                  .map((widget, index) => (
                    <li
                      key={index}
                      className="text-light-900 dark:text-light-100 pl-2 border-l-2 border-light-200 dark:border-dark-600"
                    >
                      {widget.name || "Unnamed widget"}
                    </li>
                  ))}
              </ul>
            </span>
            <span className="block text-light-600 dark:text-dark-50 text-xs mt-3">
              This action cannot be undone.
            </span>
          </>
        }
        confirmButton={
          <Button
            variant="danger"
            size="sm"
            onClick={confirmDelete}
            loading={state.isDeleting}
            disabled={state.isDeleting}
          >
            Yes, Delete
          </Button>
        }
        cancelText="Cancel"
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// SourceTypeSection — replaces SourcesAccordion
// ---------------------------------------------------------------------------

function SourceTypeSection<T extends POSSIBLE_SOURCES>({
  type,
  items,
  filter,
  defaultExpandedBackendId,
}: {
  type: T;
  items: ItemType<T>[];
  filter?: string;
  defaultExpandedBackendId?: string | null;
}) {
  const hasMatchingBackend =
    type === "backend" &&
    defaultExpandedBackendId &&
    items.some(
      (item) =>
        item.id === defaultExpandedBackendId || item.uuid === defaultExpandedBackendId,
    );

  const { setOpen } = useDataConnectorContext();

  const { name } = useMemo(() => {
    const metadata = SourceMeta[type as keyof typeof SourceMeta];
    if (type === "backend" && inSnowflakeNativeApp)
      return { ...metadata, name: "Widgets" };
    return metadata;
  }, [type]);

  const [isOpen, setIsOpen] = useState(!!hasMatchingBackend);
  const [userClosed, setUserClosed] = useState(false);
  const isProTier = useShallowFeatureFlagsStore(
    (state) => state.featureFlags?.tier === "pro",
  );

  const isEmpty = items.length === 0;

  useEffect(() => {
    if (!filter && !isEmpty && userClosed) setUserClosed(false);
    if (filter && !isEmpty && !userClosed) setIsOpen(true);
  }, [isEmpty, filter, userClosed]);

  return (
    <LibrarySection
      title={name}
      open={isOpen && !userClosed}
      onOpenChange={() =>
        !isEmpty &&
        setIsOpen((prev) => {
          setUserClosed(prev);
          return !prev;
        })
      }
      disabled={isEmpty}
      className={cn({ "opacity-50": isEmpty })}
      tooltip={
        isEmpty && !(type === "widget_studio" && inSnowflakeNativeApp) ? (
          type === "widget_studio" ? (
            <div className="flex flex-col gap-2">
              <p>Create custom widgets</p>
              <Link to="/app/widget-studio" className="w-full">
                <Button className="w-full" size="xs">
                  Go to Widget Studio
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p>Zero connections added</p>
              <Button
                className="w-full"
                size="xs"
                onClick={() => {
                  setOpen(true, {
                    dcTab: type as DcTabT,
                    mode: "create",
                  });
                }}
              >
                Add Data
              </Button>
            </div>
          )
        ) : undefined
      }
      rightSection={
        type === "backend" ? (
          <Tooltip
            position="top"
            message={
              <>
                App widgets can only be managed in the{" "}
                <Link to="/app" className="obb-hyper-link">
                  Apps page
                </Link>
              </>
            }
          >
            <span className="mr-2">
              <Icon
                id="lock-01"
                className="size-[18px] dark:text-light-500 text-light-600"
              />
            </span>
          </Tooltip>
        ) : undefined
      }
    >
      <div className="mt-2.5 space-y-2.5">
        {items.map((item, index) => (
          <SourceItemSection
            key={`${item.name}-${item.description || ""}-${item.id ?? item.uuid}-${index}`}
            item={item}
            type={type}
            filter={filter}
            defaultExpanded={
              type === "backend" &&
              (item.id === defaultExpandedBackendId ||
                item.uuid === defaultExpandedBackendId)
            }
          />
        ))}
      </div>
    </LibrarySection>
  );
}

// ---------------------------------------------------------------------------
// SourceItemSection — replaces SourceAccordionItem
// ---------------------------------------------------------------------------

function VirtualizedWidgetList<T extends POSSIBLE_SOURCES>({
  items,
  parent,
  type,
}: {
  items: WidgetCardItem[];
  parent: ItemType<T>;
  type: T;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 48,
    overscan: 5,
    getItemKey: (index) => `${items[index].selectionId}-${index}`,
  });

  return (
    <div
      ref={scrollRef}
      className="min-w-32"
      style={{ maxHeight: Math.min(8, items.length) * 48, overflow: "auto" }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const child = items[virtualRow.index];
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
              className="pb-2"
            >
              <WidgetCard
                item={child}
                type={type}
                parentId={parent.id}
                parentType={parent.type}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceItemSection<T extends POSSIBLE_SOURCES>({
  type,
  item,
  filter,
  defaultExpanded = false,
}: {
  type: T;
  item: ItemType<T>;
  filter?: string;
  defaultExpanded?: boolean;
}) {
  const [userClosed, setUserClosed] = useState(false);
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const sectionRef = useRef<HTMLDivElement>(null);
  const hasChildren = "widgets" in item;
  const hasChildrenEmpty = hasChildren && item.widgets.length === 0;
  const backendOffline = type === "backend" && item?.status === "error";
  const { toggleGroup, isGroupSelected } = useMyDataConnectors();

  const { childrenIds, selectionState } = useMemo(() => {
    if (!hasChildren)
      return {
        childrenIds: [],
        selectionState: isGroupSelected([item.selectionId]),
      };
    const childrenIds = item.widgets.map((widget) => widget.selectionId);
    const selectionState = isGroupSelected(childrenIds);
    return { childrenIds, selectionState };
  }, [item, hasChildren, isGroupSelected]);

  useEffect(() => {
    if (hasChildren) {
      if (selectionState && !userClosed) return setIsOpen(true);
      if (!(filter || selectionState) && userClosed) setUserClosed(false);
    }
    if (filter && hasChildren && !userClosed) setIsOpen(true);
  }, [hasChildren, filter, userClosed]);

  // Scroll to section when defaultExpanded is true
  useEffect(() => {
    if (defaultExpanded && sectionRef.current) {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [defaultExpanded]);

  const finalIsOpen = isOpen && hasChildren && !hasChildrenEmpty;

  const filteredItems = useMemo(() => {
    if (!hasChildren) return [];
    const lowerFilter = filter?.toLowerCase() ?? "";
    return item.widgets?.filter((child) => {
      if (!child.name?.trim()) return false;
      return (
        child.name?.toLowerCase().includes(lowerFilter) ||
        child.description?.toLowerCase().includes(lowerFilter) ||
        child.source?.toString().toLowerCase().includes(lowerFilter) ||
        child.category?.toLowerCase().includes(lowerFilter) ||
        child.subCategory?.toLowerCase().includes(lowerFilter)
      );
    });
  }, [item, hasChildren, filter]);

  const leftSectionMemo = useMemo(
    () => (
      <div className="flex items-center gap-2">
        {hasChildren && (
          <Checkbox
            disabled={hasChildrenEmpty}
            onClick={(e) => e.stopPropagation()}
            checked={selectionState}
            onCheckedChange={() => toggleGroup(childrenIds)}
          />
        )}
        {item.shared && (
          <Tooltip message="Shared">
            <span className="bg-tag-orange-bg size-[26px] rounded-full flex items-center justify-center">
              <Icon id="user-group" className="text-tag-orange-label size-[14px]" />
            </span>
          </Tooltip>
        )}
      </div>
    ),
    [
      hasChildren,
      hasChildrenEmpty,
      selectionState,
      item.shared,
      type,
      item.name,
      toggleGroup,
    ],
  );

  const rightSectionMemo = useMemo(
    () => (
      <div className="flex gap-2 items-center">
        {type === "backend" && (
          <Tooltip
            position="top"
            message={
              item.status === "success"
                ? "Backend is connected"
                : "Backend not connected"
            }
          >
            <span
              className={cn("size-3 shrink-0 rounded-full", {
                "bg-green-500": item.status === "success",
                "bg-red-500": item.status === "error",
              })}
            />
          </Tooltip>
        )}
      </div>
    ),
    [type, item.name, item.id, item.status],
  );

  if (!hasChildren && type !== "backend") {
    return (
      <div ref={sectionRef} className="pl-2.5">
        <WidgetCard item={item} type={type} />
      </div>
    );
  }

  return (
    <div ref={sectionRef}>
      <LibraryItem
        variant="row"
        className={cn("px-2.5 w-full", {
          "opacity-50":
            hasChildrenEmpty || (type === "backend" && !hasChildren) || backendOffline,
        })}
        expandable={hasChildren && !hasChildrenEmpty}
        expanded={finalIsOpen && !userClosed}
        onExpandedChange={() => {
          hasChildren &&
            !hasChildrenEmpty &&
            setIsOpen((prev) => {
              setUserClosed(prev);
              return !prev;
            });
        }}
        leftSection={leftSectionMemo}
        title={`${item.name}${hasChildren ? ` (${item.widgets?.length ?? 0})` : ""}`}
        description={item.description ?? item.url}
        rightSection={rightSectionMemo}
      >
        {finalIsOpen && hasChildren && (
          <div className="space-y-2.5 pl-6 mt-6">
            <VirtualizedWidgetList items={filteredItems} parent={item} type={type} />
          </div>
        )}
      </LibraryItem>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WidgetCard — replaces SourceCard
// ---------------------------------------------------------------------------

const WidgetCard = memo(
  ({
    type,
    item,
    parentId,
    parentType,
  }: {
    type: POSSIBLE_SOURCES;
    item: WidgetCardItem;
    parentId?: string;
    parentType?: string;
  }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { toggleWidget, isSelected, handleAddToDashboard } = useMyDataConnectors();
    const id = item.uuid ?? item.id ?? item.widgetId;
    const {
      name,
      category,
      subCategory,
      source,
      selectionId,
      shared = false,
      description = item.url,
      createdDate,
    } = item;

    return (
      <LibraryItem
        variant="row"
        className={cn(LIBRARY_CARD_CLASS, "flex h-10 items-center w-full")}
        leftSection={
          <Checkbox
            checked={isSelected(selectionId)}
            onCheckedChange={() => toggleWidget(selectionId)}
          />
        }
        title={name}
        tooltip={
          <WidgetInfoTooltip
            name={name}
            description={description}
            connectionType={type}
            category={category}
            subCategory={subCategory}
            source={source}
            uploadedAt={createdDate}
          />
        }
        description={
          <div className="inline-flex gap-2.5 overflow-hidden items-center min-w-0">
            {shared && (
              <Tooltip message="Shared">
                <span className="bg-tag-orange-bg size-[26px] rounded-full flex items-center justify-center shrink-0">
                  <Icon id="user-group" className="text-tag-orange-label size-[14px]" />
                </span>
              </Tooltip>
            )}
            <span className="text-light-500 dark:text-dark-50 truncate">
              {description}
            </span>
          </div>
        }
        rightSection={
          <div
            className={cn(
              "flex items-center gap-2 shrink-0 transition-opacity duration-200",
              isDropdownOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {!shared && type !== "backend" && (
              <RightSideActions
                parentId={parentId}
                parentType={parentType}
                selectionId={selectionId}
                id={id}
                type={type}
                name={name}
                fileUrl={item.url}
                originalFileName={item.originalFileName}
              />
            )}
            <AddToDashboardDropdownMenu
              mainButton={true}
              onAddToDashboard={(dashboards) =>
                handleAddToDashboard(dashboards, selectionId)
              }
              onOpenChange={setIsDropdownOpen}
            />
          </div>
        }
      />
    );
  },
);
