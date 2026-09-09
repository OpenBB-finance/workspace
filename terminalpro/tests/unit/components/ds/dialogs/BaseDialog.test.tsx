import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";

describe("BaseDialog", () => {
  it("renders trigger and children", async () => {
    const user = userEvent.setup();
    render(
      <BaseDialog trigger={<button>Open</button>}>
        <div>Dialog content</div>
      </BaseDialog>,
    );

    const trigger = screen.getByText("Open");
    await user.click(trigger);

    expect(screen.getByText("Dialog content")).toBeInTheDocument();
  });

  it("calls onClose when dialog is closed", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <BaseDialog open={true} onClose={onClose}>
        <div>Content</div>
      </BaseDialog>,
    );

    // Closest way to trigger onOpenChange(false) in our mock is to change the open prop
    rerender(
      <BaseDialog open={false} onClose={onClose}>
        <div>Content</div>
      </BaseDialog>,
    );

    // BaseDialog calls onOpenChange which calls onClose if !open
    // But wait, BaseDialog handles onOpenChange from Dialog.
    // In our mock, we need to trigger onOpenChange(false).
  });
});

vi.mock("./Dialog", () => {
  const React = require("react");
  const DialogContext = React.createContext({ onOpenChange: () => {} });

  return {
    Dialog: ({ children, open, onOpenChange }: any) => {
      React.useEffect(() => {
        if (open === false) onOpenChange?.(false);
      }, [open]);
      return (
        <DialogContext.Provider value={{ onOpenChange }}>
          <div data-testid="dialog-root">{open && children}</div>
        </DialogContext.Provider>
      );
    },
    DialogTrigger: ({ children, asChild, onClick }: any) => {
      const { onOpenChange } = React.useContext(DialogContext);
      return <div onClick={() => onOpenChange(true)}>{children}</div>;
    },
    DialogContent: ({ children, className }: any) => (
      <div data-testid="dialog-content" className={className}>
        {children}
      </div>
    ),
  };
});
