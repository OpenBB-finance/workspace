import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ReactNode } from "react";
import { BrowserRouter, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ButtonProps } from "~/components/ds/atoms/Button";
import type { InputProps } from "~/components/ds/atoms/Input";
import type { UnifiedTemplate } from "~/hooks/useAllTemplates";
import AppsPage from "~/routes/Apps";

const {
  mockUpdateApiSources,
  mockSetOpenDataPlatformModalOpen,
  mockUseShallowBackendConnectorStore,
  mockUseShallowFeatureFlagsStore,
  mockUseShallowThemeStore,
  mockUseAllTemplates,
  mockUseSharedTemplates,
  localStorageInitial,
} = vi.hoisted(() => ({
  mockUpdateApiSources: vi.fn(),
  mockSetOpenDataPlatformModalOpen: vi.fn(),
  mockUseShallowBackendConnectorStore: vi.fn(),
  mockUseShallowFeatureFlagsStore: vi.fn(),
  mockUseShallowThemeStore: vi.fn(),
  mockUseAllTemplates: vi.fn(),
  mockUseSharedTemplates: vi.fn(),
  localStorageInitial: { state: {} as Record<string, unknown> },
}));

vi.mock("~/api/auth.api", () => ({
  getApiSources: vi.fn().mockResolvedValue([]),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    isFetching: false,
    data: null,
    refetch: vi.fn().mockResolvedValue({}),
  })),
}));

vi.mock("use-debounce", () => ({
  useDebouncedCallback: (fn: (...args: unknown[]) => unknown) => fn,
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
  };
});

vi.mock("~/lib/state/backendConnector", () => ({
  useShallowBackendConnectorStore: (selector: unknown) =>
    mockUseShallowBackendConnectorStore(selector),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: (selector: unknown) =>
    mockUseShallowFeatureFlagsStore(selector),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: (selector: unknown) => mockUseShallowThemeStore(selector),
}));

vi.mock("~/hooks/useAllTemplates", () => ({
  useAllTemplates: (...args: unknown[]) => mockUseAllTemplates(...args),
}));

vi.mock("~/hooks/useSharedTemplates", () => ({
  useSharedTemplates: (...args: unknown[]) => mockUseSharedTemplates(...args),
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@radix-ui/react-tabs", () => ({
  Root: ({ children }: { children: ReactNode }) => (
    <div data-testid="tabs-root">{children}</div>
  ),
  List: ({ children }: { children: ReactNode }) => (
    <div data-testid="tabs-list">{children}</div>
  ),
  Trigger: ({ children, value }: { children: ReactNode; value: string }) => (
    <button type="button" data-testid={`tab-trigger-${value}`}>
      {children}
    </button>
  ),
  Content: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-testid={`tab-content-${value}`}>{children}</div>
  ),
}));

vi.mock("~/components/LayoutAuth/Skeleton/SettingsLayout", () => ({
  SettingsLayout: ({
    children,
    title,
    tabs,
  }: {
    children: ReactNode;
    title?: string;
    tabs?: { id: string; label: string }[];
  }) => (
    <div data-testid="settings-layout">
      {title && <h1>{title}</h1>}
      {tabs && tabs.length > 0 && (
        <div data-testid="tabs-root">
          <div data-testid="tabs-list">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" data-testid={`tab-trigger-${tab.id}`}>
                {tab.label}
              </button>
            ))}
          </div>
          {children}
        </div>
      )}
      {(!tabs || tabs.length === 0) && children}
    </div>
  ),
}));

vi.mock("~/components/Apps/ListedAppsTab", () => ({
  ListedAppsTab: () => (
    <div data-testid="listed-apps-tab">Apps Marketplace Content</div>
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
    secondMessage?: string | false;
    icon?: boolean;
    extraClassName?: string;
  }) => (
    <div data-testid="empty-state">
      <p>{firstMessage}</p>
      {secondMessage && <p>{secondMessage}</p>}
      {children}
    </div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: forwardRef<HTMLSpanElement, { id: string; className?: string }>(
    ({ id, className }, _ref) => (
      <span data-testid={`icon-${id}`} className={className} />
    ),
  ),
}));

