import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DecimalDigitsRadio from "~/components/DecimalDigitsRadio";

describe("DecimalDigitsRadio", () => {
  it("renders with the correct label", () => {
    render(
      <DecimalDigitsRadio
        label="Test Label"
        decimalDigits={2}
        setDecimalDigits={vi.fn()}
      />,
    );

    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("selects the correct radio button based on decimalDigits", () => {
    render(<DecimalDigitsRadio decimalDigits={2} setDecimalDigits={vi.fn()} />);

    const selectedRadio = screen.getByTestId("decimal-digits-2");
    expect(selectedRadio).toBeChecked();
  });

  it("calls setDecimalDigits with the correct value when a radio button is selected", () => {
    const mockSetDecimalDigits = vi.fn();
    render(
      <DecimalDigitsRadio decimalDigits={2} setDecimalDigits={mockSetDecimalDigits} />,
    );

    const newRadio = screen.getByTestId("decimal-digits-3");
    fireEvent.click(newRadio);

    expect(mockSetDecimalDigits).toHaveBeenCalledWith(3);
  });
});
