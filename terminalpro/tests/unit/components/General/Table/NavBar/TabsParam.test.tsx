import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { TabsParam } from "~/components/General/Table/NavBar/TabsParam";

describe("TabsParam", () => {
  const mockOptions = [
    { label: "Option 1", value: "option1" },
    { label: "Option 2", value: "option2" },
    { label: "Option 3", value: "option3" },
  ];

  describe("Basic rendering", () => {
    it("renders all options", () => {
      render(
        <TabsParam value="option1" options={mockOptions} onValueChange={vi.fn()} />,
      );

      expect(screen.getByText("Option 1")).toBeInTheDocument();
      expect(screen.getByText("Option 2")).toBeInTheDocument();
      expect(screen.getByText("Option 3")).toBeInTheDocument();
    });

    it("shows the selected value", () => {
      render(
        <TabsParam value="option2" options={mockOptions} onValueChange={vi.fn()} />,
      );

      const selectedOption = screen.getByText("Option 2");
      // Radix UI uses data-state="on" for selected items
      expect(selectedOption.closest('[data-state="on"]')).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("calls onValueChange when an option is clicked", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <TabsParam
          value="option1"
          options={mockOptions}
          onValueChange={handleValueChange}
        />,
      );

      await user.click(screen.getByText("Option 2"));

      expect(handleValueChange).toHaveBeenCalledWith("option2");
      expect(handleValueChange).toHaveBeenCalledTimes(1);
    });

    it("does not call onValueChange when undefined is passed (same option clicked)", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <TabsParam
          value="option1"
          options={mockOptions}
          onValueChange={handleValueChange}
        />,
      );

      // Click the already selected option - Radix ToggleGroup returns undefined for this
      await user.click(screen.getByText("Option 1"));

      // Should not call onValueChange because the guard (v && onValueChange(v)) prevents it
      expect(handleValueChange).not.toHaveBeenCalled();
    });
  });

  describe("Tooltip support", () => {
    it("renders tooltip when toolTipMessage is provided", async () => {
      const user = userEvent.setup();
      const tooltipMessage = (
        <div>
          <div>Ratio Category</div>
          <div>Select the financial ratio category</div>
        </div>
      );

      render(
        <TabsParam
          value="option1"
          options={mockOptions}
          onValueChange={vi.fn()}
          toolTipMessage={tooltipMessage}
        />,
      );

      // Find the toggle group (Radix UI uses role="group")
      const toggleGroup = screen.getByRole("group");
      expect(toggleGroup).toBeInTheDocument();

      // Hover over the toggle group to trigger tooltip
      await user.hover(toggleGroup);

      // Wait for tooltip to appear (with delay)
      // Note: Radix renders tooltip content twice (once visible, once for a11y)
      await waitFor(
        () => {
          const tooltipElements = screen.getAllByText("Ratio Category");
          expect(tooltipElements.length).toBeGreaterThan(0);
        },
        { timeout: 1500 },
      );
    });

    it("does not render tooltip when toolTipMessage is not provided", () => {
      render(
        <TabsParam value="option1" options={mockOptions} onValueChange={vi.fn()} />,
      );

      // The component should still render without tooltip
      expect(screen.getByText("Option 1")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("handles empty options array", () => {
      render(<TabsParam value="" options={[]} onValueChange={vi.fn()} />);

      // Should render without crashing
      const toggleGroup = screen.getByRole("group");
      expect(toggleGroup).toBeInTheDocument();
      expect(toggleGroup.children).toHaveLength(0);
    });

    it("handles value that doesn't match any option", () => {
      render(
        <TabsParam value="nonexistent" options={mockOptions} onValueChange={vi.fn()} />,
      );

      // Should render all options
      expect(screen.getByText("Option 1")).toBeInTheDocument();

      // No option should be selected
      const selectedItems = screen.queryAllByRole("radio", { checked: true });
      expect(selectedItems).toHaveLength(0);
    });
  });

  describe("Accessibility", () => {
    it("renders as group with radio items", () => {
      render(
        <TabsParam value="option1" options={mockOptions} onValueChange={vi.fn()} />,
      );

      // Radix UI ToggleGroup uses role="group"
      const toggleGroup = screen.getByRole("group");
      expect(toggleGroup).toBeInTheDocument();

      // Each option should be a radio button
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
    });

    it("supports keyboard interaction via Space key", async () => {
      const user = userEvent.setup();
      const handleValueChange = vi.fn();

      render(
        <TabsParam
          value="option1"
          options={mockOptions}
          onValueChange={handleValueChange}
        />,
      );

      // Get the second radio button
      const secondRadio = await screen.findByRole("radio", { name: "Option 2" });

      // Focus and activate with Space key
      await act(async () => {
        secondRadio.focus();
        await user.keyboard(" ");
      });

      // Should call onValueChange with the selected option
      expect(handleValueChange).toHaveBeenCalledWith("option2");
    });
  });
});
