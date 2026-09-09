import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TabProvider, useTabContext } from "~/lib/contexts/TabContext";
import TabPage from "~/routes/tab";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "test-tab-id" }),
    useSearchParams: () => [new URLSearchParams({ tab: "main" }), vi.fn()],
    useNavigate: () => vi.fn(),
  };
});

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: () => false,
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      updateTabParams: vi.fn(),
    }),
  },
  useShallowAppStore: vi.fn((selector: any) =>
    selector({
      getWidgetById: vi.fn(() => null),
      updateTabData: vi.fn(),
      getLastInnerTab: vi.fn(() => "main"),
      items: {
        "test-tab-id": {
          data: {
            gridLayout: {
              main: [{ i: "widget-1", x: 0, y: 0, w: 20, h: 10 }],
            },
          },
        },
      },
    }),
  ),
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: vi.fn((selector: any) =>
    selector({
      getWidgetById: vi.fn(() => null),
      sharedItems: {},
    }),
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: {
    getState: () => ({
      setPendingExport: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/utils", async () => {
  // Use the real implementations: the inner-tab param resolution is the logic under
  // test here, so a hand-rolled stub would make these assertions meaningless.
  const actual =
    await vi.importActual<typeof import("~/lib/utils/app")>("~/lib/utils/app");
  return {
    getInnerTabsGridLayout: actual.getInnerTabsGridLayout,
    resolveInnerTabParams: actual.resolveInnerTabParams,
  };
});

vi.mock("~/components/General/EmptyDashboardCTA", () => ({
  default: () => <div data-testid="empty-dashboard-cta">Empty Dashboard</div>,
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({ firstMessage }: { firstMessage: string }) => (
    <div data-testid="search-not-found">{firstMessage}</div>
  ),
}));

vi.mock("~/components/GridLayout", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="grid-layout">{children}</div>
  ),
}));

vi.mock("~/components/Widget", () => ({
  WidgetWrapper: ({ uuid }: { uuid: string }) => (
    <div data-testid={`widget-${uuid}`}>Widget {uuid}</div>
  ),
}));

vi.mock("~/routes/AuthedAppNotFound", () => ({
  default: () => <div data-testid="app-not-found">App Not Found</div>,
}));

