import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "~/components/ds/atoms/Switch";

describe("Switch", () => {
  it("renders correctly with label", () => {
    render(<Switch label="Enable notifications" />);
    expect(screen.getByText("Enable notifications")).toBeInTheDocument();
  });

  it("handles change events", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch onCheckedChange={onCheckedChange} />);

    const switchRoot = screen.getByRole("switch");
    await user.click(switchRoot);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is disabled when disabled prop is provided", () => {
    render(<Switch disabled={true} label="Disabled switch" />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

vi.mock("@radix-ui/react-switch", () => {
  const React = require("react");
  return {
    Root: ({
      children,
      onCheckedChange,
      checked: controlledChecked,
      className,
      id,
      disabled,
    }: any) => {
      const [internalChecked, setInternalChecked] = React.useState(false);
      const checked =
        controlledChecked !== undefined ? controlledChecked : internalChecked;
      return (
        <button
          role="switch"
          aria-checked={checked}
          id={id}
          className={className}
          disabled={disabled}
          onClick={() => {
            const next = !checked;
            if (controlledChecked === undefined) setInternalChecked(next);
            onCheckedChange?.(next);
          }}
        >
          {children}
        </button>
      );
    },
    Thumb: ({ className }: any) => <div className={className} />,
  };
});

vi.mock("../utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
