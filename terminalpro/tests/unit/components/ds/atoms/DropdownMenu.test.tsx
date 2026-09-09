import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ds/atoms/DropdownMenu";

describe("DropdownMenu", () => {
  it("renders trigger and opens content on click", async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByText("Open Menu");
    fireEvent.click(trigger);

    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });
});

vi.mock("@radix-ui/react-dropdown-menu", () => {
  const React = require("react");
  const DropdownContext = React.createContext({ open: false, setOpen: () => {} });

  return {
    Root: ({ children }: any) => {
      const [open, setOpen] = React.useState(false);
      return (
        <DropdownContext.Provider value={{ open, setOpen }}>
          {children}
        </DropdownContext.Provider>
      );
    },
    Trigger: ({ children, asChild }: any) => {
      const { setOpen } = React.useContext(DropdownContext);
      return (
        <div data-testid="trigger" onClick={() => setOpen(true)}>
          {children}
        </div>
      );
    },
    Portal: ({ children }: any) => {
      const { open } = React.useContext(DropdownContext);
      return open ? <>{children}</> : null;
    },
    Content: ({ children, className }: any) => (
      <div data-testid="content" className={className}>
        {children}
      </div>
    ),
    Item: ({ children, className, onClick }: any) => (
      <div data-testid="item" className={className} onClick={onClick}>
        {children}
      </div>
    ),
    Group: ({ children }: any) => <div>{children}</div>,
    Sub: ({ children }: any) => <div>{children}</div>,
    RadioGroup: ({ children }: any) => <div>{children}</div>,
    SubTrigger: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    SubContent: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    CheckboxItem: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    RadioItem: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    Label: ({ children, className }: any) => (
      <div className={className}>{children}</div>
    ),
    Separator: ({ className }: any) => <div className={className} />,
    ItemIndicator: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));
