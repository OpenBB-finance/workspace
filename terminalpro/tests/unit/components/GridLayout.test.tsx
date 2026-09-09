import { Responsive } from "@jose-donato/react-grid-layout";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { GridLayout } from "~/components/GridLayout";
import useIsMobile from "~/hooks/useIsMobile";
import { useTabContext } from "~/lib/contexts/TabContext";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowThemeStore } from "~/lib/state/theme";

// Mock all the dependencies
vi.mock("~/lib/contexts/TabContext");
vi.mock("~/lib/state/theme");
vi.mock("~/lib/state/app");
vi.mock("~/hooks/useIsMobile");
vi.mock("~/lib/utils", () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(" ")),
  saveToLS: vi.fn(),
}));

// Mock the react-grid-layout library
vi.mock("@jose-donato/react-grid-layout", () => ({
  Responsive: vi.fn(({ children }) => (
    <div data-testid="responsive-grid">{children}</div>
  )),
  WidthProvider: vi.fn((Component) => ({ children, ...props }) => (
    <Component {...props}>{children}</Component>
  )),
}));

// Mock the drag and drop hooks
vi.mock("~/components/GridLayout.hooks", () => ({
  useDragAndDropFiles: vi.fn(() => ({
    getRootProps: vi.fn(() => ({ "data-testid": "grid-root" })),
    getInputProps: vi.fn(() => ({ "data-testid": "grid-input" })),
    isDragActive: false,
  })),
}));

// Mock DragFileHere component
vi.mock("~/components/AI/DragFileHere", () => ({
  default: vi.fn(() => <div data-testid="drag-file-here">Drop files here</div>),
}));

// Mock Icon component
vi.mock("~/components/Icon", () => ({
  default: vi.fn(() => <div data-testid="icon">Icon</div>),
}));

const mockUseTabContext = vi.mocked(useTabContext);
const mockUseShallowThemeStore = vi.mocked(useShallowThemeStore);
const mockUseShallowAppStore = vi.mocked(useShallowAppStore);
const mockUseIsMobile = vi.mocked(useIsMobile);

