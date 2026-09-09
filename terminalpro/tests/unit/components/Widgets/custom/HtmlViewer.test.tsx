import { fireEvent, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import HtmlViewer from "~/components/Widgets/custom/HtmlViewer";
import { mockConfig } from "../../../../mocks/runtimeConfig";
import { renderWidget } from "../WidgetTestWrapper";

const appStoreMock = vi.hoisted(() => ({
  getWidgetGroups: vi.fn(() => []),
  getTabById: vi.fn(() => undefined),
  updateGroup: vi.fn(),
}));

const sharedAppStoreMock = vi.hoisted(() => ({
  getDashboardById: vi.fn(() => undefined),
  getWidgetGroups: vi.fn(() => []),
}));

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, loading, error }: any) => (
    <div data-testid="draggable-card">
      {loading && <span data-testid="loading">Loading...</span>}
      {error && <span data-testid="error">Error</span>}
      {children}
    </div>
  ),
}));

vi.mock("~/lib/api", () => ({
  useJsonData: vi.fn(() => ({
    data: "<div>Test HTML Content</div>",
    isLoading: false,
    error: null,
    dataUpdatedAt: Date.now(),
  })),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: (selector: any) =>
    selector({
      getWidgetGroups: appStoreMock.getWidgetGroups,
      getTabById: appStoreMock.getTabById,
      updateGroup: appStoreMock.updateGroup,
    }),
}));

vi.mock("~/lib/state/sharedApp", () => ({
  useShallowSharedAppStore: (selector: any) =>
    selector({
      getDashboardById: sharedAppStoreMock.getDashboardById,
      getWidgetGroups: sharedAppStoreMock.getWidgetGroups,
    }),
}));

vi.mock("~/components/General/Table/NavBar/QueryParams", () => ({
  useWidgetParamsPositions: () => ({
    renderRow0Params: null,
    renderBelowNavbarRows: null,
  }),
}));

describe("HtmlViewer Widget", () => {
  it("renders HTML viewer container", () => {
    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });
});

describe("HtmlViewer - Loading State", () => {
  it("shows loading state", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    // @ts-expect-error - ignored for now
    useJsonData.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      dataUpdatedAt: Date.now(),
    });

    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
      },
    });

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });
});

describe("HtmlViewer - raw data query", () => {
  const HTML_DATA_UPDATED_AT = 1720000000000;

  beforeEach(async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    useJsonData.mockClear();
    // @ts-expect-error - partial mock
    useJsonData.mockReturnValue({
      data: "<div>html</div>",
      isLoading: false,
      error: null,
      dataUpdatedAt: HTML_DATA_UPDATED_AT,
    });
  });

  it("uses a stale raw query so entering raw view refetches the endpoint", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));

    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        id: "html-raw",
        raw: true,
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
      },
    });

    // The second useJsonData call is the raw-data query
    const [rawOptions, rawQueryOptions] = useJsonData.mock.calls.at(-1) ?? [];
    expect(rawOptions.params.raw).toBe(true);
    expect(rawOptions.queryKey).toBeUndefined();
    expect(rawQueryOptions.staleTime).toBe(0);
  });

  it("does not share the html run-button query key with the raw query", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));

    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        id: "html-raw-run",
        raw: true,
        runButton: true,
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
      },
    });

    const htmlOptions = useJsonData.mock.calls.at(-2)?.[0];
    const rawOptions = useJsonData.mock.calls.at(-1)?.[0];
    expect(htmlOptions.queryKey).toBeDefined();
    expect(rawOptions.queryKey).toBeUndefined();
  });
});

