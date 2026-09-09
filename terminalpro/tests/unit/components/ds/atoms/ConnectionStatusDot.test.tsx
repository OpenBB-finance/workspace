import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConnectionStatusDot } from "~/components/ds/atoms/ConnectionStatusDot";

vi.mock("~/components/Icon", () => ({
  default: ({ id, className }: { id: string; className?: string }) => (
    <span data-testid={`icon-${id}`} className={className} />
  ),
}));

describe("ConnectionStatusDot", () => {
  it("renders a spinner for the pending status", () => {
    render(<ConnectionStatusDot status="pending" />);

    const spinner = screen.getByTestId("icon-mdi-loading");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("animate-spin");
    expect(spinner).toHaveClass("text-link-color");
  });

  it("renders a success dot for the connected status", () => {
    const { container } = render(<ConnectionStatusDot status="connected" />);
    expect(container.querySelector(".bg-alert-success")).toBeTruthy();
  });

  it("renders an error dot for the error status", () => {
    const { container } = render(<ConnectionStatusDot status="error" />);
    expect(container.querySelector(".bg-alert-error")).toBeTruthy();
  });

  it("renders a muted dot for the disconnected status", () => {
    const { container } = render(<ConnectionStatusDot status="disconnected" />);
    expect(container.querySelector(".bg-general-border-primary")).toBeTruthy();
  });

  it("renders an amber dot for the warning status", () => {
    const { container } = render(<ConnectionStatusDot status="warning" />);
    expect(container.querySelector(".bg-alert-warning")).toBeTruthy();
  });

  it("renders a blue dot and a spinner for the connecting status", () => {
    const { container } = render(<ConnectionStatusDot status="connecting" />);
    expect(container.querySelector(".bg-alert-informative")).toBeTruthy();
    expect(screen.getByTestId("icon-mdi-loading")).toBeInTheDocument();
  });

  it("renders an optional label next to the indicator", () => {
    render(<ConnectionStatusDot status="pending" label="Connecting…" />);
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
  });

  it("keeps the label muted by default", () => {
    const { container } = render(
      <ConnectionStatusDot status="connected" label="Connected" />,
    );
    expect(container.querySelector(".text-ds-text-caption")).toBeTruthy();
    expect(container.querySelector(".bg-alert-success")).toBeTruthy();
  });

  it("tints the dot and label one color when coloredLabel is set", () => {
    const { container } = render(
      <ConnectionStatusDot status="connected" label="Connected" coloredLabel />,
    );
    // wrapper carries the status text color; the dot inherits it via currentColor
    expect(container.querySelector(".text-alert-success")).toBeTruthy();
    expect(container.querySelector(".bg-current")).toBeTruthy();
    // label no longer uses the muted caption color
    expect(container.querySelector(".text-ds-text-caption")).toBeFalsy();
  });
});
