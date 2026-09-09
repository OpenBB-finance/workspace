import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIAgentsTab } from "~/components/AI/AIAgentsTab";
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
  mockFetchAgentsData,
  mockHasCopilotConflict,
  mockPutCustomCopilot,
  mockRemoveCustomCopilot,
  mockToast,
  mockSetShowAddAgentsDialog,
  mockUpdateExternalCopilotHolders,
  mockSetExternalCopilotHolders,
  mockSetSelectedCopilot,
  mockUseShallowCopilotStore,
  mockUseShallowThemeStore,
  mockRuntimeConfig,
} = vi.hoisted(() => ({
  mockFetchAgentsData: vi.fn(),
  mockHasCopilotConflict: vi.fn(),
  mockPutCustomCopilot: vi.fn(),
  mockRemoveCustomCopilot: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockSetShowAddAgentsDialog: vi.fn(),
  mockUpdateExternalCopilotHolders: vi.fn(),
  mockSetExternalCopilotHolders: vi.fn(),
  mockSetSelectedCopilot: vi.fn(),
  mockUseShallowCopilotStore: vi.fn(),
  mockUseShallowThemeStore: vi.fn(),
  mockRuntimeConfig: { copilot: { openbbCopilot: true } },
}));

// --- Module mocks ---

vi.mock("~/api/auth.api", () => ({
  fetchAgentsData: (...args: unknown[]) => mockFetchAgentsData(...args),
  hasCopilotConflict: (...args: unknown[]) => mockHasCopilotConflict(...args),
  putCustomCopilot: (...args: unknown[]) => mockPutCustomCopilot(...args),
  removeCustomCopilot: (...args: unknown[]) => mockRemoveCustomCopilot(...args),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("usehooks-ts", () => ({
  useDebounceValue: (value: string) => [value],
}));

const mockCopilotStoreState: {
  externalCopilotHolders: unknown[];
  setExternalCopilotHolders: ReturnType<typeof vi.fn>;
  updateExternalCopilotHolders: ReturnType<typeof vi.fn>;
} = {
  externalCopilotHolders: [],
  setExternalCopilotHolders: mockSetExternalCopilotHolders,
  updateExternalCopilotHolders: mockUpdateExternalCopilotHolders,
};

vi.mock("~/lib/state/copilot", () => ({
  useShallowCopilotStore: (selector: unknown) => mockUseShallowCopilotStore(selector),
  useCopilotStore: { getState: () => mockCopilotStoreState },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: unknown) => mockUseShallowThemeStore(selector),
}));

vi.mock("~/hooks/useStateReducer", async () => {
  const { useState: useStateReal, useCallback: useCallbackReal } = await import(
    "react"
  );
  return {
    useStateReducer: <T extends Record<string, unknown>>(initialState: T) => {
      const [state, setState] = useStateReal(initialState);
      const dispatch = useCallbackReal(
        (partial: Partial<{ [K in keyof T]: T[K] | ((prev: T[K]) => T[K]) }>) => {
          setState((prev: T) => {
            const next = { ...prev };
            for (const key of Object.keys(partial) as (keyof T)[]) {
              const val = partial[key];
              if (typeof val === "function") {
                next[key] = (val as (prev: T[keyof T]) => T[keyof T])(prev[key]);
              } else {
                next[key] = val as T[keyof T];
              }
            }
            return next;
          });
        },
        [],
      );
      return [state, dispatch] as const;
    },
  };
});

vi.mock("~/lib/runtimeConfig", () => ({
  getConfig: () => mockRuntimeConfig,
}));

vi.mock("~/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    DEFAULT_COPILOT: {
      id: "openbb-copilot",
      name: "OpenBB Copilot",
      description: "Default copilot",
      endpoints: {},
    },
    getDefaultCopilot: () => ({
      id: "openbb-copilot",
      name: "OpenBB Copilot",
      description: "OpenBB Copilot is the default agent for OpenBB Workspace.",
      image: "/assets/images/openbb.png",
    }),
  };
});

