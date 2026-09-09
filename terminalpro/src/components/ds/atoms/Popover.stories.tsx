import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Popover } from "./Popover";

const meta = {
  title: "Atoms/Popover",
  component: Popover,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Tooltip", tokens: ["--tooltip-bg", "--ds-text-body"] },
      {
        group: "Popover",
        tokens: [
          "--dropdown-bg",
          "--dropdown-border",
          "--general-label",
          "--shadow-dropdown",
        ],
      },
    ],
  },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Popover content="This is a popover" side="bottom">
      <Button variant="secondary" size="sm">
        Click me
      </Button>
    </Popover>
  ),
};

export const WithArrow: Story = {
  render: () => (
    <Popover content="Popover with arrow" arrow side="bottom">
      <Button variant="secondary" size="sm">
        With arrow
      </Button>
    </Popover>
  ),
};

export const RichContent: Story = {
  render: () => (
    <Popover
      content={
        <div className="space-y-2 p-1">
          <p className="body-xs-medium text-ds-text-heading">Settings</p>
          <p className="body-xs-regular text-ds-text-body">
            Configure your preferences here.
          </p>
        </div>
      }
      side="bottom"
    >
      <Button variant="outlined" size="sm">
        Open settings
      </Button>
    </Popover>
  ),
};

export const Positions: Story = {
  render: () => (
    <div className="flex gap-4 p-12">
      {(["top", "bottom", "left", "right"] as const).map((side) => (
        <Popover key={side} content={`Positioned ${side}`} side={side}>
          <Button variant="secondary" size="sm">
            {side}
          </Button>
        </Popover>
      ))}
    </div>
  ),
};
