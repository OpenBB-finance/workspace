import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "~/components/ds/atoms/Avatar";

describe("Avatar", () => {
  it("renders image when src is provided", () => {
    render(<Avatar src="https://example.com/avatar.png" alt="User Avatar" />);
    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(image).toHaveAttribute("alt", "User Avatar");
  });

  it("renders fallback when image fails or is not provided", () => {
    render(<Avatar fallback="JD" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("renders icon in fallback if no children provided", () => {
    render(<Avatar />);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("applies size classes to AvatarRoot", () => {
    const { rerender } = render(<Avatar size="xs" />);
    expect(screen.getByTestId("avatar-root")).toHaveClass("w-6");

    rerender(<Avatar size="lg" />);
    expect(screen.getByTestId("avatar-root")).toHaveClass("w-12");
  });
});

vi.mock("@radix-ui/react-avatar", () => ({
  Root: ({ children, className }: any) => (
    <div data-testid="avatar-root" className={className}>
      {children}
    </div>
  ),
  Image: ({ src, alt, className }: any) => (
    <img src={src} alt={alt} className={className} />
  ),
  Fallback: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));
