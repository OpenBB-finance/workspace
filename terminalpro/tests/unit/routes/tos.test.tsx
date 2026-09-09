import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TOSPage from "~/routes/tos";

vi.mock("~/components/LayoutAuth/TOSDialog", () => ({
  TOSDialogContent: ({ className }: { className?: string }) => (
    <div data-testid="tos-content" className={className}>
      Terms of Service Content
    </div>
  ),
}));

describe("TOSPage", () => {
  it("renders the Terms of Service page", () => {
    render(<TOSPage />);

    expect(screen.getByText("Terms of Service")).toBeInTheDocument();
  });

  it("renders the TOSDialogContent component", () => {
    render(<TOSPage />);

    expect(screen.getByTestId("tos-content")).toBeInTheDocument();
  });

  it("has proper heading element", () => {
    render(<TOSPage />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Terms of Service");
  });

  it("applies correct container styling", () => {
    const { container } = render(<TOSPage />);

    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer).toHaveClass("container", "mx-auto", "px-4", "py-8");
  });
});
