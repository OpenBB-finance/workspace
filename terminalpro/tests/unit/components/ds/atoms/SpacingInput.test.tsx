import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpacingInput } from "~/components/ds/atoms/SpacingInput";

describe("SpacingInput", () => {
  it("parses initial value correctly", () => {
    render(<SpacingInput value="10px" onChange={() => {}} />);
    expect(screen.getByTestId("mock-input")).toHaveValue("10");
    expect(screen.getByTestId("mock-select")).toHaveValue("px");
  });

  it("calls onChange when number changes", async () => {
    const onChange = vi.fn();
    render(<SpacingInput value="10px" onChange={onChange} />);

    const input = screen.getByTestId("mock-input");
    fireEvent.change(input, { target: { value: "20" } });

    expect(onChange).toHaveBeenCalledWith("20px");
  });

  it("calls onChange when unit changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SpacingInput value="10px" onChange={onChange} />);

    const select = screen.getByTestId("mock-select");
    fireEvent.change(select, { target: { value: "rem" } });

    expect(onChange).toHaveBeenCalledWith("10rem");
  });
});

vi.mock("~/components/ds/atoms/Input", () => ({
  Input: ({ value, onChange, className }: any) => (
    <input
      data-testid="mock-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  ),
}));

vi.mock("~/components/ds/atoms/Select", () => ({
  Select: ({ value, onValueChange, className }: any) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      className={className}
    >
      <option value="px">px</option>
      <option value="rem">rem</option>
    </select>
  ),
}));

vi.mock("../utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
