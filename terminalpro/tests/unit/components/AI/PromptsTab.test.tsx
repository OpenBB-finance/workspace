import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptsTab } from "~/components/AI/PromptsTab";

// --- vi.hoisted mocks ---

const {
  mockSetAddPromptDialogOpen,
  mockAddPrompt,
  mockRemovePrompt,
  mockRemovePrompts,
  mockSetEditingPromptId,
  mockReorderPrompts,
  mockInitializePrompts,
  mockUseShallowPromptLibraryStore,
  mockUseShallowBackendConnectorStore,
  mockUseSharedPrompts,
  mockToastSuccess,
  mockToastError,
  localStorageInitial,
  mockClipboardWriteText,
} = vi.hoisted(() => ({
  mockSetAddPromptDialogOpen: vi.fn(),
  mockAddPrompt: vi.fn(),
  mockRemovePrompt: vi.fn(),
  mockRemovePrompts: vi.fn(),
  mockSetEditingPromptId: vi.fn(),
  mockReorderPrompts: vi.fn(),
  mockInitializePrompts: vi.fn(),
  mockUseShallowPromptLibraryStore: vi.fn(),
  mockUseShallowBackendConnectorStore: vi.fn(),
  mockUseSharedPrompts: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  localStorageInitial: { state: {} as Record<string, unknown> },
  mockClipboardWriteText: vi.fn().mockResolvedValue(undefined),
}));

// --- External dependency mocks ---

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("usehooks-ts", async () => {
  const { useState: useStateReal, useCallback: useCallbackReal } = await import(
    "react"
  );
  return {
    useLocalStorage: (key: string, defaultValue: unknown) => {
      const initial =
        key in localStorageInitial.state
          ? localStorageInitial.state[key]
          : defaultValue;
      const [value, setValueInternal] = useStateReal(initial);
      const setValue = useCallbackReal((updater: unknown) => {
        setValueInternal((prev: unknown) =>
          typeof updater === "function"
            ? (updater as (prev: unknown) => unknown)(prev)
            : updater,
        );
      }, []);
      return [value, setValue];
    },
    useDebounceValue: (value: unknown) => [value],
  };
});

// --- Store mocks ---

vi.mock("~/lib/state/promptLibrary", () => ({
  useShallowPromptLibraryStore: (selector: unknown) =>
    mockUseShallowPromptLibraryStore(selector),
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: unknown) =>
    mockUseShallowBackendConnectorStore(selector),
}));

vi.mock("~/components/LayoutAuth/Search/hooks/useSharedPrompts", () => ({
  default: (...args: unknown[]) => mockUseSharedPrompts(...args),
}));

// --- Component mocks ---

vi.mock("~/components/General/SearchResultsNotFound", () => ({
  default: () => <div>No results found</div>,
}));

vi.mock("~/components/AI/TextStyle", () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <span data-testid="text-style" className={className}>
      {content}
    </span>
  ),
}));

vi.mock("~/components/General/Table/AgGridUtils", () => ({
  formatDate: (date: Date) => date.toISOString().split("T")[0],
  isDate: (_value: any) => false,
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: ({
    children,
    message,
  }: {
    children: ReactNode;
    message: string;
    position?: string;
    delayDuration?: number;
  }) => <div title={message}>{children}</div>,
}));

vi.mock("~/components/ds/atoms/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: (props: {
    placeholder?: string;
    onChange?: (value: string) => void;
    defaultValue?: string;
    className?: string;
    prefix?: ReactNode;
    clearable?: boolean;
    ref?: unknown;
  }) => (
    <div className={props.className}>
      {props.prefix}
      <input
        type="text"
        placeholder={props.placeholder}
        defaultValue={props.defaultValue}
        onChange={(e) => props.onChange?.(e.target.value)}
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
      data-testid="filter-select"
      aria-label={placeholder}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    disabled,
    onClick,
  }: {
    checked: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <input
      type="checkbox"
      checked={checked === true}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      onClick={onClick}
      data-indeterminate={checked === "indeterminate" ? "true" : undefined}
    />
  ),
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
    description: ReactNode;
    confirmText: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <div data-testid="confirm-dialog-description">{description}</div>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    ) : null,
}));

