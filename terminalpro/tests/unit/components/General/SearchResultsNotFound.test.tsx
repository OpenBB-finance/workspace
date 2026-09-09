import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchResultsNotFound from "~/components/General/SearchResultsNotFound";

vi.mock("~/components/Widget.context", () => ({
  useWidgetContext: () => ({
    widgetRef: { current: { id: "test-widget-id" } },
  }),
}));

describe("SearchResultsNotFound Component", () => {
  it("renders with default messages", () => {
    render(<SearchResultsNotFound />);

    expect(screen.getByTestId("results-not-found")).toBeInTheDocument();
    expect(screen.getByText("No results found")).toBeInTheDocument();
    expect(screen.getByText(/find a match for your search/i)).toBeInTheDocument();
  });

  it("renders with custom first message", () => {
    render(<SearchResultsNotFound firstMessage="Custom error message" />);

    expect(screen.getByText("Custom error message")).toBeInTheDocument();
  });

  it("renders URLs in string messages as clickable links", () => {
    render(
      <SearchResultsNotFound firstMessage="Unauthorized. Please go to https://google.com to get an api key." />,
    );

    expect(
      screen.getByRole("link", { name: "https://google.com" }),
    ).toHaveAttribute("href", "https://google.com");
  });

  it("renders with custom second message", () => {
    render(<SearchResultsNotFound secondMessage="Try again later" />);

    expect(screen.getByText("Try again later")).toBeInTheDocument();
  });

  it("renders with an icon when icon prop is true", () => {
    render(<SearchResultsNotFound icon={true} />);

    expect(screen.getByTestId("icon-warning-icon")).toBeInTheDocument();
  });

  it("does not render icon when icon prop is false", () => {
    render(<SearchResultsNotFound icon={false} />);

    expect(screen.queryByTestId("icon-warning-icon")).not.toBeInTheDocument();
  });

  it("renders children when provided", () => {
    render(
      <SearchResultsNotFound>
        <button>Retry</button>
      </SearchResultsNotFound>,
    );

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("applies extra className", () => {
    render(<SearchResultsNotFound extraClassName="custom-class" />);

    expect(screen.getByTestId("results-not-found")).toHaveClass("custom-class");
  });

  it("renders ReactNode as first message", () => {
    render(
      <SearchResultsNotFound
        firstMessage={<span data-testid="custom-node">Custom Node</span>}
      />,
    );

    expect(screen.getByTestId("custom-node")).toBeInTheDocument();
  });

  it("hides first message when set to empty string", () => {
    render(<SearchResultsNotFound firstMessage="" />);

    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });

  it("hides second message when set to empty string", () => {
    render(<SearchResultsNotFound secondMessage="" />);

    expect(
      screen.queryByText(
        "We couldn't find a match for your search. Please try searching for something else.",
      ),
    ).not.toBeInTheDocument();
  });
});
