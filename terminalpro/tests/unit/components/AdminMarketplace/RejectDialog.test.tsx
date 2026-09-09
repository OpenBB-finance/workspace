import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import { RejectDialog } from "~/components/AdminMarketplace/RejectDialog";

const app = { id: "app-1", name: "Acme Markets" } as AdminApp;

describe("RejectDialog", () => {
  it("keeps the confirm button disabled until a reason is entered", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RejectDialog
        app={app}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const rejectButton = screen.getByRole("button", { name: "Reject" });
    expect(rejectButton).toBeDisabled();

    await user.type(screen.getByRole("textbox"), "  Fix the manifest  ");
    expect(rejectButton).toBeEnabled();

    await user.click(rejectButton);
    expect(onConfirm).toHaveBeenCalledWith("Fix the manifest");
  });

  it("does not call onConfirm when the reason is only whitespace", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RejectDialog
        app={app}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.type(screen.getByRole("textbox"), "   ");
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