describe("TabContext", () => {
  it("provides context value", () => {
    const TestComponent = () => {
      const context = useTabContext();
      return <div data-testid="context-value">{context.currentTab}</div>;
    };

    render(
      <TabProvider currentTab="test-tab" tabId="tab-123" layouts={[]} isShared={false}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("context-value")).toHaveTextContent("test-tab");
  });

  it("throws error when used outside provider", () => {
    const TestComponent = () => {
      useTabContext();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow(
      "useTabContext must be used within a TabProvider",
    );
  });
});

describe("TabProvider", () => {
  it("provides currentTab value", () => {
    const TestComponent = () => {
      const { currentTab } = useTabContext();
      return <div data-testid="current-tab">{currentTab}</div>;
    };

    render(
      <TabProvider currentTab="my-tab" tabId="123" layouts={[]}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("current-tab")).toHaveTextContent("my-tab");
  });

  it("provides tabId value", () => {
    const TestComponent = () => {
      const { tabId } = useTabContext();
      return <div data-testid="tab-id">{tabId}</div>;
    };

    render(
      <TabProvider currentTab="tab" tabId="tab-456" layouts={[]}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("tab-id")).toHaveTextContent("tab-456");
  });

  it("provides layouts value", () => {
    const layouts = [{ i: "widget-1", x: 0, y: 0, w: 10, h: 5 }];
    const TestComponent = () => {
      const { layouts } = useTabContext();
      return <div data-testid="layouts">{layouts.length}</div>;
    };

    render(
      <TabProvider currentTab="tab" tabId="123" layouts={layouts}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("layouts")).toHaveTextContent("1");
  });

  it("provides isShared value", () => {
    const TestComponent = () => {
      const { isShared } = useTabContext();
      return <div data-testid="is-shared">{isShared ? "yes" : "no"}</div>;
    };

    render(
      <TabProvider currentTab="tab" tabId="123" layouts={[]} isShared={true}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("is-shared")).toHaveTextContent("yes");
  });

  it("provides getWidget function", () => {
    const TestComponent = () => {
      const { getWidget } = useTabContext();
      return (
        <div data-testid="get-widget">
          {typeof getWidget === "function" ? "yes" : "no"}
        </div>
      );
    };

    render(
      <TabProvider currentTab="tab" tabId="123" layouts={[]}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("get-widget")).toHaveTextContent("yes");
  });

  it("provides setLayouts function", () => {
    const TestComponent = () => {
      const { setLayouts } = useTabContext();
      return (
        <div data-testid="set-layouts">
          {typeof setLayouts === "function" ? "yes" : "no"}
        </div>
      );
    };

    render(
      <TabProvider currentTab="tab" tabId="123" layouts={[]}>
        <TestComponent />
      </TabProvider>,
    );

    expect(screen.getByTestId("set-layouts")).toHaveTextContent("yes");
  });

  it("calls custom setLayouts when provided", () => {
    const customSetLayouts = vi.fn();
    const TestComponent = () => {
      const { setLayouts } = useTabContext();
      return <button onClick={() => setLayouts([])}>Update layouts</button>;
    };

    render(
      <TabProvider
        currentTab="tab"
        tabId="123"
        layouts={[]}
        setLayouts={customSetLayouts}
      >
        <TestComponent />
      </TabProvider>,
    );
    act(() => screen.getByRole("button").click());
    expect(customSetLayouts).toHaveBeenCalled();
  });
});

describe("TabPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders grid layout when widgets exist", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => ({ id: "widget-1" })),
        updateTabData: vi.fn(),
        getLastInnerTab: vi.fn(() => "main"),
        items: {
          "test-tab-id": {
            data: {
              gridLayout: {
                main: [{ i: "widget-1", x: 0, y: 0, w: 20, h: 10 }],
              },
            },
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/test-tab-id?tab=main"]}>
        <TabPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("grid-layout")).toBeInTheDocument();
  });

  it("renders widget wrapper for each widget in layout", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => ({ id: "widget-1" })),
        updateTabData: vi.fn(),
        getLastInnerTab: vi.fn(() => "main"),
        items: {
          "test-tab-id": {
            data: {
              gridLayout: {
                main: [
                  { i: "widget-1", x: 0, y: 0, w: 20, h: 10 },
                  { i: "widget-2", x: 20, y: 0, w: 20, h: 10 },
                ],
              },
            },
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/test-tab-id?tab=main"]}>
        <TabPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("widget-widget-1")).toBeInTheDocument();
    expect(screen.getByTestId("widget-widget-2")).toBeInTheDocument();
  });

  it("renders empty dashboard CTA when no widgets", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => null),
        updateTabData: vi.fn(),
        getLastInnerTab: vi.fn(() => "main"),
        items: {
          "test-tab-id": {
            data: {
              gridLayout: {
                main: [],
              },
            },
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/test-tab-id?tab=main"]}>
        <TabPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("empty-dashboard-cta")).toBeInTheDocument();
  });

  it("renders app not found when no layout exists", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => null),
        updateTabData: vi.fn(),
        getLastInnerTab: vi.fn(() => null),
        items: {},
      }),
    );

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/app/non-existent-tab"]}>
          <TabPage />
        </MemoryRouter>,
      );
    });

    expect(screen.getByTestId("app-not-found")).toBeInTheDocument();
  });
});

describe("TabPage - Shared Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows shared empty message for empty shared dashboard", async () => {
    const { useShallowAppStore } = await import("~/lib/state/app");
    const { useShallowSharedAppStore } = await import("~/lib/state/sharedApp");

    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => null),
        updateTabData: vi.fn(),
        getLastInnerTab: vi.fn(() => "main"),
        items: {},
      }),
    );

    vi.mocked(useShallowSharedAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetById: vi.fn(() => null),
        sharedItems: {
          "test-tab-id": {
            data: {
              gridLayout: {
                main: [],
              },
            },
          },
        },
      }),
    );

    render(
      <MemoryRouter initialEntries={["/app/test-tab-id?tab=main"]}>
        <TabPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("search-not-found")).toBeInTheDocument();
    expect(screen.getByText("Empty shared dashboard")).toBeInTheDocument();
  });
});
