import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpAppPopover } from "~/components/Apps/McpAppPopover";
import type { McpConnection, McpServer } from "~/lib/state/mcpTools";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("~/components/Apps/McpTokenModal", () => ({
  McpTokenModal: ({
    isOpen,
    onSave,
  }: {
    isOpen: boolean;
    onSave: (token: string) => void;
  }) =>
    isOpen ? (
      <div data-testid="mcp-token-modal">
        <button type="button" onClick={() => onSave("tok-123")}>
          save-token
        </button>
      </div>
    ) : null,
}));

const mockAddServer = vi.fn();
const mockUpdateServer = vi.fn();
const mockGetMCPConnection = vi.fn();

type MockMcpState = {
  servers: McpServer[];
  getMCPConnection: (id: string) => McpConnection | undefined;
  addServer: typeof mockAddServer;
  updateServer: typeof mockUpdateServer;
};

let mockMcpState: MockMcpState;

vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: (selector: (state: MockMcpState) => unknown) =>
    selector(mockMcpState),
}));

const server = (overrides: Partial<McpServer> = {}): McpServer => ({
  id: "srv-1",
  name: "Demo Token MCP",
  url: "https://example.com/mcp",
  enabled: true,
  tools: [],
  vendorAppUuid: "app-1",
  ...overrides,
});

beforeEach(() => {
  mockAddServer.mockClear();
  mockUpdateServer.mockClear();
  mockGetMCPConnection.mockReset();
  mockMcpState = {
    servers: [],
    getMCPConnection: mockGetMCPConnection,
    addServer: mockAddServer,
    updateServer: mockUpdateServer,
  };
});

describe("McpAppPopover", () => {
  it("adds an OAuth server immediately without opening a modal", () => {
    render(
      <McpAppPopover
        vendorAppUuid="app-1"
        vendorName="Acme"
        mcpServer={{ name: "OAuth MCP", url: "https://oauth.example.com/mcp" }}
        isSubscribed={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add MCP Server" }));

    expect(mockAddServer).toHaveBeenCalledTimes(1);
    expect(mockAddServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "OAuth MCP",
        url: "https://oauth.example.com/mcp",
        vendorAppUuid: "app-1",
      }),
    );
    // OAuth path never carries a token authType nor custom headers.
    const added = mockAddServer.mock.calls[0][0];
    expect(added.authType).toBeUndefined();
    expect(added.customHeaders).toBeUndefined();
    expect(screen.queryByTestId("mcp-token-modal")).not.toBeInTheDocument();
  });

  it("opens the token modal instead of adding immediately for a token server", () => {
    render(
      <McpAppPopover
        vendorAppUuid="app-1"
        vendorName="Acme"
        mcpServer={{
          name: "Demo Token MCP",
          url: "https://example.com/mcp",
          authType: "token",
        }}
        isSubscribed={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add MCP Server" }));

    expect(mockAddServer).not.toHaveBeenCalled();
    expect(screen.getByTestId("mcp-token-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save-token" }));

    expect(mockAddServer).toHaveBeenCalledTimes(1);
    expect(mockAddServer).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Demo Token MCP",
        url: "https://example.com/mcp",
        authType: "token",
        customHeaders: { Authorization: "Bearer tok-123" },
      }),
    );
  });

  it("edits the token of an already-added failed token server via updateServer", () => {
    mockMcpState.servers = [
      server({ authType: "token", customHeaders: { Authorization: "Bearer old" } }),
    ];
    mockGetMCPConnection.mockReturnValue({
      state: "failed",
      error: "Couldn't authenticate with Demo Token MCP.",
      tools: [],
    } as unknown as McpConnection);

    render(
      <McpAppPopover
        vendorAppUuid="app-1"
        vendorName="Acme"
        mcpServer={{
          name: "Demo Token MCP",
          url: "https://example.com/mcp",
          authType: "token",
        }}
        isSubscribed={true}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit token" }));
    fireEvent.click(screen.getByRole("button", { name: "save-token" }));

    expect(mockAddServer).not.toHaveBeenCalled();
    // `enabled` is part of the payload because auto-registration leaves
    // token-auth servers disabled until a token exists.
    expect(mockUpdateServer).toHaveBeenCalledWith("srv-1", {
      customHeaders: { Authorization: "Bearer tok-123" },
      authType: "token",
      enabled: true,
    });
  });
});