vi.mock("~/lib/utils/widgetParams", () => ({
  createURLString: (path: string, base: string) => `${base}${path}`,
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: () => <div>No results found</div>,
}));

vi.mock("~/components/AI/AddCopilotDialog", () => ({
  AddCopilotDialog: () => <div data-testid="add-copilot-dialog" />,
}));

vi.mock("~/components/General/Avatar", () => ({
  default: ({
    alt,
    fallback,
    src,
  }: {
    alt: string;
    src?: string;
    fallback?: ReactNode;
    className?: string;
    variant?: string;
  }) => (
    <div data-testid={`avatar-${alt}`}>
      {src ? <img src={src} alt={alt} /> : fallback}
    </div>
  ),
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
      disabled={props.disabled || props.loading}
      data-variant={props.variant}
      data-size={props.size}
      className={props.className}
    >
      {props.loading ? "Loading..." : props.children}
    </button>
  )),
}));

vi.mock("~/components/ds/atoms/Tag", () => ({
  Tag: ({ children, color }: { children: ReactNode; color?: string }) => (
    <span data-testid={`tag-${color ?? "default"}`}>{children}</span>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: forwardRef<HTMLInputElement, InputProps>((props, _ref) => (
    <div className={props.className}>
      {props.prefix}
      <input
        type="text"
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        value={props.value}
        onChange={(e) => props.onChange?.(e.target.value)}
      />
    </div>
  )),
}));

vi.mock("~/components/ds/dialogs/BaseDialog", () => ({
  BaseDialog: ({
    open,
    onClose,
    children,
    className,
  }: {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
  }) =>
    open ? (
      <div data-testid="base-dialog" className={className}>
        {children}
        <button type="button" onClick={onClose} data-testid="base-dialog-close">
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock("~/components/ds/dialogs/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onClose,
    title,
    description,
    confirmText,
    onConfirm,
  }: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock("~/components/ds/dialogs/Dialog", () => ({
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p data-testid="dialog-description">{children}</p>
  ),
  DialogFooter: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => (
    <div data-testid="dialog-footer" className={className}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
}));

// --- Mock data factories ---

interface CopilotMock {
  id: string;
  name: string;
  description: string;
  holderUuid?: string;
  image?: string;
  endpoints: Record<string, string>;
  headers?: Record<string, string>;
  features?: Record<string, boolean>;
}

interface ExternalCopilotHolderMock {
  uuid: string;
  url: string;
  headers: Record<string, string>;
  copilots?: CopilotMock[];
  status?: "success" | "error";
  enabled?: boolean;
}

function makeCopilot(overrides: Partial<CopilotMock> = {}): CopilotMock {
  return {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent for unit testing",
    holderUuid: "holder-1",
    image: "",
    endpoints: { query: "/api/query" },
    headers: {},
    features: {},
    ...overrides,
  };
}

function makeHolder(
  overrides: Partial<ExternalCopilotHolderMock> = {},
): ExternalCopilotHolderMock {
  return {
    uuid: "holder-1",
    url: "https://agents.example.com",
    headers: {},
    copilots: [makeCopilot()],
    status: "success",
    enabled: true,
    ...overrides,
  };
}

const SINGLE_HOLDER = [makeHolder()];

const TWO_HOLDERS = [
  makeHolder({
    uuid: "holder-1",
    url: "https://agents.example.com",
    copilots: [
      makeCopilot({ id: "agent-1", name: "Alpha Agent", description: "First agent" }),
      makeCopilot({ id: "agent-2", name: "Beta Agent", description: "Second agent" }),
    ],
  }),
  makeHolder({
    uuid: "holder-2",
    url: "https://other-agents.example.com",
    copilots: [
      makeCopilot({
        id: "agent-3",
        name: "Gamma Agent",
        description: "Third agent",
        holderUuid: "holder-2",
      }),
    ],
  }),
];

const HOLDER_WITH_AUTH = makeHolder({
  uuid: "holder-auth",
  url: "https://auth-agents.example.com",
  headers: { Authorization: "Bearer token123", "X-Custom": "custom-value" },
  copilots: [
    makeCopilot({
      id: "agent-auth",
      name: "Authed Agent",
      description: "Agent with auth",
      holderUuid: "holder-auth",
    }),
  ],
});

// --- Setup helpers ---

function setupDefaultMocks(
  externalCopilotHolders: ExternalCopilotHolderMock[] = SINGLE_HOLDER,
  selectedCopilot: CopilotMock | null = null,
) {
  mockCopilotStoreState.externalCopilotHolders = externalCopilotHolders;

  mockUseShallowCopilotStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      externalCopilotHolders,
      updateExternalCopilotHolders: mockUpdateExternalCopilotHolders,
      setExternalCopilotHolders: mockSetExternalCopilotHolders,
      selectedCopilot,
      setSelectedCopilot: mockSetSelectedCopilot,
    }),
  );

  mockUseShallowThemeStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      setShowAddAgentsDialog: mockSetShowAddAgentsDialog,
    }),
  );
}

