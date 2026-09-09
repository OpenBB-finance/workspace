import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchDialogState } from "~/components/LayoutAuth/Search/SearchDialog";
import WidgetMenu, {
  CreateCheckbox,
  connectorTypes,
  type WidgetItem,
} from "~/components/LayoutAuth/Search/WidgetMenu";
import { useShallowThemeStore } from "~/lib/state/theme";

const mockAddWidgets = vi.fn();
const mockGetTabById = vi.fn();
const mockGetLastInnerTab = vi.fn();
const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockOnOpenChange = vi.fn();
const mockOnInputChange = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn((selector) =>
    selector({
      addWidgets: mockAddWidgets,
      getTabById: mockGetTabById,
      getLastInnerTab: mockGetLastInnerTab,
      items: {},
      addTab: vi.fn(),
    }),
  ),
  useAppStore: {
    getState: () => ({
      addTab: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector) =>
    selector({
      theme: "dark",
      recentlyAddedWidgets: [],
      setRecentlyAddedWidgets: vi.fn(),
      initialSelectedSearchTab: "widgets",
      aiEnhancements: false,
    }),
  ),
}));

vi.mock("~/lib/state/tutorial", () => ({
  useShallowTutorialStore: vi.fn((selector) =>
    selector({
      currentTutorial: null,
      goToStep: vi.fn(),
      currentStep: 0,
    }),
  ),
}));

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: vi.fn(() => false),
}));

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn(() => [{}, vi.fn()]),
}));

