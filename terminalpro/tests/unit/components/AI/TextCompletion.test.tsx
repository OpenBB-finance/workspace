import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TextCompletion from "~/components/AI/TextCompletion";

const processMentions = (text: string) => ({ result: text, mentions: [] });

describe("TextCompletion", () => {
  it("renders nothing without a prompt", () => {
    const { container } = render(
      <TextCompletion
        renderedPrompt=""
        completion="whatever"
        processMentions={processMentions}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the typed prefix as transparent and the remaining completion as visible ghost text", () => {
    render(
      <TextCompletion
        renderedPrompt="Wri"
        completion="Write a summary"
        processMentions={processMentions}
      />,
    );

    expect(screen.getByText("Wri")).toHaveClass("text-transparent");
    expect(screen.getByText("te a summary")).not.toHaveClass("text-transparent");
  });

  it("clips ghost text to the input bounds so long completions cannot overflow", () => {
    const longCompletion = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
    const { container } = render(
      <TextCompletion
        renderedPrompt="l"
        completion={longCompletion}
        processMentions={processMentions}
      />,
    );

    expect(container.firstChild).toHaveClass("overflow-hidden");
  });
});
