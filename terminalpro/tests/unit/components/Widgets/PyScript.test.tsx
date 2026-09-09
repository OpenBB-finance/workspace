import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PyScript from "~/components/Widgets/PyScript";

vi.mock("~/components/DraggableCard", () => ({
  default: ({ children, title, widget }: any) => (
    <div
      data-testid="draggable-card"
      data-title={title}
      data-widget-id={widget?.widgetId}
    >
      {children}
    </div>
  ),
}));

const mockWidget = {
  widgetId: "pyscript-widget-1",
  name: "Python Widget",
  data: {
    html: "print('Hello World')",
  },
};

describe("PyScript Widget", () => {
  it("renders pyscript container", () => {
    render(<PyScript widget={mockWidget as any} activeDashboardId="dashboard-1" />);

    expect(screen.getByTestId("draggable-card")).toBeInTheDocument();
  });

  it("renders with Python Emulator title", () => {
    render(<PyScript widget={mockWidget as any} activeDashboardId="dashboard-1" />);

    const card = screen.getByTestId("draggable-card");
    expect(card.getAttribute("data-title")).toBe("Python Emulator");
  });

  it("renders py-repl with widget code", () => {
    render(<PyScript widget={mockWidget as any} activeDashboardId="dashboard-1" />);

    const container = screen.getByTestId("draggable-card");
    expect(container.innerHTML).toContain("py-repl");
    expect(container.innerHTML).toContain("print('Hello World')");
  });

  it("renders empty py-repl when no html data provided", () => {
    const emptyWidget = {
      ...mockWidget,
      data: { html: "" },
    };

    render(<PyScript widget={emptyWidget as any} activeDashboardId="dashboard-1" />);

    const container = screen.getByTestId("draggable-card");
    expect(container.innerHTML).toContain("py-repl");
  });

  it("handles undefined html data", () => {
    const noDataWidget = {
      ...mockWidget,
      data: {},
    };

    render(<PyScript widget={noDataWidget as any} activeDashboardId="dashboard-1" />);

    const container = screen.getByTestId("draggable-card");
    expect(container.innerHTML).toContain("py-repl");
  });
});
