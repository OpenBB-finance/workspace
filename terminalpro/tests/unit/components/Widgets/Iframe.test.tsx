import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Iframe from "~/components/Widgets/Iframe";
import { useThemeStore } from "~/lib/state/theme";
import { renderWidget } from "./WidgetTestWrapper";

const iframeProtocolMock = vi.hoisted(() => ({
  state: {
    manifest: [],
    paramDefs: null,
    requestWidgetData: vi.fn(),
    sendParamsUpdate: vi.fn(),
  } as any,
}));

const appStoreMock = vi.hoisted(() => ({
  getWidgetGroups: vi.fn((..._args) => []),
  updateGroup: vi.fn(),
}));

const sharedAppStoreMock = vi.hoisted(() => ({
  getWidgetGroups: vi.fn((..._args) => []),
}));

const queryParamsMock = vi.hoisted(() => ({
  renderRow0Params: null as any,
  renderBelowNavbarRows: null as any,
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({
    children,
    elementRightNextToTitle,
    elementNextToTitle,
    elementBelowNavbar,
    extraNavbarElements,
  }: any) => (
    <div data-testid="draggable-card">
      {elementRightNextToTitle}
      {elementNextToTitle}
      {elementBelowNavbar}
      {extraNavbarElements}
      {children}
    </div>
  ),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({ firstMessage, children }: any) => (
    <div data-testid="search-not-found">
      <span>{firstMessage}</span>
      {children}
    </div>
  ),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ children, open }: any) =>
    open ? <div data-testid="url-dialog">{children}</div> : null,
}));

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: () => ({
    isMobile: false,
    setMobileCopilotDrawer: vi.fn(),
  }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) =>
    selector({
      items: {},
      getWidgetGroups: vi.fn((...args) => {
        const [tabId] = args;
        if (tabId === "shared-tab") {
          return sharedAppStoreMock.getWidgetGroups(...args);
        }
        return appStoreMock.getWidgetGroups(...args);
      }),
      updateGroup: appStoreMock.updateGroup,
    }),
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: (selector: any) =>
    selector({
      getWidgetGroups: sharedAppStoreMock.getWidgetGroups,
    }),
}));

vi.mock("~/components/Widgets/Helpers/IframeParamControls", () => ({
  IframeParamControls: ({ paramDefs }: any) => (
    <div data-testid="iframe-param-controls">
      {paramDefs.map((param: any) => (
        <span key={param.paramName}>{param.paramName}</span>
      ))}
    </div>
  ),
}));

vi.mock("~/components/Widgets/Helpers/useIframeProtocol", () => ({
  useIframeProtocol: () => iframeProtocolMock.state,
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => queryParamsMock,
}));

