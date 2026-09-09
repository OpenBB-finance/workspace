import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupPanelHeader, GroupRow } from "~/components/Widgets/Helpers/GroupRow";

vi.mock("~/components/Icon", () => ({
  default: ({ id }: { id: string }) => <span data-testid={`icon-${id}`} />,
}));

vi.mock("~/components/SpecialTooltip", () => ({
  default: ({ children, message }: any) => <div title={message}>{children}</div>,
}));

// Mirrors the real Popover, whose trigger uses `asChild` — the open handler is
// merged onto the child button rather than wrapping it, so the child's own
// stopPropagation does not prevent the popover from opening.
vi.mock("~/components/ds/atoms/Popover", async () => {
  const { cloneElement } = await import("react");
  return {
    Popover: ({ children, content, open, onOpenChange }: any) => (
      <div>
        {cloneElement(children, {
          onClick: (e: any) => {
            children.props.onClick?.(e);
            onOpenChange?.(!open);
          },
        })}
        {open ? <div data-testid="color-popover">{content}</div> : null}
      </div>
    ),
  };
});

vi.mock("react-colorful", () => ({
  HexColorPicker: ({ onChange }: any) => (
    <button
      type="button"
      data-testid="hex-picker"
      onClick={() => onChange("#abcdef")}
    />
  ),
}));

describe("GroupRow", () => {
  const baseProps = {
    name: "Group A",
    color: "#ff0000",
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the group name and a delete button", () => {
    render(<GroupRow {...baseProps} />);

    expect(screen.getByText("Group A:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete group" })).toBeInTheDocument();
  });

  it("calls onDelete when the delete button is clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<GroupRow {...baseProps} onDelete={onDelete} />);

    await user.click(screen.getByRole("button", { name: "Delete group" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does not trigger row selection when deleting", async () => {
    const user = userEvent.setup();
    const onToggleSelect = vi.fn();
    render(
      <GroupRow
        {...baseProps}
        selectable
        onToggleSelect={onToggleSelect}
        onDelete={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete group" }));

    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  describe("selection", () => {
    it("renders no checkbox when selectable is not set", () => {
      render(<GroupRow {...baseProps} />);

      expect(screen.queryByTestId("group-row-checkbox")).not.toBeInTheDocument();
    });

    it("renders a checkbox and calls onToggleSelect on row click when selectable", async () => {
      const user = userEvent.setup();
      const onToggleSelect = vi.fn();
      render(
        <GroupRow {...baseProps} selectable onToggleSelect={onToggleSelect} />,
      );

      expect(screen.getByTestId("group-row-checkbox")).toBeInTheDocument();

      await user.click(screen.getByText("Group A:"));
      expect(onToggleSelect).toHaveBeenCalledTimes(1);
    });

    it("clicking the checkbox itself still toggles the row", async () => {
      const user = userEvent.setup();
      const onToggleSelect = vi.fn();
      render(
        <GroupRow {...baseProps} selectable onToggleSelect={onToggleSelect} />,
      );

      await user.click(screen.getByTestId("group-row-checkbox"));

      expect(onToggleSelect).toHaveBeenCalledTimes(1);
    });

    it("reflects the selected state on the checkbox", () => {
      render(<GroupRow {...baseProps} selectable selected onToggleSelect={vi.fn()} />);

      expect(screen.getByTestId("group-row-checkbox")).toHaveAttribute(
        "data-state",
        "checked",
      );
    });
  });

  describe("color swatch", () => {
    it("renders a static swatch when onColorChange is absent", () => {
      render(<GroupRow {...baseProps} />);

      expect(
        screen.queryByRole("button", { name: "Change group color" }),
      ).not.toBeInTheDocument();
    });

    it("renders a picker trigger when onColorChange is provided", () => {
      render(<GroupRow {...baseProps} onColorChange={vi.fn()} />);

      expect(
        screen.getByRole("button", { name: "Change group color" }),
      ).toBeInTheDocument();
    });

    it("opening the picker does not toggle row selection", async () => {
      const user = userEvent.setup();
      const onToggleSelect = vi.fn();
      render(
        <GroupRow
          {...baseProps}
          selectable
          onToggleSelect={onToggleSelect}
          onColorChange={vi.fn()}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Change group color" }));

      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it("forwards the picked color to onColorChange without selecting the row", async () => {
      const user = userEvent.setup();
      const onColorChange = vi.fn();
      const onToggleSelect = vi.fn();
      render(
        <GroupRow
          {...baseProps}
          selectable
          onToggleSelect={onToggleSelect}
          onColorChange={onColorChange}
        />,
      );

      await user.click(screen.getByRole("button", { name: "Change group color" }));
      await user.click(screen.getByTestId("hex-picker"));

      expect(onColorChange).toHaveBeenCalledWith("#abcdef");
      expect(onToggleSelect).not.toHaveBeenCalled();
    });
  });

  describe("value pill", () => {
    it("renders the value label when provided", () => {
      render(<GroupRow {...baseProps} valueLabel="AAPL" />);

      expect(screen.getByText("AAPL")).toBeInTheDocument();
    });

    it("wraps the pill in a tooltip when valueTooltip is provided", () => {
      render(<GroupRow {...baseProps} valueLabel="AAPL" valueTooltip="Apple Inc." />);

      expect(screen.getByTitle("Apple Inc.")).toBeInTheDocument();
    });
  });

  it("dims the row when disabled", () => {
    const { container } = render(<GroupRow {...baseProps} disabled />);

    expect(container.firstChild).toHaveClass("opacity-50");
  });

  it("does not dim the row when enabled", () => {
    const { container } = render(<GroupRow {...baseProps} />);

    expect(container.firstChild).not.toHaveClass("opacity-50");
  });
});

describe("GroupPanelHeader", () => {
  it("renders the title without a create button by default", () => {
    render(<GroupPanelHeader />);

    expect(screen.getByText("Groups")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create a group" }),
    ).not.toBeInTheDocument();
  });

  it("calls onCreate when the create button is clicked", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<GroupPanelHeader onCreate={onCreate} />);

    await user.click(screen.getByRole("button", { name: "Create a group" }));

    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});
