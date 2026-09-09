import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Progress } from "~/components/ui/Progress";

describe("Progress", () => {
  it("renders correctly with value", () => {
    const { container } = render(<Progress value={50} />);
    const indicator = container.querySelector(".bg-brand-lighter");
    expect(indicator).toBeInTheDocument();
    // transform: translateX(-50%)
    expect(indicator).toHaveStyle({ transform: "translateX(-50%)" });
  });

  it("renders correctly with 0 value", () => {
    const { container } = render(<Progress value={0} />);
    const indicator = container.querySelector(".bg-brand-lighter");
    expect(indicator).toHaveStyle({ transform: "translateX(-100%)" });
  });

  it("applies custom indicator classname", () => {
    const { container } = render(
      <Progress value={50} indicatorClassname="custom-indicator" />,
    );
    const indicator = container.querySelector(".custom-indicator");
    expect(indicator).toBeInTheDocument();
  });
});
