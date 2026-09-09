import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { AnimatedChevron } from "./AnimatedChevron";

const meta = {
  title: "Atoms/AnimatedChevron",
  component: AnimatedChevron,
  tags: ["autodocs"],
} satisfies Meta<typeof AnimatedChevron>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {
  args: { isOpen: false },
};

export const Open: Story = {
  args: { isOpen: true },
};

export const Interactive: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);
    return (
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-general-label body-xs-medium cursor-pointer"
      >
        <AnimatedChevron isOpen={isOpen} />
        Click to toggle ({isOpen ? "open" : "closed"})
      </button>
    );
  },
};
