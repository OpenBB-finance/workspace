import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ColorPicker } from "~/components/ds/molecules/ColorPicker";

describe("ColorPicker", () => {
  describe("Rendering", () => {
    it("renders with the provided value", () => {
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue("#FF0000");
    });

    it("renders with default white color when no value provided", () => {
      render(<ColorPicker value="" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("#FFFFFF");
    });

    it("converts value to uppercase", () => {
      render(<ColorPicker value="#ff00aa" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("#FF00AA");
    });

    it("renders color preview box with correct background color", () => {
      const { container } = render(
        <ColorPicker value="#00FF00" onChange={vi.fn()} />,
      );

      const colorBox = container.querySelector(
        ".w-4.h-4.rounded",
      ) as HTMLElement;
      expect(colorBox).toBeInTheDocument();
      expect(colorBox).toHaveStyle({ backgroundColor: "#00FF00" });
    });

    it("applies custom className", () => {
      const { container } = render(
        <ColorPicker
          value="#FF0000"
          onChange={vi.fn()}
          className="custom-class"
        />,
      );

      const wrapper = container.querySelector(".custom-class");
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe("Disabled State", () => {
    it("renders as disabled when disabled prop is true", () => {
      const { container } = render(
        <ColorPicker value="#FF0000" onChange={vi.fn()} disabled />,
      );

      const colorBox = container.querySelector(
        ".w-4.h-4.rounded",
      ) as HTMLElement;
      expect(colorBox).toHaveClass("opacity-50", "cursor-not-allowed");
    });
  });

  describe("User Interactions", () => {
    it("calls onChange when input value changes", async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<ColorPicker value="#FF0000" onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "#00FF00");

      expect(handleChange).toHaveBeenCalled();
    });

    it("opens color picker popover on focus", async () => {
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      await waitFor(() => {
        const colorPickerElement =
          document.querySelector(".react-colorful");
        expect(colorPickerElement).toBeInTheDocument();
      });
    });

    it("closes color picker on Tab key press", async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      await waitFor(() => {
        expect(document.querySelector(".react-colorful")).toBeInTheDocument();
      });

      await user.keyboard("{Tab}");

      await waitFor(() => {
        expect(
          document.querySelector(".react-colorful"),
        ).not.toBeInTheDocument();
      });
    });

    it("closes color picker on Escape key press", async () => {
      const user = userEvent.setup();
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      await waitFor(() => {
        expect(document.querySelector(".react-colorful")).toBeInTheDocument();
      });

      await user.keyboard("{Escape}");

      await waitFor(() => {
        expect(
          document.querySelector(".react-colorful"),
        ).not.toBeInTheDocument();
      });
    });

    it("calls onBlur when input loses focus", async () => {
      const handleBlur = vi.fn();
      render(
        <ColorPicker value="#FF0000" onChange={vi.fn()} onBlur={handleBlur} />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalled();
    });

    it("stops click propagation on color box click", async () => {
      const handleClick = vi.fn();
      const { container } = render(
        <div onClick={handleClick}>
          <ColorPicker value="#FF0000" onChange={vi.fn()} />
        </div>,
      );

      const colorBox = container.querySelector(
        ".w-4.h-4.rounded",
      ) as HTMLElement;
      fireEvent.click(colorBox);

      expect(handleClick).not.toHaveBeenCalled();
    });

    it("focuses the input when color box is clicked (when not disabled)", () => {
      const { container } = render(
        <ColorPicker value="#FF0000" onChange={vi.fn()} />,
      );

      const input = screen.getByRole("textbox");
      const colorBox = container.querySelector(
        ".w-4.h-4.rounded",
      ) as HTMLElement;

      fireEvent.click(colorBox);

      expect(document.activeElement).toBe(input);
    });
  });

  describe("Input Constraints", () => {
    it("has maxLength of 7 characters", () => {
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("maxLength", "7");
    });
  });

  describe("Clearable Feature", () => {
    it("renders clearable input when clearable prop is true", () => {
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} clearable />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to input element", () => {
      const ref = { current: null };
      render(<ColorPicker value="#FF0000" onChange={vi.fn()} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("updates ref value when value changes", () => {
      const ref = { current: null } as { current: HTMLInputElement | null };
      const { rerender } = render(
        <ColorPicker value="#FF0000" onChange={vi.fn()} ref={ref} />,
      );

      expect(ref.current?.value).toBe("#FF0000");

      rerender(<ColorPicker value="#00FF00" onChange={vi.fn()} ref={ref} />);

      expect(ref.current?.value).toBe("#00FF00");
    });
  });
});
