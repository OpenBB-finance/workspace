import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { HintLabel } from "~/components/ds/atoms/HintLabel";

vi.mock("~/components/Tooltip", () => ({
  __esModule: true,
  default: ({
    message,
    className,
    children,
  }: {
    message: React.ReactNode;
    className?: string;
    children: React.ReactNode;
  }) => (
    <div
      data-testid="tooltip"
      data-message={typeof message === "string" ? message : undefined}
      data-classname={className}
    >
      {children}
    </div>
  ),
}));

describe("HintLabel", () => {
  it("renders children text", () => {
    render(<HintLabel tooltip="hint">Global data</HintLabel>);
    expect(screen.getByText("Global data")).toBeInTheDocument();
  });

  it("passes tooltip string to Tooltip message", () => {
    render(<HintLabel tooltip="Some helpful hint">Label</HintLabel>);
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute("data-message", "Some helpful hint");
  });

  it("passes tooltipClassName to Tooltip className", () => {
    render(
      <HintLabel tooltip="hint" tooltipClassName="max-w-[280px]">
        Label
      </HintLabel>,
    );
    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toHaveAttribute("data-classname", "max-w-[280px]");
  });

  it("applies enabled styling by default", () => {
    render(<HintLabel tooltip="hint">Enabled label</HintLabel>);
    const span = screen.getByText("Enabled label");
    expect(span).toHaveClass("select-none");
    expect(span).toHaveClass("underline");
    expect(span).toHaveClass("decoration-dotted");
    expect(span).toHaveClass("text-general-label");
  });

  it("applies disabled styling when disabled is true", () => {
    render(
      <HintLabel tooltip="hint" disabled={true}>
        Disabled label
      </HintLabel>,
    );
    const span = screen.getByText("Disabled label");
    expect(span).toHaveClass("select-none");
    expect(span).toHaveClass("text-general-label-disabled");
    expect(span).not.toHaveClass("underline");
    expect(span).not.toHaveClass("decoration-dotted");
  });

  it("merges custom className", () => {
    render(
      <HintLabel tooltip="hint" className="my-custom-class">
        Label
      </HintLabel>,
    );
    const span = screen.getByText("Label");
    expect(span).toHaveClass("my-custom-class");
    expect(span).toHaveClass("select-none");
  });

  it("forwards ref to the inner span", () => {
    const ref = createRef<HTMLSpanElement>();
    render(
      <HintLabel ref={ref} tooltip="hint">
        Ref label
      </HintLabel>,
    );
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current?.textContent).toBe("Ref label");
  });
});
