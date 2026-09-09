import {
  type ComponentProps,
  type MutableRefObject,
  memo,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  ControlledTreeEnvironment,
  type DraggingPositionBetweenItems,
  type DraggingPositionItem,
  Tree,
  type TreeItem,
  type TreeItemIndex,
  type TreeRenderProps,
} from "react-complex-tree";
import "react-complex-tree/lib/style-modern.css";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { useCreateRef } from "~/hooks/useRefHooks";
import {
  type SideBarItem,
  type SideBarItems,
  useShallowAppStore,
} from "~/lib/state/app";
import { useShallowSidebarStore } from "~/lib/state/sidebar";
import { cn, generateRandomName, isInputFocused, useEventListener } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import ChevronRightIcon from "../Icons/ChevronRight";
import TabItem from "./TabItem";

function RenderItemsContainer({ children, containerProps }) {
  return useMemo(
    () => (
      <ul
        className="@max-[100px]:items-center rct-tree-items-container flex flex-col"
        {...containerProps}
      >
        {children}
      </ul>
    ),
    [children, containerProps],
  );
}

function renderItemArrow({
  item,
  context,
}: ComponentProps<TreeRenderProps["renderItemArrow"]>) {
  return item.isFolder ? (
    <span {...context.arrowProps} className="ml-0.5 mr-8">
      <ChevronRightIcon
        className={cn("w-4 h-4 transition-transform duration-300", {
          "transform rotate-90": context.isExpanded,
        })}
      />
    </span>
  ) : null;
}

const RenderItem = (props: ComponentProps<TreeRenderProps["renderItem"]>) => {
  const { context, info, children, ...rest } = props;
  const childrenMemo = useMemo(() => children, [children]);
  const contextMemo = useMemo(
    () => ({
      toggleExpandedState: context.toggleExpandedState,
      isExpanded: context.isExpanded,
      isDraggingOver: context.isDraggingOver,
      canDropOn: context.canDropOn,
      interactiveElementProps: context.interactiveElementProps,
      itemContainerWithoutChildrenProps: context.itemContainerWithoutChildrenProps,
      itemContainerWithChildrenProps: context.itemContainerWithChildrenProps,
    }),
    [
      context.isExpanded,
      context.isDraggingOver,
      context.canDropOn,
      context.interactiveElementProps,
      context.itemContainerWithoutChildrenProps,
      context.itemContainerWithChildrenProps,
    ],
  );
  return useMemo(
    () => (
      <TabItem key={rest.item.index} {...rest} context={contextMemo}>
        {childrenMemo}
      </TabItem>
    ),
    [Object.values(contextMemo), childrenMemo, Object.values(rest)],
  );
};

type TabsItemsProps = {
  tabsRef: MutableRefObject<HTMLDivElement | null | undefined>;
};

function recursiveChildrenIds(item: string, items: SideBarItems): string[] {
  if (!items[item]?.isFolder) return [item];
  const children = items[item]?.children ?? [];
  return children.flatMap((child) => recursiveChildrenIds(child, items));
}

