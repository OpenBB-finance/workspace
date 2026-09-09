import type { Meta, StoryObj } from "@storybook/react";
import { Label, Message } from "./Label";

const labelMeta = {
  title: "Atoms/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Label", tokens: ["--ds-text-caption", "--general-label-disabled"] },
    ],
  },
} satisfies Meta<typeof Label>;

export default labelMeta;
type Story = StoryObj<typeof labelMeta>;

export const Default: Story = {
  args: { children: "Email address" },
};

export const WithMessage: Story = {
  render: () => (
    <div>
      <Label>Email address</Label>
      <div className="h-8 rounded-sm border border-general-border-primary" />
      <Message>We'll never share your email.</Message>
    </div>
  ),
};

export const ErrorMessage: Story = {
  render: () => (
    <div>
      <Label>Password</Label>
      <div className="h-8 rounded-sm border border-alert-error" />
      <Message error>Password must be at least 8 characters.</Message>
    </div>
  ),
};
