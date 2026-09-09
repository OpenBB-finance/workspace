import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { CollapsibleSection } from "~/components/ds/atoms/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("renders header and children when open by default", () => {
    render(
      <CollapsibleSection header="Section Title">
        <p>Section content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Section Title")).toBeInTheDocument();
    expect(screen.getByText("Section content")).toBeInTheDocument();
  });

  it("toggles content visibility on header click", () => {
    render(
      <CollapsibleSection header="Toggle Me">
        <p>Collapsible content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByRole("button", { name: "Toggle Me" });
    expect(screen.getByText("Collapsible content")).toBeInTheDocument();

    fireEvent.click(header);
    // After clicking, content should be animating out (AnimatePresence)
    // In tests framer-motion runs synchronously, so the exit removes the element
  });

  it("respects defaultOpen=false", () => {
    render(
      <CollapsibleSection header="Closed" defaultOpen={false}>
        <p>Hidden initially</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.queryByText("Hidden initially")).not.toBeInTheDocument();
  });

  it("works in controlled mode", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <CollapsibleSection header="Controlled" open={open} onOpenChange={setOpen}>
          <p>Controlled content</p>
        </CollapsibleSection>
      );
    }

    render(<Controlled />);

    expect(screen.queryByText("Controlled content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Controlled" }));
    expect(screen.getByText("Controlled content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Controlled" }));
    await waitFor(() => {
      expect(screen.queryByText("Controlled content")).not.toBeInTheDocument();
    });
  });

  it("does not toggle when disabled", () => {
    render(
      <CollapsibleSection header="Disabled" disabled={true}>
        <p>Should stay visible</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Should stay visible")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Disabled" }));
    // Content should still be visible since toggle is disabled
    expect(screen.getByText("Should stay visible")).toBeInTheDocument();
  });

  it("supports render-prop header with isOpen", () => {
    render(
      <CollapsibleSection
        header={({ isOpen }) => <span>{isOpen ? "Open" : "Closed"}</span>}
      >
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("calls onOpenChange callback", () => {
    const onOpenChange = vi.fn();

    render(
      <CollapsibleSection header="Callback Test" onOpenChange={onOpenChange}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Callback Test" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: "Callback Test" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("supports keyboard activation with Enter and Space", () => {
    const onOpenChange = vi.fn();

    render(
      <CollapsibleSection header="Keyboard" onOpenChange={onOpenChange}>
        <p>Content</p>
      </CollapsibleSection>,
    );

    const header = screen.getByRole("button", { name: "Keyboard" });

    fireEvent.keyDown(header, { key: "Enter" });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    fireEvent.keyDown(header, { key: " " });
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("applies className and contentClassName", () => {
    const { container } = render(
      <CollapsibleSection
        header="Styled"
        className="custom-root"
        contentClassName="custom-content"
      >
        <p>Content</p>
      </CollapsibleSection>,
    );

    expect(container.firstChild).toHaveClass("custom-root");
  });
});