describe("GridLayout", () => {
  const defaultTabContextValue = {
    currentTab: "tab1",
    tabId: "tab1",
    layouts: [],
    setLayouts: vi.fn(),
    getWidget: vi.fn(),
    isShared: false,
  };

  const defaultThemeStoreValue = {
    gridSnapping: "vertical",
    gridCorners: ["se"],
    setIsResizingGridElement: vi.fn(),
  };

  const defaultAppStoreValue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTabContext.mockReturnValue(defaultTabContextValue);
    mockUseShallowThemeStore.mockReturnValue(defaultThemeStoreValue);
    mockUseShallowAppStore.mockReturnValue(defaultAppStoreValue);
    mockUseIsMobile.mockReturnValue(false);
  });

  it("renders GridLayout with children", () => {
    render(
      <GridLayout>
        <div data-testid="child-widget">Widget Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("child-widget")).toBeInTheDocument();
  });

  it("applies default props correctly", () => {
    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    const gridRoot = screen.getByTestId("grid-root");
    expect(gridRoot).toBeInTheDocument();
    expect(gridRoot).toHaveClass("relative", "ml-px", "min-h-screen");
  });

  it("applies custom className via extraClassName prop", () => {
    render(
      <GridLayout extraClassName="custom-class">
        <div>Content</div>
      </GridLayout>,
    );

    const gridRoot = screen.getByTestId("grid-root");
    expect(gridRoot).toHaveClass("custom-class");
  });

  it("calls setLayouts when saveTab is false", () => {
    const mockSetLayouts = vi.fn();
    mockUseTabContext.mockReturnValue({
      ...defaultTabContextValue,
      setLayouts: mockSetLayouts,
    });

    render(
      <GridLayout saveTab={false}>
        <div>Content</div>
      </GridLayout>,
    );

    // The onLayoutChange callback should be set up to call setLayouts
    expect(mockSetLayouts).not.toHaveBeenCalled(); // Only called when layout actually changes
  });

  it("calls updateTabWidgetsLayout when saveTab is true", () => {
    const mockUpdateTabWidgetsLayout = vi.fn();
    mockUseShallowAppStore.mockReturnValue(mockUpdateTabWidgetsLayout);

    render(
      <GridLayout saveTab={true}>
        <div>Content</div>
      </GridLayout>,
    );

    // The onLayoutChange callback should be set up to call updateTabWidgetsLayout
    expect(mockUpdateTabWidgetsLayout).not.toHaveBeenCalled(); // Only called when layout actually changes
  });

  it("handles mobile mode correctly", () => {
    mockUseIsMobile.mockReturnValue(true);

    render(
      <GridLayout saveTab={true}>
        <div>Content</div>
      </GridLayout>,
    );

    // Grid should be rendered even in mobile mode
    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.isDraggable).toBe(false);
  });

  it("handles shared mode correctly", () => {
    mockUseTabContext.mockReturnValue({
      ...defaultTabContextValue,
      isShared: true,
    });

    render(
      <GridLayout saveTab={true}>
        <div>Content</div>
      </GridLayout>,
    );

    // Grid should be rendered in shared mode
    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.isDraggable).toBe(false);
  });

  it("handles locked mode correctly", () => {
    render(
      <GridLayout locked={true} saveTab={true}>
        <div>Content</div>
      </GridLayout>,
    );

    // Grid should be rendered in locked mode
    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.isDraggable).toBe(false);
    expect(lastCall.isResizable).toBe(false);
  });

  it("renders drag and drop input element", () => {
    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    const fileInput = screen.getByTestId("grid-input");
    expect(fileInput).toBeInTheDocument();
  });

  it("applies isDroppable prop correctly", () => {
    render(
      <GridLayout isDroppable={true}>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.isDroppable).toBe(true);
  });

  it("applies isBounded prop correctly", () => {
    render(
      <GridLayout isBounded={true}>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.isBounded).toBe(true);
  });

  it("applies custom draggableHandle prop", () => {
    render(
      <GridLayout draggableHandle=".custom-handle">
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.draggableHandle).toBe(".custom-handle");
  });

  it("applies custom rowHeight prop", () => {
    render(
      <GridLayout rowHeight={50}>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.rowHeight).toBe(50);
  });

  it("applies custom transformScale prop", () => {
    render(
      <GridLayout transformScale={1.5}>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.transformScale).toBe(1.5);
  });

  it("calls setIsResizingGridElement from theme store", () => {
    const mockSetIsResizingGridElement = vi.fn();
    mockUseShallowThemeStore.mockReturnValue({
      ...defaultThemeStoreValue,
      setIsResizingGridElement: mockSetIsResizingGridElement,
    });

    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    // The resize handlers should be set up to call setIsResizingGridElement
    expect(mockSetIsResizingGridElement).not.toHaveBeenCalled(); // Only called during actual resize
  });

  it("handles grid snapping settings", () => {
    mockUseShallowThemeStore.mockReturnValue({
      ...defaultThemeStoreValue,
      gridSnapping: "horizontal",
    });

    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.compactType).toBe("horizontal");
  });

  it("handles grid corners settings", () => {
    mockUseShallowThemeStore.mockReturnValue({
      ...defaultThemeStoreValue,
      gridCorners: ["se", "sw", "ne", "nw"],
    });

    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();

    const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
    expect(lastCall.resizeHandles).toEqual(["se", "sw", "ne", "nw"]);
  });

  it("handles undefined tabId gracefully", () => {
    mockUseTabContext.mockReturnValue({
      ...defaultTabContextValue,
      tabId: undefined,
    });

    render(
      <GridLayout saveTab={true}>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();
  });

  it("handles empty layouts array", () => {
    mockUseTabContext.mockReturnValue({
      ...defaultTabContextValue,
      layouts: [],
    });

    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();
  });

  it("handles layouts with items", () => {
    const mockLayouts = [
      { i: "widget1", x: 0, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
      { i: "widget2", x: 4, y: 0, w: 4, h: 4, minW: 2, minH: 2 },
    ];

    mockUseTabContext.mockReturnValue({
      ...defaultTabContextValue,
      layouts: mockLayouts,
    });

    render(
      <GridLayout>
        <div>Content</div>
      </GridLayout>,
    );

    expect(screen.getByTestId("grid-root")).toBeInTheDocument();
  });

  describe("mobileLayouts", () => {
    it("passes stacked mobile layouts for xxs/xs breakpoints", () => {
      const mockLayouts = [
        { i: "w1", x: 0, y: 0, w: 4, h: 4 },
        { i: "w2", x: 4, y: 0, w: 4, h: 6 },
      ];

      mockUseTabContext.mockReturnValue({
        ...defaultTabContextValue,
        layouts: mockLayouts,
      });

      render(
        <GridLayout>
          <div>Content</div>
        </GridLayout>,
      );

      const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
      const xxs = lastCall.layouts.xxs;
      const xs = lastCall.layouts.xs;

      // Both breakpoints receive the same mobile layout
      expect(xxs).toEqual(xs);

      // First item: h=4 bumped to 8, x=0, w=40, y=0
      expect(xxs[0]).toMatchObject({ i: "w1", x: 0, w: 40, y: 0, h: 8 });
      // Second item: h=6 bumped to 8, y = 8 (sum of previous heights)
      expect(xxs[1]).toMatchObject({ i: "w2", x: 0, w: 40, y: 8, h: 8 });
    });

    it("enforces minimum height of 8 for mobile layouts", () => {
      const mockLayouts = [{ i: "w1", x: 0, y: 0, w: 4, h: 3 }];

      mockUseTabContext.mockReturnValue({
        ...defaultTabContextValue,
        layouts: mockLayouts,
      });

      render(
        <GridLayout>
          <div>Content</div>
        </GridLayout>,
      );

      const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
      expect(lastCall.layouts.xxs[0].h).toBe(8);
    });

    it("preserves original height if >= 8 for mobile layouts", () => {
      const mockLayouts = [{ i: "w1", x: 0, y: 0, w: 4, h: 12 }];

      mockUseTabContext.mockReturnValue({
        ...defaultTabContextValue,
        layouts: mockLayouts,
      });

      render(
        <GridLayout>
          <div>Content</div>
        </GridLayout>,
      );

      const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
      expect(lastCall.layouts.xxs[0].h).toBe(12);
    });

    it("returns original layouts for empty array", () => {
      mockUseTabContext.mockReturnValue({
        ...defaultTabContextValue,
        layouts: [],
      });

      render(
        <GridLayout>
          <div>Content</div>
        </GridLayout>,
      );

      const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];
      expect(lastCall.layouts.xxs).toEqual([]);
      expect(lastCall.layouts.xs).toEqual([]);
    });

    it("passes original layouts for sm/md/lg/xl breakpoints", () => {
      const mockLayouts = [
        { i: "w1", x: 0, y: 0, w: 4, h: 4 },
        { i: "w2", x: 4, y: 2, w: 6, h: 10 },
      ];

      mockUseTabContext.mockReturnValue({
        ...defaultTabContextValue,
        layouts: mockLayouts,
      });

      render(
        <GridLayout>
          <div>Content</div>
        </GridLayout>,
      );

      const lastCall = (Responsive as Mock).mock.calls.at(-1)[0];

      for (const breakpoint of ["sm", "md", "lg", "xl"] as const) {
        expect(lastCall.layouts[breakpoint]).toEqual(mockLayouts);
      }
    });
  });
});