export function useTabsItems(
  tabsRef: MutableRefObject<HTMLDivElement | null | undefined>,
) {
  const id = useParams()?.id;
  const tabId = useMemo(() => id, [id]);

  const rootItem = useShallowAppStore((state) => state.rootItem);
  const { currentItems, getLastInnerTab } = useShallowAppStore((state) => ({
    currentItems: state.sideBarItems,
    getLastInnerTab: state.getLastInnerTab,
  }));

  const expandedItems = useShallowSidebarStore((state) => state.expandedItems);
  const sideBarStore = useShallowSidebarStore((state) => ({
    isActive: state.activeItem === tabId,
    setActiveItem: state.setActiveItem,
    setExpandedItems: state.setExpandedItems,
    setSelectedItems: state.setSelectedItems,
  }));

  const currentItemsRef = useCreateRef(currentItems);
  const expandedItemsRef = useCreateRef(expandedItems);

  const itemsArray = useMemo(
    () =>
      rootItem?.children?.flatMap((child) =>
        recursiveChildrenIds(child, currentItemsRef.current),
      ),
    [rootItem?.children, currentItemsRef],
  );

  const navigate = useNavigate();

  const scrollIntoView = useCallback(
    async (item: TreeItemIndex, setActive = true) => {
      if (!tabsRef.current) return;

      const elem = tabsRef.current.querySelector(
        `[data-rct-item-id="${item}"]`,
      ) as HTMLElement;

      if (!elem) return;
      const { scrollTop, clientHeight } = tabsRef.current;

      const elemBottom = elem.offsetTop + elem.clientHeight <= scrollTop + clientHeight;
      const elemInView = elemBottom && elem.offsetTop >= scrollTop;

      setActive && sideBarStore.setActiveItem(item);
      if (elemInView) return;
      elem.scrollIntoView({
        behavior: "auto",
        block: "nearest",
        inline: "nearest",
      });
    },
    [tabsRef],
  );

  const handleKeyboardNavigation = useCallback(
    (event: KeyboardEvent) => {
      if (isInputFocused(event?.target)) return;

      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        if (!(itemsArray?.length && tabId)) return;

        const currentIndex = itemsArray.indexOf(tabId);

        const index =
          event.key === "ArrowDown"
            ? currentIndex + 1
            : currentIndex - 1 + itemsArray.length;

        const nextIndex = index % itemsArray.length;

        const newFocusedItemId = itemsArray[nextIndex];

        scrollIntoView(newFocusedItemId);
        const innerTab = getLastInnerTab(newFocusedItemId);
        // Navigate to the new item
        navigate(`/app/${newFocusedItemId}${innerTab && `?tab=${innerTab}`}`);
      }
    },
    [tabId, itemsArray, navigate],
  );

  useEffect(() => {
    tabId && queueMicrotask(() => setTimeout(() => scrollIntoView(tabId, false), 300));
    if (sideBarStore.isActive) return;
    sideBarStore.setActiveItem(tabId);
  }, [tabId]);

  useEffect(() => {
    const ctrl = new AbortController();
    window.addEventListener("keydown", handleKeyboardNavigation, {
      signal: ctrl.signal,
    });
    return () => ctrl.abort();
  }, [handleKeyboardNavigation]);

  useEventListener("scrollToTabItem", (detail) => {
    if (detail?.tabId)
      queueMicrotask(() => setTimeout(() => scrollIntoView(detail.tabId), 300));
  });

  useEffect(() => {
    if (tabId) {
      const currentItems = currentItemsRef.current;
      const findParents = (
        itemId: TreeItemIndex,
        itemsMap: Record<string, SideBarItem>,
      ): TreeItemIndex[] => {
        const parentId = currentItems[itemId]?.parentId;

        return parentId ? [parentId, ...findParents(parentId, itemsMap)] : [];
      };

      const item = currentItems[tabId];
      if (item) {
        // Find all parent IDs
        const parentIds = findParents(tabId, currentItems);
        if (parentIds.some((parentId) => !expandedItemsRef.current.includes(parentId)))
          // Ensure all parents are expanded
          sideBarStore.setExpandedItems((prevExpandedItems) =>
            Array.from(new Set([...prevExpandedItems, ...parentIds])),
          );
      }
    }
  }, [tabId, currentItemsRef]);
}

