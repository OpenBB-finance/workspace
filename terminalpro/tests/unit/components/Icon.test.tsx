import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Unmock Icon to test the actual implementation (global vitest.setup.ts mocks it)
vi.unmock("~/components/Icon");

import Icon from "~/components/Icon";

vi.mock("~/lib/constants", () => ({
  VERSION: "mocked-version",
  AG_CHART_TYPES: [],
}));

describe("Icon Component", () => {
  it("renders with default classes", () => {
    render(<Icon id="home-icon" data-testid="test-icon" />);
    const icon = screen.getByTestId("test-icon");

    expect(icon).toHaveClass("w-4", "h-4");
  });

  it("merges custom classes with default classes", () => {
    render(<Icon id="home-icon" className="text-red-500" data-testid="test-icon" />);
    const icon = screen.getByTestId("test-icon");

    expect(icon).toHaveClass("w-4", "h-4", "text-red-500");
  });

  it("renders with correct href in use element", () => {
    render(<Icon id="home-icon" data-testid="test-icon" />);
    const useElement = screen.getByTestId("test-icon").querySelector("use");

    expect(useElement).toHaveAttribute(
      "href",
      "/assets/icons/sprite.svg?v=mocked-version#home-icon",
    );
  });

  it("passes through additional SVG props", () => {
    render(
      <Icon
        id="home-icon"
        data-testid="test-icon"
        width={24}
        height={24}
        fill="currentColor"
      />,
    );
    const icon = screen.getByTestId("test-icon");

    expect(icon).toHaveAttribute("width", "24");
    expect(icon).toHaveAttribute("height", "24");
    expect(icon).toHaveAttribute("fill", "currentColor");
  });
});
