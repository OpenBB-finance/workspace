import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ManageMcpServer, McpServerModal } from "~/components/McpServerModal";
import type { McpServer } from "~/lib/state/mcpTools";

// ----- shared mock state -----

let mockDispatch = vi.fn();
let mockState = {
  addingServer: false,
  editServerId: null as string | null,
  searchTerm: "",
};

vi.mock("~/hooks/useStateReducer", () => ({
  useStateReducer: () => {
    const dispatch = (action: Partial<typeof mockState>) => {
      mockState = { ...mockState, ...action };
      mockDispatch(action);
    };
    return [mockState, dispatch];
  },
}));

// ----- mcpTools store mock -----

const mockUpdateServer = vi.fn();
const mockRemoveServer = vi.fn();
const mockGetMCPConnection = vi.fn();
const mockGetServerById = vi.fn();

type MockMcpState = {
  servers: McpServer[];
  getMCPConnection: typeof mockGetMCPConnection;
  getServerById: typeof mockGetServerById;
  updateServer: typeof mockUpdateServer;
  removeServer: typeof mockRemoveServer;
};

let mockMcpState: MockMcpState = {
  servers: [],
  getMCPConnection: mockGetMCPConnection,
  getServerById: mockGetServerById,
  updateServer: mockUpdateServer,
  removeServer: mockRemoveServer,
};

vi.mock("~/lib/state/mcpTools", () => ({
  PENDING_CONNECTION_STATES: ["loading", "connecting", "discovering", "authenticating"],
  useShallowMcpToolsStore: (selector: (state: MockMcpState) => unknown) =>
    selector(mockMcpState),
}));

// ----- UI mocks -----

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("~/components/ds/molecules/Form", () => ({
  Form: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useForm: () => ({
    control: {},
    handleSubmit: (cb: () => void) => () => cb(),
    getValues: () => ({ customHeaders: [] }),
    setValue: vi.fn(),
    reset: vi.fn(),
    formState: { isValid: true, isSubmitting: false, isDirty: false },
  }),
  FormField: ({
    render,
  }: {
    render: (props: {
      field: { value: string; onChange: () => void };
      fieldState: { error?: { message?: string } };
    }) => ReactNode;
  }) => render({ field: { value: "", onChange: vi.fn() }, fieldState: {} }),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  FormInput: ({ label }: { label: string }) => <div>{label}</div>,
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label={placeholder}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("~/components/DataConnectors/SingleWidget", () => ({
  EndpointHeadersForm: () => <div>Endpoint Headers</div>,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    disabled?: boolean;
  }) => <button onClick={onClick}>{children}</button>,
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({ label }: { label: ReactNode }) => <label>{label}</label>,
}));

// Tooltip renders children and exposes message as aria-label for button queries
vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    message,
  }: {
    children: ReactNode;
    message: ReactNode;
    position?: string;
  }) => (
    <span aria-label={typeof message === "string" ? message : undefined}>
      {children}
    </span>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id?: string; className?: string }) => <span data-icon={id} />,
}));

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({
    firstMessage,
    secondMessage,
  }: {
    firstMessage?: ReactNode;
    secondMessage?: ReactNode;
    icon?: boolean;
    extraClassName?: string;
  }) => (
    <div data-testid="search-results-not-found">
      <span>{firstMessage}</span>
      <span>{secondMessage}</span>
    </div>
  ),
}));

// SettingsMenu renders title, rightElement, and children unconditionally
// so tests can query edit/delete buttons without needing to expand a collapsible
vi.mock("~/components/ds/molecules/SettingsMenu", () => ({
  default: ({
    title,
    rightElement,
    children,
  }: {
    title: ReactNode;
    rightElement?: ReactNode;
    children: ReactNode;
    canCollapse?: boolean;
    defaultOpen?: boolean;
  }) => (
    <div data-testid="settings-menu">
      <div data-testid="settings-menu-title">{title}</div>
      {rightElement && (
        <div data-testid="settings-menu-right">{rightElement}</div>
      )}
      <div data-testid="settings-menu-content">{children}</div>
    </div>
  ),
}));

// ----- helpers -----

function makeServer(
  overrides: Partial<McpServer> & { id: string; name: string; url: string },
): McpServer {
  return {
    enabled: true,
    tools: [],
    ...overrides,
  };
}

type ConnectionState =
  | "disconnected"
  | "ready"
  | "failed"
  | "connecting"
  | "loading"
  | "discovering"
  | "authenticating"
  | "pending_auth";

function makeConnection(
  state: ConnectionState = "disconnected",
  tools: { name: string; description?: string }[] = [],
) {
  return {
    state,
    error: undefined as string | undefined,
    tools,
    callTool: undefined,
    disconnect: vi.fn(),
    retry: vi.fn(),
    clearStorage: vi.fn(),
  };
}

