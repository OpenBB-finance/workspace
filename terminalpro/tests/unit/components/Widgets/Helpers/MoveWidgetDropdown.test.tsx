import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MoveWidgetDropdown from "~/components/Widgets/Helpers/MoveWidgetDropdown";

const mockAddWidget = vi.fn();
const mockAddTab = vi.fn();
const mockGetAllTabs = vi.fn(() => [
  { index: "tab-1", data: { name: "Dashboard 1", type: "custom", widgets: [] } },
  { index: "tab-2", data: { name: "Dashboard 2", type: "custom", widgets: [] } },
]);

vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children }: any) => (
    <button data-testid="dropdown-trigger">{children}</button>
  ),
  Portal: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  Sub: ({ children }: any) => <div>{children}</div>,
  SubTrigger: ({ children }: any) => (
    <button data-testid="sub-trigger">{children}</button>
  ),
  SubContent: ({ children }: any) => <div data-testid="sub-content">{children}</div>,
  Item: ({ children, onClick }: any) => (
    <div onClick={onClick} role="menuitem">
      {children}
    </div>
  ),
}));

vi.mock("@radix-ui/react-icons", () => ({
  CaretRightIcon: () => null,
  FileIcon: () => null,
  Link2Icon: () => null,
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: () => ({
    getAllTabs: mockGetAllTabs,
    addWidget: mockAddWidget,
    addTab: mockAddTab,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "mock-uuid-1234",
}));

vi.mock("~/lib/utils", () => ({
  generateRandomName: () => "Generated Name",
}));

vi.mock("~/components/Icons/Location", () => ({
  default: () => <div data-testid="location-icon">Location Icon</div>,
}));

vi.mock("~/components/Icons", () => ({
  IcBaselineFolderOpen: () => <div data-testid="folder-icon">Folder</div>,
}));

const mockWidget = {
  widgetId: "widget-1",
  name: "Test Widget",
  type: "CHART",
} as any;

describe("MoveWidgetDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dropdown trigger with location icon", () => {
    render(<MoveWidgetDropdown widget={mockWidget} />);

    expect(screen.getByTestId("location-icon")).toBeInTheDocument();
  });

  it("opens dropdown when trigger is clicked", async () => {
    const user = userEvent.setup();

    render(<MoveWidgetDropdown widget={mockWidget} />);

    await user.click(screen.getByTestId("location-icon"));

    // The dropdown should open and show "Add to" option
    expect(await screen.findByText("Add to")).toBeInTheDocument();
  });

  it("shows existing tabs in submenu", async () => {
    const user = userEvent.setup();

    render(<MoveWidgetDropdown widget={mockWidget} />);

    await user.click(screen.getByTestId("location-icon"));

    // Hover/click on "Add to" to open submenu
    const addToTrigger = await screen.findByText("Add to");
    await user.click(addToTrigger);

    // Should show both dashboard tabs
    expect(await screen.findByText("Dashboard 1")).toBeInTheDocument();
    expect(await screen.findByText("Dashboard 2")).toBeInTheDocument();
  });

  it("shows New tab option in submenu", async () => {
    const user = userEvent.setup();

    render(<MoveWidgetDropdown widget={mockWidget} />);

    await user.click(screen.getByTestId("location-icon"));

    const addToTrigger = await screen.findByText("Add to");
    await user.click(addToTrigger);

    expect(await screen.findByText("New tab")).toBeInTheDocument();
  });

  it("calls addWidget when clicking on existing tab", async () => {
    const user = userEvent.setup();

    render(<MoveWidgetDropdown widget={mockWidget} />);

    await user.click(screen.getByTestId("location-icon"));

    const addToTrigger = await screen.findByText("Add to");
    await user.click(addToTrigger);

    const dashboard1 = await screen.findByText("Dashboard 1");
    await user.click(dashboard1);

    expect(mockAddWidget).toHaveBeenCalledWith("tab-1", mockWidget);
  });

  it("calls addTab when clicking on New tab", async () => {
    const user = userEvent.setup();

    render(<MoveWidgetDropdown widget={mockWidget} />);

    await user.click(screen.getByTestId("location-icon"));

    const addToTrigger = await screen.findByText("Add to");
    await user.click(addToTrigger);

    const newTab = await screen.findByText("New tab");
    await user.click(newTab);

    expect(mockAddTab).toHaveBeenCalledWith({
      index: "mock-uuid-1234",
      data: {
        name: "Generated Name",
        type: "custom",
        widgets: [mockWidget],
      },
    });
  });
});
