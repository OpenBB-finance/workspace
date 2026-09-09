import isEqual from "lodash.isequal";
import type { TreeItemIndex } from "react-complex-tree";
import { persist, subscribeWithSelector } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import { createWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/vanilla/shallow";
import type { Selector } from "./app";

const EXPANDED_MAP = {
  "shared-tabs": "expandedShared",
  tabs: "expandedMyDashboards",
  library: "expandedLibrary",
  dev: "expandedDev",
} as const;

type Expanded = keyof typeof EXPANDED_MAP;

interface SidebarState {
  scrollY: number;
  isHamburgerMenuOpen: boolean;
  effectiveExpanded: boolean;
  expandedShared: boolean;
  expandedMyDashboards: boolean;
  expandedLibrary: boolean;
  expandedDev: boolean;
  focusedItem: TreeItemIndex | null;
  activeItem: TreeItemIndex | null;
  expandedItems: TreeItemIndex[];
  selectedItems: TreeItemIndex[];
  width: number;
  getActiveItem: () => TreeItemIndex | null;
  sectionIsExpanded: (section: Expanded) => boolean;
  setEffectiveExpanded: (expanded: boolean) => void;
  toggleExpanded: (section: Expanded) => void;
  setScrollY: (scrollY: number) => void;
  setIsHamburgerMenuOpen: (isOpen: boolean) => void;
  toggleHamburgerMenu: () => void;
  setFocusedItem: (item: TreeItemIndex | null) => void;
  setExpandedItems: (cb: (prev: TreeItemIndex[]) => TreeItemIndex[]) => void;
  setSelectedItems: (items: TreeItemIndex[]) => void;
  setActiveItem: (item: TreeItemIndex | null) => void;
  setWidth: (width: number) => void;
}

export const useSidebarStore = createWithEqualityFn<SidebarState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        scrollY: 0,
        isHamburgerMenuOpen: false,
        effectiveExpanded: true,
        expandedShared: true,
        expandedMyDashboards: true,
        expandedLibrary: true,
        expandedDev: true,
        focusedItem: null,
        activeItem: null,
        expandedItems: [],
        selectedItems: [],
        width: 14,
        getActiveItem: () => get().activeItem,
        sectionIsExpanded: (section) => {
          const key = EXPANDED_MAP[section];
          if (!key) return false;
          return get()[key];
        },
        toggleExpanded: (section) => {
          const key = EXPANDED_MAP[section];
          if (!key) return;
          set((state) => ({ [key]: !state[key] }));
        },
        setEffectiveExpanded: (expanded) => set({ effectiveExpanded: expanded }),
        setScrollY: (scrollY) => set({ scrollY }),
        setIsHamburgerMenuOpen: (isOpen) => set({ isHamburgerMenuOpen: isOpen }),
        toggleHamburgerMenu: () =>
          set((state) => ({ isHamburgerMenuOpen: !state.isHamburgerMenuOpen })),
        setFocusedItem: (item) => set({ focusedItem: item }),
        setSelectedItems: (items) => set({ selectedItems: items }),
        setExpandedItems: (cb) =>
          set((state) => ({ expandedItems: cb(state.expandedItems) })),
        setActiveItem: (item) => set({ activeItem: item }),
        setWidth: (width) => set({ width }),
      }),
      {
        name: "sidebar-storage",
      },
    ),
  ),
  shallow,
);

export function useShallowSidebarStore<S extends SidebarState, T>(
  selector: Selector<S, T>,
): T {
  return useSidebarStore(useShallow(selector), (prev, next) => isEqual(prev, next));
}
