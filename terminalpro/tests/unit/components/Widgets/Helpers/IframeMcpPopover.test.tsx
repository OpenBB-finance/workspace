import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IframeMcpPopover } from "~/components/Widgets/Helpers/IframeMcpPopover";
import {
  type McpConnection,
  type McpServer,
  useMcpToolsStore,
} from "~/lib/state/mcpTools";

vi.mock("~/components/ds/atoms/Popover", () => ({
  PopoverRoot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    message,
    className,
  }: {
    children: ReactNode;
    message: ReactNode;
    className?: string;
  }) => (
    <>
      {children}
      <div data-testid="tooltip-content" className={className}>
        {message}
      </div>
    </>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: ({
    value = "",
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
  },
}));

const createServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: "iframe-mcp-widget-1",
  name: "Widget",
  url: "https://mcp.example.com",
  enabled: true,
  tools: [],
  iframeWidgetId: "widget-1",
  ...overrides,
});

const createConnection = (overrides: Partial<McpConnection> = {}): McpConnection => ({
  callTool: undefined,
  error: undefined,
  state: "disconnected",
  tools: [],
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
  ...overrides,
});

describe("IframeMcpPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useMcpToolsStore.setState({
        servers: [],
        mcpConnectionRegistry: {},
      });
    });
  });

  it("keeps widget-provided MCP URLs read-only while connect and disconnect toggle the server", async () => {
    const user = userEvent.setup();
    const lockedUrl = "https://locked.example.com/mcp";

    render(
      <IframeMcpPopover
        widgetId="widget-1"
        widgetName="Locked Widget"
        mcpUrl={lockedUrl}
      />,
    );

    expect(screen.getByText(lockedUrl)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("MCP server URL")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      const server = useMcpToolsStore.getState().servers[0];
      expect(server).toMatchObject({
        url: lockedUrl,
        enabled: true,
        iframeWidgetId: "widget-1",
      });
    });
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(useMcpToolsStore.getState().servers[0].enabled).toBe(false);
    });
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("MCP server URL")).not.toBeInTheDocument();
  });

  it("removes manual iframe MCP servers on disconnect so the URL can be edited", async () => {
    const user = userEvent.setup();
    const manualUrl = "https://manual.example.com/mcp";

    act(() => {
      useMcpToolsStore.setState({
        servers: [
          createServer({
            url: manualUrl,
          }),
        ],
        mcpConnectionRegistry: {
          "iframe-mcp-widget-1": createConnection({ state: "ready" }),
        },
      });
    });

    render(<IframeMcpPopover widgetId="widget-1" widgetName="Manual Widget" />);

    await user.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(useMcpToolsStore.getState().servers).toHaveLength(0);
    });
    expect(screen.getByPlaceholderText("MCP server URL")).toHaveValue(manualUrl);
  });

  it("wraps long unbroken tool descriptions inside the tooltip", () => {
    act(() => {
      useMcpToolsStore.setState({
        servers: [
          createServer({
            tools: [
              {
                id: "run_screener",
                name: "run_screener",
                enabled: true,
                description:
                  "``exchange``/``sector``/``industry``/``fund_issuer``/``fund_style`` are matched case-insensitively.",
              },
            ],
          }),
        ],
        mcpConnectionRegistry: {
          "iframe-mcp-widget-1": createConnection({ state: "ready" }),
        },
      });
    });

    render(<IframeMcpPopover widgetId="widget-1" widgetName="Widget" />);

    const toolTooltip = screen
      .getAllByTestId("tooltip-content")
      .find((el) => el.textContent?.includes("run_screener"));
    expect(toolTooltip).toBeDefined();
    expect(toolTooltip?.className).toContain("break-words");
  });
});
