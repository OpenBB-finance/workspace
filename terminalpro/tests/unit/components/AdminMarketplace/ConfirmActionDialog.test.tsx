import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AdminApp } from "~/api/adminMarketplace.api";
import {
  ConfirmActionDialog,
  type ConfirmActionTarget,
} from "~/components/AdminMarketplace/ConfirmActionDialog";

function makeApp(overrides: Partial<AdminApp> = {}): AdminApp {
  return {
    id: "app-1",
    name: "Acme Markets",
    version: "2",
    is_built_in: false,
    last_fetch_status: "ok",
    ...overrides,
  } as AdminApp;
}

function renderDialog(target: ConfirmActionTarget | null, onConfirm = vi.fn()) {
  render(
    <ConfirmActionDialog
      target={target}
      isPending={false}
      onClose={vi.fn()}
      onConfirm={onConfirm}
    />,
  );
  return { onConfirm };
}

const REVERIFY_WARNING = /re-verify first/i;

describe("ConfirmActionDialog", () => {
  it("renders nothing without a target", () => {
    const { container } = render(
      <ConfirmActionDialog
        target={null}
        isPending={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the app and version when publishing", () => {
    renderDialog({ app: makeApp(), action: "publish" });
    expect(screen.getByText("Publish app")).toBeInTheDocument();
    expect(
      screen.getByText(/Publishing Acme Markets v2 makes it live/i),
    ).toBeInTheDocument();
  });

  it("warns that publishing auto-disables other published versions", () => {
    renderDialog({ app: makeApp(), action: "publish" });
    expect(
      screen.getByText(/auto-disable other published versions/i),
    ).toBeInTheDocument();
  });

  it("warns to re-verify when the last fetch errored on a non-built-in app", () => {
    renderDialog({ app: makeApp({ last_fetch_status: "error" }), action: "publish" });
    expect(screen.getByText(REVERIFY_WARNING)).toBeInTheDocument();
  });

  it("skips the re-verify warning for a built-in app, which has no backend to fetch", () => {
    renderDialog({
      app: makeApp({ last_fetch_status: "error", is_built_in: true }),
      action: "publish",
    });
    expect(screen.queryByText(REVERIFY_WARNING)).not.toBeInTheDocument();
  });

  it("skips the re-verify warning when the last fetch succeeded", () => {
    renderDialog({ app: makeApp({ last_fetch_status: "ok" }), action: "publish" });
    expect(screen.queryByText(REVERIFY_WARNING)).not.toBeInTheDocument();
  });

  it("shows the irreversible copy and no publish warnings when removing", () => {
    renderDialog({ app: makeApp({ last_fetch_status: "error" }), action: "remove" });
    expect(screen.getByText("Remove app")).toBeInTheDocument();
    expect(screen.getByText(/This can't be undone/i)).toBeInTheDocument();
    expect(screen.queryByText(REVERIFY_WARNING)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/auto-disable other published versions/i),
    ).not.toBeInTheDocument();
  });

  it("confirms the action", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ app: makeApp(), action: "publish" });
    await user.click(screen.getByRole("button", { name: "Publish" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
