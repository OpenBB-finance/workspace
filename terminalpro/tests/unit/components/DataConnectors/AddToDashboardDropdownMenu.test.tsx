import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AddToDashboardDropdownMenu from "~/components/DataConnectors/AddToDashboardDropdownMenu";

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "test-dashboard-id" }),
}));

vi.mock("~/lib/state/app", () => ({
  useShallowAppStore: vi.fn(() => ({
    items: {
      "dashboard-1": {
        index: "dashboard-1",
        data: { name: "Dashboard 1" },
        isFolder: false,
        isRoot: false,
      },
      "dashboard-2": {
        index: "dashboard-2",
        data: { name: "Dashboard 2" },
        isFolder: false,
        isRoot: false,
      },
    },
    addTab: vi.fn(),
  })),
}));

describe("AddToDashboardDropdownMenu", () => {
  const defaultProps = {
    onAddToDashboard: vi.fn(),
  };

  it("renders the trigger button", () => {
    render(<AddToDashboardDropdownMenu {...defaultProps} />);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("opens the dropdown when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<AddToDashboardDropdownMenu {...defaultProps} />);

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.getByText("Create New Dashboard")).toBeInTheDocument();
    expect(screen.getByText("DASHBOARDS")).toBeInTheDocument();
  });

  describe("onOpenChange callback", () => {
    it("calls onOpenChange with true when dropdown opens", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <AddToDashboardDropdownMenu {...defaultProps} onOpenChange={onOpenChange} />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("calls onOpenChange with false when dropdown closes", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      render(
        <AddToDashboardDropdownMenu {...defaultProps} onOpenChange={onOpenChange} />,
      );

      const trigger = screen.getByRole("button");
      // Open
      await user.click(trigger);
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Close by pressing Escape
      await user.keyboard("{Escape}");
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("works without onOpenChange prop (optional)", async () => {
      const user = userEvent.setup();

      render(<AddToDashboardDropdownMenu {...defaultProps} />);

      const trigger = screen.getByRole("button");

      // Should not throw when onOpenChange is not provided
      await expect(user.click(trigger)).resolves.not.toThrow();

      expect(screen.getByText("Create New Dashboard")).toBeInTheDocument();
    });
  });
});