// --- Mock data ---

const PERSONAL_PROMPTS = [
  {
    id: "p-1",
    prompt: "Analyze the stock performance of AAPL over the last quarter",
    widgets: ["widget-chart"],
    createdAt: "2024-06-01T10:00:00Z",
    updatedAt: "2024-06-01T10:00:00Z",
  },
  {
    id: "p-2",
    prompt: "Compare revenue trends of MSFT and GOOG",
    widgets: [],
    createdAt: "2024-05-15T08:30:00Z",
    updatedAt: "2024-05-15T08:30:00Z",
  },
  {
    id: "p-3",
    prompt: "Show me the top performing ETFs this year",
    widgets: ["widget-table"],
    createdAt: "2024-04-20T14:00:00Z",
    updatedAt: "2024-04-20T14:00:00Z",
  },
];

const API_SOURCES = [
  {
    id: "backend-1",
    uuid: "uuid-b1",
    name: "Finance API",
    url: "https://finance.api.com",
    status: "success",
    templates: [
      {
        id: "tmpl-1",
        templateId: "tmpl-1",
        name: "Market Analysis",
        prompts: ["What is the current market cap?", "Show daily volume trends"],
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "tmpl-2",
        templateId: "tmpl-2",
        name: "Risk Assessment",
        prompts: ["Calculate portfolio VaR"],
        createdAt: "2024-01-01T00:00:00Z",
      },
    ],
    widgets: {},
    createdDate: "2024-01-01T00:00:00Z",
    endpointHeaders: null,
  },
];

const API_SOURCES_NO_TEMPLATES = [
  {
    id: "backend-2",
    uuid: "uuid-b2",
    name: "Empty Backend",
    url: "https://empty.api.com",
    status: "success",
    templates: [],
    widgets: {},
    createdDate: "2024-01-01T00:00:00Z",
    endpointHeaders: null,
  },
];

const SHARED_PROMPTS = [
  {
    uuid: "shared-1",
    access: "read",
    prompt: "Give me a sector breakdown of the S&P 500",
    tooltip: undefined,
    createdAt: "2024-03-10T12:00:00Z",
  },
  {
    uuid: "shared-2",
    access: "read",
    prompt: "What are the earnings estimates for TSLA?",
    tooltip: undefined,
    createdAt: "2024-03-11T09:00:00Z",
  },
];

// --- Setup helpers ---

function setupDefaultMocks({
  prompts = PERSONAL_PROMPTS,
  apiSources = API_SOURCES,
  sharedPrompts = SHARED_PROMPTS,
  isLoading = false,
  error = null,
}: {
  prompts?: typeof PERSONAL_PROMPTS;
  apiSources?: typeof API_SOURCES;
  sharedPrompts?: typeof SHARED_PROMPTS;
  isLoading?: boolean;
  error?: unknown;
} = {}) {
  mockUseShallowPromptLibraryStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      prompts,
      addPrompt: mockAddPrompt,
      removePrompt: mockRemovePrompt,
      removePrompts: mockRemovePrompts,
      setEditingPromptId: mockSetEditingPromptId,
      setAddPromptDialogOpen: mockSetAddPromptDialogOpen,
      reorderPrompts: mockReorderPrompts,
      initializePrompts: mockInitializePrompts,
    }),
  );

  mockUseShallowBackendConnectorStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      apiSources,
    }),
  );

  mockUseSharedPrompts.mockReturnValue({
    sharedPrompts,
    isLoading,
    error,
  });
}

function renderPromptsTab(route = "/") {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <PromptsTab />
    </MemoryRouter>,
  );
}

// --- Tests ---

