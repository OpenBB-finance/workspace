import { render, screen } from "@testing-library/react";
import { OTPInputContext } from "input-otp";
import { describe, expect, it } from "vitest";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "~/components/ui/input-otp";

describe("InputOTP", () => {
  it("renders InputOTP correctly", () => {
    const { container } = render(
      <InputOTP maxLength={6}>
        <InputOTPGroup>
          <InputOTPSlot index={0} />
        </InputOTPGroup>
      </InputOTP>,
    );
    expect(container.querySelector('[data-slot="input-otp"]')).toBeInTheDocument();
  });

  it("renders InputOTPGroup correctly", () => {
    const { container } = render(<InputOTPGroup>Test</InputOTPGroup>);
    expect(
      container.querySelector('[data-slot="input-otp-group"]'),
    ).toBeInTheDocument();
  });

  it("renders InputOTPSlot correctly", () => {
    const mockContext = {
      slots: [{ char: "1", hasFakeCaret: false, isActive: true }],
    };

    const { container } = render(
      <OTPInputContext.Provider value={mockContext as any}>
        <InputOTPSlot index={0} />
      </OTPInputContext.Provider>,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="input-otp-slot"]')).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("renders InputOTPSeparator correctly", () => {
    render(<InputOTPSeparator />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});
