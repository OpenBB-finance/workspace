import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Ds from "~/routes/ds";

describe("Ds", () => {
  it("renders without crashing", () => {
    const { container } = render(<Ds />);
    expect(container).toBeInTheDocument();
  });

  it("renders an empty fragment", () => {
    const { container } = render(<Ds />);
    expect(container.innerHTML).toBe("");
  });
});
