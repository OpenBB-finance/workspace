import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FontFamilyInput } from "~/components/ds/atoms/FontFamilyInput";

describe("FontFamilyInput", () => {
  it("renders with initial value", () => {
    render(<FontFamilyInput value="Inter" onChange={() => {}} />);
    expect(screen.getByText("Inter")).toBeInTheDocument();
  });

  it("calls onChange when a new font is selected", () => {
    const onChange = vi.fn();
    render(<FontFamilyInput value="Inter" onChange={onChange} />);

    // Simulate picking Inter and changing it (mock implementation below)
    fireEvent.click(screen.getByText("Inter")); // Trigger open if mocked
    fireEvent.click(screen.getByText("Roboto"));

    expect(onChange).toHaveBeenCalledWith("Roboto");
  });

  it("converts 'unchanged' to empty string", () => {
    const onChange = vi.fn();
    render(<FontFamilyInput value="Inter" onChange={onChange} />);

    fireEvent.click(screen.getByText("Unchanged"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

vi.mock("~/components/ds/atoms/Select", () => {
  const React = require("react");
  const SelectContext = React.createContext({ onValueChange: () => {} });
  return {
    SelectRoot: ({ children, onValueChange }: any) => {
      return (
        <SelectContext.Provider value={{ onValueChange }}>
          <div data-testid="select-root">{children}</div>
        </SelectContext.Provider>
      );
    },
    SelectTrigger: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    SelectValue: ({ placeholder, style }: any) => (
      <div style={style}>{placeholder}</div>
    ),
    SelectContent: ({ children }: any) => (
      <div data-testid="select-content">{children}</div>
    ),
    SelectItem: ({ children, value }: any) => {
      const { onValueChange } = React.useContext(SelectContext);
      return (
        <div onClick={() => onValueChange(value)} data-value={value}>
          {children}
        </div>
      );
    },
  };
});

vi.mock("~/components/ds/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
