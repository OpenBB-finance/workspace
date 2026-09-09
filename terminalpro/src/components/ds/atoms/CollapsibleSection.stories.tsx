import type { Meta, StoryObj } from "@storybook/react";
import { AnimatedChevron } from "./AnimatedChevron";
import { CollapsibleSection } from "./CollapsibleSection";

const meta = {
  title: "Atoms/CollapsibleSection",
  component: CollapsibleSection,
  tags: ["autodocs"],
} satisfies Meta<typeof CollapsibleSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    header: ({ isOpen }) => (
      <div className="flex items-center gap-2 p-2 cursor-pointer text-general-label hover:text-general-label-hover">
        <AnimatedChevron isOpen={isOpen} />
        <span className="body-xs-medium">Section Title</span>
      </div>
    ),
    children: (
      <div className="p-2 text-ds-text-body body-xs-regular">
        Collapsible content goes here. This section can be expanded and collapsed.
      </div>
    ),
    defaultOpen: true,
  },
};

export const ClosedByDefault: Story = {
  args: {
    header: ({ isOpen }) => (
      <div className="flex items-center gap-2 p-2 cursor-pointer text-general-label">
        <AnimatedChevron isOpen={isOpen} />
        <span className="body-xs-medium">Click to expand</span>
      </div>
    ),
    children: (
      <div className="p-2 text-ds-text-body body-xs-regular">
        Hidden content revealed on expand.
      </div>
    ),
    defaultOpen: false,
  },
};

export const Disabled: Story = {
  args: {
    header: ({ isOpen }) => (
      <div className="flex items-center gap-2 p-2 opacity-50 text-general-label">
        <AnimatedChevron isOpen={isOpen} />
        <span className="body-xs-medium">Disabled section</span>
      </div>
    ),
    children: <div className="p-2">This won't show</div>,
    disabled: true,
    defaultOpen: false,
  },
};
