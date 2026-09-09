import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupLabel,
} from "~/components/ds/atoms/RadioGroup";

describe("RadioGroup", () => {
  it("renders labels correctly", () => {
    render(
      <RadioGroup>
        <RadioGroupLabel>Color Preference</RadioGroupLabel>
        <RadioGroupItem value="red" label="Red" />
        <RadioGroupItem value="blue" label="Blue" />
      </RadioGroup>,
    );

    expect(screen.getByText("Color Preference")).toBeInTheDocument();
    expect(screen.getByText("Red")).toBeInTheDocument();
    expect(screen.getByText("Blue")).toBeInTheDocument();
  });

  it("handles value change on item click", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <RadioGroup onValueChange={onValueChange}>
        <RadioGroupItem value="red" label="Red" />
        <RadioGroupItem value="blue" label="Blue" />
      </RadioGroup>,
    );

    const redItem = screen.getByLabelText("Red");
    await user.click(redItem);

    expect(onValueChange).toHaveBeenCalledWith("red");
  });

  it("disables items when disabled prop is provided", () => {
    render(
      <RadioGroup disabled={true}>
        <RadioGroupItem value="red" label="Red" />
      </RadioGroup>,
    );

    expect(screen.getByRole("radio")).toBeDisabled();
  });
});

vi.mock("@radix-ui/react-radio-group", () => {
  const React = require("react");
  const RadioContext = React.createContext({
    value: "",
    onValueChange: () => {},
    disabled: false,
  });

  return {
    Root: ({ children, value, onValueChange, className, disabled }: any) => (
      <RadioContext.Provider value={{ value, onValueChange, disabled: !!disabled }}>
        <div role="radiogroup" className={className}>
          {children}
        </div>
      </RadioContext.Provider>
    ),
    Item: ({ children, value, id, className, disabled: itemDisabled }: any) => {
      const { onValueChange, disabled: rootDisabled } = React.useContext(RadioContext);
      const disabled = rootDisabled || itemDisabled;
      return (
        <button
          role="radio"
          id={id}
          className={className}
          disabled={disabled}
          onClick={() => onValueChange(value)}
        >
          {children}
        </button>
      );
    },
    Indicator: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));

vi.mock("../utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