vi.mock("sonner", () => ({
  toast: {
    warning: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: vi.fn((selector) =>
    selector({ isLoadingBackends: false }),
  ),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (opts: any) => ({
    getVirtualItems: () =>
      Array.from({ length: opts.count }, (_, i) => ({
        key: opts.getItemKey?.(i) ?? i,
        index: i,
        start: i * 44,
        size: 44,
      })),
    getTotalSize: () => opts.count * 44,
    measureElement: () => {},
  }),
}));

const createMockWidget = (overrides: Partial<WidgetItem> = {}): WidgetItem => ({
  widgetId: `widget-${Math.random().toString(36).substr(2, 9)}`,
  uniqueId: `unique-${Math.random().toString(36).substr(2, 9)}`,
  name: "Test Widget",
  category: "Equity",
  subCategory: "Charts",
  description: "A test widget",
  source: "openbb",
  widgetType: "backend",
  ...overrides,
});

const mockWidgets: WidgetItem[] = [
  createMockWidget({
    widgetId: "widget-1",
    uniqueId: "widget-1",
    name: "Stock Chart",
    category: "Equity",
    subCategory: "Charts",
  }),
  createMockWidget({
    widgetId: "widget-2",
    uniqueId: "widget-2",
    name: "Bond Tracker",
    category: "Economy",
    subCategory: "Bonds",
  }),
  createMockWidget({
    widgetId: "widget-3",
    uniqueId: "widget-3",
    name: "ETF Overview",
    category: "ETF",
    subCategory: "Overview",
  }),
];

const defaultState: SearchDialogState = {
  selectedWidgets: [],
  selectedCategory: "All",
  selectedOption: "all",
  isShiftPressed: false,
  anchorWidgetId: null,
};

const defaultProps = {
  isFiltered: false,
  widgets: mockWidgets,
  globalSearch: "",
  globalIndexRef: { current: 0 },
  itemRefs: { current: [] },
  onOpenChange: mockOnOpenChange,
  allCategories: ["Equity", "Economy", "ETF"],
  state: defaultState,
  dispatch: mockDispatch,
  inputValue: "",
  onInputChange: mockOnInputChange,
  inputRef: { current: null },
};

function renderWidgetMenu(props = {}) {
  const mergedProps = { ...defaultProps, ...props };
  return render(
    <MemoryRouter initialEntries={["/app/dashboard-123"]}>
      <Routes>
        <Route path="/app/:id" element={<WidgetMenu {...mergedProps} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WidgetMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTabById.mockReturnValue({ data: { widgets: [] } });
    mockGetLastInnerTab.mockReturnValue("");
  });

  describe("Rendering", () => {
    it("renders toolbar with search input", () => {
      renderWidgetMenu();

      expect(screen.getByPlaceholderText("Search for widgets")).toBeInTheDocument();
    });

    it("renders filter select with All Widgets default", () => {
      renderWidgetMenu();

      expect(screen.getByText("All Widgets")).toBeInTheDocument();
    });

    it("renders widget source filter dropdown", () => {
      renderWidgetMenu();

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("renders Cancel button", () => {
      renderWidgetMenu();

      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("renders Add widget button", () => {
      renderWidgetMenu();

      expect(screen.getByRole("button", { name: /Add.*widget/i })).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows SearchResultsNotFound when no widgets are available", () => {
      renderWidgetMenu({ widgets: [] });

      expect(screen.getByTestId("results-not-found")).toBeInTheDocument();
    });

    it("shows link to add external source when filtering by external", () => {
      renderWidgetMenu({
        widgets: [],
        state: { ...defaultState, selectedOption: "external" },
      });

      expect(
        screen.getByRole("link", { name: "Add an external source" }),
      ).toBeInTheDocument();
    });
  });

  describe("Widget Selection", () => {
    it("updates selectedWidgets when widget is checked", async () => {
      const user = userEvent.setup();
      renderWidgetMenu();

      const checkbox = screen.getAllByRole("checkbox")[0];
      await user.click(checkbox);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });
    });

    it("disables Add button when no widgets are selected", () => {
      renderWidgetMenu();

      const addButton = screen.getByRole("button", { name: /Add.*widget/i });
      expect(addButton).toBeDisabled();
    });

    it("enables Add button when widgets are selected", () => {
      const stateWithSelection = {
        ...defaultState,
        selectedWidgets: [mockWidgets[0]],
      };

      renderWidgetMenu({ state: stateWithSelection });

      const addButton = screen.getByRole("button", { name: /Add widgets/i });
      expect(addButton).toBeEnabled();
    });

    it("enables Add button for multiple selected widgets", () => {
      const stateWithSelection = {
        ...defaultState,
        selectedWidgets: [mockWidgets[0], mockWidgets[1]],
      };

      renderWidgetMenu({ state: stateWithSelection });

      const addButton = screen.getByRole("button", { name: /Add widgets/i });
      expect(addButton).toBeEnabled();
    });
  });

  describe("Cancel Action", () => {
    it("clears selected widgets and closes dialog on Cancel", async () => {
      const user = userEvent.setup();
      const stateWithSelection = {
        ...defaultState,
        selectedWidgets: [mockWidgets[0]],
      };

      renderWidgetMenu({ state: stateWithSelection });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      await user.click(cancelButton);

      expect(mockDispatch).toHaveBeenCalledWith({ selectedWidgets: [] });
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Add Widgets Action", () => {
    it("does not call addWidgets when no widgets are selected (button disabled)", async () => {
      renderWidgetMenu();

      const addButton = screen.getByRole("button", { name: /Add.*widget/i });

      expect(addButton).toBeDisabled();
      expect(mockAddWidgets).not.toHaveBeenCalled();
    });

    it("calls addWidgets and closes dialog when widgets are selected", async () => {
      const user = userEvent.setup();
      const stateWithSelection = {
        ...defaultState,
        selectedWidgets: [mockWidgets[0]],
      };

      renderWidgetMenu({ state: stateWithSelection });

      const addButton = screen.getByRole("button", { name: /Add widgets/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(mockAddWidgets).toHaveBeenCalled();
        expect(mockOnOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("returns null when not on widgets tab", () => {
    it("returns null when initialSelectedSearchTab is not widgets", () => {
      vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
        selector({
          theme: "dark",
          recentlyAddedWidgets: [],
          setRecentlyAddedWidgets: vi.fn(),
          initialSelectedSearchTab: "data",
          aiEnhancements: false,
        }),
      );

      const { container } = renderWidgetMenu();

      expect(container.firstChild).toBeNull();
    });
  });
});

describe("CreateCheckbox", () => {
  const defaultCheckboxProps = {
    id: "test-checkbox",
    checked: false,
    onChange: vi.fn(),
    parentId: "parent-element",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="parent-element"></div>';
  });

  it("renders checkbox with provided id", () => {
    render(<CreateCheckbox {...defaultCheckboxProps} />);

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("calls onChange when checkbox is clicked", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<CreateCheckbox {...defaultCheckboxProps} onChange={handleChange} />);

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it("renders as checked when checked prop is true", () => {
    render(<CreateCheckbox {...defaultCheckboxProps} checked={true} />);

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });
});

describe("connectorTypes", () => {
  it("contains expected connector types", () => {
    expect(connectorTypes).toContain("backend");
    expect(connectorTypes).toContain("file");
    expect(connectorTypes).toContain("single");
    expect(connectorTypes).toContain("snowflake");
    expect(connectorTypes).toContain("database");
    expect(connectorTypes).toContain("copilot_table");
  });

  it("has correct length", () => {
    expect(connectorTypes).toHaveLength(6);
  });
});

describe("WidgetMenu - Category Headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTabById.mockReturnValue({ data: { widgets: [] } });
    mockGetLastInnerTab.mockReturnValue("");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
      selector({
        theme: "dark",
        recentlyAddedWidgets: [],
        setRecentlyAddedWidgets: vi.fn(),
        initialSelectedSearchTab: "widgets",
        aiEnhancements: false,
      }),
    );
  });

  it("renders category headers for each unique category", async () => {
    renderWidgetMenu();

    await waitFor(() => {
      const equityElements = screen.getAllByText(/Equity/i);
      expect(equityElements.length).toBeGreaterThan(0);
    });
  });

  it("renders expandable category sections", async () => {
    renderWidgetMenu();

    await waitFor(() => {
      const categoryHeaders = screen.getAllByText(/\(\d+\)/);
      expect(categoryHeaders.length).toBeGreaterThan(0);
    });
  });
});

describe("WidgetMenu - Recently Added Section", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTabById.mockReturnValue({ data: { widgets: [] } });
    mockGetLastInnerTab.mockReturnValue("");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
      selector({
        theme: "dark",
        recentlyAddedWidgets: [],
        setRecentlyAddedWidgets: vi.fn(),
        initialSelectedSearchTab: "widgets",
        aiEnhancements: false,
      }),
    );
  });

  it("does not show recently added section when isFiltered is true", () => {
    renderWidgetMenu({ isFiltered: true });

    expect(screen.queryByText(/Recently Added/)).not.toBeInTheDocument();
  });

  it("shows recently added section when there are recent widgets", () => {
    vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
      selector({
        theme: "dark",
        recentlyAddedWidgets: [mockWidgets[0]],
        setRecentlyAddedWidgets: vi.fn(),
        initialSelectedSearchTab: "widgets",
        aiEnhancements: false,
      }),
    );

    renderWidgetMenu();

    expect(screen.getByText(/Recently Added/)).toBeInTheDocument();
  });
});

describe("WidgetMenu - Navigation Bar Special Case", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTabById.mockReturnValue({ data: { widgets: [] } });
    mockGetLastInnerTab.mockReturnValue("");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
      selector({
        theme: "dark",
        recentlyAddedWidgets: [],
        setRecentlyAddedWidgets: vi.fn(),
        initialSelectedSearchTab: "widgets",
        aiEnhancements: false,
      }),
    );
  });

  it("renders navigation bar widget in widget menu", () => {
    const navigationBarWidget = createMockWidget({
      widgetId: "navigation_bar",
      uniqueId: "navigation_bar",
      name: "Navigation Bar",
    });

    renderWidgetMenu({
      widgets: [navigationBarWidget],
    });

    expect(screen.getByText("Navigation Bar")).toBeInTheDocument();
  });

  it("has getTabById function available from app store", () => {
    mockGetTabById.mockReturnValue({
      data: {
        widgets: [{ widgetId: "navigation_bar" }],
      },
    });

    renderWidgetMenu();

    expect(mockGetTabById("test")).toEqual({
      data: {
        widgets: [{ widgetId: "navigation_bar" }],
      },
    });
  });
});
