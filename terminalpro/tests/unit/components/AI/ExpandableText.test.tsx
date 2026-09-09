import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpandableText } from "~/components/AI/ExpandableText";

vi.mock("~/components/AI/TextStyle", () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <span data-testid="text-style" className={className}>
      {content}
    </span>
  ),
}));

describe("ExpandableText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders content via TextStyle", () => {
    render(<ExpandableText content="Hello world" />);

    const textStyle = screen.getByTestId("text-style");
    expect(textStyle).toHaveTextContent("Hello world");
  });

  it("applies default className when none provided", () => {
    render(<ExpandableText content="test" />);

    const textStyle = screen.getByTestId("text-style");
    expect(textStyle).toHaveClass("text-xs", "text-light-900", "dark:text-light-100");
  });

  it("applies custom className when provided", () => {
    render(<ExpandableText content="test" className="custom-class" />);

    const textStyle = screen.getByTestId("text-style");
    expect(textStyle).toHaveClass("custom-class");
    expect(textStyle).not.toHaveClass("text-xs");
  });

  it("applies line-clamp-3 when not expanded", () => {
    render(<ExpandableText content="Short text" />);

    const contentDiv = screen.getByTestId("text-style").parentElement!;
    expect(contentDiv).toHaveClass("line-clamp-3");
  });

  it("does not show read more button when content fits", () => {
    render(<ExpandableText content="Short text" />);

    expect(screen.queryByText("...Read more")).not.toBeInTheDocument();
    expect(screen.queryByText("Read less")).not.toBeInTheDocument();
  });

  it("shows read more button and toggles expansion when content overflows", async () => {
    const user = userEvent.setup();

    // Mock scrollHeight > clientHeight to trigger truncation
    const originalGetter = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollHeight",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 50;
      },
    });

    render(<ExpandableText content="A very long text that should be truncated" />);

    const readMoreBtn = screen.getByText("...Read more");
    expect(readMoreBtn).toBeInTheDocument();

    await user.click(readMoreBtn);

    expect(screen.getByText("Read less")).toBeInTheDocument();
    const contentDiv = screen.getByTestId("text-style").parentElement!;
    expect(contentDiv).not.toHaveClass("line-clamp-3");

    await user.click(screen.getByText("Read less"));

    expect(screen.getByText("...Read more")).toBeInTheDocument();
    expect(contentDiv).toHaveClass("line-clamp-3");

    // Restore
    if (originalGetter) {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalGetter);
    }
  });

  it("stops event propagation on button click", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();

    Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 200;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get() {
        return 50;
      },
    });

    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test only
      <div onClick={parentClick}>
        <ExpandableText content="Long content" />
      </div>,
    );

    await user.click(screen.getByText("...Read more"));

    expect(parentClick).not.toHaveBeenCalled();
  });
});
