import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  TabPageEmptyState,
  TabPageLayout,
  TabPageSearchInput,
  TabPageSectionHeader,
  TabPageToolbar,
  TabPageToolbarActions,
  TabPageToolbarDivider,
} from "~/components/shared/TabPage";

describe("TabPageLayout", () => {
  it("renders children with layout classes", () => {
    render(
      <TabPageLayout>
        <p>content</p>
      </TabPageLayout>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <TabPageLayout className="custom-class">
        <p>content</p>
      </TabPageLayout>,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("TabPageToolbar", () => {
  it("renders children in a flex row", () => {
    render(
      <TabPageToolbar>
        <button>action</button>
      </TabPageToolbar>,
    );
    expect(screen.getByRole("button", { name: "action" })).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <TabPageToolbar className="extra">
        <span>x</span>
      </TabPageToolbar>,
    );
    expect(container.firstChild).toHaveClass("extra");
  });
});

describe("TabPageSearchInput", () => {
  it("renders with placeholder", () => {
    render(<TabPageSearchInput placeholder="Search widgets" />);
    expect(screen.getByPlaceholderText("Search widgets")).toBeInTheDocument();
  });

  it("renders with default placeholder when none given", () => {
    render(<TabPageSearchInput />);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TabPageSearchInput ref={ref} placeholder="ref test" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("calls onChange with string value", () => {
    const onChange = vi.fn();
    render(<TabPageSearchInput onChange={onChange} placeholder="type here" />);
    const input = screen.getByPlaceholderText("type here");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalledWith("hello");
  });
});

describe("TabPageEmptyState", () => {
  it("renders title and description", () => {
    render(<TabPageEmptyState title="Nothing here" description="Add some items" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Add some items")).toBeInTheDocument();
  });

  it("renders without description", () => {
    render(<TabPageEmptyState title="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });

  it("renders action slot", () => {
    render(<TabPageEmptyState title="Empty" action={<button>Add item</button>} />);
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });
});

describe("TabPageToolbarActions", () => {
  it("renders children", () => {
    render(
      <TabPageToolbarActions>
        <button>act</button>
      </TabPageToolbarActions>,
    );
    expect(screen.getByRole("button", { name: "act" })).toBeInTheDocument();
  });
});

describe("TabPageToolbarDivider", () => {
  it("renders a divider element", () => {
    const { container } = render(<TabPageToolbarDivider />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("TabPageSectionHeader", () => {
  it("renders title and count", () => {
    render(<TabPageSectionHeader title="Agents" count={5} isOpen={false} />);
    expect(screen.getByText(/Agents/)).toBeInTheDocument();
    expect(screen.getByText(/(5)/)).toBeInTheDocument();
  });

  it("renders without count", () => {
    render(<TabPageSectionHeader title="Prompts" isOpen={true} />);
    expect(screen.getByText("Prompts")).toBeInTheDocument();
  });

  it("calls onToggle on click", () => {
    const onToggle = vi.fn();
    render(
      <TabPageSectionHeader title="Clickable" isOpen={false} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Enter key", () => {
    const onToggle = vi.fn();
    render(
      <TabPageSectionHeader title="Keyboard" isOpen={false} onToggle={onToggle} />,
    );
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onToggle on Space key", () => {
    const onToggle = vi.fn();
    render(<TabPageSectionHeader title="Space" isOpen={false} onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not call onToggle when disabled", () => {
    const onToggle = vi.fn();
    render(
      <TabPageSectionHeader
        title="Disabled"
        isOpen={false}
        onToggle={onToggle}
        disabled={true}
      />,
    );
    fireEvent.click(screen.getByText(/Disabled/));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not render role=button when onToggle is not provided", () => {
    render(<TabPageSectionHeader title="Static" isOpen={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders leading icon", () => {
    render(
      <TabPageSectionHeader
        title="With Icon"
        isOpen={true}
        leadingIcon={<span data-testid="_leading-icon">★</span>}
      />,
    );
    expect(screen.getByTestId("_leading-icon")).toBeInTheDocument();
  });

  it("renders trailing content", () => {
    render(
      <TabPageSectionHeader
        title="With Trailing"
        isOpen={true}
        trailingContent={<span data-testid="_trailing">info</span>}
      />,
    );
    expect(screen.getByTestId("_trailing")).toBeInTheDocument();
  });

  it("works in controlled toggle scenario", () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <TabPageSectionHeader
          title="Controlled"
          isOpen={open}
          onToggle={() => setOpen((prev) => !prev)}
        />
      );
    }

    render(<Controlled />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    // Just verifying no crashes in controlled mode
    expect(btn).toBeInTheDocument();
  });
});