describe("Iframe Widget", () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: "dark" });
    iframeProtocolMock.state.manifest = [];
    iframeProtocolMock.state.paramDefs = null;
    iframeProtocolMock.state.requestWidgetData = vi.fn();
    iframeProtocolMock.state.sendParamsUpdate = vi.fn();
    appStoreMock.getWidgetGroups.mockReturnValue([]);
    appStoreMock.updateGroup.mockReset();
    sharedAppStoreMock.getWidgetGroups.mockReturnValue([]);
    queryParamsMock.renderRow0Params = null;
    queryParamsMock.renderBelowNavbarRows = null;
  });

  it("renders empty state when no URL is provided", () => {
    renderWidget(<Iframe />, {
      widgetOverrides: { storage: { html: "" } },
    });

    expect(screen.getByTestId("search-not-found")).toBeInTheDocument();
    expect(screen.getByText("No URL provided")).toBeInTheDocument();
  });

  it("renders Add URL button in empty state", () => {
    renderWidget(<Iframe />, {
      widgetOverrides: { storage: { html: "" } },
    });

    expect(screen.getByRole("button", { name: /add url/i })).toBeInTheDocument();
  });

  it("renders iframe when URL is provided", () => {
    renderWidget(<Iframe />, {
      widgetOverrides: {
        storage: { html: "https://example.com", scale: 1.0 },
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "https://example.com/?theme=dark");
  });

  it("passes the active light theme to iframe URLs", () => {
    useThemeStore.setState({ theme: "light" });

    renderWidget(<Iframe />, {
      widgetOverrides: {
        storage: { html: "https://example.com/widget", scale: 1.0 },
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute("src", "https://example.com/widget?theme=light");
  });

  it("displays URL in button when URL is set", () => {
    renderWidget(<Iframe />, {
      widgetOverrides: {
        storage: { html: "https://openbb.co", scale: 1.0 },
      },
    });

    expect(screen.getByText("https://openbb.co")).toBeInTheDocument();
  });

  it("shows zoom controls when URL is provided", () => {
    renderWidget(<Iframe />, {
      widgetOverrides: {
        storage: { html: "https://example.com", scale: 1.0 },
      },
    });

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("hides iframe protocol params that are hidden by the widget manifest", () => {
    iframeProtocolMock.state.manifest = [{ widgetId: "browse_markets" }];
    iframeProtocolMock.state.paramDefs = [
      {
        paramName: "event_ticker",
        label: "Select event shared with the dashboard",
        type: "text",
        value: "KXEVENT",
      },
      {
        paramName: "search",
        label: "Search",
        type: "text",
        value: "",
      },
    ];

    renderWidget(<Iframe />, {
      widgetOverrides: {
        id: "browse_markets",
        storage: { html: "https://example.com", scale: 1.0 },
        params: [
          {
            paramName: "event_ticker",
            type: "endpoint",
            show: false,
          },
        ],
      },
    });

    expect(screen.getByTestId("iframe-param-controls")).toHaveTextContent("search");
    expect(screen.queryByText("event_ticker")).not.toBeInTheDocument();
  });

  it("renders visible widget params through the shared navbar controls", () => {
    queryParamsMock.renderRow0Params = (
      <div data-testid="native-widget-params">Category / Tag / Event</div>
    );

    renderWidget(<Iframe />, {
      widgetOverrides: {
        id: "browse_markets",
        storage: { html: "https://example.com", scale: 1.0 },
        params: [
          {
            paramName: "selection",
            type: "endpoint",
            show: true,
          },
        ],
      },
    });

    expect(screen.getByTestId("native-widget-params")).toHaveTextContent(
      "Category / Tag / Event",
    );
  });

  it("does not duplicate iframe protocol params already owned by widget params", () => {
    iframeProtocolMock.state.manifest = [{ widgetId: "browse_markets" }];
    iframeProtocolMock.state.paramDefs = [
      {
        paramName: "selection",
        label: "Category / Tag / Event",
        type: "text",
        value: "All",
      },
      {
        paramName: "search",
        label: "Search",
        type: "text",
        value: "",
      },
    ];

    renderWidget(<Iframe />, {
      widgetOverrides: {
        id: "browse_markets",
        storage: { html: "https://example.com", scale: 1.0 },
        params: [
          {
            paramName: "selection",
            type: "endpoint",
            show: true,
          },
        ],
      },
    });

    expect(screen.getByTestId("iframe-param-controls")).toHaveTextContent("search");
    expect(screen.getByTestId("iframe-param-controls")).not.toHaveTextContent(
      "selection",
    );
  });

  it("uses grouped params in the iframe URL even when widget storage is stale", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([
      {
        id: "selection-group",
        type: "endpointParam",
        groupById: "selection-options",
        value: "Sports",
      },
    ]);

    renderWidget(<Iframe />, {
      widgetOverrides: {
        id: "browse_markets",
        storage: {
          html: "https://example.com/browse",
          scale: 1.0,
          params: { selection: "All" },
        },
        params: [
          {
            paramName: "selection",
            type: "endpoint",
            groupById: "selection-options",
            value: "All",
            show: true,
          },
        ],
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute(
      "src",
      "https://example.com/browse?selection=Sports&theme=dark",
    );
  });

  it("uses grouped params in the iframe URL when widget params are row-grouped", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([
      {
        id: "selection-group",
        type: "endpointParam",
        groupById: "selection-options",
        value: "Sports",
      },
    ]);

    renderWidget(<Iframe />, {
      widgetOverrides: {
        id: "browse_markets",
        storage: {
          html: "https://example.com/browse",
          scale: 1.0,
          params: { selection: "All" },
        },
        params: [
          {
            paramName: "selection",
            type: "endpoint",
            groupById: "selection-options",
            value: "All",
            show: true,
          },
        ] as any,
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute(
      "src",
      "https://example.com/browse?selection=Sports&theme=dark",
    );
  });

  it("uses shared grouped params in the iframe URL", () => {
    sharedAppStoreMock.getWidgetGroups.mockReturnValue([
      {
        id: "selection-group",
        type: "endpointParam",
        groupById: "selection-options",
        value: "Crypto",
      },
    ]);

    renderWidget(<Iframe />, {
      isShared: true,
      activeDashboardId: "shared-tab",
      widgetOverrides: {
        id: "browse_markets",
        storage: {
          html: "https://example.com/browse",
          scale: 1.0,
          params: { selection: "All" },
        },
        params: [
          {
            paramName: "selection",
            type: "endpoint",
            groupById: "selection-options",
            value: "All",
            show: true,
          },
        ],
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).toHaveAttribute(
      "src",
      "https://example.com/browse?selection=Crypto&theme=dark",
    );
  });
});