function setupEmptyMocks() {
  setupDefaultMocks([]);
}

const renderAIAgentsTab = () =>
  render(
    <BrowserRouter>
      <AIAgentsTab />
    </BrowserRouter>,
  );

// --- Tests ---

describe("AIAgentsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeConfig.copilot.openbbCopilot = true;
    mockFetchAgentsData.mockResolvedValue([]);
    mockHasCopilotConflict.mockReturnValue(false);
    mockPutCustomCopilot.mockResolvedValue({});
    mockRemoveCustomCopilot.mockResolvedValue({});
    setupDefaultMocks();
  });

  describe("Rendering", () => {
    it("renders the search input", () => {
      renderAIAgentsTab();
      expect(screen.getByPlaceholderText("Search for agents")).toBeInTheDocument();
    });

    it("renders the Add Agent button", () => {
      renderAIAgentsTab();
      expect(screen.getByRole("button", { name: "Add Agent" })).toBeInTheDocument();
    });

    it("renders the AddCopilotDialog component", () => {
      renderAIAgentsTab();
      expect(screen.getByTestId("add-copilot-dialog")).toBeInTheDocument();
    });

    it("renders all agent cards as flat cards when holders exist", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      expect(screen.getAllByText("Alpha Agent").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Beta Agent")).toBeInTheDocument();
      expect(screen.getAllByText("Gamma Agent").length).toBeGreaterThanOrEqual(1);
    });

    it("displays agent name and description in agent cards", () => {
      renderAIAgentsTab();

      expect(screen.getByText("Test Agent")).toBeInTheDocument();
      expect(screen.getByText("A test agent for unit testing")).toBeInTheDocument();
    });

    it("displays avatar fallback icon when agent has no image", () => {
      setupDefaultMocks([
        makeHolder({
          copilots: [makeCopilot({ image: "" })],
        }),
      ]);
      renderAIAgentsTab();

      expect(screen.getByTestId("icon-stars-02")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows OpenBB Copilot section instead of empty state when no holders exist and flag is true", () => {
      setupEmptyMocks();
      renderAIAgentsTab();

      expect(screen.queryByText("No AI Agent added")).not.toBeInTheDocument();
      expect(screen.getAllByText("OpenBB Copilot").length).toBeGreaterThanOrEqual(1);
    });

    it("shows empty state when no holders exist and openbbCopilot flag is false", () => {
      mockRuntimeConfig.copilot.openbbCopilot = false;
      setupEmptyMocks();
      renderAIAgentsTab();

      expect(screen.getByText("No AI Agent added")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't added any AI Agent yet."),
      ).toBeInTheDocument();
      expect(screen.queryByText("OpenBB Copilot")).not.toBeInTheDocument();
    });
  });

  describe("Add Agent Button", () => {
    it("calls setShowAddAgentsDialog(true) when clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      await user.click(screen.getByRole("button", { name: "Add Agent" }));
      expect(mockSetShowAddAgentsDialog).toHaveBeenCalledWith(true);
    });
  });

  describe("Search Functionality", () => {
    it("filters agents by name", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      expect(screen.getAllByText("Alpha Agent").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Gamma Agent").length).toBeGreaterThanOrEqual(1);

      const searchInput = screen.getByPlaceholderText("Search for agents");
      await user.type(searchInput, "Alpha");

      await waitFor(() => {
        expect(screen.getAllByText("Alpha Agent").length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText("Gamma Agent")).not.toBeInTheDocument();
      });
    });

    it("filters agents by description", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      const searchInput = screen.getByPlaceholderText("Search for agents");
      await user.type(searchInput, "Third agent");

      await waitFor(() => {
        expect(screen.getAllByText("Gamma Agent").length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText("Alpha Agent")).not.toBeInTheDocument();
      });
    });

    it("filters by holder URL when no agent matches", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      const searchInput = screen.getByPlaceholderText("Search for agents");
      await user.type(searchInput, "other-agents.example");

      await waitFor(() => {
        // The holder whose URL doesn't match and has no matching agents should be gone
        expect(screen.queryByText("Alpha Agent")).not.toBeInTheDocument();
        expect(screen.queryByText("Beta Agent")).not.toBeInTheDocument();
        // The holder with matching URL survives but its copilots are filtered by name/description,
        // so individual agent cards won't show — but the holder group is still rendered
        expect(screen.queryByText("No results found")).not.toBeInTheDocument();
      });
    });

    it("shows empty state when search matches nothing", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      const searchInput = screen.getByPlaceholderText("Search for agents");
      await user.type(searchInput, "nonexistent-agent-xyz");

      await waitFor(() => {
        expect(screen.getByText("No results found")).toBeInTheDocument();
      });
    });
  });

  describe("Action Buttons", () => {
    it("renders Edit Settings tooltip button for each agent card", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      // 3 agents total (2 in holder-1, 1 in holder-2) = 3 edit buttons
      const editButtons = screen.getAllByTitle("Edit Settings");
      expect(editButtons).toHaveLength(3);
    });

    it("renders Delete tooltip button for each agent card", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      // 3 agents total = 3 delete buttons
      const deleteButtons = screen.getAllByTitle("Delete");
      expect(deleteButtons).toHaveLength(3);
    });
  });

  describe("Connection Toggle", () => {
    it("shows Disconnect for connected backends", () => {
      renderAIAgentsTab();
      expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    });

    it("shows Connect for disconnected backends", () => {
      setupDefaultMocks([
        makeHolder({
          uuid: "holder-offline",
          enabled: false,
          status: "error",
        }),
      ]);
      renderAIAgentsTab();
      expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    });

    it("persists backend disable when Disconnect is clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      await user.click(screen.getByRole("button", { name: "Disconnect" }));

      await waitFor(() => {
        expect(mockPutCustomCopilot).toHaveBeenCalledWith(
          expect.objectContaining({
            uuid: "holder-1",
            enabled: false,
          }),
        );
      });
    });

    it("refreshes backend when Connect is clicked", async () => {
      const user = userEvent.setup();
      setupDefaultMocks([
        makeHolder({
          uuid: "holder-offline",
          enabled: false,
          status: "error",
        }),
      ]);
      renderAIAgentsTab();

      await user.click(screen.getByRole("button", { name: "Connect" }));

      await waitFor(() => {
        expect(mockFetchAgentsData).toHaveBeenCalled();
      });
    });
  });

  describe("Delete Agent Group", () => {
    it("opens ConfirmDialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });
      expect(screen.getByText("Delete Agent Group")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Are you sure you want to delete this agent group? This action is irreversible.",
        ),
      ).toBeInTheDocument();
    });

    it("closes ConfirmDialog when cancel is clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
      });
    });

    it("calls removeCustomCopilot when delete is confirmed", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockRemoveCustomCopilot).toHaveBeenCalledWith("holder-1");
      });
    });

    it("shows success toast after successful deletion", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith(
          "Agent group deleted successfully",
        );
      });
    });

    it("shows error toast when deletion fails", async () => {
      mockRemoveCustomCopilot.mockRejectedValue(new Error("Network error"));
      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Network error");
      });
    });

    it("resets selected copilot to default when deleting holder that contains the selected copilot", async () => {
      const selectedCopilot = makeCopilot({ id: "agent-1", holderUuid: "holder-1" });
      setupDefaultMocks(SINGLE_HOLDER, selectedCopilot);

      const user = userEvent.setup();
      renderAIAgentsTab();

      const deleteWrapper = screen.getByTitle("Delete");
      const deleteButton = deleteWrapper.querySelector("button")!;
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Delete" }));

      await waitFor(() => {
        expect(mockSetSelectedCopilot).toHaveBeenCalledWith(
          expect.objectContaining({ id: "openbb-copilot" }),
        );
      });
    });
  });

  describe("Edit Agent Dialog", () => {
    it("opens edit dialog when Edit Settings button is clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
        expect(screen.getByText("Edit agent")).toBeInTheDocument();
      });
    });

    it("shows header key/value fields for existing headers", async () => {
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      const keyLabels = screen.getAllByText("Key");
      const valueLabels = screen.getAllByText("Value");
      expect(keyLabels.length).toBeGreaterThan(0);
      expect(valueLabels.length).toBeGreaterThan(0);
    });

    it("closes edit dialog when close button is clicked", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByTestId("base-dialog-close"));

      await waitFor(() => {
        expect(screen.queryByTestId("base-dialog")).not.toBeInTheDocument();
      });
    });

    it("adds a new header pair when 'Add Authentication' is clicked", async () => {
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      const initialKeyLabels = screen.getAllByText("Key");
      const initialCount = initialKeyLabels.length;

      const addButton = screen.getByRole("button", { name: /Add Authentication/i });
      await user.click(addButton);

      await waitFor(() => {
        const keyLabels = screen.getAllByText("Key");
        expect(keyLabels).toHaveLength(initialCount + 1);
      });
    });

    it("removes a header pair when remove button is clicked", async () => {
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      const initialKeyLabels = screen.getAllByText("Key");
      const initialCount = initialKeyLabels.length;

      const removeButtons = screen.getAllByTestId("icon-circled-cross-icon");
      await user.click(removeButtons[0].closest("button")!);

      await waitFor(() => {
        const updatedKeyLabels = screen.getAllByText("Key");
        expect(updatedKeyLabels).toHaveLength(initialCount - 1);
      });
    });

    it("shows success toast when settings are saved after test", async () => {
      mockFetchAgentsData.mockResolvedValue([makeCopilot()]);
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      // Click Test first (required before Update is enabled)
      const testButton = screen.getByRole("button", { name: "Test" });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Test successful/)).toBeInTheDocument();
      });

      const updateButton = screen.getByRole("button", { name: "Update" });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToast.success).toHaveBeenCalledWith("Agent settings updated");
      });
    });

    it("shows error toast when test fails", async () => {
      mockFetchAgentsData.mockRejectedValue(new Error("Connection refused"));
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      const testButton = screen.getByRole("button", { name: "Test" });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Error/)).toBeInTheDocument();
        expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
      });
    });

    it("shows error toast for duplicate header keys", async () => {
      mockFetchAgentsData.mockResolvedValue([makeCopilot()]);
      setupDefaultMocks([HOLDER_WITH_AUTH]);
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      // Add a duplicate key pair
      const addButton = screen.getByRole("button", { name: /Add Authentication/i });
      await user.click(addButton);

      // Type the same key as the existing one
      const keyInputs = screen.getAllByPlaceholderText("Authorization");
      await user.type(keyInputs[keyInputs.length - 1], "Authorization");

      // Test first
      const testButton = screen.getByRole("button", { name: "Test" });
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Test successful/)).toBeInTheDocument();
      });

      const updateButton = screen.getByRole("button", { name: "Update" });
      await user.click(updateButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Duplicate header keys found");
      });
    });

    it("shows endpoint URL input in dialog", async () => {
      const user = userEvent.setup();
      renderAIAgentsTab();

      const editWrapper = screen.getByTitle("Edit Settings");
      const editButton = editWrapper.querySelector("button")!;
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByTestId("base-dialog")).toBeInTheDocument();
      });

      expect(
        screen.getByPlaceholderText("https://example.com/agents.json"),
      ).toBeInTheDocument();
      expect(screen.getByText("Endpoint URL")).toBeInTheDocument();
    });
  });

  describe("Multiple Holders", () => {
    it("renders all agent cards across all holders", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      expect(screen.getByText("Alpha Agent")).toBeInTheDocument();
      expect(screen.getByText("Beta Agent")).toBeInTheDocument();
      expect(screen.getByText("Gamma Agent")).toBeInTheDocument();
    });

    it("shows holder hostname next to agent name", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      expect(screen.getAllByText("agents.example.com")).toHaveLength(2);
      expect(screen.getByText("other-agents.example.com")).toBeInTheDocument();
    });

    it("renders action buttons for each agent card", () => {
      setupDefaultMocks(TWO_HOLDERS);
      renderAIAgentsTab();

      // 3 agents total across 2 holders = 3 sets of buttons
      const deleteButtons = screen.getAllByTitle("Delete");
      expect(deleteButtons).toHaveLength(3);

      const editButtons = screen.getAllByTitle("Edit Settings");
      expect(editButtons).toHaveLength(3);
    });
  });

  describe("Refresh", () => {
    it("renders a Refresh agents button when holders exist", () => {
      renderAIAgentsTab();
      expect(screen.getByTitle("Refresh agents")).toBeInTheDocument();
    });

    it("does not render Refresh agents when there are no external holders", () => {
      setupEmptyMocks();
      renderAIAgentsTab();
      expect(screen.queryByTitle("Refresh agents")).not.toBeInTheDocument();
    });

    it("refreshes all holders with a single toast when Refresh agents is clicked", async () => {
      const user = userEvent.setup();
      mockFetchAgentsData.mockResolvedValue([makeCopilot()]);
      renderAIAgentsTab();

      const refreshAll = screen.getByTitle("Refresh agents").querySelector("button")!;
      await user.click(refreshAll);

      await waitFor(() => {
        expect(mockFetchAgentsData).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith("Agents refreshed");
      });
    });

    it("refreshes a single holder when its card refresh icon is clicked", async () => {
      const user = userEvent.setup();
      mockFetchAgentsData.mockResolvedValue([makeCopilot()]);
      renderAIAgentsTab();

      const cardRefresh = screen.getAllByTitle("Refresh")[0].querySelector("button")!;
      await user.click(cardRefresh);

      await waitFor(() => {
        expect(mockFetchAgentsData).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith(
          "Agents refreshed successfully",
          { id: "refresh-holder-1" },
        );
      });
    });
  });

  describe("Default Agent Section (OpenBB Copilot)", () => {
    it("renders the default copilot card with name and Default tag", () => {
      renderAIAgentsTab();

      expect(screen.getAllByText("OpenBB Copilot").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId("tag-grey")).toHaveTextContent("Default");
    });

    it("renders the default copilot section above external agents", () => {
      setupDefaultMocks(SINGLE_HOLDER);
      renderAIAgentsTab();

      expect(screen.getAllByText("OpenBB Copilot").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Test Agent").length).toBeGreaterThanOrEqual(1);
    });

    it("does not show edit or delete controls on the default section", () => {
      setupEmptyMocks();
      renderAIAgentsTab();

      expect(screen.queryByTitle("Edit Settings")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Delete")).not.toBeInTheDocument();
    });

    it("shows agent description in the default copilot card", () => {
      setupEmptyMocks();
      renderAIAgentsTab();

      expect(
        screen.getByText("OpenBB Copilot is the default agent for OpenBB Workspace."),
      ).toBeInTheDocument();
    });

    it("renders a horizontal divider between the header row and description", () => {
      setupEmptyMocks();
      renderAIAgentsTab();

      expect(document.querySelector("hr")).toBeInTheDocument();
    });

    it("renders Default badge inline next to the title (not far right)", () => {
      renderAIAgentsTab();

      const badge = screen.getByTestId("tag-grey");
      const title = screen.getAllByText("OpenBB Copilot")[0];
      expect(badge.parentElement).toBe(title.parentElement);
    });
  });
});
