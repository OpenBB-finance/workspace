import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EdgeHoverZone } from "~/components/ui/EdgeHoverZone";

describe("EdgeHoverZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Default to pointer: fine (mouse)
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(pointer: fine)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders a left hover zone correctly", () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <EdgeHoverZone side="left" onHoverChange={onHoverChange} />,
    );
    const div = container.querySelector(".left-\\[10px\\]");
    expect(div).toBeInTheDocument();
  });

  it("calls onHoverChange(true) on mouse enter", () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <EdgeHoverZone side="left" onHoverChange={onHoverChange} />,
    );
    const div = container.firstChild as HTMLElement;

    fireEvent.mouseEnter(div);
    expect(onHoverChange).toHaveBeenCalledWith(true);
  });

  it("calls onHoverChange(false) after delay on mouse leave", () => {
    const onHoverChange = vi.fn();
    const { container } = render(
      <EdgeHoverZone side="left" onHoverChange={onHoverChange} />,
    );
    const div = container.firstChild as HTMLElement;

    fireEvent.mouseLeave(div);
    expect(onHoverChange).not.toHaveBeenCalledWith(false);

    vi.advanceTimersByTime(200);
    expect(onHoverChange).toHaveBeenCalledWith(false);
  });

  it("does not render if not a pointer device", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const onHoverChange = vi.fn();
    const { container } = render(
      <EdgeHoverZone side="left" onHoverChange={onHoverChange} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
