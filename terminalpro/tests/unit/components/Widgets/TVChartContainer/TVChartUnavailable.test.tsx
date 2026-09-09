import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { ChartingLibraryWidget } from "~/components/Widgets/TVChartContainer/TVChartContainerFunc";
import TVChartUnavailable from "~/components/Widgets/TVChartContainer/TVChartUnavailable";

describe("TVChartUnavailable", () => {
  it("explains that charts are unavailable and leaves the chart ref empty", () => {
    const chartRef = createRef<ChartingLibraryWidget>();

    render(<TVChartUnavailable ref={chartRef} extraClassName="h-full" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Advanced charts are unavailable in this workspace. Choose another chart widget.",
    );
    expect(screen.getByRole("alert")).toHaveClass("h-full");
    expect(chartRef.current).toBeNull();
  });
});