vi.mock("~/components/Tooltip", () => ({
  default: forwardRef<HTMLDivElement, { message: string; children: ReactNode }>(
    ({ message, children }, _ref) => <div title={message}>{children}</div>,
  ),
}));

vi.mock("~/components/LayoutAuth/AppCard", () => ({
  default: ({ template }: { template: UnifiedTemplate }) => (
    <div data-testid={`app-card-${template.id}`}>{template.name}</div>
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
      {props.loading ? (props.loadingChildren ?? "Loading...") : props.children}
    </button>
  )),
}));

vi.mock("~/components/ds/atoms/Checkbox", () => ({
  Checkbox: (props: {
    checked: boolean | "indeterminate";
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = props.checked === "indeterminate";
      }}
      checked={props.checked === true}
      onChange={(e) => props.onCheckedChange(e.target.checked)}
    />
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

vi.mock("~/components/ds/atoms/Select", () => ({
  SelectTriggerVariants: () => "select-trigger",
  Select: (props: {
    options: { label: string; value: string }[];
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    className?: string;
  }) => (
    <select
      value={props.value}
      onChange={(e) => props.onChange?.(e.target.value)}
      className={props.className}
      data-testid={props.placeholder === "Sort by" ? "sort-select" : "filter-select"}
    >
      {props.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("~/components/ds/atoms/Popover", () => ({
  PopoverRoot: ({
    children,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => <div data-testid="popover-root">{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode; asChild?: boolean }) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
  PopoverContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    align?: string;
    className?: string;
  }) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
}));

// --- Mock data factories ---

const makeApiSource = (overrides: Record<string, unknown> = {}) => ({
  id: "backend-1",
  uuid: "uuid-1",
  name: "My Backend",
  url: "https://api.example.com",
  widgets: {},
  templates: [],
  status: "success" as const,
  createdDate: "2024-01-15T00:00:00Z",
  endpointHeaders: null,
  ...overrides,
});

const makeTemplate = (overrides: Partial<UnifiedTemplate> = {}): UnifiedTemplate => ({
  id: "template-1",
  name: "Template 1",
  description: "A template",
  type: "user",
  widgets: [],
  prompts: [],
  onClick: vi.fn(),
  source: {
    id: "backend-1",
    uuid: "uuid-1",
    name: "My Backend",
    url: "https://api.example.com",
    endpointHeaders: null,
    createdDate: "2024-01-15T00:00:00Z",
  },
  ...overrides,
});

const TWO_BACKENDS = [
  makeApiSource({ id: "backend-1", uuid: "uuid-1", name: "Alpha Backend" }),
  makeApiSource({ id: "backend-2", uuid: "uuid-2", name: "Beta Backend" }),
];

const FOUR_BACKENDS = [
  makeApiSource({ id: "b-1", uuid: "u-1", name: "Alpha" }),
  makeApiSource({ id: "b-2", uuid: "u-2", name: "Beta" }),
  makeApiSource({ id: "b-3", uuid: "u-3", name: "Gamma" }),
  makeApiSource({ id: "b-4", uuid: "u-4", name: "Delta" }),
];

const TEMPLATES_FOR_TWO_BACKENDS: UnifiedTemplate[] = [
  makeTemplate({
    id: "t-1",
    name: "App from Alpha",
    source: {
      id: "backend-1",
      uuid: "uuid-1",
      name: "Alpha Backend",
      url: "https://a.com",
      endpointHeaders: null,
    },
  }),
  makeTemplate({
    id: "t-2",
    name: "App from Beta",
    source: {
      id: "backend-2",
      uuid: "uuid-2",
      name: "Beta Backend",
      url: "https://b.com",
      endpointHeaders: null,
    },
  }),
];

// --- Setup helpers ---

function setupDefaultMocks(
  apiSources = TWO_BACKENDS,
  templates = TEMPLATES_FOR_TWO_BACKENDS,
) {
  mockUseShallowBackendConnectorStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      apiSources,
      updateApiSources: mockUpdateApiSources,
    }),
  );

  mockUseShallowFeatureFlagsStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({ featureFlags: { tier: "free" } }),
  );

  mockUseShallowThemeStore.mockImplementation((selector: unknown) =>
    (selector as (state: unknown) => unknown)({
      setOpenDataPlatformModalOpen: mockSetOpenDataPlatformModalOpen,
    }),
  );

  mockUseAllTemplates.mockReturnValue(templates);

  mockUseSharedTemplates.mockReturnValue({
    isFetching: false,
    data: [],
    refetch: vi.fn().mockResolvedValue({}),
  });
}

const renderApps = () =>
  render(
    <BrowserRouter>
      <AppsPage />
    </BrowserRouter>,
  );

const renderAppsWithRoute = (initialRoute: string) =>
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppsPage />
    </MemoryRouter>,
  );

// --- Tests ---

describe("AppsPage - Backend Filter Dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageInitial.state = {};
    setupDefaultMocks();
  });

  describe("Rendering", () => {
    it("renders the backend filter trigger with 'All Backends' by default", () => {
      renderApps();
      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toHaveTextContent("All Backends");
    });

    it("renders a label for each backend in apiSources", () => {
      renderApps();
      expect(screen.getByText("Alpha Backend")).toBeInTheDocument();
      expect(screen.getByText("Beta Backend")).toBeInTheDocument();
    });

    it("renders a checkbox for each backend plus Select All", () => {
      renderApps();
      const checkboxes = screen.getAllByRole("checkbox");
      // 2 backend checkboxes + 1 Select All checkbox
      expect(checkboxes).toHaveLength(3);
    });

    it("shows 'No backends connected' when apiSources is empty", () => {
      setupDefaultMocks([], []);
      renderApps();
      expect(screen.getByText("No backends connected")).toBeInTheDocument();
    });

    it("always renders search input in popover", () => {
      renderApps();
      expect(screen.getByPlaceholderText("Search for backends")).toBeInTheDocument();
    });
  });

  describe("Backend Selection", () => {
    it("checks every backend by default (all-selected state)", () => {
      renderApps();
      // [0] = Select All, [1..] = backends — all checked when no filter is active
      for (const cb of screen.getAllByRole("checkbox")) {
        expect(cb).toBeChecked();
      }
    });

    it("deselects only the clicked backend from the all-selected state", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      // [0] = Select All, [1] = Alpha, [2] = Beta
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).toBeChecked();
      });
    });

    it("collapses to the 'none' state when the last selected backend is deselected", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // deselect Alpha -> only Beta selected
      await user.click(checkboxes[2]); // deselect Beta (last one) -> explicit none

      await waitFor(() => {
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
      });
      expect(screen.getByTestId("popover-trigger")).toHaveTextContent("No Backends");
    });

    it("selects only the clicked backend when picking from the 'none' state", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      // Clear all via the Select All checkbox so we enter the 'none' state.
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
      });

      // Picking a single backend from 'none' yields exactly that selection.
      await user.click(checkboxes[1]);

      await waitFor(() => {
        expect(checkboxes[1]).toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
      });
      expect(screen.getByTestId("popover-trigger")).toHaveTextContent("Alpha Backend");
    });

    it("shows 'Backends (N)' after deselecting a subset", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(FOUR_BACKENDS, []);
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      // [0]=Select All, [1..4]=Alpha,Beta,Gamma,Delta — deselect two, leaving two
      await user.click(checkboxes[1]);
      await user.click(checkboxes[2]);

      await waitFor(() => {
        expect(screen.getByText("Backends (2)")).toBeInTheDocument();
      });
    });

    it("filters the template list to the backends that remain selected", async () => {
      const user = userEvent.setup();
      renderApps();

      expect(screen.getByTestId("app-card-t-1")).toBeInTheDocument();
      expect(screen.getByTestId("app-card-t-2")).toBeInTheDocument();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // deselect Alpha -> only Beta apps remain

      await waitFor(() => {
        expect(screen.queryByTestId("app-card-t-1")).not.toBeInTheDocument();
        expect(screen.getByTestId("app-card-t-2")).toBeInTheDocument();
      });
    });
  });

  describe("Select All Backends", () => {
    it("re-checks every backend when 'Select All' is clicked", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // deselect Alpha -> partial

      await waitFor(() => {
        expect(checkboxes[1]).not.toBeChecked();
      });

      await user.click(checkboxes[0]); // Select All -> back to all

      await waitFor(() => {
        for (const cb of screen.getAllByRole("checkbox")) {
          expect(cb).toBeChecked();
        }
      });
    });

    it("clears every backend when 'Select All' is clicked from the all-selected state", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      // All backends start selected -> clicking Select All clears them.
      await user.click(checkboxes[0]);

      await waitFor(() => {
        expect(checkboxes[0]).not.toBeChecked();
        expect(checkboxes[1]).not.toBeChecked();
        expect(checkboxes[2]).not.toBeChecked();
      });
      expect(screen.getByTestId("popover-trigger")).toHaveTextContent("No Backends");
    });

    it("hides every app when the user clears all backends", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[0]); // clear all

      await waitFor(() => {
        expect(screen.queryByTestId("app-card-t-1")).not.toBeInTheDocument();
        expect(screen.queryByTestId("app-card-t-2")).not.toBeInTheDocument();
      });
    });

    it("renders 'Select All' as indeterminate when a subset is selected", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // deselect Alpha -> partial

      await waitFor(() => {
        expect(checkboxes[0]).toBePartiallyChecked();
      });
    });

    it("restores all templates after clicking 'Select All'", async () => {
      const user = userEvent.setup();
      renderApps();

      const checkboxes = screen.getAllByRole("checkbox");
      await user.click(checkboxes[1]); // deselect Alpha -> only Beta apps remain

      await waitFor(() => {
        expect(screen.queryByTestId("app-card-t-1")).not.toBeInTheDocument();
      });

      await user.click(checkboxes[0]); // Select All -> restore

      await waitFor(() => {
        expect(screen.getByTestId("app-card-t-1")).toBeInTheDocument();
        expect(screen.getByTestId("app-card-t-2")).toBeInTheDocument();
      });
    });
  });

  describe("Dropdown Search", () => {
    it("filters backend list by search text", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(FOUR_BACKENDS, []);
      renderApps();

      const searchInput = screen.getByPlaceholderText("Search for backends");
      await user.type(searchInput, "Alpha");

      await waitFor(() => {
        expect(screen.getByText("Alpha")).toBeInTheDocument();
        expect(screen.queryByText("Beta")).not.toBeInTheDocument();
        expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
        expect(screen.queryByText("Delta")).not.toBeInTheDocument();
      });
    });

    it("hides 'Select All' option inside dropdown when search is active", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(FOUR_BACKENDS, []);
      renderApps();

      // Select All text should be visible before search
      expect(screen.getByText("Select All")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText("Search for backends");
      await user.type(searchInput, "Al");

      await waitFor(() => {
        expect(screen.queryByText("Select All")).not.toBeInTheDocument();
      });
    });

    it("shows 'No backends match your search' for no results", async () => {
      const user = userEvent.setup();
      setupDefaultMocks(FOUR_BACKENDS, []);
      renderApps();

      const searchInput = screen.getByPlaceholderText("Search for backends");
      await user.type(searchInput, "zzzznonexistent");

      await waitFor(() => {
        expect(screen.getByText("No backends match your search")).toBeInTheDocument();
      });
    });
  });

  describe("URL Param Pre-selection", () => {
    it("pre-selects backend matching by id from ?backend= param", async () => {
      renderAppsWithRoute("/app/apps?backend=backend-1");

      await waitFor(() => {
        const checkboxes = screen.getAllByRole("checkbox");
        // [0] = Select All, [1] = first backend
        expect(checkboxes[1]).toBeChecked();
      });
    });

    it("pre-selects backend matching by uuid from ?backend= param", async () => {
      renderAppsWithRoute("/app/apps?backend=uuid-2");

      await waitFor(() => {
        const checkboxes = screen.getAllByRole("checkbox");
        // [0] = Select All, [2] = second backend
        expect(checkboxes[2]).toBeChecked();
      });
    });

    it("keeps all backends selected when param does not match any source", () => {
      renderAppsWithRoute("/app/apps?backend=nonexistent");

      // No filter applied -> default all-selected state -> everything checked
      for (const cb of screen.getAllByRole("checkbox")) {
        expect(cb).toBeChecked();
      }
    });
  });

  describe("Stale Backend Cleanup", () => {
    it("removes selected backends that no longer exist in apiSources", async () => {
      localStorageInitial.state["apps-options-v2"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: ["backend-1", "removed-backend"],
      };

      renderApps();

      await waitFor(() => {
        const checkboxes = screen.getAllByRole("checkbox");
        const checkedCount = checkboxes.filter(
          (cb) => (cb as HTMLInputElement).checked,
        ).length;
        expect(checkedCount).toBe(1);
      });
    });

    it("shows all backends selected when every selected backend was removed", async () => {
      localStorageInitial.state["apps-options-v2"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: ["removed-1", "removed-2"],
      };

      renderApps();

      await waitFor(() => {
        // cleanup empties the selection -> all-selected state -> everything checked
        for (const cb of screen.getAllByRole("checkbox")) {
          expect(cb).toBeChecked();
        }
      });
    });
  });

  describe("Legacy localStorage migration", () => {
    it("shows all apps for returning users with the pre-#2012 empty-array selection", () => {
      // Builds before #2012 persisted `selectedBackends: []` to mean "All Backends".
      // The tri-state filter now reads `[]` as "No Backends", which would blank the
      // page. Returning users must not inherit an empty page from that flipped sentinel.
      localStorageInitial.state["apps-options"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: [],
      };

      renderApps();

      expect(screen.getByTestId("app-card-t-1")).toBeInTheDocument();
      expect(screen.getByTestId("app-card-t-2")).toBeInTheDocument();
      expect(screen.getByTestId("popover-trigger")).toHaveTextContent("All Backends");
    });
  });

  describe("Backend Filter Display Text", () => {
    it("shows 'All Backends' when nothing is selected", () => {
      renderApps();

      const triggers = screen.getAllByText("All Backends");
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });

    it("shows backend name in trigger when exactly one is selected", async () => {
      localStorageInitial.state["apps-options-v2"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: ["backend-1"],
      };

      renderApps();

      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toHaveTextContent("Alpha Backend");
    });

    it("shows '1 Backend' fallback when selected backend has no name", () => {
      const backendWithNoName = makeApiSource({
        id: "nameless",
        uuid: "u-nameless",
        name: "",
      });

      localStorageInitial.state["apps-options-v2"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: ["nameless"],
      };

      setupDefaultMocks([backendWithNoName], []);
      renderApps();

      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toHaveTextContent("1 Backend");
    });

    it("shows 'Backends (N)' when N > 1 backends are selected", () => {
      localStorageInitial.state["apps-options-v2"] = {
        filterBy: "all",
        sortBy: "newest",
        selectedBackends: ["backend-1", "backend-2"],
      };

      renderApps();

      expect(screen.getByText("Backends (2)")).toBeInTheDocument();
    });
  });
});