function resetMockState(
  servers: McpServer[] = [],
  searchTerm = "",
) {
  mockState = { addingServer: false, editServerId: null, searchTerm };
  mockDispatch = vi.fn();
  mockGetMCPConnection.mockReset();
  mockGetServerById.mockReset();
  mockUpdateServer.mockReset();
  mockRemoveServer.mockReset();
  mockMcpState = {
    servers,
    getMCPConnection: mockGetMCPConnection,
    getServerById: mockGetServerById,
    updateServer: mockUpdateServer,
    removeServer: mockRemoveServer,
  };
}

// ----- ManageMcpServer -----

describe("ManageMcpServer", () => {
  it("describes streamable HTTP support for new MCP servers", () => {
    resetMockState();
    mockGetServerById.mockReturnValue(undefined);

    render(<ManageMcpServer open={true} onClose={vi.fn()} />);

    expect(
      screen.getByText(
        "Connect OpenBB Workspace to your data and tools. Supports streamable HTTP only (stdio and SSE are not supported).",
      ),
    ).toBeInTheDocument();
  });
});

// ----- McpServerModal -----

describe("McpServerModal", () => {
  it("renders MCP Servers title and description", () => {
    resetMockState([]);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "MCP Servers" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Test connections to your MCP servers and discover available tools. Supports HTTP/SSE protocols only (stdio protocol is not supported).",
      ),
    ).toBeInTheDocument();
  });

  it("renders empty state when servers list is empty", () => {
    resetMockState([]);

    render(<McpServerModal onClose={vi.fn()} />);

    const notFound = screen.getByTestId("search-results-not-found");
    expect(notFound).toBeInTheDocument();
    expect(notFound).toHaveTextContent("No MCP servers added");
  });

  it("renders one McpServerConnection per server with name and tool count", () => {
    const servers = [
      makeServer({
        id: "s1",
        name: "Alpha Server",
        url: "https://alpha.example.com",
        tools: [
          { id: "t1", name: "tool-a", enabled: true },
          { id: "t2", name: "tool-b", enabled: true },
        ],
      }),
      makeServer({
        id: "s2",
        name: "Beta Server",
        url: "https://beta.example.com",
        tools: [{ id: "t3", name: "tool-c", enabled: true }],
      }),
    ];
    resetMockState(servers);

    mockGetMCPConnection.mockImplementation((id: string) =>
      id === "s1" || id === "s2" ? makeConnection() : undefined,
    );
    mockGetServerById.mockImplementation((id: string) =>
      servers.find((s) => s.id === id),
    );

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("Alpha Server")).toBeInTheDocument();
    expect(screen.getByText("Beta Server")).toBeInTheDocument();
    expect(screen.getByText("(2)")).toBeInTheDocument();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("filters out servers that don't match search term by name", () => {
    const servers = [
      makeServer({ id: "s1", name: "Alpha Server", url: "https://alpha.example.com" }),
      makeServer({ id: "s2", name: "Beta Server", url: "https://beta.example.com" }),
    ];
    resetMockState(servers, "alpha");

    mockGetMCPConnection.mockReturnValue(makeConnection());
    mockGetServerById.mockImplementation((id: string) =>
      servers.find((s) => s.id === id),
    );

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("Alpha Server")).toBeInTheDocument();
    expect(screen.queryByText("Beta Server")).not.toBeInTheDocument();
  });

  it("keeps a server visible when only a tool name matches the search term", () => {
    const servers = [
      makeServer({ id: "s1", name: "Alpha Server", url: "https://alpha.example.com", tools: [] }),
      makeServer({
        id: "s2",
        name: "Beta Server",
        url: "https://beta.example.com",
        tools: [{ id: "t1", name: "get_price", enabled: true }],
      }),
    ];
    resetMockState(servers, "get_price");

    mockGetMCPConnection.mockReturnValue(makeConnection());
    mockGetServerById.mockImplementation((id: string) =>
      servers.find((s) => s.id === id),
    );

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.queryByText("Alpha Server")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Server")).toBeInTheDocument();
  });

  it("shows 'No results found' when search matches nothing but servers exist", () => {
    const servers = [
      makeServer({ id: "s1", name: "Alpha", url: "https://alpha.example.com", tools: [] }),
    ];
    resetMockState(servers, "zzznomatch");

    mockGetMCPConnection.mockReturnValue(makeConnection());
    mockGetServerById.mockImplementation((id: string) =>
      servers.find((s) => s.id === id),
    );

    render(<McpServerModal onClose={vi.fn()} />);

    const notFound = screen.getByTestId("search-results-not-found");
    expect(notFound).toHaveTextContent("No results found");
    expect(notFound).not.toHaveTextContent("No MCP servers added");
  });

  it("clicking edit button dispatches editServerId with server id", () => {
    const server = makeServer({ id: "s1", name: "Alpha", url: "https://alpha.example.com" });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection());
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    // The edit button has a pencil icon and sits inside a settings-menu-right panel
    const rightPanel = screen.getByTestId("settings-menu-right");
    const buttons = rightPanel.querySelectorAll("button");
    // First button: Edit (pencil-02), second button: Delete (trash-04)
    const editButton = Array.from(buttons).find((btn) =>
      btn.querySelector("[data-icon='pencil-02']"),
    );
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton!);

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ editServerId: "s1" }),
    );
  });

  it("clicking delete button calls removeServer with server id", () => {
    const server = makeServer({ id: "s1", name: "Alpha", url: "https://alpha.example.com" });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection());
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    const rightPanel = screen.getByTestId("settings-menu-right");
    const deleteButton = rightPanel.querySelector("[data-icon='trash-04']")?.closest("button");
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton!);

    expect(mockRemoveServer).toHaveBeenCalledWith("s1");
  });

  it("clicking Connect calls updateServer with enabled: true when server is disconnected", () => {
    const server = makeServer({ id: "s1", name: "Alpha", url: "https://alpha.example.com" });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection("disconnected"));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    const connectButton = screen.getByRole("button", { name: "Connect" });
    fireEvent.click(connectButton);

    expect(mockUpdateServer).toHaveBeenCalledWith("s1", { enabled: true });
  });

  it("clicking Disconnect calls updateServer with enabled: false when server is connected", () => {
    const server = makeServer({ id: "s1", name: "Alpha", url: "https://alpha.example.com" });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection("ready"));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    const disconnectButton = screen.getByRole("button", { name: "Disconnect" });
    fireEvent.click(disconnectButton);

    expect(mockUpdateServer).toHaveBeenCalledWith("s1", { enabled: false });
  });
});

