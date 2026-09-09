import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SlashSuggestionItem } from "~/components/AI/hooks/useSlashCommandSuggestions";
import {
  McpToolsDropdown,
  ToolDescriptionMarkdown,
} from "~/components/AI/McpToolsDropdown";
import {
  type McpConnection,
  type McpServer,
  useMcpToolsStore,
} from "~/lib/state/mcpTools";

vi.mock("~/components/AI/hooks/useCopilotAddToContext", () => ({
  highlightSelection: vi.fn(),
}));

vi.mock("~/components/ds/atoms/Popover", () => ({
  PopoverRoot: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    className,
    message,
  }: {
    children: ReactNode;
    className?: string;
    message: ReactNode;
  }) => (
    <div data-testid="tooltip" className={className}>
      <div data-testid="tooltip-message">{message}</div>
      {children}
    </div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
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

vi.mock("~/components/AI/McpServerSourceTag", () => ({
  McpServerSourceTag: () => null,
}));

const createServer = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: "server-1",
  name: "Test Server",
  url: "https://mcp.example.com",
  enabled: true,
  toolsEnabled: true,
  tools: [{ id: "tool-1", name: "Tool 1", enabled: true }],
  ...overrides,
});

const createConnection = (overrides: Partial<McpConnection> = {}): McpConnection => ({
  callTool: undefined,
  error: undefined,
  state: "ready",
  tools: [],
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
  ...overrides,
});

function renderDropdown() {
  return render(
    <MemoryRouter>
      <McpToolsDropdown open={true} onOpenChange={vi.fn()}>
        <button type="button">trigger</button>
      </McpToolsDropdown>
    </MemoryRouter>,
  );
}

describe("McpToolsDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    act(() => {
      useMcpToolsStore.setState({
        servers: [],
        mcpConnectionRegistry: {},
      });
    });
  });

  it("renders duplicate copies of the same iframe widget as a single entry", () => {
    act(() => {
      useMcpToolsStore.setState({
        servers: [
          createServer({
            id: "iframe-server-1",
            name: "Widget MCP",
            url: "https://widget.example.com/mcp",
            iframeWidgetId: "widget-1",
          }),
          createServer({
            id: "iframe-server-2",
            name: "Widget MCP",
            url: "https://widget.example.com/mcp",
            iframeWidgetId: "widget-2",
          }),
        ],
        mcpConnectionRegistry: {
          "iframe-server-1": createConnection(),
          "iframe-server-2": createConnection(),
        },
      });
    });

    renderDropdown();

    expect(screen.getAllByText("Widget MCP")).toHaveLength(1);
  });

  it("renders iframe widgets with different urls as separate entries", () => {
    act(() => {
      useMcpToolsStore.setState({
        servers: [
          createServer({
            id: "iframe-server-1",
            name: "Widget A",
            url: "https://a.example.com/mcp",
            iframeWidgetId: "widget-1",
          }),
          createServer({
            id: "iframe-server-2",
            name: "Widget B",
            url: "https://b.example.com/mcp",
            iframeWidgetId: "widget-2",
          }),
        ],
        mcpConnectionRegistry: {
          "iframe-server-1": createConnection(),
          "iframe-server-2": createConnection(),
        },
      });
    });

    renderDropdown();

    expect(screen.getByText("Widget A")).toBeInTheDocument();
    expect(screen.getByText("Widget B")).toBeInTheDocument();
  });

  it("renders regular servers sharing a url as separate entries", () => {
    act(() => {
      useMcpToolsStore.setState({
        servers: [
          createServer({ id: "server-1", name: "Server One" }),
          createServer({ id: "server-2", name: "Server Two" }),
        ],
        mcpConnectionRegistry: {
          "server-1": createConnection(),
          "server-2": createConnection(),
        },
      });
    });

    renderDropdown();

    expect(screen.getByText("Server One")).toBeInTheDocument();
    expect(screen.getByText("Server Two")).toBeInTheDocument();
  });
});

describe("ToolDescriptionMarkdown", () => {
  it("allows slash-delimited inline code to wrap inside constrained tooltip content", () => {
    const { container } = render(
      <ToolDescriptionMarkdown content="Use `alpha`/`beta`/`gamma` when configuring the tool." />,
    );

    const root = container.querySelector(".markdown-tooltip-content");
    expect(root).toHaveClass(
      "min-w-0",
      "max-w-full",
      "whitespace-normal",
      "wrap-anywhere",
    );
    expect(root?.className).toContain("wrap-anywhere");

    const paragraph = container.querySelector("p");
    expect(paragraph).toHaveClass("whitespace-normal", "wrap-anywhere");
    expect(paragraph?.className).toContain("wrap-anywhere");

    const inlineCodeNodes = container.querySelectorAll("code");
    expect(inlineCodeNodes).toHaveLength(3);
    inlineCodeNodes.forEach((codeNode) => {
      expect(codeNode).toHaveClass("whitespace-normal", "wrap-anywhere");
      expect(codeNode.className).toContain("wrap-anywhere");
    });
  });
});

describe("SlashSuggestionItem", () => {
  it("wraps slash-delimited MCP tool hover content inside the tooltip", () => {
    const item = {
      type: "mcpTool" as const,
      id: "server/tool",
      serverName: "server/path",
      serverUrl: "https://example.com",
      toolName: "tool/path",
      toolId: "tool/path",
      description: "Use `alpha`/`beta`/`gamma` when configuring the tool.",
      slashText: "/server/path_tool/path",
      inputSchema: {
        type: "object",
        properties: {
          "path/with/slashes": {
            type: "string",
            description: "A slash-delimited parameter name.",
          },
        },
      },
    };

    render(<SlashSuggestionItem index={0} item={item} onSelect={vi.fn()} />);

    const tooltip = document.querySelector('[data-testid="tooltip"]');
    expect(tooltip).toHaveClass("max-w-[24rem]", "overflow-x-hidden", "wrap-anywhere");
    expect(tooltip?.className).toContain("wrap-anywhere");

    const tooltipMessage = document.querySelector('[data-testid="tooltip-message"]');
    const label = tooltipMessage?.querySelector(".sticky");
    expect(label).toHaveClass("whitespace-normal", "wrap-anywhere");
    expect(label?.className).toContain("wrap-anywhere");

    const markdownContent = tooltipMessage?.querySelector(".prose");
    expect(markdownContent).toHaveClass("whitespace-normal", "wrap-anywhere");
    expect(markdownContent?.className).toContain("[&_code]:wrap-anywhere");
    expect(markdownContent?.className).toContain("[&_pre]:whitespace-pre-wrap");
    expect(tooltipMessage?.querySelector("pre")).toBeInTheDocument();
  });
});
