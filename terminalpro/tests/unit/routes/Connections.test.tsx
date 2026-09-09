import { useQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ReactNode } from "react";
import { BrowserRouter, MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendPermissionsT } from "~/api/user_roles.api";
import type { ButtonProps } from "~/components/ds/atoms/Button";
import type { ExternalCopilotHolder } from "~/lib/state/copilot";
import ConnectionsPage from "~/routes/Connections";

const {
  mockDeleteApiSource,
  mockGetApiSources,
  mockRemoveCustomCopilot,
  mockToast,
  mockUpdateApiSources,
  mockRemoveApiSource,
  mockSetExternalCopilotHolders,
  mockSetManageAppDialog,
  mockRefreshApiSourceById,
  mockUseShallowBackendConnectorStore,
  mockUseShallowCopilotStore,
  mockUseShallowPermissionsStore,
  mockUseShallowThemeStore,
} = vi.hoisted(() => ({
  mockDeleteApiSource: vi.fn(),
  mockGetApiSources: vi.fn(),
  mockRemoveCustomCopilot: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockUpdateApiSources: vi.fn(),
  mockRemoveApiSource: vi.fn(),
  mockSetExternalCopilotHolders: vi.fn(),
  mockSetManageAppDialog: vi.fn(),
  mockRefreshApiSourceById: vi.fn().mockResolvedValue(undefined),
  mockUseShallowBackendConnectorStore: vi.fn(),
  mockUseShallowCopilotStore: vi.fn(),
  mockUseShallowPermissionsStore: vi.fn(),
  mockUseShallowThemeStore: vi.fn(),
}));

vi.mock("~/api/auth.api", () => ({
  SUBSCRIPTIONS_QUERY_KEY: ["marketplace", "subscriptions"],
  getUserSubscriptions: vi.fn(),
  deleteApiSource: (...args: unknown[]) => mockDeleteApiSource(...args),
  getApiSources: () => mockGetApiSources(),
  removeCustomCopilot: (...args: unknown[]) => mockRemoveCustomCopilot(...args),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: vi.fn((data) => data),
  useQuery: vi.fn(() => ({
    isFetching: false,
    data: null,
    refetch: vi.fn().mockResolvedValue({}),
  })),
  useQueries: vi.fn(() => [
    { isFetching: false, data: null, refetch: vi.fn().mockResolvedValue({}) },
  ]),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: any) =>
    mockUseShallowBackendConnectorStore(selector),
}));

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: any) => mockUseShallowCopilotStore(selector),
}));

vi.mock("~/lib/state/permissions", () => ({
  useShallowPermissionsStore: (selector: any) =>
    mockUseShallowPermissionsStore(selector),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: any) => mockUseShallowThemeStore(selector),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({ children, title }: { children: ReactNode; title?: string }) => (
    <div data-testid="settings-layout">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  ),
}));

vi.mock("~/components/ds/dialogs/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onClose,
    title,
    description,
    confirmButton,
    cancelText,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    confirmButton: ReactNode;
    cancelText: string;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        {confirmButton}
        <button type="button" onClick={onClose}>
          {cancelText}
        </button>
      </div>
    ) : null,
}));

vi.mock("~/components/General/BrandedLoadingState", () => ({
  default: ({ message }: { message?: string }) => (
    <div data-testid="branded-loading">{message}</div>
  ),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: ({
    children,
    firstMessage,
    secondMessage,
  }: {
    children?: ReactNode;
    firstMessage: string;
    secondMessage: string;
    icon?: boolean;
    extraClassName?: string;
  }) => (
    <div data-testid="empty-state">
      <p>{firstMessage}</p>
      <p>{secondMessage}</p>
      {children}
    </div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: forwardRef(({ id, className }: { id: string; className?: string }, _ref) => (
    <span data-testid={`icon-${id}`} className={className} />
  )),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    message,
  }: {
    children: ReactNode;
    message: string | ReactNode;
    position?: string;
    id?: string;
  }) => <div title={typeof message === "string" ? message : undefined}>{children}</div>,
}));

