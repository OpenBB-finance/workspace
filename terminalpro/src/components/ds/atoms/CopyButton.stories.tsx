import type { Meta, StoryObj } from "@storybook/react";
import { CopyButton } from "./CopyButton";

const meta = {
  title: "Atoms/CopyButton",
  component: CopyButton,
  tags: ["autodocs"],
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    text: "Copied text!",
  },
};

export const WithCustomStyle: Story = {
  args: {
    text: "sk-1234567890abcdef",
    variant: "ghost",
  },
};
