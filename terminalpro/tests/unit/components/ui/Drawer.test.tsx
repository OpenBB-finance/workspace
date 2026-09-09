import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/Drawer";

describe("Drawer", () => {
  it("renders trigger and opens content", async () => {
    render(
      <Drawer>
        <DrawerTrigger>Open Drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Title</DrawerTitle>
            <DrawerDescription>Description</DrawerDescription>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>,
    );

    const trigger = screen.getByText("Open Drawer");
    fireEvent.click(trigger);

    expect(await screen.findByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});

vi.mock("vaul", () => {
  const React = require("react");
  const DrawerContext = React.createContext({ open: false, setOpen: () => {} });

  return {
    Drawer: {
      Root: ({ children }: any) => {
        const [open, setOpen] = React.useState(false);
        return (
          <DrawerContext.Provider value={{ open, setOpen }}>
            {children}
          </DrawerContext.Provider>
        );
      },
      Trigger: ({ children, asChild }: any) => {
        const { setOpen } = React.useContext(DrawerContext);
        if (asChild && React.isValidElement(children)) {
          return React.cloneElement(children as any, { onClick: () => setOpen(true) });
        }
        return <button onClick={() => setOpen(true)}>{children}</button>;
      },
      Portal: ({ children }: any) => {
        const { open } = React.useContext(DrawerContext);
        return open ? <>{children}</> : null;
      },
      Overlay: () => <div data-testid="drawer-overlay" />,
      Content: ({ children, className }: any) => (
        <div data-testid="drawer-content" className={className}>
          {children}
        </div>
      ),
      Title: ({ children }: any) => <h2>{children}</h2>,
      Description: ({ children }: any) => <p>{children}</p>,
      Close: ({ children }: any) => {
        const { setOpen } = React.useContext(DrawerContext);
        return <button onClick={() => setOpen(false)}>{children}</button>;
      },
    },
  };
});
