import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/ContextMenu";

describe("ContextMenu", () => {
  it("renders trigger and opens content on right click", () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Right click me</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Item 1</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    );

    const trigger = screen.getByText("Right click me");
    fireEvent.contextMenu(trigger);

    expect(screen.getByText("Item 1")).toBeInTheDocument();
  });
});

vi.mock("@radix-ui/react-context-menu", () => {
  const React = require("react");
  return {
    Root: ({ children }: any) => {
      const [open, setOpen] = React.useState(false);
      return (
        <div onContextMenu={() => setOpen(true)}>
          {React.Children.map(children, (child: any) => {
            if (child.type.displayName === "ContextMenuContent") {
              return open ? child : null;
            }
            return child;
          })}
        </div>
      );
    },
    Trigger: ({ children }: any) => <div data-testid="trigger">{children}</div>,
    Portal: ({ children }: any) => <>{children}</>,
    Content: ({ children }: any) => <div data-testid="content">{children}</div>,
    Item: ({ children }: any) => <div data-testid="item">{children}</div>,
    Group: ({ children }: any) => <div>{children}</div>,
    Sub: ({ children }: any) => <div>{children}</div>,
    RadioGroup: ({ children }: any) => <div>{children}</div>,
    SubTrigger: ({ children }: any) => <div>{children}</div>,
    SubContent: ({ children }: any) => <div>{children}</div>,
    CheckboxItem: ({ children }: any) => <div>{children}</div>,
    RadioItem: ({ children }: any) => <div>{children}</div>,
    Label: ({ children }: any) => <div>{children}</div>,
    ItemIndicator: ({ children }: any) => <div>{children}</div>,
    Separator: () => <div />,
  };
});
