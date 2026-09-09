import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import EllipsisDropdownMenu from "~/components/EllipsisDropdown";
import type { EllipsisDropdownMenuProps } from "~/components/MoveToDropDown/types";

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: vi.fn(() => ({
    widgetRef: {
      current: {
        id: "test-widget",
        widgetId: "test-widget",
        name: "Test Widget",
        type: "table",
      },
    },
    activeDashboardId: "dashboard-1",
    isShared: false,
  })),
}));

vi.mock("~/lib/state/app", () => ({
  useAppStore: {
    getState: () => ({
      getTabWidgetById: vi.fn(),
      duplicateWidget: vi.fn(),
    }),
  },
}));

vi.mock("~/lib/state/theme", () => ({
  useShallowThemeStore: vi.fn(() => vi.fn()),
}));

vi.mock("~/lib/state/featureFlags", () => ({
  useShallowFeatureFlagsStore: vi.fn(() => true),
}));

vi.mock("~/components/General/Table/Chart/hooks/useChartOptions", () => ({
  useChartBarFillQuickAction: vi.fn(() => null),
  useChartQuickActions: vi.fn(() => []),
}));

vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(() => ({
    capture: vi.fn(),
  })),
}));

vi.mock("~/components/MoveToDropDown", () => ({
  MoveToTabsDropdownMenu: () => <div data-testid="move-to-tabs">Move</div>,
}));

vi.mock("~/components/General/FeatureLock", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("EllipsisDropdownMenu", () => {
  const defaultProps: EllipsisDropdownMenuProps = {
    dispatch: vi.fn(),
    settings: {},
  };

  it("renders the ellipsis trigger button", () => {
    render(<EllipsisDropdownMenu {...defaultProps} />);

    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  describe("Minimize menu item", () => {
    it("shows minimize option when showMinimize is true and onMinimizeToggle is provided", async () => {
      const user = userEvent.setup();
      const onMinimizeToggle = vi.fn();

      render(
        <EllipsisDropdownMenu
          {...defaultProps}
          settings={{ showMinimize: true }}
          onMinimizeToggle={onMinimizeToggle}
          isMinimized={false}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      expect(screen.getByText("Minimize")).toBeInTheDocument();
    });

    it("shows expand option when widget is minimized", async () => {
      const user = userEvent.setup();
      const onMinimizeToggle = vi.fn();

      render(
        <EllipsisDropdownMenu
          {...defaultProps}
          settings={{ showMinimize: true }}
          onMinimizeToggle={onMinimizeToggle}
          isMinimized={true}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      expect(screen.getByText("Expand")).toBeInTheDocument();
    });

    it("calls onMinimizeToggle when minimize menu item is clicked", async () => {
      const user = userEvent.setup();
      const onMinimizeToggle = vi.fn();

      render(
        <EllipsisDropdownMenu
          {...defaultProps}
          settings={{ showMinimize: true }}
          onMinimizeToggle={onMinimizeToggle}
          isMinimized={false}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      const minimizeItem = screen.getByText("Minimize");
      await user.click(minimizeItem);

      expect(onMinimizeToggle).toHaveBeenCalledTimes(1);
    });

    it("does not show minimize option when showMinimize is false", async () => {
      const user = userEvent.setup();
      const onMinimizeToggle = vi.fn();

      render(
        <EllipsisDropdownMenu
          {...defaultProps}
          settings={{ showMinimize: false }}
          onMinimizeToggle={onMinimizeToggle}
          isMinimized={false}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      expect(screen.queryByText("Minimize")).not.toBeInTheDocument();
      expect(screen.queryByText("Expand")).not.toBeInTheDocument();
    });

    it("does not show minimize option when onMinimizeToggle is not provided", async () => {
      const user = userEvent.setup();

      render(
        <EllipsisDropdownMenu
          {...defaultProps}
          settings={{ showMinimize: true }}
          isMinimized={false}
        />,
      );

      const trigger = screen.getByRole("button");
      await user.click(trigger);

      expect(screen.queryByText("Minimize")).not.toBeInTheDocument();
    });
  });
});
