import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { type Mock, describe, expect, it, vi } from "vitest";
import Avatar from "~/components/General/Avatar";

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  keepPreviousData: vi.fn(),
}));

describe("Avatar Component", () => {
  beforeEach(() => {
    // Scoped mocks
    vi.resetAllMocks();

    (useQuery as Mock).mockReturnValue({
      data: "data",
      isLoading: false,
      isError: false,
      error: null,
      status: "success",
      isSuccess: true,
    });
  });

  it("renders with default size and classes", () => {
    render(<Avatar src="https://example.com/avatar.png" alt="AAPL" />);
    const avatarRoot = screen.getByTestId("avatar");

    expect(avatarRoot).toHaveStyle({ width: "24px", height: "24px" });
    expect(avatarRoot).toHaveClass(
      "inline-flex",
      "items-center",
      "justify-center",
      "rounded-[2px]",
    );
  });

  it("merges custom classes with default classes", () => {
    render(
      <Avatar
        src="https://example.com/avatar.png"
        alt="User Avatar"
        extraClassName="custom-class"
      />,
    );
    const avatarRoot = screen.getByTestId("avatar");

    expect(avatarRoot).toHaveClass("custom-class");
  });

  it("applies the correct size and extra class name", () => {
    const src = "https://example.com/avatar.png";
    const alt = "User Avatar";
    const size = 48;
    const extraClassName = "custom-class";

    render(<Avatar src={src} alt={alt} size={size} extraClassName={extraClassName} />);
    const avatarRoot = screen.getByTestId("avatar");

    expect(avatarRoot).toHaveStyle({ width: `${size}px`, height: `${size}px` });
    expect(avatarRoot).toHaveClass(extraClassName);
  });
});