vi.mock("~/components/ds/atoms/HintLabel", () => ({
  HintLabel: ({
    children,
    tooltip,
  }: {
    children: ReactNode;
    tooltip: ReactNode;
    className?: string;
  }) => (
    <span>
      {children}
      <span data-testid="hint-tooltip">{tooltip}</span>
    </span>
  ),
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: forwardRef<HTMLButtonElement, ButtonProps>((props, _ref) => (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled || props.loading}
      data-variant={props.variant}
      data-size={props.size}
      className={props.className}
    >
      {props.loading ? "Loading..." : props.children}
    </button>
  )),
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    disabled,
    className,
  }: {
    checked: boolean | "indeterminate";
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked === true}
      onChange={(e) => onCheckedChange(e.target.checked)}
      disabled={disabled}
      className={className}
      data-indeterminate={checked === "indeterminate"}
    />
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: ({
    placeholder,
    onChange,
    defaultValue,
    className,
    prefix,
  }: {
    placeholder?: string;
    onChange?: (value: string) => void;
    defaultValue?: string;
    className?: string;
    prefix?: ReactNode;
  }) => (
    <div className={className}>
      {prefix}
      <input
        type="text"
        placeholder={placeholder}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        data-testid="search-input"
      />
    </div>
  ),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  Select: ({
    options,
    placeholder,
    value,
    onChange,
    className,
  }: {
    options: { label: string; value: string }[];
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={className}
      data-testid={placeholder === "Sort by" ? "sort-select" : "filter-select"}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

const mockApiSources = [
  {
    id: "backend-1",
    uuid: "uuid-1",
    name: "My Backend",
    url: "https://api.example.com",
    widgets: { "widget-1": {}, "widget-2": {} },
    templates: [{ id: "template-1" }],
    status: "success" as const,
    createdDate: "2024-01-15T00:00:00Z",
  },
  {
    id: "backend-2",
    uuid: "uuid-2",
    name: "Another Backend",
    url: "https://another.example.com",
    widgets: {},
    templates: [],
    status: "error" as const,
    createdDate: "2024-01-10T00:00:00Z",
  },
];

const mockExternalCopilotHolders: ExternalCopilotHolder[] = [
  {
    uuid: "copilot-holder-1",
    url: "https://api.example.com",
    headers: {},
    copilots: [
      { id: "agent-1", name: "Agent 1", description: "Test agent" },
      { id: "agent-2", name: "Agent 2", description: "Test agent 2" },
    ],
  },
];

const mockSharedBackends: BackendPermissionsT[] = [
  {
    uuid: "shared-uuid-1",
    name: "Shared Backend",
    url: "https://shared.example.com",
    access: "read",
    endpointHeaders: [],
    widgets: [{ widgetId: "sw-1", access: "read" }],
    templates: [],
  },
];

function setupDefaultMocks() {
  mockUseShallowBackendConnectorStore.mockImplementation((selector: any) =>
    selector({
      apiSources: mockApiSources,
      updateApiSources: mockUpdateApiSources,
      removeApiSource: mockRemoveApiSource,
      refreshApiSourceById: mockRefreshApiSourceById,
      deleteApiSource: mockDeleteApiSource,
    }),
  );

  mockUseShallowCopilotStore.mockImplementation((selector: any) =>
    selector({
      externalCopilotHolders: mockExternalCopilotHolders,
      setExternalCopilotHolders: mockSetExternalCopilotHolders,
    }),
  );

  mockUseShallowPermissionsStore.mockImplementation((selector: any) =>
    selector({
      permissions: {
        backends: mockSharedBackends,
        files: [],
        prompts: [],
      },
    }),
  );

  mockUseShallowThemeStore.mockImplementation((selector: any) =>
    selector({
      setManageAppDialog: mockSetManageAppDialog,
    }),
  );
}

function setupEmptyMocks() {
  mockUseShallowBackendConnectorStore.mockImplementation((selector: any) =>
    selector({
      apiSources: [],
      updateApiSources: mockUpdateApiSources,
      removeApiSource: mockRemoveApiSource,
      refreshApiSourceById: mockRefreshApiSourceById,
      deleteApiSource: mockDeleteApiSource,
    }),
  );

  mockUseShallowCopilotStore.mockImplementation((selector: any) =>
    selector({
      externalCopilotHolders: [],
      setExternalCopilotHolders: mockSetExternalCopilotHolders,
    }),
  );

  mockUseShallowPermissionsStore.mockImplementation((selector: any) =>
    selector({
      permissions: {
        backends: [],
        files: [],
        prompts: [],
      },
    }),
  );

  mockUseShallowThemeStore.mockImplementation((selector: any) =>
    selector({
      setManageAppDialog: mockSetManageAppDialog,
    }),
  );
}

const renderConnections = () => {
  return render(
    <BrowserRouter>
      <ConnectionsPage />
    </BrowserRouter>,
  );
};

describe("ConnectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteApiSource.mockResolvedValue({});
    mockRemoveCustomCopilot.mockResolvedValue({});
    setupDefaultMocks();
  });

  describe("Rendering", () => {
    it("renders the page title", () => {
      renderConnections();
      expect(screen.getByText("Connections")).toBeInTheDocument();
    });

    it("renders the search input", () => {
      renderConnections();
      expect(screen.getByTestId("search-input")).toBeInTheDocument();
    });

    it("renders sort and filter selects", () => {
      renderConnections();
      expect(screen.getByTestId("sort-select")).toBeInTheDocument();
      expect(screen.getByTestId("filter-select")).toBeInTheDocument();
    });

    it("renders Connect Backend button", () => {
      renderConnections();
      expect(
        screen.getByRole("button", { name: /connect backend/i }),
      ).toBeInTheDocument();
    });

    it("renders connections table with headers", () => {
      renderConnections();
      const headers = screen.getAllByRole("columnheader");
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain("Backends");
      expect(headerTexts).toContain("Widgets");
      expect(headerTexts).toContain("Apps");
      expect(headerTexts).toContain("Agents");
      expect(headerTexts).toContain("Prompts");
      expect(headerTexts).toContain("Last Updated");
    });

    it("renders connection rows", async () => {
      const user = userEvent.setup();
      renderConnections();
      expect(screen.getByText("My Backend")).toBeInTheDocument();
      expect(screen.getByText("Shared Backend")).toBeInTheDocument();
      // "Another Backend" has status "error" and is in the collapsed Inactive section
      // Expand the inactive section to see it
      const inactiveButton = screen.getByRole("button", { name: /inactive/i });
      await user.click(inactiveButton);
      expect(screen.getByText("Another Backend")).toBeInTheDocument();
    });

    it("displays widget count for backends", () => {
      renderConnections();
      const rows = screen.getAllByRole("row");
      const myBackendRow = rows.find((row) => within(row).queryByText("My Backend"));
      expect(myBackendRow).toBeDefined();
      if (myBackendRow) {
        const cells = within(myBackendRow).getAllByRole("cell");
        // Column order: Checkbox, Backend, Apps, Widgets, Prompts, Agents, Last Updated, Actions
        expect(cells[3]).toHaveTextContent("2");
      }
    });
  });

  describe("Connect Backend Action", () => {
    it("opens manage app dialog when Connect Backend is clicked", async () => {
      const user = userEvent.setup();
      renderConnections();

      await user.click(screen.getByRole("button", { name: /connect backend/i }));

      expect(mockSetManageAppDialog).toHaveBeenCalledWith({
        isOpen: true,
        mode: "add",
        data: null,
      });
    });
  });

  describe("Search Functionality", () => {
    it("filters connections by name", async () => {
      const user = userEvent.setup();
      renderConnections();

      const searchInput = screen.getByTestId("search-input");
      await user.type(searchInput, "My Backend");

      await waitFor(() => {
        expect(screen.getByText("My Backend")).toBeInTheDocument();
      });
    });

    it("filters connections by URL", async () => {
      const user = userEvent.setup();
      renderConnections();

      const searchInput = screen.getByTestId("search-input");
      await user.type(searchInput, "another.example");

      // "Another Backend" has status "error" and is in the collapsed Inactive section
      // Expand the inactive section to see filtered results
      await waitFor(() => {
        const inactiveButton = screen.getByRole("button", { name: /inactive/i });
        return inactiveButton;
      });
      const inactiveButton = screen.getByRole("button", { name: /inactive/i });
      await user.click(inactiveButton);

      await waitFor(() => {
        expect(screen.getByText("Another Backend")).toBeInTheDocument();
      });
    });
  });

  describe("Filter Functionality", () => {
    it("filters to show only my connections", async () => {
      const user = userEvent.setup();
      renderConnections();

      const filterSelect = screen.getByTestId("filter-select");
      await user.selectOptions(filterSelect, "my-connections");

      await waitFor(() => {
        expect(screen.getByText("My Backend")).toBeInTheDocument();
        expect(screen.queryByText("Shared Backend")).not.toBeInTheDocument();
      });
    });

    it("filters to show only shared connections", async () => {
      const user = userEvent.setup();
      renderConnections();

      const filterSelect = screen.getByTestId("filter-select");
      await user.selectOptions(filterSelect, "shared");

      await waitFor(() => {
        expect(screen.queryByText("My Backend")).not.toBeInTheDocument();
        expect(screen.getByText("Shared Backend")).toBeInTheDocument();
      });
    });
  });

  describe("Sort Functionality", () => {
    it("sorts by name A-Z", async () => {
      const user = userEvent.setup();
      renderConnections();

      const sortSelect = screen.getByTestId("sort-select");
      await user.selectOptions(sortSelect, "a-z");

      const rows = screen.getAllByRole("row");
      const connectionRows = rows.slice(1);
      expect(connectionRows.length).toBeGreaterThan(0);
    });

    it("sorts by name Z-A", async () => {
      const user = userEvent.setup();
      renderConnections();

      const sortSelect = screen.getByTestId("sort-select");
      await user.selectOptions(sortSelect, "z-a");

      const rows = screen.getAllByRole("row");
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  describe("Selection", () => {
    it("selects individual connection", async () => {
      const user = userEvent.setup();
      renderConnections();

      const checkboxes = screen.getAllByRole("checkbox");
      const firstConnectionCheckbox = checkboxes[1];
      await user.click(firstConnectionCheckbox);

      expect(firstConnectionCheckbox).toBeChecked();
    });

    it("selects all connections with header checkbox", async () => {
      const user = userEvent.setup();
      renderConnections();

      const checkboxes = screen.getAllByRole("checkbox");
      const headerCheckbox = checkboxes[0];
      await user.click(headerCheckbox);

      checkboxes.slice(1).forEach((checkbox) => {
        if (!checkbox.hasAttribute("disabled")) {
          expect(checkbox).toBeChecked();
        }
      });
    });

    it("deselects all when header checkbox is unchecked", async () => {
      const user = userEvent.setup();
      renderConnections();

      const checkboxes = screen.getAllByRole("checkbox");
      const headerCheckbox = checkboxes[0];

      await user.click(headerCheckbox);
      await user.click(headerCheckbox);

      checkboxes.slice(1).forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
      });
    });
  });

  describe("Delete Single Connection", () => {
    it("opens delete confirmation dialog", async () => {
      const user = userEvent.setup();
      renderConnections();

      // The Tooltip wrapper has the title, find the button inside
      const deleteWrappers = screen.getAllByTitle("Delete connection");
      const deleteButton = within(deleteWrappers[0]).getByRole("button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });
      expect(screen.getByText("Delete connection")).toBeInTheDocument();
    });

    it("closes dialog when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderConnections();

      const deleteWrappers = screen.getAllByTitle("Delete connection");
      const deleteButton = within(deleteWrappers[0]).getByRole("button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
      });
    });

    it("calls delete API when confirmed", async () => {
      const user = userEvent.setup();
      renderConnections();

      const deleteWrappers = screen.getAllByTitle("Delete connection");
      const deleteButton = within(deleteWrappers[0]).getByRole("button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      // Find the confirm button inside the dialog (the danger variant button)
      const dialog = screen.getByTestId("confirm-dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /yes, delete/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockDeleteApiSource).toHaveBeenCalled();
      });
    });

    it("shows success toast after deletion", async () => {
      const user = userEvent.setup();
      renderConnections();

      const deleteWrappers = screen.getAllByTitle("Delete connection");
      const deleteButton = within(deleteWrappers[0]).getByRole("button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByTestId("confirm-dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /yes, delete/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          expect.stringContaining("deleted successfully"),
        );
      });
    });
  });

  describe("Delete Multiple Connections", () => {
    it("shows bulk delete button when connections are selected", async () => {
      const user = userEvent.setup();
      renderConnections();

      // Before selection, bulk delete button should not be rendered
      expect(
        screen.queryByRole("button", { name: /delete connection/i }),
      ).not.toBeInTheDocument();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      // After selection, bulk delete button appears
      const bulkDeleteButton = screen.getByRole("button", {
        name: /delete connection/i,
      });
      expect(bulkDeleteButton).not.toBeDisabled();
    });

    it("does not show bulk delete button when no connections selected", () => {
      renderConnections();

      expect(
        screen.queryByRole("button", { name: /delete connection/i }),
      ).not.toBeInTheDocument();
    });

    it("opens bulk delete confirmation dialog", async () => {
      const user = userEvent.setup();
      renderConnections();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      const bulkDeleteButton = screen.getByRole("button", {
        name: /delete connection/i,
      });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });
      expect(screen.getByText("Delete connections")).toBeInTheDocument();
    });

    it("shows count in bulk delete confirmation", async () => {
      const user = userEvent.setup();
      renderConnections();

      // Expand inactive section to have more selectable connections
      const inactiveButton = screen.getByRole("button", { name: /inactive/i });
      await user.click(inactiveButton);

      const checkboxes = screen.getAllByRole("checkbox");
      // [0]=Active header, [1]=My Backend, [2]=Shared Backend (disabled), [3]=Inactive header, [4]=Another Backend
      await user.click(checkboxes[1]);
      await user.click(checkboxes[4]);

      const bulkDeleteButton = screen.getByRole("button", {
        name: /delete connections/i,
      });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByText(/2 connection/)).toBeInTheDocument();
      });
    });
  });

  describe("Edit Backend", () => {
    it("opens edit dialog when edit button is clicked", async () => {
      const user = userEvent.setup();
      renderConnections();

      // The Tooltip wrapper has the title, find the button inside
      const editWrappers = screen.getAllByTitle("Edit backend");
      const editButton = within(editWrappers[0]).getByRole("button");
      await user.click(editButton);

      expect(mockSetManageAppDialog).toHaveBeenCalledWith({
        isOpen: true,
        mode: "edit",
        data: expect.objectContaining({
          id: "backend-1",
        }),
      });
    });
  });

  describe("Shared Connections", () => {
    it("displays shared indicator for shared connections", () => {
      renderConnections();

      const sharedIndicators = screen.getAllByTitle("Shared");
      expect(sharedIndicators.length).toBeGreaterThan(0);
    });

    it("does not show delete button for shared connections", () => {
      renderConnections();

      const sharedRow = screen.getByText("Shared Backend").closest("tr");
      expect(sharedRow).toBeDefined();
      if (sharedRow) {
        expect(
          within(sharedRow).queryByTitle("Delete connection"),
        ).not.toBeInTheDocument();
      }
    });

    it("does not show edit button for shared connections", () => {
      renderConnections();

      const sharedRow = screen.getByText("Shared Backend").closest("tr");
      expect(sharedRow).toBeDefined();
      if (sharedRow) {
        expect(within(sharedRow).queryByTitle("Edit backend")).not.toBeInTheDocument();
      }
    });

    it("disables checkbox for shared connections", () => {
      renderConnections();

      const sharedRow = screen.getByText("Shared Backend").closest("tr");
      expect(sharedRow).toBeDefined();
      if (sharedRow) {
        const checkbox = within(sharedRow).getByRole("checkbox");
        expect(checkbox).toBeDisabled();
      }
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no connections exist", () => {
      setupEmptyMocks();
      renderConnections();

      expect(screen.getByText("No connections added")).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: /connect backend/i })[0],
      ).toBeInTheDocument();
    });
  });

  describe("URL Copy Feature", () => {
    it("shows URL in backend name tooltip", () => {
      renderConnections();

      // URL is rendered inside HintLabel tooltip content
      expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
    });

    it("copies URL to clipboard when copy button is clicked", async () => {
      const user = userEvent.setup();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      renderConnections();

      // The copy button is rendered inside the HintLabel tooltip content, next to the URL
      const urlElement = screen.getByText("https://api.example.com");
      const copyButton = urlElement.parentElement?.querySelector("button");
      expect(copyButton).toBeTruthy();
      await user.click(copyButton!);

      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith("https://api.example.com");
      });
    });
  });

  describe("Refresh Button", () => {
    it("renders refresh button", () => {
      renderConnections();
      expect(screen.getByTitle("Refresh all backends")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("shows error toast when delete fails", async () => {
      mockDeleteApiSource.mockRejectedValue(new Error("Delete failed"));

      const user = userEvent.setup();
      renderConnections();

      const deleteWrappers = screen.getAllByTitle("Delete connection");
      const deleteButton = within(deleteWrappers[0]).getByRole("button");
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByTestId("confirm-dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /yes, delete/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to delete connection");
      });
    });

    it("shows error toast when bulk delete fails", async () => {
      mockDeleteApiSource.mockRejectedValue(new Error("Delete failed"));

      const user = userEvent.setup();
      renderConnections();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]);

      const bulkDeleteButton = screen.getByRole("button", {
        name: /delete connection/i,
      });
      await user.click(bulkDeleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      const dialog = screen.getByTestId("confirm-dialog");
      const confirmButton = within(dialog).getByRole("button", {
        name: /yes, delete/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Failed to delete connections");
      });
    });
  });

  describe("Progressive Loading", () => {
    const fetchingQuery = () =>
      ({
        isFetching: true,
        data: null,
        refetch: vi.fn().mockResolvedValue({}),
      }) as any;

    afterEach(() => {
      vi.mocked(useQuery).mockImplementation(
        () =>
          ({
            isFetching: false,
            data: null,
            refetch: vi.fn().mockResolvedValue({}),
          }) as any,
      );
    });

    it("shows the full-page loader only when no connections are available yet", () => {
      setupEmptyMocks();
      vi.mocked(useQuery).mockImplementation(fetchingQuery);
      renderConnections();

      expect(screen.getByTestId("branded-loading")).toHaveTextContent(
        "Loading connections...",
      );
    });

    it("renders rows while backends are still validating instead of a full-page loader", () => {
      vi.mocked(useQuery).mockImplementation(fetchingQuery);
      renderConnections();

      expect(screen.queryByTestId("branded-loading")).not.toBeInTheDocument();
      expect(screen.getByText("My Backend")).toBeInTheDocument();
    });

    it("shows a validating indicator on rows that are still pending", () => {
      vi.mocked(useQuery).mockImplementation(fetchingQuery);
      mockUseShallowBackendConnectorStore.mockImplementation((selector: any) =>
        selector({
          apiSources: [
            mockApiSources[0],
            {
              id: "backend-pending",
              uuid: "uuid-pending",
              name: "Pending Backend",
              url: "https://pending.example.com",
              widgets: {},
              templates: [],
              status: "pending" as const,
              createdDate: "2024-01-05T00:00:00Z",
            },
          ],
          updateApiSources: mockUpdateApiSources,
          removeApiSource: mockRemoveApiSource,
          refreshApiSourceById: mockRefreshApiSourceById,
          deleteApiSource: mockDeleteApiSource,
        }),
      );
      renderConnections();

      const pendingRow = screen.getByText("Pending Backend").closest("tr");
      expect(pendingRow).toBeTruthy();
      expect(within(pendingRow!).getByTestId("icon-mdi-loading")).toBeInTheDocument();

      const successRow = screen.getByText("My Backend").closest("tr");
      expect(successRow).toBeTruthy();
      expect(
        within(successRow!).queryByTestId("icon-mdi-loading"),
      ).not.toBeInTheDocument();
    });
  });

  describe("Go to connection highlight", () => {
    function LocationProbe() {
      const loc = useLocation();
      return <div data-testid="loc-search">{loc.search}</div>;
    }

    const renderAt = (route: string) =>
      render(
        <MemoryRouter initialEntries={[route]}>
          <ConnectionsPage />
          <LocationProbe />
        </MemoryRouter>,
      );

    const scrollIntoViewMock = vi.fn();

    beforeEach(() => {
      Element.prototype.scrollIntoView = scrollIntoViewMock;
      scrollIntoViewMock.mockClear();
    });

    it("scrolls to and flashes the matching active connection row", () => {
      vi.useFakeTimers();
      try {
        renderAt("/app/connections?connectionId=backend-1");
        const row = screen.getByText("My Backend").closest("tr");
        expect(row).toBeTruthy();
        expect(scrollIntoViewMock).not.toHaveBeenCalled();

        act(() => {
          vi.advanceTimersByTime(250);
        });

        expect(scrollIntoViewMock).toHaveBeenCalled();
        expect(row?.className).toContain("brand-main");
      } finally {
        vi.useRealTimers();
      }
    });

    it("removes the connectionId param after the highlight completes", () => {
      vi.useFakeTimers();
      try {
        renderAt("/app/connections?connectionId=backend-1");
        expect(screen.getByTestId("loc-search").textContent).toContain(
          "connectionId=backend-1",
        );

        act(() => {
          vi.advanceTimersByTime(2250);
        });

        expect(screen.getByTestId("loc-search").textContent).not.toContain(
          "connectionId",
        );
      } finally {
        vi.useRealTimers();
      }
    });

    it("opens the edit modal for the deep-linked connection", () => {
      renderAt("/app/connections?connectionId=backend-1");

      expect(mockSetManageAppDialog).toHaveBeenCalledWith({
        isOpen: true,
        mode: "edit",
        data: expect.objectContaining({ id: "backend-1" }),
      });
    });

    it("does nothing when connectionId matches no connection", () => {
      vi.useFakeTimers();
      try {
        renderAt("/app/connections?connectionId=does-not-exist");

        act(() => {
          vi.advanceTimersByTime(2250);
        });

        expect(scrollIntoViewMock).not.toHaveBeenCalled();
        expect(mockSetManageAppDialog).not.toHaveBeenCalled();
        expect(screen.getByText("My Backend")).toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
