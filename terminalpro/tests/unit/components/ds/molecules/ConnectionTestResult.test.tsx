import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionTestResult } from "~/components/ds/molecules/ConnectionTestResult";

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

describe("ConnectionTestResult", () => {
  it("renders the success variant with a check icon and default heading", () => {
    const { container } = render(
      <ConnectionTestResult status="success" message="3 agents found" />,
    );

    expect(screen.getByText("Test successful")).toBeInTheDocument();
    expect(screen.getByText("3 agents found")).toBeInTheDocument();
    expect(screen.getByTestId("icon-check-circle")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-success-100/15");
  });

  it("renders the error variant with a warning icon and default heading", () => {
    const { container } = render(
      <ConnectionTestResult status="error" message="Connection refused" />,
    );

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
    expect(screen.getByTestId("icon-warning-icon")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-error-100/15");
  });

  it("supports a custom title", () => {
    render(<ConnectionTestResult status="success" title="Connected" message="ok" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });
});