// ----- ConnectionTools (via McpServerModal) -----

describe("ConnectionTools (via McpServerModal)", () => {
  it("shows tool names when server is connected and has tools", () => {
    const toolsConnection = [
      { name: "get_price", description: "Get asset price" },
      { name: "list_symbols" },
    ];
    const serverTools = toolsConnection.map((t, i) => ({
      id: `t${i}`,
      name: t.name,
      enabled: true,
      description: t.description,
    }));
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("get_price")).toBeInTheDocument();
    expect(screen.getByText("list_symbols")).toBeInTheDocument();
  });

  it("shows 'No tools match your search' when search filters all tools but server still shows by name", () => {
    const toolsConnection = [{ name: "get_price", description: "Get asset price" }];
    const serverTools = [{ id: "t1", name: "get_price", enabled: true, description: "Get asset price" }];
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    resetMockState([server], "alpha");

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("No tools match your search")).toBeInTheDocument();
  });

  it("filters tools by name case-insensitively", () => {
    const toolsConnection = [
      { name: "get_PRICE" },
      { name: "list_symbols" },
    ];
    const serverTools = [
      { id: "t1", name: "get_PRICE", enabled: true },
      { id: "t2", name: "list_symbols", enabled: true },
    ];
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    // "get_price" matches tool name case-insensitively; server name "Alpha" doesn't match
    resetMockState([server], "get_price");

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("get_PRICE")).toBeInTheDocument();
    expect(screen.queryByText("list_symbols")).not.toBeInTheDocument();
  });

  it("filters tools by description case-insensitively", () => {
    const toolsConnection = [
      { name: "get_price", description: "Fetches OHLCV data" },
      { name: "list_symbols", description: "List available tickers" },
    ];
    const serverTools = [
      { id: "t1", name: "get_price", enabled: true, description: "Fetches OHLCV data" },
      { id: "t2", name: "list_symbols", enabled: true, description: "List available tickers" },
    ];
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    resetMockState([server], "ohlcv");

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("get_price")).toBeInTheDocument();
    expect(screen.queryByText("list_symbols")).not.toBeInTheDocument();
  });
});

// ----- ToolItem (via McpServerModal) -----

describe("ToolItem (via McpServerModal)", () => {
  it("clicking a tool with description toggles expanded description", () => {
    const toolsConnection = [
      { name: "get_price", description: "Returns the current price." },
    ];
    const serverTools = [
      { id: "t1", name: "get_price", enabled: true, description: "Returns the current price." },
    ];
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.queryByText("Returns the current price.")).not.toBeInTheDocument();

    const toolRow = screen.getByRole("button", { name: /get_price/ });
    fireEvent.click(toolRow);

    expect(screen.getByText("Returns the current price.")).toBeInTheDocument();

    fireEvent.click(toolRow);
    expect(screen.queryByText("Returns the current price.")).not.toBeInTheDocument();
  });

  it("tool row without description has no button role and is not expandable", () => {
    const toolsConnection = [{ name: "list_symbols" }];
    const serverTools = [{ id: "t1", name: "list_symbols", enabled: true }];
    const server = makeServer({
      id: "s1",
      name: "Alpha",
      url: "https://alpha.example.com",
      tools: serverTools,
    });
    resetMockState([server]);

    mockGetMCPConnection.mockReturnValue(makeConnection("ready", toolsConnection));
    mockGetServerById.mockReturnValue(server);

    render(<McpServerModal onClose={vi.fn()} />);

    expect(screen.getByText("list_symbols")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /list_symbols/ })).not.toBeInTheDocument();
  });
});
