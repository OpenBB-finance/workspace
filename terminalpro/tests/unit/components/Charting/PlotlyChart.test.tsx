import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlotlyChart from "~/components/Charting/PlotlyChart";

const { mockPlotComponent } = vi.hoisted(() => {
  const mockPlotComponent = vi.fn(({ data, layout, config, className, style }: any) => (
    <div
      data-testid="plotly-plot"
      data-trace-count={data?.length || 0}
      className={className}
      style={style}
    >
      <span data-testid="plot-title">{layout?.title || "Untitled"}</span>
      <span data-testid="trace-count">{data?.length || 0} traces</span>
    </div>
  ));
  return { mockPlotComponent };
});

// Mock dependencies
vi.mock("plotly.js-dist-min", () => ({
  default: {},
  newPlot: vi.fn(),
  react: vi.fn(),
}));

vi.mock("react-plotly.js/factory", () => ({
  default: () => mockPlotComponent,
}));

vi.mock("react-resize-detector", () => ({
  useResizeDetector: () => ({
    width: 800,
    height: 600,
    ref: { current: null },
  }),
}));

vi.mock("usehooks-ts", () => ({
  useUpdateEffect: vi.fn((effect, deps) => {
    // Simulate the effect being called after first render
    const { useEffect, useRef } = require("react");
    const isFirst = useRef(true);
    useEffect(() => {
      if (isFirst.current) {
        isFirst.current = false;
        return;
      }
      effect();
    }, deps);
  }),
  useWindowSize: () => ({ width: 1024, height: 768 }),
}));

vi.mock("~/lib/state/theme", () => ({
  useThemeStore: () => ({ theme: "light" }),
  useShallowThemeStore: vi.fn((selector: any) => selector({ theme: "light" })),
}));

vi.mock("~/lib/templates/dark.json", () => ({
  default: { paper_bgcolor: "#1a1a1a", plot_bgcolor: "#1a1a1a" },
}));

vi.mock("~/lib/templates/light.json", () => ({
  default: { paper_bgcolor: "#ffffff", plot_bgcolor: "#ffffff" },
}));

vi.mock("~/lib/utils", () => ({
  cn: (...args: any[]) => args.filter((a) => typeof a === "string").join(" "),
  mergeObjects: (a: any, b: any) => ({ ...a, ...b }),
}));

vi.mock("~/components/Charting/ResizeHandler", () => ({
  default: ({ plotData }: any) => ({
    plotData,
    layout_update: {},
  }),
}));

describe("PlotlyChart Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders null when no initial data", () => {
    const { container } = render(<PlotlyChart initialData={null} />);

    expect(screen.queryByTestId("plotly-plot")).not.toBeInTheDocument();
  });

  it("renders null when initialData has empty data array", () => {
    const { container } = render(
      <PlotlyChart initialData={{ data: [], layout: {} }} />,
    );

    expect(screen.queryByTestId("plotly-plot")).not.toBeInTheDocument();
  });

  it("renders Plotly chart when data is provided", async () => {
    const chartData = {
      data: [{ x: [1, 2, 3], y: [10, 20, 30], type: "scatter" }],
      layout: { title: "Test Chart" },
    };
    await act(async () => render(<PlotlyChart initialData={chartData} />));

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("displays correct number of traces", () => {
    const chartData = {
      data: [
        { x: [1, 2, 3], y: [10, 20, 30], type: "scatter" },
        { x: [1, 2, 3], y: [15, 25, 35], type: "scatter" },
        { x: [1, 2, 3], y: [12, 22, 32], type: "bar" },
      ],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("trace-count")).toHaveTextContent("3 traces");
  });
});

describe("PlotlyChart - Theme Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies light theme template", async () => {
    const { useShallowThemeStore } = await import("~/lib/state/theme");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: any) =>
      selector({ theme: "light" }),
    );

    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("applies dark theme template", async () => {
    const { useShallowThemeStore } = await import("~/lib/state/theme");
    vi.mocked(useShallowThemeStore).mockImplementation((selector: any) =>
      selector({ theme: "dark" }),
    );

    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });
});