function TabsItems({ tabsRef }: TabsItemsProps) {
  useTabsItems(tabsRef);

  const [noDashboards, updateItems] = useShallowAppStore((state) => [
    !state.hasItems,
    state.updateItems,
  ]);
  const [rootItem, items] = useShallowAppStore((state) => [
    state.rootItem,
    state.sideBarItems,
  ]);

  const [focusedItem, expandedItems, selectedItems] = useShallowSidebarStore(
    (state) => [state.focusedItem, state.expandedItems, state.selectedItems],
  );
  const sideBarStore = useShallowSidebarStore((state) => ({
    getActiveItem: state.getActiveItem,
    setFocusedItem: state.setFocusedItem,
    setExpandedItems: state.setExpandedItems,
    setSelectedItems: state.setSelectedItems,
  }));

  const sidebarExpanded = useShallowSidebarStore((state) => state.expandedMyDashboards);

  const currentItems = useMemo(
    () =>
      items as Record<
        TreeItemIndex,
        TreeItem & { isRoot?: boolean; parentId?: TreeItemIndex }
      >,
    [Object.values(items)],
  );

  const currentItemsRef = useCreateRef(currentItems);
  const expandedItemsRef = useCreateRef(expandedItems);

  const handleOnDrop = useCallback(
    (
      treeItems: (TreeItem & { parentId: TreeItemIndex })[],
      target: DraggingPositionItem | DraggingPositionBetweenItems,
    ) => {
      const currentItems = currentItemsRef.current;
      const newItems = { ...currentItems };

      const expandedItems = expandedItemsRef.current;
      for (const item of treeItems) {
        const parent = currentItems[item.parentId];

        if (!parent) {
          throw Error(`Could not find parent of item "${item.index}"`);
        }

        if (!parent.children) {
          throw Error(
            `Parent "${parent.index}" of item "${item.index}" did not have any children`,
          );
        }
        // @ts-expect-error
        if (target.targetType === "item" || target.targetType === "root") {
          if (!newItems[target.targetItem]?.isFolder) {
            return;
          }
          if (target.targetItem === parent.index) {
            // Trying to drop inside itself
            return;
          }
          // trying to drop on another item
          newItems[parent.index] = {
            ...parent,
            children: parent.children.filter((child) => child !== item.index),
          };

          newItems[target.targetItem] = {
            ...currentItems[target.targetItem],
            children: [...(currentItems[target.targetItem].children ?? []), item.index],
          };

          newItems[item.index] = {
            ...item,
            parentId: target.targetItem,
          };

          if (
            currentItems[target.targetItem].isFolder &&
            !expandedItems.includes(target.targetItem)
          )
            sideBarStore.setExpandedItems((prevExpandedItems) =>
              Array.from(new Set([...prevExpandedItems, target.targetItem])),
            );
        } else {
          // trying to drop between items
          const newParent = currentItems[target.parentItem];
          const newParentChildren = [...(newParent.children ?? [])].filter(
            (child) => child !== item.index,
          );

          if (target.parentItem === item.index) {
            // Trying to drop inside itself
            return;
          }

          if (target.parentItem === parent.index) {
            // Trying to drop on another item
            const isOldItemPriorToNewItem =
              ((newParent.children ?? []).indexOf(item.index) ??
                Number.POSITIVE_INFINITY) < target.childIndex;
            newParentChildren.splice(
              target.childIndex - (isOldItemPriorToNewItem ? 1 : 0),
              0,
              item.index,
            );

            newItems[parent.index] = {
              ...parent,
              children: newParentChildren,
            };
          } else {
            // Trying to drop on another item in another folder
            newParentChildren.splice(target.childIndex, 0, item.index);

            newItems[parent.index] = {
              ...parent,
              children: parent.children.filter((child) => child !== item.index),
            };

            newItems[newParent.index] = {
              ...newParent,
              children: newParentChildren,
            };

            newItems[item.index] = {
              ...item,
              parentId: newParent.index,
            };
          }
        }
      }
      updateItems(newItems as any);
    },
    [currentItemsRef, expandedItemsRef],
  );

  const onFocusItem = useCallback(
    (item: TreeItem) => sideBarStore.setFocusedItem(item.index),
    [],
  );

  const onExpandItem = useCallback(
    (item: TreeItem) =>
      sideBarStore.setExpandedItems((prevExpandedItems) =>
        Array.from(new Set([...prevExpandedItems, item.index])),
      ),
    [],
  );

  const onCollapseItem = useCallback(
    (item: TreeItem) => {
      // Don't collapse if the current active tab is inside this folder
      const currentTabId = sideBarStore.getActiveItem();
      if (currentTabId && item.isFolder) {
        const childrenIds = recursiveChildrenIds(
          item.index as string,
          currentItemsRef.current as unknown as SideBarItems,
        );
        if (childrenIds.includes(currentTabId as string)) {
          return;
        }
      }

      sideBarStore.setExpandedItems((prevExpandedItems) =>
        prevExpandedItems.filter(
          (expandedItemIndex) => expandedItemIndex !== item.index,
        ),
      );
    },
    [sideBarStore.getActiveItem, currentItemsRef],
  );

  const onSelectItems = useCallback(
    (items: TreeItemIndex[]) => sideBarStore.setSelectedItems(items),
    [],
  );

  const getItemTitle = useCallback((item: TreeItem) => item.data.name, []);
  const renderItem = useCallback(
    (props: ComponentProps<TreeRenderProps["renderItem"]>) => (
      <RenderItem key={`${props.item.index}-render`} {...props} />
    ),
    [],
  );

  const treeContentMemo = useMemo(
    () => (
      <Tree
        key="sidebar-tree"
        treeId="sidebar"
        rootItem={rootItem?.index as string}
        treeLabel="Sidebar"
        renderItemsContainer={RenderItemsContainer}
        renderItem={renderItem}
        renderItemArrow={renderItemArrow}
      />
    ),
    [rootItem?.index],
  );

  const viewState = useMemo(
    () => ({ sidebar: { focusedItem, expandedItems, selectedItems } }),
    [expandedItems, selectedItems],
  );

  const treeMemo = useMemo(
    () => (
      <ControlledTreeEnvironment
        key="sidebar-tree-root"
        items={currentItems}
        getItemTitle={getItemTitle}
        viewState={viewState}
        canSearch={false}
        canSearchByStartingTyping={false}
        autoFocus={false}
        canDragAndDrop={sidebarExpanded}
        canReorderItems={sidebarExpanded}
        canDropOnFolder={sidebarExpanded}
        canDropOnNonFolder={false}
        onFocusItem={onFocusItem}
        onExpandItem={onExpandItem}
        onCollapseItem={onCollapseItem}
        onSelectItems={onSelectItems}
        onDrop={handleOnDrop}
      >
        {treeContentMemo}
      </ControlledTreeEnvironment>
    ),
    [viewState, currentItems, handleOnDrop, treeContentMemo, sidebarExpanded],
  );

  return noDashboards ? <NoDashboards /> : treeMemo;
}

function NoDashboards() {
  const addTab = useShallowAppStore((state) => state.addTab);
  const navigate = useNavigate();

  return (
    <div
      className="@max-[100px]:hidden p-5
      flex flex-col gap-2.5 items-center justify-center dark:bg-dark-850 rounded bg-light-50"
    >
      <p className="text-light-500 dark:text-dark-100 text-2xs text-center">
        No dashboards created
      </p>
      <Button
        onClick={() => {
          const id = uuidv4();
          addTab({
            index: id,
            data: {
              name: generateRandomName(),
              type: "custom",
              widgets: [],
            },
          });
          setTimeout(() => navigate(`/app/${id}`));
        }}
        size="xs"
        variant="outlined"
        className="whitespace-nowrap text-2xs"
      >
        Create Dashboard
      </Button>
    </div>
  );
}

export default memo(TabsItems);
