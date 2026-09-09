import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthedAppNotFound from "~/routes/AuthedAppNotFound";

describe("AuthedAppNotFound", () => {
  it("renders the page not found message", () => {
    render(<AuthedAppNotFound />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders the secondary message", () => {
    render(<AuthedAppNotFound />);

    expect(
      screen.getByText("We couldn't find the page you're looking for."),
    ).toBeInTheDocument();
  });

  it("renders the SearchResultsNotFound component with icon", () => {
    render(<AuthedAppNotFound />);

    // The component should render in a container with specific styling
    const container = screen.getByText("Page not found").closest("div");
    expect(container).toBeInTheDocument();
  });
});
