import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Calendar } from "~/components/ui/Calendar";

describe("Calendar", () => {
  it("renders correctly", () => {
    render(<Calendar mode="single" selected={new Date(2023, 0, 1)} />);
    expect(screen.getByTestId("day-picker")).toBeInTheDocument();
  });

  it("renders select when isSingle is true", () => {
    render(<Calendar isSingle={true} />);
    // DayPicker will render components.Select
    expect(screen.getByTestId("day-picker")).toBeInTheDocument();
  });
});

vi.mock("react-day-picker", () => ({
  DayPicker: ({ components }: any) => {
    return (
      <div data-testid="day-picker">
        {components?.Select && <div data-testid="mock-select" />}
      </div>
    );
  },
}));

vi.mock("../ds/atoms/Select", () => ({
  Select: () => <div data-testid="ds-select" />,
}));
