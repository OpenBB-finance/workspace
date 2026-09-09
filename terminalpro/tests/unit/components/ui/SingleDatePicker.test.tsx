import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SingleDatePicker } from "~/components/ui/SingleDatePicker";

// Mock Calendar
vi.mock("~/components/ui/Calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <div data-testid="mock-calendar">
      <button onClick={() => onSelect(new Date("2023-05-20"))}>Select date</button>
    </div>
  ),
}));

describe("SingleDatePicker", () => {
  const onSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default date", () => {
    render(<SingleDatePicker defaultDate="2023-01-01" onSave={onSave} />);
    expect(screen.getByText("Jan 01, 2023")).toBeInTheDocument();
  });

  it("calls onSave when a date is selected", async () => {
    render(<SingleDatePicker defaultDate="2023-01-01" onSave={onSave} />);

    // Open calendar
    fireEvent.click(screen.getByText("Jan 01, 2023"));

    // Select date
    const selectBtn = await screen.findByText("Select date");
    fireEvent.click(selectBtn);

    expect(onSave).toHaveBeenCalled();
    // formatDate(new Date("2023-05-20")) should be "2023-05-20" usually
    expect(onSave).toHaveBeenCalledWith(expect.stringContaining("2023-05"));
  });

  it("calls onSave with empty string when cleared", async () => {
    render(<SingleDatePicker defaultDate="2023-01-01" onSave={onSave} />);

    // Open calendar
    fireEvent.click(screen.getByText("Jan 01, 2023"));

    // Click clear
    const clearBtn = await screen.findByText("Clear");
    fireEvent.click(clearBtn);

    expect(onSave).toHaveBeenCalledWith("");
  });
});
