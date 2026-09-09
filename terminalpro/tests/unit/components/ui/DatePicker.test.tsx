import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatePicker } from "~/components/ui/DatePicker";
import { WidgetContext } from "~/components/Widget.context";

// Mock Calendar to avoid complex day-picker logic
vi.mock("~/components/ui/Calendar", () => ({
  Calendar: ({ onSelect }: any) => (
    <div data-testid="mock-calendar">
      <button
        onClick={() =>
          onSelect({ from: new Date(2023, 0, 1), to: new Date(2023, 0, 5) })
        }
      >
        Select range
      </button>
    </div>
  ),
}));

describe("DatePicker", () => {
  const updateWidget = vi.fn();
  const mockWidget = {
    storage: {
      params: {
        start_date: "2023-01-01",
        end_date: "2023-01-10",
      },
    },
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <WidgetContext.Provider value={{ widget: mockWidget, updateWidget } as any}>
      {children}
    </WidgetContext.Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with initial dates from widget context", () => {
    render(<DatePicker />, { wrapper });
    expect(screen.getByText(/Jan 01, 2023 - Jan 10, 2023/)).toBeInTheDocument();
  });

  it("opens calendar on click", async () => {
    render(<DatePicker />, { wrapper });
    fireEvent.click(
      screen.getByRole("button", { name: /Jan 01, 2023 - Jan 10, 2023/ }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("mock-calendar")).toBeInTheDocument();
    });
  });

  it("updates widget when save is clicked", async () => {
    render(<DatePicker />, { wrapper });

    // Open popover
    fireEvent.click(
      screen.getByRole("button", { name: /Jan 01, 2023 - Jan 10, 2023/ }),
    );

    // Select new range in mock calendar
    const selectBtn = await screen.findByText("Select range");
    fireEvent.click(selectBtn);

    // Click save
    fireEvent.click(screen.getByText("Save"));

    expect(updateWidget).toHaveBeenCalled();
    const updateFn = updateWidget.mock.calls[0][0];
    const newState = updateFn(mockWidget);
    expect(newState.storage.params.start_date).toBe("2023-01-01");
    expect(newState.storage.params.end_date).toBe("2023-01-05");
  });
});
