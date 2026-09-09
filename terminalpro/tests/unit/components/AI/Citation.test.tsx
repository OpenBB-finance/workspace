import { render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Citation from "~/components/AI/Citation";

vi.mock("@radix-ui/react-hover-card", () => ({
  Root: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Trigger: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Portal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const routeParams: { id?: string } = { id: "dashboard-1" };

vi.mock("react-router-dom", () => ({
  useParams: () => routeParams,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => ({ whiteLabel: { mainColor: "#0088CC" } }),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
  currentDateModifier: (value: unknown) => value,
  dispatchUpdateWidget: vi.fn(),
  triggerCustomEvent: vi.fn(),
}));

vi.mock("~/components/AI", () => ({
  Artifact: () => <div>Artifact</div>,
  Table: ({ content }: { content: Record<string, unknown> }) => (
    <div>{JSON.stringify(content)}</div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: () => <span>icon</span>,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: vi.fn(),
}));

vi.mock("~/lib/state/copilotData", () => ({
  useShallowCopilotDataStore: vi.fn(),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(),
}));

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useShallowAppWidgetsStore: vi.fn(),
}));

import { useShallowAppWidgetsStore } from "~/components/AI/hooks/useGetAppWidgets";
import { useShallowAppStore } from "~/lib/state/app";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { useShallowCopilotDataStore } from "~/lib/state/copilotData";

const dashboardWidget = {
  id: "widget-1",
  name: "Portfolio Exposure by Industry",
  type: "table",
  widgetId: "portfolio_industries_custom_obb",
  sourceName: "Portfolio Risk",
  external: true,
  storage: { params: { portfolio: "Client 1" } },
  params: [{ paramName: "portfolio", type: "text", value: "Client 1" }],
} as any;

const widgetDefinition = {
  id: "portfolio-def",
  name: "Portfolio Exposure by Industry",
  type: "table",
  widgetId: "portfolio_industries_custom_obb",
  sourceName: "Portfolio Risk",
  external: true,
  storage: { params: {} },
  params: [{ paramName: "portfolio", type: "text", value: "Client 1" }],
} as any;

const iframeWidget = {
  id: "iframe-widget-1",
  name: "Portfolio Iframe",
  type: "iframe",
  widgetId: "iframe",
  sourceName: "OpenBB Workspace",
  storage: { iframeParams: { symbol: "AAPL" } },
  params: [],
} as any;

describe("Citation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeParams.id = "dashboard-1";

    vi.mocked(useShallowCopilotStore).mockImplementation((selector: any) =>
      selector({
        setHoveredCitationWidgetId: vi.fn(),
        isFullscreen: false,
        toggleFullscreen: vi.fn(),
        getCurrentChatArtifact: vi.fn(),
      }),
    );

    vi.mocked(useShallowCopilotDataStore).mockImplementation((selector: any) =>
      selector({
        getWidgetRuntimeState: vi.fn(),
        getWidgetsInCurrentDashboard: (uuid?: string) => {
          if (uuid) {
            if (uuid === iframeWidget.id) return iframeWidget;
            return uuid === dashboardWidget.id ? dashboardWidget : null;
          }
          return [dashboardWidget, iframeWidget];
        },
        signaturesMap: {
          [dashboardWidget.id]: {
            origin: "Portfolio Risk",
            widgetId: "portfolio_industries_custom_obb",
            args: { portfolio: "Client 1" },
          },
          [iframeWidget.id]: {
            origin: "OpenBB Workspace",
            widgetId: "iframe-widget-1",
            args: {},
          },
        },
        getWidgetFromSignature: vi.fn(() => null),
        widgetsLastUpdated: 1,
      }),
    );

    vi.mocked(useShallowAppStore).mockImplementation((selector: any) =>
      selector({
        getWidgetsByAttribute: vi.fn(() => ({})),
        addWidget: vi.fn(),
        getLastInnerTab: vi.fn(() => ""),
      }),
    );

    vi.mocked(useShallowAppWidgetsStore).mockImplementation((selector: any) =>
      selector({
        getAppWidget: vi.fn(() => widgetDefinition),
      }),
    );
  });

  it("shows add widget to dashboard when widget uuid matches but input args differ", () => {
    render(
      <Citation
        index={0}
        content={{
          id: "citation-1",
          signature: "sig-1",
          source_info: {
            type: "widget",
            uuid: dashboardWidget.id,
            origin: "Portfolio Risk",
            widget_id: "portfolio_industries_custom_obb",
            name: "Portfolio Exposure by Industry",
            metadata: {
              widget_uuid: dashboardWidget.id,
              input_args: { portfolio: "Client 2" },
            },
          },
          details: [{ Portfolio: "Client 2" }],
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add widget to dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Scroll to widget" }),
    ).not.toBeInTheDocument();
  });

  it("shows scroll to widget when widget uuid and input args both match", () => {
    render(
      <Citation
        index={0}
        content={{
          id: "citation-2",
          signature: "sig-2",
          source_info: {
            type: "widget",
            uuid: dashboardWidget.id,
            origin: "Portfolio Risk",
            widget_id: "portfolio_industries_custom_obb",
            name: "Portfolio Exposure by Industry",
            metadata: {
              widget_uuid: dashboardWidget.id,
              input_args: { portfolio: "Client 1" },
            },
          },
          details: [{ Portfolio: "Client 1" }],
        }}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Scroll to widget" }),
    ).toBeInTheDocument();
  });

  it("states why there is no action instead of showing a dead disabled button", () => {
    routeParams.id = undefined;

    render(
      <Citation
        index={0}
        content={{
          id: "citation-4",
          signature: "sig-4",
          source_info: {
            type: "widget",
            uuid: dashboardWidget.id,
            origin: "Portfolio Risk",
            widget_id: "portfolio_industries_custom_obb",
            name: "Portfolio Exposure by Industry",
            metadata: {
              widget_uuid: dashboardWidget.id,
              input_args: { portfolio: "Client 1" },
            },
          },
          details: [{ Portfolio: "Client 1" }],
        }}
      />,
    );

    expect(screen.getByText("Open a dashboard to add this widget")).toBeInTheDocument();
    // The reason is a caption, not a dead CTA the user could try to press.
    expect(
      screen.queryByRole("button", { name: "Open a dashboard to add this widget" }),
    ).toBeNull();
  });

  it("shows iframe MCP citations as matching dashboard widget citations", () => {
    render(
      <Citation
        index={0}
        content={{
          id: "citation-3",
          signature: "sig-3",
          source_info: {
            type: "widget",
            uuid: iframeWidget.id,
            origin: "OpenBB Workspace",
            widget_id: iframeWidget.id,
            name: "Portfolio Iframe",
            metadata: {
              iframe_mcp: true,
              matching: true,
              widget_uuid: iframeWidget.id,
              input_args: { symbol: "AAPL" },
              mcp_tool_args: { account_id: "demo-account" },
            },
          },
          details: [
            {
              "Source type": "mcp",
              Widget: "Portfolio Iframe",
              Server: "Portfolio MCP",
              Tool: "holdings",
              "Account Id": "demo-account",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Portfolio Iframe*")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Scroll to matching widget" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Widget not on current dashboard" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(JSON.stringify({ "Account Id": "demo-account" })),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Portfolio MCP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/holdings/)).not.toBeInTheDocument();
  });
});