describe("HtmlViewer - iframe params bridge", () => {
  const BRIDGE_UUID = "11111111-1111-1111-1111-111111111111";
  const FULL_TOKEN = `openbb-html-${BRIDGE_UUID}`;

  beforeAll(() => {
    mockConfig.data.allowHtmlJsExecution = true;
    vi.spyOn(crypto, "randomUUID").mockReturnValue(BRIDGE_UUID);
  });

  afterAll(() => {
    mockConfig.data.allowHtmlJsExecution = false;
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));
    useJsonData.mockClear();
    // @ts-expect-error - partial mock
    useJsonData.mockReturnValue({
      data: "<html><body><p>hi</p></body></html>",
      isLoading: false,
      error: null,
      dataUpdatedAt: Date.now(),
    });
    appStoreMock.getWidgetGroups.mockReturnValue([]);
    appStoreMock.getTabById.mockReturnValue(undefined);
    appStoreMock.updateGroup.mockReset();
    sharedAppStoreMock.getDashboardById.mockReturnValue(undefined);
    sharedAppStoreMock.getWidgetGroups.mockReturnValue([]);
  });

  it("includes storage params in the run-button html query key", async () => {
    const { useJsonData } = vi.mocked(await import("~/lib/api"));

    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        id: "market-filters",
        runButton: true,
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: { use_categories: "correctional_facilities" } },
        params: [{ paramName: "use_categories" }],
      },
    });

    const [options] = useJsonData.mock.calls.at(-1) ?? [];
    expect(options.queryKey).toContain(
      JSON.stringify({
        use_categories: "correctional_facilities",
        theme: "dark",
      }),
    );
  });

  it("updates widget storage when a bridge-tokened params message arrives", () => {
    const updateWidget = vi.fn();
    renderWidget(<HtmlViewer />, {
      updateWidget,
      widgetOverrides: {
        id: "html-1",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "event_ticker" }, { paramName: "limit" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:widget-params:update",
          params: { event_ticker: "KXSB-27", limit: 40 },
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(updateWidget).toHaveBeenCalled();
    const [updater] = updateWidget.mock.calls.at(-1) ?? [];
    const next = updater({ storage: { params: { existing: "x" } } });
    expect(next.storage.params).toEqual({
      existing: "x",
      event_ticker: "KXSB-27",
      limit: 40,
    });
    expect(next.refreshQuery).toBeUndefined();
  });

  it("fires the per-widget updateQueryParams custom event with the filtered params", () => {
    const handler = vi.fn();
    window.addEventListener("updateQueryParams-html-evt", handler as EventListener);

    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        id: "html-evt",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "ticker" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:params:update",
          paramName: "ticker",
          value: "AAPL",
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls.at(-1)?.[0] as CustomEvent).detail;
    expect(detail).toEqual({ ticker: "AAPL" });

    window.removeEventListener("updateQueryParams-html-evt", handler as EventListener);
  });

  it("handles params dispatched as same-origin iframe custom events", () => {
    const updateWidget = vi.fn();
    renderWidget(<HtmlViewer />, {
      updateWidget,
      widgetOverrides: {
        id: "html-direct",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "sectors" }],
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe?.contentWindow).toBeTruthy();

    fireEvent.load(iframe as HTMLIFrameElement);
    iframe?.contentWindow?.dispatchEvent(
      new CustomEvent("openbb:widget-params:update", {
        detail: {
          type: "openbb:widget-params:update",
          params: { sectors: "utility" },
        },
      }),
    );

    expect(updateWidget).toHaveBeenCalledTimes(1);
    const [updater] = updateWidget.mock.calls.at(-1) ?? [];
    const next = updater({ storage: { params: {} } });
    expect(next.storage.params).toEqual({ sectors: "utility" });
  });

  it("updates matching dashboard param groups from nested widget params", () => {
    appStoreMock.getWidgetGroups.mockReturnValue([
      {
        id: "sectors-group",
        type: "param",
        groupById: "sectors",
        value: "",
      },
      {
        id: "proceeds-group",
        type: "param",
        groupById: "uses_of_proceeds",
        value: "",
      },
    ]);

    renderWidget(<HtmlViewer />, {
      activeDashboardId: "market-dashboard",
      widgetOverrides: {
        id: "market-filters",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "sectors" }, { paramName: "uses_of_proceeds" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:widget-params:update",
          params: { sectors: "education,government" },
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(appStoreMock.updateGroup).toHaveBeenCalledTimes(1);
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "market-dashboard",
      "sectors-group",
      {
        id: "sectors-group",
        type: "param",
        groupById: "sectors",
        value: "education,government",
      },
    );
  });

  it("updates matching dashboard param groups even when the html widget is not linked", () => {
    appStoreMock.getTabById.mockReturnValue({
      data: {
        groups: [
          {
            id: "proceeds-group",
            type: "param",
            groupById: "uses_of_proceeds",
            value: "",
          },
          {
            id: "unrelated-group",
            type: "param",
            groupById: "states",
            value: "",
          },
        ],
      },
    });

    renderWidget(<HtmlViewer />, {
      activeDashboardId: "market-dashboard",
      widgetOverrides: {
        id: "market-filters",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "uses_of_proceeds" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:widget-params:update",
          params: { uses_of_proceeds: "correctional_facilities" },
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(appStoreMock.updateGroup).toHaveBeenCalledTimes(1);
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "market-dashboard",
      "proceeds-group",
      {
        id: "proceeds-group",
        type: "param",
        groupById: "uses_of_proceeds",
        value: "correctional_facilities",
      },
    );
  });

  it("updates groups using stored params plus the iframe changed param", () => {
    appStoreMock.getTabById.mockReturnValue({
      data: {
        groups: [
          {
            id: "sectors-group",
            type: "param",
            groupById: "sectors",
            value: "",
          },
          {
            id: "proceeds-group",
            type: "param",
            groupById: "uses_of_proceeds",
            value: "",
          },
        ],
      },
    });

    renderWidget(<HtmlViewer />, {
      activeDashboardId: "market-dashboard",
      widgetOverrides: {
        id: "market-filters",
        endpoint: { url: "https://api.example.com/html" },
        storage: {
          params: {
            sectors: "education,government",
            uses_of_proceeds: "correctional_facilities",
          },
        },
        params: [{ paramName: "sectors" }, { paramName: "uses_of_proceeds" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:widget-params:update",
          params: { uses_of_proceeds: "police" },
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(appStoreMock.updateGroup).toHaveBeenCalledTimes(2);
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "market-dashboard",
      "sectors-group",
      {
        id: "sectors-group",
        type: "param",
        groupById: "sectors",
        value: "education,government",
      },
    );
    expect(appStoreMock.updateGroup).toHaveBeenCalledWith(
      "market-dashboard",
      "proceeds-group",
      {
        id: "proceeds-group",
        type: "param",
        groupById: "uses_of_proceeds",
        value: "police",
      },
    );
  });

  it("drops params not declared on the widget", () => {
    const updateWidget = vi.fn();
    renderWidget(<HtmlViewer />, {
      updateWidget,
      widgetOverrides: {
        id: "html-2",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "ticker" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb:widget-params:update",
          params: { ticker: "AAPL", secret_field: "leaked" },
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(updateWidget).toHaveBeenCalledTimes(1);
    const [updater] = updateWidget.mock.calls.at(-1) ?? [];
    const next = updater({ storage: { params: {} } });
    expect(next.storage.params).toEqual({ ticker: "AAPL" });
    expect(next.storage.params).not.toHaveProperty("secret_field");
  });

  it("ignores messages that match neither event.source nor the bridge token", () => {
    const updateWidget = vi.fn();
    renderWidget(<HtmlViewer />, {
      updateWidget,
      widgetOverrides: {
        id: "html-3",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "ticker" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        // Source is this top-level window, not the iframe's contentWindow,
        // and no bridge token is included.
        source: window,
        data: {
          type: "openbb:widget-params:update",
          params: { ticker: "AAPL" },
        },
      }),
    );

    expect(updateWidget).not.toHaveBeenCalled();
  });

  it("ignores non-params message types even when the token matches", () => {
    const updateWidget = vi.fn();
    renderWidget(<HtmlViewer />, {
      updateWidget,
      widgetOverrides: {
        id: "html-4",
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [{ paramName: "ticker" }],
      },
    });

    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          type: "openbb-data",
          widgetId: "html-4",
          dataType: "table",
          data: [],
          openbbWidgetParamBridgeToken: FULL_TOKEN,
        },
      }),
    );

    expect(updateWidget).not.toHaveBeenCalled();
  });

  it("injects the bridge script immediately after <body> in iframe srcdoc", () => {
    renderWidget(<HtmlViewer />, {
      widgetOverrides: {
        endpoint: { url: "https://api.example.com/html" },
        storage: { params: {} },
        params: [],
      },
    });

    const iframe = document.querySelector("iframe");
    expect(iframe).not.toBeNull();
    const srcdoc = iframe?.getAttribute("srcdoc") ?? "";
    expect(srcdoc).toMatch(/<body><script>/i);
    expect(srcdoc).toContain(BRIDGE_UUID);
    expect(srcdoc).toContain("openbb:widget-params:update");
  });
});
