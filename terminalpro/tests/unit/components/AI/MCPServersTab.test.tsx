import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MCPServersTab } from "~/components/AI/MCPServersTab";
import type { ButtonProps } from "~/components/ds/atoms/Button";
import type { InputProps } from "~/components/ds/atoms/Input";

// Mock framer-motion so AnimatePresence exit animations complete synchronously in jsdom
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
    }: {
      children?: ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => <div className={className}>{children}</div>,
  },
}));

// --- Hoisted mocks ---

const {
  mockUseShallowMcpToolsStore,
  mockRemoveServer,
  mockUpdateServer,
  mockGetMCPConnection,
  mockManageMcpServerOpen,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockUseShallowMcpToolsStore: vi.fn(),
  mockRemoveServer: vi.fn(),
  mockUpdateServer: vi.fn(),
  mockGetMCPConnection: vi.fn(),
  mockManageMcpServerOpen: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

// --- Module mocks ---

vi.mock("usehooks-ts", () => {
  const { useState: useStateReal } = require("react");
  return {
    useDebounceValue: (value: string, _delay: number) => [value],
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock("~/lib/state/mcpTools", () => ({
  useShallowMcpToolsStore: (selector: unknown) => mockUseShallowMcpToolsStore(selector),
  PENDING_CONNECTION_STATES: ["loading", "connecting", "discovering", "authenticating"],
}));

vi.mock("~/components/AI/McpToolsDropdown", () => ({
  ToolDescriptionMarkdown: ({ content }: { content: string }) => (
    <div data-testid="tool-description-markdown">{content}</div>
  ),
}));

vi.mock("~/components/McpServerModal", () => ({
  ManageMcpServer: ({
    open,
    onClose,
    existingServerId,
  }: {
    open: boolean;
    onClose: () => void;
    existingServerId?: string | null;
  }) => {
    // Track that the modal was opened with certain props
    if (open) mockManageMcpServerOpen({ open, existingServerId });
    return open ? (
      <div data-testid="manage-mcp-server-modal">
        <span data-testid="modal-existing-server-id">{existingServerId ?? "none"}</span>
        <button type="button" onClick={onClose} data-testid="modal-close-btn">
          Close
        </button>
      </div>
    ) : null;
  },
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({ children, message }: { children: ReactNode; message: string }) => (
    <div title={message}>{children}</div>
  ),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: forwardRef<HTMLButtonElement, ButtonProps>((props, _ref) => (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      data-variant={props.variant}
      data-size={props.size}
      className={props.className}
    >
      {props.children}
    </button>
  )),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: () => <div>No results found</div>,
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: forwardRef<HTMLInputElement, InputProps>((props, _ref) => (
    <div className={props.className}>
      {props.prefix}
      <input
        type="text"
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    </div>
  )),
}));

// --- Mock data ---

const makeTool = (
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    enabled: boolean;
  }> = {},
) => ({
  id: overrides.id ?? "tool-1",
  name: overrides.name ?? "get_data",
  description: overrides.description ?? "Fetches data from the API",
  enabled: overrides.enabled ?? true,
});

const makeServer = (
  overrides: Partial<{
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    tools: Array<{ id: string; name: string; description?: string; enabled: boolean }>;
  }> = {},
) => ({
  id: overrides.id ?? "server-1",
  name: overrides.name ?? "Test Server",
  url: overrides.url ?? "https://mcp.example.com",
  enabled: overrides.enabled ?? true,
  tools: overrides.tools ?? [makeTool()],
});

const MOCK_SERVERS = [
  makeServer({
    id: "server-1",
    name: "Alpha Server",
    url: "https://alpha.example.com",
    enabled: true,
    tools: [
      makeTool({ id: "t1", name: "get_stocks", description: "Fetches stock data" }),
      makeTool({ id: "t2", name: "get_crypto", description: "Fetches crypto data" }),
    ],
  }),
  makeServer({
    id: "server-2",
    name: "Beta Server",
    url: "https://beta.example.com",
    enabled: false,
    tools: [
      makeTool({
        id: "t3",
        name: "analyze_data",
        description: "Analyzes financial data",
      }),
    ],
  }),
];

const makeConnectionReady = (
  tools?: Array<{ name: string; description?: string }>,
) => ({
  state: "ready",
  tools: tools ?? [],
  callTool: vi.fn(),
  error: undefined,
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
});

const makeConnectionFailed = () => ({
  state: "failed",
  tools: [],
  callTool: undefined,
  error: new Error("Connection failed"),
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
});

const makeConnectionPending = (state = "connecting") => ({
  state,
  tools: [],
  callTool: undefined,
  error: undefined,
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
});

const makeConnectionDisconnected = () => ({
  state: "disconnected",
  tools: [],
  callTool: undefined,
  error: undefined,
  disconnect: vi.fn(),
  retry: vi.fn(),
  clearStorage: vi.fn(),
});

// --- Setup helpers ---

function setupStore(
  servers = MOCK_SERVERS,
  connectionOverrides: Record<string, ReturnType<typeof makeConnectionReady>> = {},
) {
  mockGetMCPConnection.mockImplementation((serverId: string) => {
    if (connectionOverrides[serverId]) return connectionOverrides[serverId];
    // Default: enabled servers are "ready", disabled are "disconnected"
    const server = servers.find((s) => s.id === serverId);
    if (server?.enabled) {
      return makeConnectionReady(
        server.tools.map((t) => ({ name: t.name, description: t.description })),
      );
    }
    return makeConnectionDisconnected();
  });

  mockUseShallowMcpToolsStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      servers,
      removeServer: mockRemoveServer,
      updateServer: mockUpdateServer,
      getMCPConnection: mockGetMCPConnection,
    }),
  );
}

