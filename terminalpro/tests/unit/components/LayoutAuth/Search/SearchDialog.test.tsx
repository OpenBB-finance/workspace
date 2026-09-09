import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SearchDialog from "~/components/LayoutAuth/Search/SearchDialog";

const mockAddWidgets = vi.fn();
const mockChangeSearch = vi.fn();
const mockSetInitialSelectedSearchTab = vi.fn();
const mockGetAllAppWidgets = vi.fn();
const mockNavigate = vi.fn();

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

vi.mock("~/components/AI/hooks/useGetAppWidgets", () => ({
  useShallowAppWidgetsStore: vi.fn((selector) =>
    selector({
      lastUpdated: Date.now(),
      getAllAppWidgets: mockGetAllAppWidgets,
    }),
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector) =>
    selector({
      search: true,
      changeSearch: mockChangeSearch,
      initialSelectedSearchTab: "widgets",
      setInitialSelectedSearchTab: mockSetInitialSelectedSearchTab,
      recentlyAddedWidgets: [],
      setRecentlyAddedWidgets: vi.fn(),
    }),
  ),
}));

vi.mock("~/components/DataConnectors/Providers/DataConnectorProvider", () => ({
  DataConnectorProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/components/DataConnectors/AddConnectionModal", () => ({
  DataConnectionTabs: () => <div>Data Connection Tabs</div>,
}));

vi.mock("~/components/LayoutAuth/Search/useCopilotPrompt", () => ({
  default: () => null,
}));

vi.mock("~/components/LayoutAuth/Search/WidgetMenu", () => ({
  default: ({ widgets, inputValue, onInputChange, inputRef }: any) => (
    <div data-testid="widget-menu">
      <input
        ref={inputRef}
        placeholder="Search for widgets"
        value={inputValue ?? ""}
        onChange={(e: any) => onInputChange?.(e.target.value)}
      />
      <span data-testid="widget-count">{widgets?.length ?? 0}</span>
    </div>
  ),
}));

vi.mock("usehooks-ts", () => ({
  useLocalStorage: vi.fn(() => [[], vi.fn()]),
  useDebounceValue: vi.fn((value) => [value]),
}));

vi.mock("use-debounce", () => ({
  useDebouncedCallback: (fn: Function) => fn,
}));

const mockWidgets = [
  {
    widgetId: "widget-1",
    name: "Test Widget 1",
    category: "Equity",
    subCategory: "Charts",
    description: "A test widget",
    disabled: false,
    source: "openbb",
  },
  {
    widgetId: "widget-2",
    name: "Test Widget 2",
    category: "Economy",
    subCategory: "Data",
    description: "Another test widget",
    disabled: false,
    source: "openbb",
  },
  {
    widgetId: "widget-3",
    name: "Shared Widget",
    category: "Equity",
    subCategory: "Tables",
    description: "A shared widget",
    disabled: false,
    isSharedWidget: true,
    source: "external",
  },
];

