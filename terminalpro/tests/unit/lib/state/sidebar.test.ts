/**
 * Tests for sidebar Zustand store
 *
 * Tests the sidebar state management including:
 * - Hamburger menu toggling
 * - Section expansion (shared, my dashboards, library)
 * - Tree navigation (focus, selection, expansion)
 * - Scroll position tracking
 * - Width management
 */

import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSidebarStore } from "~/lib/state/sidebar";

describe("useSidebarStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    act(() => {
      useSidebarStore.setState({
        scrollY: 0,
        isHamburgerMenuOpen: false,
        effectiveExpanded: true,
        expandedShared: true,
        expandedMyDashboards: true,
        expandedLibrary: true,
        focusedItem: null,
        activeItem: null,
        expandedItems: [],
        selectedItems: [],
        width: 14,
      });
    });
  });

  describe("initial state", () => {
    it("should have correct initial values", () => {
      const state = useSidebarStore.getState();

      expect(state.scrollY).toBe(0);
      expect(state.isHamburgerMenuOpen).toBe(false);
      expect(state.effectiveExpanded).toBe(true);
      expect(state.expandedShared).toBe(true);
      expect(state.expandedMyDashboards).toBe(true);
      expect(state.expandedLibrary).toBe(true);
      expect(state.focusedItem).toBeNull();
      expect(state.activeItem).toBeNull();
      expect(state.expandedItems).toEqual([]);
      expect(state.selectedItems).toEqual([]);
      expect(state.width).toBe(14);
    });
  });

  describe("hamburger menu", () => {
    it("should set hamburger menu open state", () => {
      act(() => {
        useSidebarStore.getState().setIsHamburgerMenuOpen(true);
      });

      expect(useSidebarStore.getState().isHamburgerMenuOpen).toBe(true);

      act(() => {
        useSidebarStore.getState().setIsHamburgerMenuOpen(false);
      });

      expect(useSidebarStore.getState().isHamburgerMenuOpen).toBe(false);
    });

    it("should toggle hamburger menu", () => {
      expect(useSidebarStore.getState().isHamburgerMenuOpen).toBe(false);

      act(() => {
        useSidebarStore.getState().toggleHamburgerMenu();
      });

      expect(useSidebarStore.getState().isHamburgerMenuOpen).toBe(true);

      act(() => {
        useSidebarStore.getState().toggleHamburgerMenu();
      });

      expect(useSidebarStore.getState().isHamburgerMenuOpen).toBe(false);
    });
  });

  describe("section expansion", () => {
    it("should check if shared section is expanded", () => {
      expect(useSidebarStore.getState().sectionIsExpanded("shared-tabs")).toBe(true);

      act(() => {
        useSidebarStore.setState({ expandedShared: false });
      });

      expect(useSidebarStore.getState().sectionIsExpanded("shared-tabs")).toBe(false);
    });

    it("should check if my dashboards section is expanded", () => {
      expect(useSidebarStore.getState().sectionIsExpanded("tabs")).toBe(true);

      act(() => {
        useSidebarStore.setState({ expandedMyDashboards: false });
      });

      expect(useSidebarStore.getState().sectionIsExpanded("tabs")).toBe(false);
    });

    it("should check if library section is expanded", () => {
      expect(useSidebarStore.getState().sectionIsExpanded("library")).toBe(true);

      act(() => {
        useSidebarStore.setState({ expandedLibrary: false });
      });

      expect(useSidebarStore.getState().sectionIsExpanded("library")).toBe(false);
    });

    it("should return false for unknown section", () => {
      // @ts-expect-error - testing invalid input
      expect(useSidebarStore.getState().sectionIsExpanded("unknown")).toBe(false);
    });

    it("should toggle shared section", () => {
      expect(useSidebarStore.getState().expandedShared).toBe(true);

      act(() => {
        useSidebarStore.getState().toggleExpanded("shared-tabs");
      });

      expect(useSidebarStore.getState().expandedShared).toBe(false);

      act(() => {
        useSidebarStore.getState().toggleExpanded("shared-tabs");
      });

      expect(useSidebarStore.getState().expandedShared).toBe(true);
    });

    it("should toggle my dashboards section", () => {
      expect(useSidebarStore.getState().expandedMyDashboards).toBe(true);

      act(() => {
        useSidebarStore.getState().toggleExpanded("tabs");
      });

      expect(useSidebarStore.getState().expandedMyDashboards).toBe(false);
    });

    it("should toggle library section", () => {
      expect(useSidebarStore.getState().expandedLibrary).toBe(true);

      act(() => {
        useSidebarStore.getState().toggleExpanded("library");
      });

      expect(useSidebarStore.getState().expandedLibrary).toBe(false);
    });

    it("should not throw for unknown section toggle", () => {
      expect(() => {
        act(() => {
          // @ts-expect-error - testing invalid input
          useSidebarStore.getState().toggleExpanded("unknown");
        });
      }).not.toThrow();
    });
  });

  describe("effective expanded", () => {
    it("should set effective expanded state", () => {
      expect(useSidebarStore.getState().effectiveExpanded).toBe(true);

      act(() => {
        useSidebarStore.getState().setEffectiveExpanded(false);
      });

      expect(useSidebarStore.getState().effectiveExpanded).toBe(false);

      act(() => {
        useSidebarStore.getState().setEffectiveExpanded(true);
      });

      expect(useSidebarStore.getState().effectiveExpanded).toBe(true);
    });
  });

  describe("scroll position", () => {
    it("should set scroll Y position", () => {
      expect(useSidebarStore.getState().scrollY).toBe(0);

      act(() => {
        useSidebarStore.getState().setScrollY(100);
      });

      expect(useSidebarStore.getState().scrollY).toBe(100);

      act(() => {
        useSidebarStore.getState().setScrollY(250);
      });

      expect(useSidebarStore.getState().scrollY).toBe(250);
    });
  });

  describe("tree navigation - focused item", () => {
    it("should set focused item", () => {
      expect(useSidebarStore.getState().focusedItem).toBeNull();

      act(() => {
        useSidebarStore.getState().setFocusedItem("dashboard-1");
      });

      expect(useSidebarStore.getState().focusedItem).toBe("dashboard-1");
    });

    it("should clear focused item", () => {
      act(() => {
        useSidebarStore.getState().setFocusedItem("dashboard-1");
      });

      expect(useSidebarStore.getState().focusedItem).toBe("dashboard-1");

      act(() => {
        useSidebarStore.getState().setFocusedItem(null);
      });

      expect(useSidebarStore.getState().focusedItem).toBeNull();
    });
  });

  describe("tree navigation - active item", () => {
    it("should set active item", () => {
      expect(useSidebarStore.getState().activeItem).toBeNull();

      act(() => {
        useSidebarStore.getState().setActiveItem("dashboard-2");
      });

      expect(useSidebarStore.getState().activeItem).toBe("dashboard-2");
    });

    it("should get active item", () => {
      act(() => {
        useSidebarStore.getState().setActiveItem("dashboard-3");
      });

      expect(useSidebarStore.getState().getActiveItem()).toBe("dashboard-3");
    });

    it("should return null when no active item", () => {
      expect(useSidebarStore.getState().getActiveItem()).toBeNull();
    });
  });

  describe("tree navigation - selected items", () => {
    it("should set selected items", () => {
      expect(useSidebarStore.getState().selectedItems).toEqual([]);

      act(() => {
        useSidebarStore.getState().setSelectedItems(["dashboard-1", "dashboard-2"]);
      });

      expect(useSidebarStore.getState().selectedItems).toEqual([
        "dashboard-1",
        "dashboard-2",
      ]);
    });

    it("should replace selected items", () => {
      act(() => {
        useSidebarStore.getState().setSelectedItems(["dashboard-1"]);
      });

      act(() => {
        useSidebarStore.getState().setSelectedItems(["dashboard-2", "dashboard-3"]);
      });

      expect(useSidebarStore.getState().selectedItems).toEqual([
        "dashboard-2",
        "dashboard-3",
      ]);
    });

    it("should clear selected items", () => {
      act(() => {
        useSidebarStore.getState().setSelectedItems(["dashboard-1"]);
      });

      act(() => {
        useSidebarStore.getState().setSelectedItems([]);
      });

      expect(useSidebarStore.getState().selectedItems).toEqual([]);
    });
  });

  describe("tree navigation - expanded items", () => {
    it("should set expanded items with callback", () => {
      expect(useSidebarStore.getState().expandedItems).toEqual([]);

      act(() => {
        useSidebarStore.getState().setExpandedItems(() => ["folder-1", "folder-2"]);
      });

      expect(useSidebarStore.getState().expandedItems).toEqual(["folder-1", "folder-2"]);
    });

    it("should update expanded items based on previous state", () => {
      act(() => {
        useSidebarStore.getState().setExpandedItems(() => ["folder-1"]);
      });

      act(() => {
        useSidebarStore.getState().setExpandedItems((prev) => [...prev, "folder-2"]);
      });

      expect(useSidebarStore.getState().expandedItems).toEqual(["folder-1", "folder-2"]);
    });

    it("should remove expanded item", () => {
      act(() => {
        useSidebarStore.getState().setExpandedItems(() => ["folder-1", "folder-2"]);
      });

      act(() => {
        useSidebarStore
          .getState()
          .setExpandedItems((prev) => prev.filter((item) => item !== "folder-1"));
      });

      expect(useSidebarStore.getState().expandedItems).toEqual(["folder-2"]);
    });
  });

  describe("width", () => {
    it("should set width", () => {
      expect(useSidebarStore.getState().width).toBe(14);

      act(() => {
        useSidebarStore.getState().setWidth(20);
      });

      expect(useSidebarStore.getState().width).toBe(20);
    });

    it("should allow setting width to minimum value", () => {
      act(() => {
        useSidebarStore.getState().setWidth(0);
      });

      expect(useSidebarStore.getState().width).toBe(0);
    });
  });

  describe("complex interactions", () => {
    it("should handle multiple state changes", () => {
      act(() => {
        useSidebarStore.getState().setIsHamburgerMenuOpen(true);
        useSidebarStore.getState().toggleExpanded("tabs");
        useSidebarStore.getState().setActiveItem("dashboard-1");
        useSidebarStore.getState().setSelectedItems(["dashboard-1", "dashboard-2"]);
        useSidebarStore.getState().setWidth(18);
      });

      const state = useSidebarStore.getState();
      expect(state.isHamburgerMenuOpen).toBe(true);
      expect(state.expandedMyDashboards).toBe(false);
      expect(state.activeItem).toBe("dashboard-1");
      expect(state.selectedItems).toEqual(["dashboard-1", "dashboard-2"]);
      expect(state.width).toBe(18);
    });

    it("should maintain independence between section toggles", () => {
      act(() => {
        useSidebarStore.getState().toggleExpanded("shared-tabs");
      });

      const state = useSidebarStore.getState();
      expect(state.expandedShared).toBe(false);
      expect(state.expandedMyDashboards).toBe(true);
      expect(state.expandedLibrary).toBe(true);
    });
  });
});
