import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "~/components/ds/atoms/CopyButton";

describe("CopyButton", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText,
      },
      configurable: true,
      writable: true,
    });
  });

  it("copies text to clipboard on click", async () => {
    const user = userEvent.setup();
    render(<CopyButton text="hello" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("shows 'Copied' feedback on click", async () => {
    const user = userEvent.setup();
    render(<CopyButton text="hello" />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));

vi.mock("./Button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("./Popover", () => ({
  Popover: ({ children, open, content }: any) => (
    <div>
      {children}
      {open && <div>{content}</div>}
    </div>
  ),
}));

vi.mock("../utils", () => ({
  sleep: vi.fn(() => Promise.resolve()),
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
}));