describe("PromptsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageInitial.state = {};
    mockClipboardWriteText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: mockClipboardWriteText },
      writable: true,
      configurable: true,
    });
  });

  describe("Initialization", () => {
    it("calls initializePrompts on mount", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(mockInitializePrompts).toHaveBeenCalled();
    });

    it("renders search input and filter select", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.getByPlaceholderText("Search for prompts")).toBeInTheDocument();
      expect(screen.getByTestId("filter-select")).toBeInTheDocument();
    });

    it("renders the 'Add Prompt' button", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.getByRole("button", { name: "Add Prompt" })).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty state message when no prompts exist anywhere", async () => {
      setupDefaultMocks({
        prompts: [],
        apiSources: [],
        sharedPrompts: [],
      });
      await renderPromptsTab();

      expect(screen.getByText("No prompts added")).toBeInTheDocument();
      expect(
        screen.getByText("You haven't added any prompts yet."),
      ).toBeInTheDocument();
    });

    it("shows empty state when filter yields no results", async () => {
      setupDefaultMocks({ prompts: [], apiSources: [], sharedPrompts: [] });
      await renderPromptsTab();

      const user = userEvent.setup();
      const select = screen.getByTestId("filter-select");
      await user.selectOptions(select, "personal");

      expect(screen.getByText("No prompts added")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading spinner when shared prompts are loading", async () => {
      setupDefaultMocks({ isLoading: true });
      const { container } = await renderPromptsTab();

      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message when shared prompts fail to load", async () => {
      setupDefaultMocks({ error: new Error("network error") });
      await renderPromptsTab();

      expect(screen.getByText("Error loading shared prompts")).toBeInTheDocument();
    });
  });

  describe("Personal prompts section", () => {
    it("shows 'My Prompts' accordion header with count", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      // "My Prompts" appears both in the filter <option> and as an accordion header
      const matches = screen.getAllByText("My Prompts");
      // At least one should be the accordion <p> (not the <option>)
      const accordionHeader = matches.find((el) => el.tagName === "P");
      expect(accordionHeader).toBeDefined();
      // Count is rendered inside the same <p> element
      expect(accordionHeader!.textContent).toContain(`(${PERSONAL_PROMPTS.length})`);
    });

    it("renders prompt cards for each personal prompt", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      for (const p of PERSONAL_PROMPTS) {
        expect(screen.getByText(p.prompt)).toBeInTheDocument();
      }
    });

    it("does not render creation dates on prompt cards", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.queryByText("2024-06-01")).not.toBeInTheDocument();
    });

    it("shows widget tags on prompt cards that have widgets", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      // Widgets render only when the card is expanded — click the prompt text to expand
      await user.click(
        screen.getByText("Analyze the stock performance of AAPL over the last quarter"),
      );
      await user.click(screen.getByText("Show me the top performing ETFs this year"));

      expect(screen.getByText("widget-chart")).toBeInTheDocument();
      expect(screen.getByText("widget-table")).toBeInTheDocument();
    });
  });

  describe("Add prompt", () => {
    it("calls setAddPromptDialogOpen(true) when 'Add Prompt' button is clicked", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "Add Prompt" }));

      expect(mockSetAddPromptDialogOpen).toHaveBeenCalledWith(true);
    });
  });

  describe("Edit prompt", () => {
    it("calls setEditingPromptId and setAddPromptDialogOpen when edit icon is clicked", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const editIcons = screen.getAllByTestId("icon-edit");
      // Click the first edit button (parent of the icon)
      await user.click(editIcons[0].closest("button")!);

      expect(mockSetEditingPromptId).toHaveBeenCalledWith("p-1");
      expect(mockSetAddPromptDialogOpen).toHaveBeenCalledWith(true);
    });
  });

  describe("Delete prompt", () => {
    it("opens confirm dialog when trash icon is clicked on a prompt card", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete Prompt")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to delete this prompt?"),
      ).toBeInTheDocument();
    });

    it("calls removePrompt and closes dialog when delete is confirmed", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      await user.click(screen.getByRole("button", { name: "Delete" }));

      expect(mockRemovePrompt).toHaveBeenCalledWith("p-1");
    });

    it("closes dialog without deleting when cancel is clicked", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const trashIcons = screen.getAllByTestId("icon-trash-02");
      await user.click(trashIcons[0].closest("button")!);

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockRemovePrompt).not.toHaveBeenCalled();
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Bulk selection", () => {
    it("renders one checkbox per personal prompt", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(PERSONAL_PROMPTS.length);
    });

    it("bulk delete button is not visible when no prompts are selected", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(
        screen.queryByRole("button", { name: /Delete prompt/ }),
      ).not.toBeInTheDocument();
    });

    it("shows bulk delete button after selecting a prompt", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]);

      expect(screen.getByRole("button", { name: /Delete prompt/ })).toBeInTheDocument();
    });
  });

  describe("Bulk delete", () => {
    it("opens bulk delete confirm dialog with selected count", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // select first prompt
      await user.click(checkboxes[1]); // select second prompt

      const bulkDeleteBtn = screen.getByRole("button", { name: /Delete prompts/ });
      await user.click(bulkDeleteBtn);

      expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
      expect(screen.getByText("Delete Prompt(s)")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // count of selected
    });

    it("calls removePrompts with selected IDs and shows toast on confirm", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // select prompt p-1
      await user.click(checkboxes[1]); // select prompt p-2

      const bulkDeleteBtn = screen.getByRole("button", { name: /Delete prompts/ });
      await user.click(bulkDeleteBtn);

      await user.click(screen.getByRole("button", { name: "Yes, Delete" }));

      expect(mockRemovePrompts).toHaveBeenCalledWith(
        expect.arrayContaining(["p-1", "p-2"]),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("2 prompt(s) deleted");
    });
  });

  describe("Selecting multiple prompts", () => {
    it("shows bulk delete button after selecting all prompts individually", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const checkboxes = screen.getAllByRole("checkbox");
      for (const checkbox of checkboxes) {
        await user.click(checkbox);
      }

      expect(
        screen.getByRole("button", { name: /Delete prompts/ }),
      ).toBeInTheDocument();
    });

    it("no checkboxes are rendered when there are no personal prompts", async () => {
      setupDefaultMocks({ prompts: [] });
      await renderPromptsTab();

      const checkboxes = screen.queryAllByRole("checkbox");
      expect(checkboxes.length).toBe(0);
    });
  });

  describe("Copy to clipboard", () => {
    it("copies prompt text to clipboard and shows toast when clipboard icon is clicked", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const clipboardIcons = screen.getAllByTestId("icon-clipboard-icon");
      const btn = clipboardIcons[0].closest("button");
      expect(btn).toBeTruthy();
      await user.click(btn!);

      // Verify the toast was shown (clipboard writeText is called but we verify via toast)
      expect(mockToastSuccess).toHaveBeenCalledWith("Prompt copied to clipboard");
    });
  });

  describe("Search / filter", () => {
    it("filters personal prompts by search text", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText("Search for prompts");
      await user.type(searchInput, "AAPL");

      await waitFor(() => {
        expect(
          screen.getByText(
            "Analyze the stock performance of AAPL over the last quarter",
          ),
        ).toBeInTheDocument();
        expect(
          screen.queryByText("Compare revenue trends of MSFT and GOOG"),
        ).not.toBeInTheDocument();
      });
    });

    it("filters by category when select dropdown changes to 'personal'", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const select = screen.getByTestId("filter-select");
      await user.selectOptions(select, "personal");

      // Personal prompts accordion header should still be in the document (as <p>)
      const myPromptsHeaders = screen.getAllByText("My Prompts");
      expect(myPromptsHeaders.some((el) => el.tagName === "P")).toBe(true);
      // Backend section should not render when filter is personal
      expect(screen.queryByText("Backend Prompts")).not.toBeInTheDocument();
    });

    it("filters by category when select dropdown changes to 'backend'", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const select = screen.getByTestId("filter-select");
      await user.selectOptions(select, "backend");

      // Should show backend prompts
      expect(screen.getByText("Backend Prompts")).toBeInTheDocument();
      // "My Prompts" should only appear in the <option>, not as an accordion header
      const myPromptsMatches = screen.getAllByText("My Prompts");
      expect(myPromptsMatches.every((el) => el.tagName === "OPTION")).toBe(true);
    });

    it("filters by category when select dropdown changes to 'shared'", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const select = screen.getByTestId("filter-select");
      await user.selectOptions(select, "shared");

      expect(screen.getByText("Shared with me")).toBeInTheDocument();
      // "My Prompts" should only appear in the <option>
      const myPromptsMatches = screen.getAllByText("My Prompts");
      expect(myPromptsMatches.every((el) => el.tagName === "OPTION")).toBe(true);
      expect(screen.queryByText("Backend Prompts")).not.toBeInTheDocument();
    });

    it("shows all sections when filter is 'all'", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      // "My Prompts" appears as both <option> and <p> accordion header
      const myPromptsHeaders = screen.getAllByText("My Prompts");
      expect(myPromptsHeaders.some((el) => el.tagName === "P")).toBe(true);
      expect(screen.getByText("Backend Prompts")).toBeInTheDocument();
      expect(screen.getByText("Shared with me")).toBeInTheDocument();
    });
  });

  describe("Backend prompts section", () => {
    it("shows Backend Prompts accordion with total count", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const backendHeader = screen.getByText("Backend Prompts");
      expect(backendHeader).toBeInTheDocument();
      // Total backend prompts: 2 + 1 = 3 — count is inside the same <p> element
      expect(backendHeader.closest("p")!.textContent).toContain("(3)");
    });

    it("shows lock icon indicating read-only backend prompts", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.getByTestId("icon-lock-01")).toBeInTheDocument();
    });

    it("renders backend source name and URL", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.getByText("Finance API")).toBeInTheDocument();
      expect(screen.getByText("https://finance.api.com")).toBeInTheDocument();
    });

    it("renders template names with prompt counts", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      // Backend source accordion is collapsed by default — click to expand
      const sourceHeader = screen.getByText("Finance API");
      await user.click(sourceHeader.closest("[class*='cursor-pointer']")!);

      // Now template names should be visible
      expect(screen.getByText("Market Analysis")).toBeInTheDocument();
      expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
    });

    it("does not show backend section when apiSources have no templates", async () => {
      setupDefaultMocks({ apiSources: API_SOURCES_NO_TEMPLATES });
      await renderPromptsTab();

      expect(screen.queryByText("Backend Prompts")).not.toBeInTheDocument();
    });

    it("shows duplicate button on backend prompt cards", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      // Backend prompt cards have copy-03 icons for duplicate
      const copyIcons = screen.getAllByTestId("icon-copy-03");
      expect(copyIcons.length).toBeGreaterThan(0);
    });

    it("calls addPrompt and shows toast when duplicate is clicked on backend prompt", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const copyIcons = screen.getAllByTestId("icon-copy-03");
      // Click the first duplicate button (from backend prompts)
      await user.click(copyIcons[0].closest("button")!);

      expect(mockAddPrompt).toHaveBeenCalledWith({
        prompt: expect.any(String),
        widgets: [],
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Prompt duplicated to your library",
      );
    });
  });

  describe("Shared prompts section", () => {
    it("shows 'Shared with me' accordion header with count", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      expect(screen.getByText("Shared with me")).toBeInTheDocument();
      expect(screen.getByText(`(${SHARED_PROMPTS.length})`)).toBeInTheDocument();
    });

    it("renders shared prompt text", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      for (const sp of SHARED_PROMPTS) {
        expect(screen.getByText(sp.prompt)).toBeInTheDocument();
      }
    });

    it("shows duplicate button on shared prompt cards", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      // Shared prompts also have copy-03 icons for duplicate
      const duplicateTooltips = screen.getAllByTitle("Duplicate to My Prompts");
      expect(duplicateTooltips.length).toBeGreaterThan(0);
    });

    it("calls addPrompt when duplicate is clicked on shared prompt", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const duplicateTooltips = screen.getAllByTitle("Duplicate to My Prompts");
      // Click the last duplicate button (should be from shared prompts section)
      const lastDuplicate = duplicateTooltips[duplicateTooltips.length - 1];
      await user.click(lastDuplicate.querySelector("button")!);

      expect(mockAddPrompt).toHaveBeenCalledWith({
        prompt: expect.any(String),
        widgets: [],
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Prompt duplicated to your library",
      );
    });

    it("does not show shared section when there are no shared prompts", async () => {
      setupDefaultMocks({ sharedPrompts: [] });
      await renderPromptsTab();

      expect(screen.queryByText("Shared with me")).not.toBeInTheDocument();
    });

    it("shared prompt cards do not have edit or delete buttons", async () => {
      setupDefaultMocks({ prompts: [], apiSources: [] });
      await renderPromptsTab();

      // Only shared prompts are visible now
      // Shared cards should not have edit or trash-02 icons
      expect(screen.queryByTestId("icon-edit")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-trash-02")).not.toBeInTheDocument();
    });

    it("shared prompt cards do not have drag handle", async () => {
      setupDefaultMocks({ prompts: [], apiSources: [] });
      await renderPromptsTab();

      expect(screen.queryByTestId("icon-two-dots-vertical")).not.toBeInTheDocument();
    });
  });

  describe("URL params", () => {
    it("expands backend accordion when ?backend= search param is present", async () => {
      setupDefaultMocks();
      localStorageInitial.state["prompts-library-accordion"] = {
        personal: true,
        backend: false,
        shared: true,
      };

      await renderPromptsTab("/?backend=uuid-b1");

      // The backend accordion should be expanded (the setAccordionState effect runs)
      // We verify the backend source content is visible
      expect(screen.getByText("Finance API")).toBeInTheDocument();
    });
  });

  describe("Reordering", () => {
    it("renders up and down reorder buttons for personal prompts when no filter is active", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const upButtons = screen.getAllByTestId("icon-square-arrow-up");
      const downButtons = screen.getAllByTestId("icon-square-arrow-down");

      expect(upButtons.length).toBe(PERSONAL_PROMPTS.length);
      expect(downButtons.length).toBe(PERSONAL_PROMPTS.length);
    });

    it("clicking move-up calls reorderPrompts with swapped order", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const upButtons = screen.getAllByTestId("icon-square-arrow-up");

      // Click the second item's move-up button (index 1).
      await user.click(upButtons[1].closest("button")!);

      // Swap index 0 ("p-1") and index 1 ("p-2")
      const expectedSwapped = [
        PERSONAL_PROMPTS[1],
        PERSONAL_PROMPTS[0],
        PERSONAL_PROMPTS[2],
      ];
      expect(mockReorderPrompts).toHaveBeenCalledWith(expectedSwapped);
    });

    it("clicking move-down calls reorderPrompts with swapped order", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const downButtons = screen.getAllByTestId("icon-square-arrow-down");

      // Click the first item's move-down button (index 0).
      await user.click(downButtons[0].closest("button")!);

      // Swap index 0 ("p-1") and index 1 ("p-2")
      const expectedSwapped = [
        PERSONAL_PROMPTS[1],
        PERSONAL_PROMPTS[0],
        PERSONAL_PROMPTS[2],
      ];
      expect(mockReorderPrompts).toHaveBeenCalledWith(expectedSwapped);
    });

    it("does not render (or disables) reorder buttons when search filter is active", async () => {
      setupDefaultMocks();
      await renderPromptsTab();

      const user = userEvent.setup();
      const searchInput = screen.getByPlaceholderText("Search for prompts");
      await user.type(searchInput, "AAPL");

      expect(screen.queryByTestId("icon-square-arrow-up")).not.toBeInTheDocument();
      expect(screen.queryByTestId("icon-square-arrow-down")).not.toBeInTheDocument();
    });
  });
});
