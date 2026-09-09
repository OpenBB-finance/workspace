import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AdvancedSelect from "~/components/NewAdvancedSelectAddEdit";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("AdvancedSelect Component", () => {
  it("renders with default props", () => {
    const mockOnSelect = vi.fn();
    render(
      <AdvancedSelect
        label="Test Select"
        values={[
          { label: "Option 1", value: "option1" },
          { label: "Option 2", value: "option2" },
        ]}
        onSelect={mockOnSelect}
      />,
    );

    const selectElement = screen.getByText("Test Select");
    expect(selectElement).toBeInTheDocument();
  });

  it("handles item selection", async () => {
    const mockOnSelect = vi.fn();
    render(
      <AdvancedSelect
        label="Test Select"
        values={[
          { label: "Option 1", value: "option1" },
          { label: "Option 2", value: "option2" },
        ]}
        onSelect={mockOnSelect}
      />,
    );

    userEvent.click(screen.getByText("Test Select"));

    await screen.findByText("Option 1");

    userEvent.click(screen.getByText("Option 1"));

    await waitFor(() => {
      expect(mockOnSelect).toHaveBeenCalledWith("option1");
    });
  });
});
