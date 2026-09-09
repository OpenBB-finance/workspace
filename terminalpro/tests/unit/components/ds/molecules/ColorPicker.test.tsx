import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker } from "~/components/ds/molecules/ColorPicker";

// Mock react-colorful
vi.mock("react-colorful", () => ({
  HexColorPicker: ({ color, onChange }: any) => (
    <div data-testid="hex-color-picker">
      <button onClick={() => onChange("#000000")}>Select Black</button>
    </div>
  ),
}));

describe("ColorPicker Molecule", () => {
  it("renders with initial value", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF0000" onChange={onChange} />);

    const input = screen.getByDisplayValue("#FF0000");
    expect(input).toBeInTheDocument();
  });

  it("opens picker on focus", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF0000" onChange={onChange} />);

    const input = screen.getByDisplayValue("#FF0000");
    fireEvent.focus(input);

    expect(screen.getByTestId("hex-color-picker")).toBeInTheDocument();
  });

  it("calls onChange when a color is selected in picker", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF0000" onChange={onChange} />);

    const input = screen.getByDisplayValue("#FF0000");
    fireEvent.focus(input);

    fireEvent.click(screen.getByText("Select Black"));
    expect(onChange).toHaveBeenCalledWith("#000000");
  });

  it("calls onChange when typing in input", () => {
    const onChange = vi.fn();
    render(<ColorPicker value="#FF0000" onChange={onChange} />);

    const input = screen.getByDisplayValue("#FF0000");
    fireEvent.change(input, { target: { value: "#123456" } });

    expect(onChange).toHaveBeenCalled();
  });
});