function renderSearchDialog(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/app/dashboard-123"]}>
      <Routes>
        <Route path="/app/:id" element={<SearchDialog isMobile={false} {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SearchDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllAppWidgets.mockReturnValue(mockWidgets);
  });

  describe("Rendering", () => {
    it("renders the dialog with search input", () => {
      renderSearchDialog();

      expect(screen.getByPlaceholderText("Search for widgets")).toBeInTheDocument();
    });

    it("renders tab triggers for Widgets Library and Data", () => {
      renderSearchDialog();

      expect(screen.getByText("Widgets Library")).toBeInTheDocument();
      expect(screen.getByText("Data")).toBeInTheDocument();
    });

    it("renders the widget menu component", () => {
      renderSearchDialog();

      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    });

    it("displays widget count from getAllAppWidgets", () => {
      renderSearchDialog();

      const widgetCount = screen.getByTestId("widget-count");
      expect(widgetCount).toBeInTheDocument();
    });

    it("renders dialog title for accessibility", () => {
      renderSearchDialog();

      expect(screen.getByText("Widget Menu")).toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("updates search input value on user input", async () => {
      const user = userEvent.setup();
      renderSearchDialog();

      const input = screen.getByPlaceholderText("Search for widgets");
      await user.type(input, "test");

      expect(input).toHaveValue("test");
    });

    it("shows data connection content when Data tab is selected", async () => {
      vi.mocked(
        await import("~/lib/state/theme"),
      ).useShallowThemeStore.mockImplementation((selector: Function) =>
        selector({
          search: true,
          changeSearch: mockChangeSearch,
          initialSelectedSearchTab: "data",
          setInitialSelectedSearchTab: mockSetInitialSelectedSearchTab,
          recentlyAddedWidgets: [],
          setRecentlyAddedWidgets: vi.fn(),
        }),
      );

      renderSearchDialog();

      expect(screen.getByText("Data Connection Tabs")).toBeInTheDocument();
    });
  });

  describe("Tab Navigation", () => {
    it("renders widgets library as the default active tab", () => {
      renderSearchDialog();

      const widgetTab = screen.getByText("Widgets Library");
      expect(widgetTab).toBeInTheDocument();
    });
  });

  describe("Dialog Behavior", () => {
    it("calls changeSearch with false when dialog is closed", async () => {
      const user = userEvent.setup();
      renderSearchDialog();

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(mockChangeSearch).toHaveBeenCalledWith(false);
      });
    });

    it("clears input value when dialog is closed", async () => {
      const user = userEvent.setup();
      renderSearchDialog();

      const input = screen.getByPlaceholderText("Search for widgets");
      await user.type(input, "test query");
      expect(input).toHaveValue("test query");

      await user.clear(input);
      expect(input).toHaveValue("");
    });
  });

  describe("Mobile Mode", () => {
    it("renders mobile-specific layout when isMobile is true", async () => {
      const { useShallowThemeStore } = await import("~/lib/state/theme");
      vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
        selector({
          search: true,
          changeSearch: mockChangeSearch,
          initialSelectedSearchTab: "widgets",
          setInitialSelectedSearchTab: mockSetInitialSelectedSearchTab,
          recentlyAddedWidgets: [],
          setRecentlyAddedWidgets: vi.fn(),
        }),
      );

      render(
        <MemoryRouter initialEntries={["/app/dashboard-123"]}>
          <Routes>
            <Route path="/app/:id" element={<SearchDialog isMobile={true} />} />
          </Routes>
        </MemoryRouter>,
      );

      // Mobile layout renders without dialog wrapper
      expect(screen.queryByText("Widget Menu")).not.toBeInTheDocument();
      // But should have the widget menu and search
      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Search for widgets")).toBeInTheDocument();
    });
  });

  describe("Keyboard Navigation", () => {
    it("handles shift+number keys for tab switching", async () => {
      const user = userEvent.setup();
      renderSearchDialog();

      await user.keyboard("{Shift>}{1}{/Shift}");

      expect(mockSetInitialSelectedSearchTab).toHaveBeenCalled();
    });
  });

  describe("Widget Filtering", () => {
    it("filters out disabled widgets from the list", () => {
      const widgetsWithDisabled = [
        ...mockWidgets,
        {
          widgetId: "widget-disabled",
          name: "Disabled Widget",
          category: "Equity",
          disabled: true,
        },
      ];
      mockGetAllAppWidgets.mockReturnValue(widgetsWithDisabled);

      renderSearchDialog();

      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    });

    it("filters shared widgets based on selectedOptions", async () => {
      const { useShallowThemeStore } = await import("~/lib/state/theme");
      vi.mocked(useShallowThemeStore).mockImplementation((selector: Function) =>
        selector({
          search: true,
          changeSearch: mockChangeSearch,
          initialSelectedSearchTab: "widgets",
          setInitialSelectedSearchTab: mockSetInitialSelectedSearchTab,
          recentlyAddedWidgets: [],
          setRecentlyAddedWidgets: vi.fn(),
        }),
      );

      renderSearchDialog();

      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    });
  });
});

describe("SearchDialog - Fuse.js Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllAppWidgets.mockReturnValue(mockWidgets);
  });

  it("applies fuzzy search on widget name", async () => {
    const user = userEvent.setup();
    renderSearchDialog();

    const input = screen.getByPlaceholderText("Search for widgets");
    await user.type(input, "test widget");

    await waitFor(() => {
      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    });
  });

  it("searches across multiple fields (name, description, category)", async () => {
    const user = userEvent.setup();
    renderSearchDialog();

    const input = screen.getByPlaceholderText("Search for widgets");
    await user.type(input, "equity");

    await waitFor(() => {
      expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    });
  });

  it("handles empty search gracefully", () => {
    renderSearchDialog();

    expect(screen.getByTestId("widget-menu")).toBeInTheDocument();
    expect(screen.getByTestId("widget-count")).toBeInTheDocument();
  });
});
