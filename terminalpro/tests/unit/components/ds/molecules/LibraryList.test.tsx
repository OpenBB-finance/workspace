import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { LibraryItem, LibrarySection } from "~/components/ds/molecules/LibraryList";

describe("LibrarySection", () => {
  it("renders title, count and children when open", () => {
    render(
      <LibrarySection title="Servers" count={3} defaultOpen={true}>
        <p>child content</p>
      </LibrarySection>,
    );

    expect(screen.getByText(/Servers/)).toBeInTheDocument();
    expect(screen.getByText(/(3)/)).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("hides children when collapsed", () => {
    render(
      <LibrarySection title="Collapsed" defaultOpen={false}>
        <p>hidden</p>
      </LibrarySection>,
    );

    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("toggles open/closed on click", async () => {
    render(
      <LibrarySection title="Toggle" defaultOpen={true}>
        <p>toggled content</p>
      </LibrarySection>,
    );

    expect(screen.getByText("toggled content")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.queryByText("toggled content")).not.toBeInTheDocument();
    });
  });

  it("renders description", () => {
    render(
      <LibrarySection
        title="With Desc"
        description="https://example.com"
        defaultOpen={false}
      >
        <p>child</p>
      </LibrarySection>,
    );

    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("renders leftSection and rightSection", () => {
    render(
      <LibrarySection
        title="Sections"
        leftSection={<span data-testid="_left">L</span>}
        rightSection={<button data-testid="_right">R</button>}
        defaultOpen={false}
      >
        <p>child</p>
      </LibrarySection>,
    );

    expect(screen.getByTestId("_left")).toBeInTheDocument();
    expect(screen.getByTestId("_right")).toBeInTheDocument();
  });

  it("supports controlled open state", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <LibrarySection title="Controlled" open={open} onOpenChange={setOpen}>
          <p>controlled child</p>
        </LibrarySection>
      );
    }

    render(<Controlled />);
    expect(screen.queryByText("controlled child")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("controlled child")).toBeInTheDocument();
  });

  it("rightSection click does not toggle section", () => {
    const onClick = vi.fn();

    render(
      <LibrarySection
        title="No Toggle"
        rightSection={
          <button data-testid="_action" onClick={onClick}>
            Act
          </button>
        }
        defaultOpen={true}
      >
        <p>stays open</p>
      </LibrarySection>,
    );

    fireEvent.click(screen.getByTestId("_action"));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByText("stays open")).toBeInTheDocument();
  });
});

describe("LibraryItem", () => {
  it("renders title and description in row variant", () => {
    render(<LibraryItem title="My Item" description="desc text" />);

    expect(screen.getByText("My Item")).toBeInTheDocument();
    expect(screen.getByText("desc text")).toBeInTheDocument();
  });

  it("renders card variant with border styling", () => {
    const { container } = render(<LibraryItem title="Card" variant="card" />);

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-md");
    expect(card.className).toContain("border");
  });

  it("renders leftSection and rightSection", () => {
    render(
      <LibraryItem
        title="Sections"
        leftSection={<span data-testid="_left">L</span>}
        rightSection={<button data-testid="_right">R</button>}
      />,
    );

    expect(screen.getByTestId("_left")).toBeInTheDocument();
    expect(screen.getByTestId("_right")).toBeInTheDocument();
  });

  it("shows children always when not expandable", () => {
    render(
      <LibraryItem title="Static">
        <p>always visible</p>
      </LibraryItem>,
    );

    expect(screen.getByText("always visible")).toBeInTheDocument();
  });

  it("shows/hides children when expandable", () => {
    render(
      <LibraryItem title="Expandable" expandable={true} defaultExpanded={false}>
        <p>expandable content</p>
      </LibraryItem>,
    );

    expect(screen.queryByText("expandable content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("expandable content")).toBeInTheDocument();
  });

  it("supports controlled expanded state", () => {
    function Controlled() {
      const [expanded, setExpanded] = useState(false);
      return (
        <LibraryItem
          title="Ctrl"
          expandable={true}
          expanded={expanded}
          onExpandedChange={setExpanded}
        >
          <p>ctrl content</p>
        </LibraryItem>
      );
    }

    render(<Controlled />);
    expect(screen.queryByText("ctrl content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("ctrl content")).toBeInTheDocument();
  });

  it("rightSection click does not toggle expansion", () => {
    const onClick = vi.fn();

    render(
      <LibraryItem
        title="No Toggle"
        expandable={true}
        defaultExpanded={false}
        rightSection={
          <button data-testid="_action" onClick={onClick}>
            Act
          </button>
        }
      >
        <p>hidden</p>
      </LibraryItem>,
    );

    fireEvent.click(screen.getByTestId("_action"));
    expect(onClick).toHaveBeenCalled();
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();
  });

  it("does not render chevron when not expandable", () => {
    const { container } = render(<LibraryItem title="No Chevron" />);
    // AnimatedChevron renders a motion.div with an Icon. If not expandable, no chevron-right icon.
    expect(container.querySelector("[data-icon='chevron-right']")).toBeNull();
  });
});
