import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Notice } from "~/components/ds/molecules/Notice";

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

describe("Notice", () => {
  it("renders the success variant with a check icon and green color", () => {
    const { container } = render(
      <Notice variant="success" title="Connected successfully">
        body text
      </Notice>,
    );

    expect(screen.getByText("Connected successfully")).toBeInTheDocument();
    expect(screen.getByText("body text")).toBeInTheDocument();
    expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-success-100/15");
  });

  it("renders the warning variant with a triangle icon, amber color, and a node body", () => {
    const { container } = render(
      <Notice variant="warning" title="Sidecar unreachable">
        Run <code>workspace-mcp</code>
      </Notice>,
    );

    expect(screen.getByText("Sidecar unreachable")).toBeInTheDocument();
    expect(screen.getByText("workspace-mcp")).toBeInTheDocument();
    expect(screen.getByTestId("icon-exclamation-outline-triangle")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-warning-100/15");
  });

  it("renders the error variant with a warning icon and red color", () => {
    const { container } = render(<Notice variant="error" title="Failed" />);

    expect(screen.getByTestId("icon-warning-icon")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-error-100/15");
  });

  it("renders the info variant with an info icon", () => {
    const { container } = render(<Notice variant="info" title="Heads up" />);

    expect(screen.getByTestId("icon-info-circle")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-informative-100/15");
  });

  it("allows overriding the default icon", () => {
    render(<Notice variant="success" title="x" icon="mcp" />);
    expect(screen.getByTestId("icon-mcp")).toBeInTheDocument();
  });

  it("omits the body wrapper when no children are provided", () => {
    const { container } = render(<Notice variant="info" title="Only title" />);
    expect(container.querySelectorAll("div")).toHaveLength(2); // outer box + content column
  });
});
