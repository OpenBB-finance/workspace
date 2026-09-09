import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import BottomTabBar from "~/components/LayoutAuth/Mobile/BottomTabBar";

const mockNavigate = vi.fn();
const mockSetMobileNavigationDrawer = vi.fn();
const mockSetMobileCopilotDrawer = vi.fn();
const mockChangeSearch = vi.fn();
let mockCopilotAvailable = true;

vi.mock("~/components/AI/hooks/useCopilotAvailable", () => ({
  useCopilotAvailable: () => mockCopilotAvailable,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/app" }),
  };
});

vi.mock("~/lib/providers/MobileProvider", () => ({
  useMobile: vi.fn((selector) =>
    selector({
      setMobileNavigationDrawer: mockSetMobileNavigationDrawer,
      setMobileCopilotDrawer: mockSetMobileCopilotDrawer,
    }),
  ),
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn((selector) =>
    selector({
      changeSearch: mockChangeSearch,
    }),
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: ({ id, ...props }: any) => <span data-testid={`icon-${id}`} {...props} />,
}));

vi.mock("~/lib/utils", () => ({
  cn: vi.fn((...args: any[]) => args.filter(Boolean).join(" ")),
  beautifySlug: vi.fn((s: string) => s),
}));

describe("BottomTabBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopilotAvailable = true;
  });

  it("renders all four tab buttons", () => {
    render(<BottomTabBar />);

    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("Copilot")).toBeInTheDocument();
  });

  it("renders as a nav element", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("clicking Menu opens the navigation drawer", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar />);

    await user.click(screen.getByText("Menu"));

    expect(mockSetMobileNavigationDrawer).toHaveBeenCalledWith(true);
  });

  it("clicking Apps navigates to /app", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar />);

    await user.click(screen.getByText("Apps"));

    expect(mockNavigate).toHaveBeenCalledWith("/app");
  });

  it("clicking Search calls changeSearch(true)", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar />);

    await user.click(screen.getByText("Search"));

    expect(mockChangeSearch).toHaveBeenCalledWith(true);
  });

  it("clicking Copilot opens the copilot drawer", async () => {
    const user = userEvent.setup();
    render(<BottomTabBar />);

    await user.click(screen.getByText("Copilot"));

    expect(mockSetMobileCopilotDrawer).toHaveBeenCalledWith(true);
  });

  it("Apps tab has active styling when on /app path", async () => {
    const { cn } = await import("~/lib/utils");

    render(<BottomTabBar />);

    const cnMock = cn as Mock;
    const calls = cnMock.mock.calls;

    // Find the call for the Apps button (isActive: true when pathname === "/app")
    const activeCall = calls.find(
      (args) => args.includes("text-tab-action-active"),
    );
    expect(activeCall).toBeDefined();
  });

  it("non-Apps tabs do not have active styling when on /app path", async () => {
    const { cn } = await import("~/lib/utils");

    render(<BottomTabBar />);

    const cnMock = cn as Mock;
    const captionCalls = cnMock.mock.calls.filter((args) =>
      args.includes("text-ds-text-caption"),
    );

    // Menu, Search, Copilot are all inactive — 3 calls with caption class
    expect(captionCalls.length).toBe(3);
  });

  it("renders icons for all tabs", () => {
    render(<BottomTabBar />);

    expect(screen.getByTestId("icon-menu")).toBeInTheDocument();
    expect(screen.getByTestId("icon-grid-01")).toBeInTheDocument();
    expect(screen.getByTestId("icon-search")).toBeInTheDocument();
    expect(screen.getByTestId("icon-sparkles-icon")).toBeInTheDocument();
  });

  it("hides the Copilot tab when copilot is unavailable (0 agents)", () => {
    mockCopilotAvailable = false;
    render(<BottomTabBar />);

    expect(screen.queryByText("Copilot")).not.toBeInTheDocument();
    expect(screen.getByText("Menu")).toBeInTheDocument();
    expect(screen.getByText("Apps")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });
});

describe("BottomTabBar - inactive Apps tab when not on /app", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCopilotAvailable = true;
  });

  it("Apps tab does not have active styling when not on /app path", async () => {
    const reactRouterDom = await import("react-router-dom");
    const { cn } = await import("~/lib/utils");

    // Override useLocation to return a different pathname
    const spy = vi.spyOn(reactRouterDom, "useLocation").mockReturnValue({
      pathname: "/some-other-path",
      search: "",
      hash: "",
      state: null,
      key: "default",
    });

    const cnMock = cn as Mock;
    cnMock.mockClear();

    render(<BottomTabBar />);

    const activeCall = cnMock.mock.calls.find((args) =>
      args.includes("text-brand-main dark:text-brand-lighter"),
    );
    expect(activeCall).toBeUndefined();

    spy.mockRestore();
  });
});
