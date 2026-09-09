import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverflowTags } from "~/components/ds/molecules/OverflowTags";

// Render the DS Popover content inline so overflow items are assertable
// without driving Radix's portal/open state.
vi.mock("~/components/ds/atoms/Popover", () => ({
  Popover: ({ children, content }: { children: ReactNode; content: ReactNode }) => (
    <div>
      {children}
      <div data-testid="_overflow-popover">{content}</div>
    </div>
  ),
}));

/**
 * jsdom has no layout engine, so width measurement returns 0 by default. These
 * getters give the container a width and each tag a fixed width so the
 * width-based fitting logic can be exercised deterministically.
 */
function mockSizes({ container, tag }: { container: number; tag: number }) {
  const prevClient = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "clientWidth",
  );
  const prevOffset = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetWidth",
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return this.getAttribute("data-testid") === "_overflow-tags" ? container : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return this.classList?.contains("BB-Tag") ? tag : 0;
    },
  });
  return () => {
    if (prevClient)
      Object.defineProperty(HTMLElement.prototype, "clientWidth", prevClient);
    if (prevOffset)
      Object.defineProperty(HTMLElement.prototype, "offsetWidth", prevOffset);
  };
}

describe("OverflowTags", () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  it("renders every tag without an overflow chip when they all fit", () => {
    restore = mockSizes({ container: 1000, tag: 40 });
    render(<OverflowTags items={["Analyst", "Trader"]} />);

    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("collapses tags that don't fit into a +N chip with all items in the popover", () => {
    restore = mockSizes({ container: 150, tag: 40 });
    render(<OverflowTags items={["Analyst", "Trader", "Admin", "Risk"]} />);

    expect(screen.getByRole("button", { name: "2 more" })).toBeInTheDocument();

    const popover = screen.getByTestId("_overflow-popover");
    for (const role of ["Analyst", "Trader", "Admin", "Risk"]) {
      expect(within(popover).getByText(role)).toBeInTheDocument();
    }
  });

  it("respects max as a hard cap even when every tag would fit", () => {
    restore = mockSizes({ container: 1000, tag: 40 });
    render(<OverflowTags items={["Analyst", "Trader", "Admin", "Risk"]} max={2} />);

    expect(screen.getByRole("button", { name: "2 more" })).toBeInTheDocument();
  });

  it("always keeps one tag visible (truncated) plus a chip when nothing fits at natural width", () => {
    restore = mockSizes({ container: 20, tag: 40 });
    render(<OverflowTags items={["Analyst", "Trader"]} />);

    // First tag stays inline (it will ellipsize), only the remainder folds.
    expect(screen.getByRole("button", { name: "1 more" })).toBeInTheDocument();
  });

  it("always shows a lone item without a chip even when it doesn't fit", () => {
    restore = mockSizes({ container: 20, tag: 40 });
    render(<OverflowTags items={["Analyst"]} />);

    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
  });

  it("renders a lone tag with a truncating label so it ellipsizes instead of clipping", () => {
    restore = mockSizes({ container: 50, tag: 400 });
    const longRole = "Senior Quantitative Research Analyst, Equities";
    render(<OverflowTags items={[longRole]} />);

    // The visible (non-measure) layer renders the label wrapped in a truncating
    // span; the measure layer renders the raw string for width measurement.
    const labels = screen.getAllByText(longRole);
    const truncated = labels.find((el) => el.className.includes("truncate"));
    expect(truncated).toBeDefined();
  });

  it("ignores blank/whitespace-only items", () => {
    restore = mockSizes({ container: 1000, tag: 40 });
    render(<OverflowTags items={["Analyst", "", "   "]} />);

    // Only "Analyst" survives, so it shows alone with no overflow chip.
    expect(screen.queryByRole("button", { name: /more/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Analyst").length).toBeGreaterThan(0);
  });

  it("renders duplicate labels without React key collisions", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    restore = mockSizes({ container: 1000, tag: 40 });

    render(<OverflowTags items={["Risk", "Risk", "Risk"]} />);

    expect(
      errorSpy.mock.calls.some((args) => String(args[0]).includes("same key")),
    ).toBe(false);
    errorSpy.mockRestore();
  });

  it("renders the default empty fallback with no items", () => {
    render(<OverflowTags items={[]} />);
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders a custom empty fallback", () => {
    render(<OverflowTags items={[]} emptyFallback="None" />);
    expect(screen.getByText("None")).toBeInTheDocument();
  });
});
