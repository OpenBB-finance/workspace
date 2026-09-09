import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CodeSnippet from "~/components/CodeSnippet";

// Global mocks

vi.mock("~/components/CopyButton", () => ({
  __esModule: true,
  default: ({ text }: { text: string }) => (
    <button onClick={() => navigator.clipboard.writeText(text)}>Copy</button>
  ),
}));

describe("CodeSnippet Component", () => {
  // Scoped mocks
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders the code snippet with the provided text", () => {
    const text = "data = obb.equity.fundamental.management()";
    render(<CodeSnippet text={text} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("copies the text to clipboard when the copy button is clicked", async () => {
    const text = "data = obb.equity.fundamental.management()";
    render(<CodeSnippet text={text} />);

    const copyButton = screen.getByText("Copy");
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
  });

  it("when disables applies correct styles but still allows to copy the code", () => {
    const text = "data = obb.equity.fundamental.management()";
    render(<CodeSnippet text={text} disabled={true} />);

    const codeElement = screen.getByText(text).closest("code");
    expect(codeElement).toHaveClass("pointer-events-none");

    const copyButton = screen.getByText("Copy");
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
  });
});