const renderMCPServersTab = () => {
  return render(
    <BrowserRouter>
      <MCPServersTab />
    </BrowserRouter>,
  );
};

// --- Tests ---

describe("MCPServersTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  describe("Empty state", () => {
    it("shows empty state message when servers array is empty", async () => {
      setupStore([]);
      await renderMCPServersTab();

      expect(screen.getByText("No MCP Server added")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't added any MCP Server yet."),
      ).toBeInTheDocument();
    });
  });

  describe("Server list rendering", () => {
    it("renders server cards with name and tool count", async () => {
      await renderMCPServersTab();

      // Alpha Server has 2 connection tools (ready state returns them)
      expect(screen.getByText(/Alpha Server/)).toBeInTheDocument();
      // Beta Server has 1 tool from server.tools (disconnected, no connectionTools)
      expect(screen.getByText(/Beta Server/)).toBeInTheDocument();
    });

    it("displays tool count from connectionTools when connected", async () => {
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
          { name: "get_crypto", description: "Fetches crypto data" },
        ]),
      });
      await renderMCPServersTab();

      // connectionTools.length = 2 for server-1
      expect(screen.getByText("Alpha Server")).toBeInTheDocument();
      expect(screen.getByText("(2)")).toBeInTheDocument();
    });

    it("displays tool count from server.tools when disconnected", async () => {
      setupStore(MOCK_SERVERS, {
        "server-2": makeConnectionDisconnected(),
      });
      await renderMCPServersTab();

      // server-2 has 1 tool in server.tools, connectionTools is empty
      expect(screen.getByText("Beta Server")).toBeInTheDocument();
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });
  });

  describe("Search filtering", () => {
    it("filters servers by name", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const searchInput = screen.getByPlaceholderText("Search for MCP Servers");
      await user.type(searchInput, "Alpha");

      await waitFor(() => {
        expect(screen.getByText(/Alpha Server/)).toBeInTheDocument();
        expect(screen.queryByText(/Beta Server/)).not.toBeInTheDocument();
      });
    });

    it("filters servers by URL", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const searchInput = screen.getByPlaceholderText("Search for MCP Servers");
      await user.type(searchInput, "beta.example");

      await waitFor(() => {
        expect(screen.queryByText(/Alpha Server/)).not.toBeInTheDocument();
        expect(screen.getByText(/Beta Server/)).toBeInTheDocument();
      });
    });

    it("filters servers by tool name", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const searchInput = screen.getByPlaceholderText("Search for MCP Servers");
      await user.type(searchInput, "get_crypto");

      await waitFor(() => {
        expect(screen.getByText(/Alpha Server/)).toBeInTheDocument();
        expect(screen.queryByText(/Beta Server/)).not.toBeInTheDocument();
      });
    });

    it("filters servers by tool description", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const searchInput = screen.getByPlaceholderText("Search for MCP Servers");
      await user.type(searchInput, "financial");

      await waitFor(() => {
        expect(screen.queryByText(/Alpha Server/)).not.toBeInTheDocument();
        expect(screen.getByText(/Beta Server/)).toBeInTheDocument();
      });
    });

    it("shows empty state when search matches nothing", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const searchInput = screen.getByPlaceholderText("Search for MCP Servers");
      await user.type(searchInput, "nonexistent_server_xyz");

      await waitFor(() => {
        expect(screen.getByText("No results found")).toBeInTheDocument();
      });
    });
  });

  describe("Add server button", () => {
    it("renders 'Add Server' button in the header", async () => {
      await renderMCPServersTab();

      expect(screen.getByRole("button", { name: "Add Server" })).toBeInTheDocument();
    });

    it("opens ManageMcpServer modal when clicking 'Add Server'", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const addButton = screen.getByRole("button", { name: "Add Server" });
      await user.click(addButton);

      expect(screen.getByTestId("manage-mcp-server-modal")).toBeInTheDocument();
      expect(screen.getByTestId("modal-existing-server-id")).toHaveTextContent("none");
    });
  });

  describe("Server card expand/collapse", () => {
    it("does not show tools section by default", async () => {
      await renderMCPServersTab();

      // Tools should not be visible when collapsed
      expect(screen.queryByText("get_stocks")).not.toBeInTheDocument();
    });

    it("expands server card to show tools when clicking the card", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
          { name: "get_crypto", description: "Fetches crypto data" },
        ]),
      });
      await renderMCPServersTab();

      // Click the server name area to expand
      const serverNameArea = screen.getByText("Alpha Server");
      await user.click(serverNameArea);

      // Tools should now be visible
      expect(screen.getByText("get_stocks")).toBeInTheDocument();
      expect(screen.getByText("get_crypto")).toBeInTheDocument();
    });

    it("collapses server card when clicking again", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
        ]),
      });
      await renderMCPServersTab();

      const serverNameArea = screen.getByText(/Alpha Server/);
      // Expand
      await user.click(serverNameArea);
      expect(screen.getByText("get_stocks")).toBeInTheDocument();

      // Collapse
      await user.click(serverNameArea);
      expect(screen.queryByText("get_stocks")).not.toBeInTheDocument();
    });

    it("shows cached tools when disconnected server with cached tools is expanded", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-2": makeConnectionDisconnected(),
      });
      await renderMCPServersTab();

      const serverNameArea = screen.getByText(/Beta Server/);
      await user.click(serverNameArea);

      // Shows cached tools from server.tools even when disconnected
      expect(screen.getByText("analyze_data")).toBeInTheDocument();
    });

    it("cannot expand disconnected server without cached tools", async () => {
      const user = userEvent.setup();
      setupStore(
        [
          makeServer({
            id: "s-empty",
            name: "Empty Server",
            enabled: false,
            tools: [],
          }),
        ],
        { "s-empty": makeConnectionDisconnected() },
      );
      await renderMCPServersTab();

      const serverNameArea = screen.getByText(/Empty Server/);
      await user.click(serverNameArea);

      // Server cannot be expanded (no chevron, no tools section)
      // The click does nothing since canExpand is false
      expect(screen.queryByText("No tools available")).not.toBeInTheDocument();
    });

    it("shows 'Discovering tools...' when connected but no tools yet", async () => {
      const user = userEvent.setup();
      // Server is enabled and connected (pending state counts as connected), but no tools in connectionTools
      setupStore(
        [
          makeServer({
            id: "s-pending",
            name: "Pending Server",
            enabled: true,
            tools: [],
          }),
        ],
        { "s-pending": makeConnectionPending("connecting") },
      );
      await renderMCPServersTab();

      const serverNameArea = screen.getByText(/Pending Server/);
      await user.click(serverNameArea);

      expect(screen.getByText("Discovering tools...")).toBeInTheDocument();
    });
  });

  describe("Connection toggle", () => {
    it("shows 'Disconnect' button for connected servers", async () => {
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady(),
      });
      await renderMCPServersTab();

      const disconnectButtons = screen.getAllByRole("button", {
        name: "Disconnect",
      });
      expect(disconnectButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("shows 'Connect' button for disconnected servers", async () => {
      setupStore(MOCK_SERVERS, {
        "server-2": makeConnectionDisconnected(),
      });
      await renderMCPServersTab();

      const connectButtons = screen.getAllByRole("button", {
        name: "Connect",
      });
      expect(connectButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("calls updateServer with toggled enabled when clicking Connect", async () => {
      const user = userEvent.setup();
      // server-2 is disabled, so it shows "Connect"
      setupStore(MOCK_SERVERS, {
        "server-2": makeConnectionDisconnected(),
      });
      await renderMCPServersTab();

      const connectButtons = screen.getAllByRole("button", {
        name: "Connect",
      });
      // Click the Connect button for the disabled server
      await user.click(connectButtons[0]);

      expect(mockUpdateServer).toHaveBeenCalledWith("server-2", {
        enabled: true,
      });
    });

    it("calls updateServer to disable when clicking Disconnect", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady(),
      });
      await renderMCPServersTab();

      const disconnectButtons = screen.getAllByRole("button", {
        name: "Disconnect",
      });
      await user.click(disconnectButtons[0]);

      expect(mockUpdateServer).toHaveBeenCalledWith("server-1", {
        enabled: false,
      });
    });

    it("calls updateServer to enable when clicking Connect on a failed server", async () => {
      const user = userEvent.setup();
      setupStore(
        [makeServer({ id: "server-failed", name: "Failed Server", enabled: true })],
        { "server-failed": makeConnectionFailed() },
      );
      await renderMCPServersTab();

      await user.click(screen.getByRole("button", { name: "Connect" }));

      expect(mockUpdateServer).toHaveBeenCalledWith("server-failed", {
        enabled: true,
      });
    });

    it("shows 'Disconnect' for servers in pending state", async () => {
      setupStore(
        [makeServer({ id: "s-p", name: "Pending", enabled: true, tools: [] })],
        { "s-p": makeConnectionPending("loading") },
      );
      await renderMCPServersTab();

      expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    });
  });

  describe("Tool items", () => {
    it("shows tool name when server card is expanded", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
        ]),
      });
      await renderMCPServersTab();

      await user.click(screen.getByText(/Alpha Server/));

      expect(screen.getByText("get_stocks")).toBeInTheDocument();
    });

    it("expands tool item to show description when clicked", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
        ]),
      });
      await renderMCPServersTab();

      // Expand server card
      await user.click(screen.getByText(/Alpha Server/));

      // Click tool to expand description
      await user.click(screen.getByText("get_stocks"));

      expect(screen.getByText("Fetches stock data")).toBeInTheDocument();
    });

    it("collapses tool description when clicking tool again", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([
          { name: "get_stocks", description: "Fetches stock data" },
        ]),
      });
      await renderMCPServersTab();

      await user.click(screen.getByText(/Alpha Server/));
      // Expand tool
      await user.click(screen.getByText("get_stocks"));
      expect(screen.getByText("Fetches stock data")).toBeInTheDocument();

      // Collapse tool
      await user.click(screen.getByText("get_stocks"));
      expect(screen.queryByText("Fetches stock data")).not.toBeInTheDocument();
    });

    it("does not show description section when tool has no description", async () => {
      const user = userEvent.setup();
      setupStore(MOCK_SERVERS, {
        "server-1": makeConnectionReady([{ name: "no_desc_tool" }]),
      });
      await renderMCPServersTab();

      await user.click(screen.getByText(/Alpha Server/));
      await user.click(screen.getByText("no_desc_tool"));

      // The description div should not render at all
      // The separator + description block only shows if isExpanded && tool.description
      // With no description, even when expanded, no description content should appear
      const toolItems = screen.queryByText("undefined");
      expect(toolItems).not.toBeInTheDocument();
    });
  });

  describe("Edit and Delete actions", () => {
    it("renders edit button with tooltip on server card", async () => {
      await renderMCPServersTab();

      const editButtons = screen.getAllByTitle("Edit");
      expect(editButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("renders delete button with tooltip on server card", async () => {
      await renderMCPServersTab();

      const deleteButtons = screen.getAllByTitle("Delete");
      expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("opens ManageMcpServer modal with existingServerId when edit is clicked", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const editButtons = screen.getAllByTitle("Edit");
      // Click edit on the first server
      const editBtn = editButtons[0].querySelector("button");
      await user.click(editBtn!);

      expect(screen.getByTestId("manage-mcp-server-modal")).toBeInTheDocument();
      expect(screen.getByTestId("modal-existing-server-id")).toHaveTextContent(
        "server-1",
      );
    });

    it("calls removeServer when delete is clicked", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const deleteButtons = screen.getAllByTitle("Delete");
      const deleteBtn = deleteButtons[0].querySelector("button");
      await user.click(deleteBtn!);

      expect(mockRemoveServer).toHaveBeenCalledWith("server-1");
    });

    it("calls removeServer with correct server id for second server", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const deleteButtons = screen.getAllByTitle("Delete");
      const deleteBtn = deleteButtons[1].querySelector("button");
      await user.click(deleteBtn!);

      expect(mockRemoveServer).toHaveBeenCalledWith("server-2");
    });

    it("shows success toast when deleting a server", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      const deleteButtons = screen.getAllByTitle("Delete");
      const deleteBtn = deleteButtons[0].querySelector("button");
      await user.click(deleteBtn!);

      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Alpha Server deleted successfully",
      );
    });
  });

  describe("Status indicators", () => {
    it("shows green status dot for ready connection", async () => {
      setupStore(
        [makeServer({ id: "s-ready", name: "Ready Server", enabled: true, tools: [] })],
        { "s-ready": makeConnectionReady() },
      );
      await renderMCPServersTab();

      // The status dot should use the semantic success token
      const statusDots = document.querySelectorAll(".bg-alert-success");
      expect(statusDots.length).toBeGreaterThanOrEqual(1);
    });

    it("shows red status dot for failed connection", async () => {
      setupStore(
        [makeServer({ id: "s-fail", name: "Failed Server", enabled: true, tools: [] })],
        { "s-fail": makeConnectionFailed() },
      );
      await renderMCPServersTab();

      const statusDots = document.querySelectorAll(".bg-alert-error");
      expect(statusDots.length).toBeGreaterThanOrEqual(1);
    });

    it("shows spinner for pending connection state", async () => {
      setupStore(
        [
          makeServer({
            id: "s-pending",
            name: "Pending Server",
            enabled: true,
            tools: [],
          }),
        ],
        { "s-pending": makeConnectionPending("connecting") },
      );
      await renderMCPServersTab();

      // Pending state renders a spinner div with animate-spin instead of a status dot
      const spinners = document.querySelectorAll(".animate-spin");
      expect(spinners.length).toBeGreaterThanOrEqual(1);
    });

    it("shows gray status dot for disabled server", async () => {
      setupStore(
        [
          makeServer({
            id: "s-disabled",
            name: "Disabled Server",
            enabled: false,
            tools: [],
          }),
        ],
        { "s-disabled": makeConnectionDisconnected() },
      );
      await renderMCPServersTab();

      // Disabled servers get the muted semantic token
      const statusDots = document.querySelectorAll(".bg-general-border-primary");
      expect(statusDots.length).toBeGreaterThanOrEqual(1);
    });

    it("shows spinner for all pending connection states", async () => {
      const pendingStates = ["loading", "connecting", "discovering", "authenticating"];

      for (const state of pendingStates) {
        vi.clearAllMocks();
        setupStore(
          [makeServer({ id: "s-p", name: "Server", enabled: true, tools: [] })],
          { "s-p": makeConnectionPending(state) },
        );

        const { unmount } = await renderMCPServersTab();
        const spinners = document.querySelectorAll(".animate-spin");
        expect(spinners.length).toBeGreaterThanOrEqual(1);
        unmount();
      }
    });
  });

  describe("Modal close behavior", () => {
    it("closes add server modal when modal close button is clicked", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      // Open add server modal
      const addButton = screen.getByRole("button", { name: "Add Server" });
      await user.click(addButton);

      expect(screen.getByTestId("manage-mcp-server-modal")).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByTestId("modal-close-btn");
      await user.click(closeBtn);

      expect(screen.queryByTestId("manage-mcp-server-modal")).not.toBeInTheDocument();
    });

    it("closes edit server modal when modal close button is clicked", async () => {
      const user = userEvent.setup();
      await renderMCPServersTab();

      // Open edit modal
      const editButtons = screen.getAllByTitle("Edit");
      const editBtn = editButtons[0].querySelector("button");
      await user.click(editBtn!);

      expect(screen.getByTestId("manage-mcp-server-modal")).toBeInTheDocument();

      // Close modal
      const closeBtn = screen.getByTestId("modal-close-btn");
      await user.click(closeBtn);

      expect(screen.queryByTestId("manage-mcp-server-modal")).not.toBeInTheDocument();
    });
  });
});
