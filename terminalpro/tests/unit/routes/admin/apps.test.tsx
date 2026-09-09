import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getApps } from "~/api/admin.api";
import AdminApps from "~/routes/admin/apps";

vi.mock("~/api/admin.api", () => ({
  getApps: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryFn }: { queryFn: unknown }) => {
    if (queryFn === getApps) {
      return { data: mockApps, isLoading: false, isError: false };
    }
    return { data: undefined, isLoading: false, isError: false };
  },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

const fakeThemeState = {
  theme: "light",
  manageAppDialog: { isOpen: false, mode: "add" as const, data: null },
  setManageAppDialog: vi.fn(),
  setManageAppsDialogOpen: vi.fn(),
};

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => fakeThemeState,
  useShallowThemeStore: (selector?: (s: typeof fakeThemeState) => unknown) =>
    selector ? selector(fakeThemeState) : fakeThemeState,
}));

vi.mock("~/components/Apps/ManageAppDialog", () => ({ default: () => null }));

const mockApps = [
  {
    uuid: "app-1",
    name: "Shared App",
    url: "https://example.com/shared",
    user_uuid: "user-1",
    user_email: "user1@example.com",
    created_date: "2023-01-01T00:00:00Z",
    updated_date: "2023-01-02T00:00:00Z",
  },
  {
    uuid: "app-2",
    name: "Shared App",
    url: "https://example.com/shared",
    user_uuid: "user-2",
    user_email: "user2@example.com",
    created_date: "2023-02-01T00:00:00Z",
    updated_date: "2023-02-02T00:00:00Z",
  },
  {
    uuid: "app-3",
    name: "Solo App",
    url: "https://example.com/solo",
    user_uuid: "user-3",
    user_email: "user3@example.com",
    created_date: "2023-03-01T00:00:00Z",
    updated_date: "2023-03-02T00:00:00Z",
  },
];

let originalRO: typeof ResizeObserver;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 1100,
    height: 600,
    top: 0,
    left: 0,
    right: 1100,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
  originalRO = global.ResizeObserver;
  global.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(el: Element) {
      this.cb(
        [
          {
            target: el,
            contentRect: { width: 1100, height: 600 } as DOMRectReadOnly,
            borderBoxSize: [{ inlineSize: 1100, blockSize: 600 }],
          } as unknown as ResizeObserverEntry,
        ],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  global.ResizeObserver = originalRO;
  vi.restoreAllMocks();
});

describe("AdminApps", () => {
  it("renders the title and stat tiles", () => {
    render(<AdminApps />);
    expect(screen.getByText("App Management")).toBeInTheDocument();
    expect(screen.getByText("Total apps")).toBeInTheDocument();
    expect(screen.getByText("Unique apps")).toBeInTheDocument();
  });

  it("renders the toolbar actions", () => {
    render(<AdminApps />);
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
    expect(screen.getByText("Add backend")).toBeInTheDocument();
    expect(screen.getByText("Export apps")).toBeInTheDocument();
    // No grouped/flat toggle anymore.
    expect(screen.queryByRole("button", { name: "Grouped" })).not.toBeInTheDocument();
  });

  it("renders selectable rows with view-users + connect actions and opens the dialog", async () => {
    render(<AdminApps />);
    await waitFor(() =>
      expect(screen.getByText("user1@example.com")).toBeInTheDocument(),
    );
    expect(screen.getByText("user3@example.com")).toBeInTheDocument();

    // header select-all + one checkbox per row
    expect(screen.getAllByRole("checkbox")).toHaveLength(mockApps.length + 1);
    // a view-users + connect action per row
    expect(screen.getAllByTestId("icon-user-group")).toHaveLength(mockApps.length);
    expect(screen.getAllByTestId("icon-external-link-icon")).toHaveLength(
      mockApps.length,
    );

    fireEvent.click(
      screen.getAllByTestId("icon-user-group")[0].closest("button") as HTMLElement,
    );
    // The users dialog opens with a "Users with apps" section (SettingsMenu).
    await waitFor(() =>
      expect(screen.getByText("Users with apps")).toBeInTheDocument(),
    );
  });
});
