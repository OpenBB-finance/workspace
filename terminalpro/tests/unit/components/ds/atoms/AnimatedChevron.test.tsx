import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedChevron } from "~/components/ds/atoms/AnimatedChevron";

describe("AnimatedChevron", () => {
  it("renders a chevron-right icon", () => {
    render(<AnimatedChevron isOpen={false} />);
    expect(screen.getByTestId("icon-chevron-right")).toBeInTheDocument();
  });

  it("renders when isOpen is true", () => {
    render(<AnimatedChevron isOpen={true} />);
    expect(screen.getByTestId("icon-chevron-right")).toBeInTheDocument();
  });

  it("accepts custom size", () => {
    render(<AnimatedChevron isOpen={false} size="size-6" />);
    const icon = screen.getByTestId("icon-chevron-right");
    expect(icon).toHaveClass("size-6");
  });

  it("uses default size-4 when no size prop given", () => {
    render(<AnimatedChevron isOpen={false} />);
    const icon = screen.getByTestId("icon-chevron-right");
    expect(icon).toHaveClass("size-4");
  });

  it("applies custom className to wrapper", () => {
    const { container } = render(
      <AnimatedChevron isOpen={false} className="custom-chevron" />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-chevron");
    expect(wrapper).toHaveClass("flex-shrink-0");
  });
});
