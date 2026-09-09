import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Setup2FA from "~/routes/2fa";

describe("Setup2FA", () => {
  it("renders the 2FA setup page correctly", () => {
    render(<Setup2FA />);

    expect(screen.getByText(/set up two-factor authentication/i)).toBeInTheDocument();
  });

  it("displays the OpenBB logo", () => {
    render(<Setup2FA />);

    const logo = screen.getByAltText("OpenBB");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("src", "/assets/images/logo.svg");
  });

  it("displays the security requirement message", () => {
    render(<Setup2FA />);

    expect(
      screen.getByText(/Your company requires two-factor authentication/i),
    ).toBeInTheDocument();
  });

  it("displays Google Authenticator option", () => {
    render(<Setup2FA />);

    expect(screen.getByText("Google Authenticator")).toBeInTheDocument();
    expect(
      screen.getByText(/You need to install Google Authenticator/i),
    ).toBeInTheDocument();
  });

  it("displays the Google Authenticator logo", () => {
    render(<Setup2FA />);

    const authLogo = screen.getByAltText("Google Authenticator");
    expect(authLogo).toBeInTheDocument();
    expect(authLogo).toHaveAttribute("src", "/assets/logos/google-authenticator.svg");
  });

  it("renders the Set Up button", () => {
    render(<Setup2FA />);

    const button = screen.getByRole("button", { name: /set up/i });
    expect(button).toBeInTheDocument();
  });
});
