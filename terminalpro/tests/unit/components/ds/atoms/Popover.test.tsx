import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Popover } from "~/components/ds/atoms/Popover";

describe("Popover", () => {
  it("renders trigger and shows content on click", async () => {
    render(
      <Popover content="Popover content">
        <button>Click me</button>
      </Popover>,
    );

    const trigger = screen.getByText("Click me");
    fireEvent.click(trigger);

    expect(screen.getByText("Popover content")).toBeInTheDocument();
  });

  it("handles controlled open state", () => {
    const { rerender } = render(
      <Popover open={false} content="Hidden content">
        <button>Click me</button>
      </Popover>,
    );
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument();

    rerender(
      <Popover open={true} content="Visible content">
        <button>Click me</button>
      </Popover>,
    );
    expect(screen.getByText("Visible content")).toBeInTheDocument();
  });
});

vi.mock("@radix-ui/react-popover", () => {
  const React = require("react");
  const PopoverContext = React.createContext({ open: false, setOpen: () => {} });

  return {
    Root: ({ children, open: controlledOpen, onOpenChange }: any) => {
      const [internalOpen, setInternalOpen] = React.useState(false);
      const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
      const setOpen = onOpenChange || setInternalOpen;
      return (
        <PopoverContext.Provider value={{ open, setOpen }}>
          {children}
        </PopoverContext.Provider>
      );
    },
    Trigger: ({ children, asChild }: any) => {
      const { setOpen } = React.useContext(PopoverContext);
      return <div onClick={() => setOpen(true)}>{children}</div>;
    },
    Portal: ({ children }: any) => {
      const { open } = React.useContext(PopoverContext);
      return open ? <>{children}</> : null;
    },
    Content: React.forwardRef(({ children, className }: any, ref: any) => (
      <div ref={ref} className={className}>
        {children}
      </div>
    )),
    Arrow: () => <div data-testid="popover-arrow" />,
    Close: ({ children }: any) => <button>{children}</button>,
  };
});

vi.mock("./DropdownMenu", () => ({
  DropdownMenuContentVariants: () => "mock-dropdown-variants",
}));

vi.mock("../utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
