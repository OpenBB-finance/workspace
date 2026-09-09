import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Label, Message } from "~/components/ds/atoms/Label";

describe("Label and Message", () => {
  describe("Label", () => {
    it("renders correctly with children", () => {
      render(<Label>Username</Label>);
      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("does not render with no children", () => {
      const { container } = render(<Label />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("Message", () => {
    it("renders correctly with children", () => {
      render(<Message>Hint text</Message>);
      expect(screen.getByText("Hint text")).toBeInTheDocument();
    });

    it("applies error styles when error prop is true", () => {
      render(<Message error={true}>Error text</Message>);
      const message = screen.getByText("Error text");
      expect(message).toHaveClass("text-alert-error");
    });

    it("does not render with no children", () => {
      const { container } = render(<Message />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

vi.mock("@radix-ui/react-label", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, className, ...props }: any, ref: any) => (
      <label ref={ref} className={className} {...props}>
        {children}
      </label>
    )),
  };
});
