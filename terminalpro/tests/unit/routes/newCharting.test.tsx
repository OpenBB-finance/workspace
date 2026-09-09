import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewCharting from "~/routes/newCharting";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams({ ticker: "AAPL" }), vi.fn()],
  };
});

vi.mock("~/components/Widgets/TvChart", () => ({
  default: ({
    ticker,
    secondTickers,
  }: {
    ticker: string;
    secondTickers: string[];
  }) => (
    <div data-testid="tv-chart">
      <span data-testid="main-ticker">{ticker}</span>
      <span data-testid="second-tickers">{secondTickers.join(",")}</span>
    </div>
  ),
}));

describe("NewCharting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders TvChart component", () => {
    render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("tv-chart")).toBeInTheDocument();
  });

  it("passes ticker from URL params to TvChart", () => {
    render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("main-ticker")).toHaveTextContent("AAPL");
  });

  it("has proper container styling", () => {
    const { container } = render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );

    const chartContainer = container.firstChild as HTMLElement;
    expect(chartContainer).toHaveClass("mx-[22px]", "my-[10px]", "rounded");
  });
});

describe("NewCharting with multiple tickers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles multiple second tickers", async () => {
    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useSearchParams: () => [
          new URLSearchParams({
            ticker: "AAPL",
            secondTickers: "MSFT,GOOGL,AMZN",
          }),
          vi.fn(),
        ],
      };
    });

    render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("tv-chart")).toBeInTheDocument();
  });
});

describe("NewCharting without ticker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.doMock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
      };
    });
  });

  it("handles missing ticker gracefully", () => {
    render(
      <BrowserRouter>
        <NewCharting />
      </BrowserRouter>,
    );

    expect(screen.getByTestId("tv-chart")).toBeInTheDocument();
  });
});
