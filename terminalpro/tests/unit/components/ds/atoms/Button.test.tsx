import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "~/components/ds/atoms/Button";

/**
 * Reproduces how Chrome/Edge auto-translation mutates the live DOM: each text
 * node is replaced in-place by a <font> wrapper that re-parents the original
 * text node. After this, React still tracks the original text node but its
 * parent is the injected <font>, so React's later removeChild on the button
 * throws `NotFoundError: The node to be removed is not a child of this node`.
 */
function simulateBrowserTranslation(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeValue?.trim()) textNodes.push(n as Text);
  }
  for (const text of textNodes) {
    const parent = text.parentNode;
    if (!parent) continue;
    const font = document.createElement("font");
    parent.replaceChild(font, text);
    font.appendChild(text);
  }
}

describe("Button", () => {
  it("renders correctly with children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("handles click events", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled={true}>Click me</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state", () => {
    render(
      <Button loading={true} loadingChildren="Loading...">
        Click me
      </Button>,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies variant classes", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-btn-primary-bg");

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-btn-destructive-bg");
  });
});

describe("Button - browser translation safety", () => {
  // Mirrors the real-world crash: an icon + text button (e.g. the Skills tab
  // bulk-delete button) whose text child is removed on rerender while the page
  // is auto-translated. If Button keeps text in a stable element wrapper, the
  // node React removes is one it still owns and reconciliation survives.
  function IconTextButton({ showLabel }: { showLabel: boolean }) {
    return (
      <Button>
        <span data-testid="icon" />
        {showLabel ? "Delete skill" : null}
      </Button>
    );
  }

  it("survives a translated text child being removed on rerender", () => {
    const { container, rerender } = render(<IconTextButton showLabel={true} />);

    // Browser translation re-parents the "Delete skill" text node into a <font>.
    simulateBrowserTranslation(container);

    // React must now remove that text node. With a bare text child it targets a
    // node it no longer owns and throws NotFoundError (removeChild). A stable
    // wrapper element keeps the removal on a node React still owns.
    expect(() => rerender(<IconTextButton showLabel={false} />)).not.toThrow();
  });

  // A label split into adjacent fragments where the trailing one toggles away,
  // e.g. `Delete skill{plural ? "s" : null}`. These stay as separate text nodes,
  // so removing one must not crash either.
  function PluralButton({ plural }: { plural: boolean }) {
    return (
      <Button>
        <span data-testid="icon" />
        Delete skill{plural ? "s" : null}
      </Button>
    );
  }

  it("survives a translated trailing text fragment toggling away", () => {
    const { container, rerender } = render(<PluralButton plural={true} />);
    simulateBrowserTranslation(container);
    expect(() => rerender(<PluralButton plural={false} />)).not.toThrow();
  });
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));
