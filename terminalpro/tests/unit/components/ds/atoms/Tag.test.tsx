import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tag } from "~/components/ds/atoms/Tag";

describe("Tag", () => {
  it("renders correctly with children", () => {
    render(<Tag>New</Tag>);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("applies color classes based on color prop", () => {
    const { rerender } = render(<Tag color="success">Success</Tag>);
    expect(screen.getByText("Success")).toHaveClass("text-tag-green-label");

    rerender(<Tag color="danger">Danger</Tag>);
    expect(screen.getByText("Danger")).toHaveClass("text-tag-red-label");
  });

  it("does not render with no children", () => {
    const { container } = render(<Tag />);
    expect(container).toBeEmptyDOMElement();
  });
});
