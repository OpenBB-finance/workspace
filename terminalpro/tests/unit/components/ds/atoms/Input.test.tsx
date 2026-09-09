import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "~/components/ds/atoms/Input";

describe("Input", () => {
  it("renders with label and placeholder", () => {
    render(<Input label="Username" placeholder="Enter your name" />);
    expect(screen.getByText("Username")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });

  it("handles value changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);

    const input = screen.getByRole("textbox");
    await user.type(input, "hello");

    expect(onChange).toHaveBeenCalledWith("h"); // Called for each character usually
    expect(input).toHaveValue("hello");
  });

  it("is clearable when text is present", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input value="something" clearable={true} onChange={onChange} />);

    const buttons = screen.queryAllByRole("button");
    const clearButton = buttons[buttons.length - 1]; // Clear button is typically the last
    await user.click(clearButton);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("is revealable for password type", async () => {
    const user = userEvent.setup();
    const { container } = render(<Input type="password" value="secret" />);

    const input = container.querySelector("input")!;
    expect(input).toHaveAttribute("type", "password");

    // Use queryAllByRole and select the correct button, or a more specific query
    // Assuming the reveal button is the first (or only) button if clearable is false
    const revealButton = screen.queryAllByRole("button")[0];
    await user.click(revealButton);
    expect(input).toHaveAttribute("type", "text");

    await user.click(revealButton);
    expect(input).toHaveAttribute("type", "password");
  });

  it("shows error message and applies error state", () => {
    render(<Input error={true} message="Required field" />);
    expect(screen.getByText("Required field")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders prefix and suffix", () => {
    render(<Input prefix={<span>$</span>} suffix={<span>USD</span>} />);
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
  });
});

vi.mock("~/components/Icon", () => ({
  default: ({ id }: any) => <div data-testid={`icon-${id}`} />,
}));

vi.mock("./CopyButton", () => ({
  CopyButton: ({ text }: any) => <button data-testid="copy-button">Copy {text}</button>,
}));

// Mock molecules to avoid complex dependencies in unit test
vi.mock("../molecules/Form", () => ({
  FormControl: ({ children }: any) => <div>{children}</div>,
  FormItem: ({ children }: any) => <div>{children}</div>,
  FormLabel: ({ children }: any) => <label>{children}</label>,
  FormMessage: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("./Label", () => ({
  Label: ({ children }: any) => <div>{children}</div>,
  Message: ({ children }: any) => <div>{children}</div>,
}));