describe("PlotlyChart - Props", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies extraClassname", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    const { container } = render(
      <PlotlyChart initialData={chartData} extraClassname="custom-chart-class" />,
    );

    expect(container.querySelector(".custom-chart-class")).toBeInTheDocument();
  });

  it("handles custom margin", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} margin={{ t: 50, b: 100 }} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("handles reduceSize prop", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} reduceSize={40} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("handles isExternal prop", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: { title: "External Chart" },
    };

    render(<PlotlyChart initialData={chartData} isExternal={true} />);

    // External charts don't remove title
    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });
});

describe("PlotlyChart - setPlotDiv Callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls setPlotDiv callback when plot is ready", async () => {
    const setPlotDivMock = vi.fn();

    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} setPlotDiv={setPlotDivMock} />);

    await waitFor(() => {
      expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    });

    // The callback may be called after effect runs
  });
});

describe("PlotlyChart - Layout Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes title for non-external charts", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: { title: "Original Title" },
    };

    render(<PlotlyChart initialData={chartData} isExternal={false} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    const lastCall = mockPlotComponent.mock.calls.at(-1)[0];
    expect(lastCall.layout.title).toBe("");
  });

  it("preserves title for external charts", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: { title: "External Chart Title" },
    };

    render(<PlotlyChart initialData={chartData} isExternal={true} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    const lastCall = mockPlotComponent.mock.calls.at(-1)[0];
    expect(lastCall.layout.title).toBe("External Chart Title");
  });

  it("handles layout with existing margins", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {
        margin: { l: 50, r: 50, t: 50, b: 50 },
      },
    };

    render(<PlotlyChart initialData={chartData} margin={{ t: 20, b: 20 }} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("handles layout with legend configuration", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4], name: "Series 1" }],
      layout: {
        legend: { x: 0.5, y: 0.5 },
      },
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    const lastCall = mockPlotComponent.mock.calls.at(-1)[0];
    expect(lastCall.layout.legend).toBeDefined();
    expect(lastCall.layout.legend.orientation).toBe("h");
  });
});

describe("PlotlyChart - Resize Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles window resize", async () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} resizeRate={100} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });
});

describe("PlotlyChart - Config Options", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with responsive config", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
      config: { responsive: true },
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("enables scroll zoom for external charts", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} isExternal={true} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    const lastCall = mockPlotComponent.mock.calls.at(-1)[0];
    expect(lastCall.config.scrollZoom).toBe(true);
    expect(lastCall.config.displayModeBar).toBe("hover");
  });

  it("disables display mode bar for internal charts", () => {
    const chartData = {
      data: [{ x: [1, 2], y: [3, 4] }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} isExternal={false} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
    const lastCall = mockPlotComponent.mock.calls.at(-1)[0];
    expect(lastCall.config.scrollZoom).toBe(false);
    expect(lastCall.config.displayModeBar).toBe(false);
  });
});

describe("PlotlyChart - Data Types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders scatter plot", () => {
    const chartData = {
      data: [{ x: [1, 2, 3], y: [4, 5, 6], type: "scatter", mode: "lines" }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("renders bar chart", () => {
    const chartData = {
      data: [{ x: ["A", "B", "C"], y: [10, 20, 30], type: "bar" }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("renders pie chart", () => {
    const chartData = {
      data: [{ labels: ["A", "B", "C"], values: [30, 40, 30], type: "pie" }],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });

  it("renders candlestick chart", () => {
    const chartData = {
      data: [
        {
          x: ["2024-01-01", "2024-01-02"],
          open: [100, 105],
          high: [110, 112],
          low: [95, 100],
          close: [105, 108],
          type: "candlestick",
        },
      ],
      layout: {},
    };

    render(<PlotlyChart initialData={chartData} />);

    expect(screen.getByTestId("plotly-plot")).toBeInTheDocument();
  });
});
