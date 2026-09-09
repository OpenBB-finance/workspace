import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DraggableCard from "~/components/DraggableCard/DraggableCard";
import { useWidgetContext } from "~/components/Widget.context";
import { useStateReducer } from "~/hooks/useStateReducer";
import { useTabContext } from "~/lib/contexts/TabContext";

// Mock the necessary hooks and components
vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(),
}));

vi.mock("~/lib/contexts/TabContext", () => ({
  useTabContext: vi.fn(),
}));

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: vi.fn(() => [{ accessError: null, hasAccess: true }, vi.fn()]),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(() => ({
    onHoveredCitation: false,
    isTyping: false,
  })),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: vi.fn(() => ({
    isSelected: false,
    selectedWidgetIDs: [],
  })),
}));

vi.mock("~/lib/state/permissions", () => ({
  useShallowPermissionsStore: vi.fn(() => ({
    hasAccess: vi.fn(() => true),
  })),
}));

vi.mock("~/components/LayoutAuth/Search/hooks/useFetchSharedResources", () => ({
  default: vi.fn(),
}));

vi.mock("~/components/Widgets/Helpers/useCopilotDataWidget", () => ({
  default: vi.fn(),
}));

vi.mock("~/components/DraggableCard/NavBar", () => ({
  default: vi.fn(({ title }) => <div data-testid="navbar">{title}</div>),
}));

vi.mock("~/components/DraggableCard/SetLoadingOnResize", () => ({
  LoadingElement: vi.fn(({ children }) => <div>{children}</div>),
}));

describe("DraggableCard", () => {
  const mockUseWidgetContext = useWidgetContext as any;
  const mockUseTabContext = useTabContext as any;

  beforeEach(() => {
    mockUseTabContext.mockReturnValue({
      isShared: false,
    });

    // Reset the useStateReducer mock to default state
    vi.mocked(useStateReducer).mockReturnValue([
      { accessError: null, hasAccess: true },
      vi.fn(),
    ]);
  });

  it("renders normally when widget ID is not blocked", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "widget-123",
          widgetId: "widget-123",
          name: "Test Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "widget-123",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    render(
      <DraggableCard title="Test Widget">
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(screen.getByTestId("widget-content")).toBeInTheDocument();
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });

  it("shows error message when widget is blocked", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "blocked-widget",
          widgetId: "blocked-widget",
          name: "Blocked Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "blocked-widget",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    // Mock the state reducer to simulate blocked access
    vi.mocked(useStateReducer).mockReturnValue([
      {
        accessError: "This widget is currently blocked from loading.",
        hasAccess: false,
      },
      vi.fn(),
    ]);

    render(
      <DraggableCard title="Blocked Widget" isBlocked={true}>
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(
      screen.getByText("This widget is currently blocked from loading."),
    ).toBeInTheDocument();
    expect(screen.getByText("Remove Widget")).toBeInTheDocument();
    expect(screen.queryByTestId("widget-content")).not.toBeInTheDocument();
  });

  it("renders normally when widget is not blocked", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "widget-123",
          widgetId: "widget-123",
          name: "Normal Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "widget-123",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    render(
      <DraggableCard title="Normal Widget" isBlocked={false}>
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(screen.getByTestId("widget-content")).toBeInTheDocument();
    expect(
      screen.queryByText("This widget is currently blocked from loading."),
    ).not.toBeInTheDocument();
  });

  it("shows error message when widget is blocked even if it's a shared resource", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "blocked-shared-widget",
          widgetId: "blocked-shared-widget",
          name: "Blocked Shared Widget",
          isSharedWidget: true,
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "blocked-shared-widget",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    // Mock the state reducer to simulate blocked access
    vi.mocked(useStateReducer).mockReturnValue([
      {
        accessError: "This widget is deprecated and cannot be used.",
        hasAccess: false,
      },
      vi.fn(),
    ]);

    render(
      <DraggableCard title="Blocked Shared Widget" isBlocked={true}>
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(
      screen.getByText("This widget is deprecated and cannot be used."),
    ).toBeInTheDocument();
    expect(screen.getByText("Remove Widget")).toBeInTheDocument();
    expect(screen.queryByTestId("widget-content")).not.toBeInTheDocument();
  });

  it("shows error message when widget ID is in blocked list", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "price-target-analyst",
          widgetId: "price-target-analyst",
          name: "Price Target Analyst Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "price-target-analyst",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    // Mock the state reducer to simulate blocked access
    vi.mocked(useStateReducer).mockReturnValue([
      {
        accessError: "This widget is deprecated and cannot be used.",
        hasAccess: false,
      },
      vi.fn(),
    ]);

    render(
      <DraggableCard title="Price Target Analyst Widget">
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(
      screen.getByText("This widget is deprecated and cannot be used."),
    ).toBeInTheDocument();
    expect(screen.getByText("Remove Widget")).toBeInTheDocument();
    expect(screen.queryByTestId("widget-content")).not.toBeInTheDocument();
  });

  it("renders normally when widget ID is not in blocked list", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "widget-not-blocked",
          widgetId: "widget-not-blocked",
          name: "Normal Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "widget-not-blocked",
        external: false,
        endpoint: { url: "https://example.com" },
        sourceName: "Test Source",
      },
    });

    render(
      <DraggableCard title="Normal Widget">
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    expect(screen.getByTestId("widget-content")).toBeInTheDocument();
    expect(
      screen.queryByText("This widget is deprecated and cannot be used."),
    ).not.toBeInTheDocument();
  });

  it("renders normally when external widget has blocked ID", () => {
    mockUseWidgetContext.mockReturnValue({
      widgetRef: {
        current: {
          id: "yield_curve",
          widgetId: "yield_curve",
          name: "External Yield Curve Widget",
        },
      },
      widgetFromJSON: null,
      widget: {
        sourceId: "source-1",
        widgetId: "yield_curve", // This is in BLOCKED_WIDGET_IDS
        external: true, // But it's external, so should not be blocked
        endpoint: { url: "https://external-api.com" },
        sourceName: "External Source",
      },
    });

    render(
      <DraggableCard title="External Yield Curve Widget">
        <div data-testid="widget-content">Widget Content</div>
      </DraggableCard>,
    );

    // The widget should NOT be blocked, so we should NOT see the error message
    expect(
      screen.queryByText("This widget is deprecated and cannot be used."),
    ).not.toBeInTheDocument();

    // We should NOT see the results-not-found component
    expect(screen.queryByTestId("results-not-found")).not.toBeInTheDocument();

    // We should see the navbar
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
  });
});
