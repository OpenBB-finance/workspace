import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClockWidget from "~/components/Widgets/Clock";
import { renderWidget } from "./WidgetTestWrapper";

// Mock DraggableCard and NewAdvancedSelect to avoid complexity
vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, elementNextToTitle }: any) => (
    <div data-testid="draggable-card">
      {elementNextToTitle}
      {children}
    </div>
  ),
}));

vi.mock("~/components/NewAdvancedSelect", () => ({
  default: ({ onSelect }: any) => (
    <button onClick={() => onSelect(["America/New_York"])}>Add NYC</button>
  ),
}));

describe("ClockWidget", () => {
  it("renders empty state when no timezones", () => {
    renderWidget(<ClockWidget />, {
      widgetOverrides: { storage: { timezones: [] } },
    });
    expect(screen.getByText("No timezones added yet")).toBeInTheDocument();
  });

  it("renders timezones correctly", () => {
    renderWidget(<ClockWidget />, {
      widgetOverrides: {
        storage: { timezones: ["America/New_York", "Europe/London"] },
      },
    });
    expect(screen.getByText("New York")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
  });

  it("adds timezone through selector", () => {
    const updateWidget = vi.fn();
    renderWidget(<ClockWidget />, {
      widgetOverrides: { storage: { timezones: [] } },
      updateWidget,
    });

    fireEvent.click(screen.getByText("Add NYC"));

    expect(updateWidget).toHaveBeenCalled();
    const updateFn = updateWidget.mock.calls[0][0];
    const newState = updateFn({ storage: { timezones: [] } });
    expect(newState.storage.timezones).toEqual(["America/New_York"]);
  });
});
