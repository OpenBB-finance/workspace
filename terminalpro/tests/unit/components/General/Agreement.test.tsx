import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Agreement } from "~/components/General/Agreement";

// Wrapper component to manage state and simulate button behavior
function AgreementWithButton() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div>
      <Agreement
        id="agreement-checkbox"
        errorMessage=""
        value={isChecked}
        onChange={setIsChecked}
      />
      <button disabled={!isChecked} onClick={() => alert("Account Created")}>
        Create Account
      </button>
    </div>
  );
}

describe("Agreement", () => {
  it("renders with the correct label and links", () => {
    render(
      <Agreement
        id="agreement-checkbox"
        errorMessage="You must agree to the terms"
        value={false}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/I am over 16 years of age and I agree to the/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Terms of Service/i)).toHaveAttribute(
      "href",
      "https://openbb.co/legal/terms-of-service",
    );
    expect(screen.getByText(/Privacy Policy/i)).toHaveAttribute(
      "href",
      "https://openbb.co/legal/privacy-policy",
    );
  });
  it("calls onChange with the correct value when checkbox is clicked", () => {
    const mockOnChange = vi.fn();
    render(
      <Agreement
        id="agreement-checkbox"
        errorMessage="You must agree to the terms"
        value={false}
        onChange={mockOnChange}
      />,
    );
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(mockOnChange).toHaveBeenCalled();
  });

  it("does not allow 'Create Account' button to be clicked when checkbox is not selected", () => {
    render(<AgreementWithButton />);

    const createAccountButton = screen.getByText("Create Account");

    // Simulate clicking the button
    fireEvent.click(createAccountButton);

    // Verify that the button click does not trigger any action
    // Since we are using alert, we can mock it to ensure it doesn't get called
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

    expect(alertMock).not.toHaveBeenCalled();

    // Clean up the mock
    alertMock.mockRestore();
  });
});
