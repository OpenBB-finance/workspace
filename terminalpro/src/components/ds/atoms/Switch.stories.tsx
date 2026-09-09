import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./Switch";

const meta = {
  title: "Atoms/Switch",
  component: Switch,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Track", tokens: ["--toggle-bg", "--toggle-bg-disabled", "--main-100"] },
      { group: "Label", tokens: ["--general-label", "--general-label-disabled"] },
    ],
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Toggle" },
};

export const Checked: Story = {
  args: { defaultChecked: true, "aria-label": "Toggle" },
};

export const WithLabel: Story = {
  args: { label: "Enable notifications" },
};

export const CheckedWithLabel: Story = {
  args: { label: "Dark mode", defaultChecked: true },
};

export const Disabled: Story = {
  args: { label: "Unavailable", disabled: true },
};

export const DisabledChecked: Story = {
  args: { label: "Locked on", disabled: true, defaultChecked: true },
};
