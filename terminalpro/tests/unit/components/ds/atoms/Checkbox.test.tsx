import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "~/components/ds/atoms/Checkbox";

describe("Checkbox", () => {
  it("renders correctly with label", () => {
    render(<Checkbox label="Keep me logged in" />);
    expect(screen.getByText("Keep me logged in")).toBeInTheDocument();
  });

  it("handles change events", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Checkbox label="Accept terms" onCheckedChange={onCheckedChange} />);

    // In JSDOM with Radix, we might need to click the checkbox root
    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Checkbox disabled={true} label="Disabled" />);
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("links label to checkbox via id", () => {
    render(<Checkbox label="Linked label" />);
    const checkbox = screen.getByRole("checkbox");
    const label = screen.getByText("Linked label");
    expect(label).toHaveAttribute("for", checkbox.id);
  });
});

vi.mock("~/components/Icon", () => ({
  default: () => <div data-testid="icon" />,
}));
