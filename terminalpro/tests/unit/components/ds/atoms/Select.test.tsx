import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "~/components/ds/atoms/Select";

describe("Select", () => {
  const options = [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
  ];

  it("renders with placeholder and options", () => {
    render(<Select options={options} placeholder="Select an option" />);
    expect(screen.getByText("Select an option")).toBeInTheDocument();
  });

  it("handles value change", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} placeholder="Select" />);

    // Open the select
    const trigger = screen.getByText("Select");
    await user.click(trigger);

    // Select an option
    const option1 = screen.getByText("Option 1");
    await user.click(option1);

    expect(onChange).toHaveBeenCalledWith("opt1");
  });

  it("applies force-light class on SelectContent when forceLight is true", async () => {
    const user = userEvent.setup();
    render(<Select options={options} placeholder="Select" forceLight={true} />);

    const trigger = screen.getByText("Select");
    await user.click(trigger);

    const contentEl = document.querySelector(".force-light");
    expect(contentEl).toBeInTheDocument();
  });

  it("renders grouped options", async () => {
    const groupedOptions = [
      { label: "Group 1", options: ["A", "B"] },
      { label: "Group 2", options: ["C"] },
    ];
    render(<Select options={groupedOptions} placeholder="Select" />);

    const trigger = screen.getByText("Select");
    fireEvent.click(trigger);

    expect(screen.getByText("Group 1")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });
});

vi.mock("@radix-ui/react-select", () => {
  const React = require("react");
  const SelectContext = React.createContext({
    open: false,
    setOpen: () => {},
    value: "",
    onValueChange: () => {},
  });

  return {
    Root: ({
      children,
      onValueChange,
      value,
      open: controlledOpen,
      onOpenChange,
    }: any) => {
      const [internalOpen, setInternalOpen] = React.useState(false);
      const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
      const setOpen = onOpenChange || setInternalOpen;
      return (
        <SelectContext.Provider value={{ open, setOpen, value, onValueChange }}>
          {children}
        </SelectContext.Provider>
      );
    },
    Trigger: ({ children, className }: any) => {
      const { setOpen } = React.useContext(SelectContext);
      return (
        <button onClick={() => setOpen(true)} className={className}>
          {children}
        </button>
      );
    },
    Value: ({ placeholder }: any) => {
      const { value } = React.useContext(SelectContext);
      return <span>{value || placeholder}</span>;
    },
    Portal: ({ children }: any) => {
      const { open } = React.useContext(SelectContext);
      return open ? <>{children}</> : null;
    },
    Content: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    Viewport: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    Item: ({ children, value, className }: any) => {
      const { onValueChange, setOpen } = React.useContext(SelectContext);
      return (
        <div
          onClick={() => {
            onValueChange(value);
            setOpen(false);
          }}
          className={className}
        >
          {children}
        </div>
      );
    },
    ItemText: ({ children }: any) => <span>{children}</span>,
    Indicator: ({ children }: any) => <div>{children}</div>,
    Group: ({ children }: any) => <div>{children}</div>,
    Label: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    Icon: ({ children }: any) => <div>{children}</div>,
    ItemIndicator: ({ children }: any) => <div>{children}</div>,
    Separator: ({ className }: any) => <div className={className} />,
    ScrollUpButton: () => null,
    ScrollDownButton: () => null,
  };
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));

vi.mock("./DropdownMenu", () => ({
  DropdownMenuContentVariants: () => "mock-content-variants",
  DropdownMenuItemVariants: () => "mock-item-variants",
}));

vi.mock("./Label", () => ({
  Label: ({ children }: any) => <div>{children}</div>,
  Message: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("../molecules/Form", () => ({
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormMessage: ({ children }: any) => <div>{children}</div>,
}));
