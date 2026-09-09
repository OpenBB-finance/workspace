import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Atoms/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "outlined", "warning", "danger", "ghost"],
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
    },
  },
  parameters: {
    semanticTokens: [
      {
        group: "Primary",
        tokens: [
          "--btn-primary-bg",
          "--btn-primary-bg-hover",
          "--btn-primary-bg-disabled",
          "--btn-primary-label",
          "--btn-primary-label-disabled",
        ],
      },
      {
        group: "Secondary",
        tokens: [
          "--btn-secondary-bg",
          "--btn-secondary-bg-hover",
          "--btn-secondary-bg-disabled",
          "--btn-secondary-border",
          "--general-label",
          "--general-label-disabled",
        ],
      },
      {
        group: "Outlined",
        tokens: [
          "--btn-outlined-border",
          "--btn-outlined-border-hover",
          "--btn-outlined-border-disabled",
          "--general-label",
          "--general-label-disabled",
        ],
      },
      {
        group: "Warning",
        tokens: [
          "--btn-warning-bg",
          "--btn-warning-bg-hover",
          "--btn-warning-bg-disabled",
          "--btn-warning-label",
          "--btn-warning-label-disabled",
        ],
      },
      {
        group: "Danger",
        tokens: [
          "--btn-destructive-bg",
          "--btn-destructive-bg-hover",
          "--btn-destructive-bg-disabled",
          "--btn-destructive-label",
          "--btn-destructive-label-disabled",
        ],
      },
      {
        group: "Ghost",
        tokens: ["--btn-ghost-bg-hover", "--general-label", "--general-label-disabled"],
      },
      { group: "Focus", tokens: ["--alert-informative"] },
    ],
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { children: "Primary", variant: "primary" },
};

export const Secondary: Story = {
  args: { children: "Secondary", variant: "secondary" },
};

export const Outlined: Story = {
  args: { children: "Outlined", variant: "outlined" },
};

export const Warning: Story = {
  args: { children: "Warning", variant: "warning" },
};

export const Danger: Story = {
  args: { children: "Danger", variant: "danger" },
};

export const Ghost: Story = {
  args: { children: "Ghost", variant: "ghost" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outlined">Outlined</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { children: "Submit", loading: true },
};

export const LoadingCustomText: Story = {
  args: { children: "Submit", loading: true, loadingChildren: "Saving..." },
};

export const Disabled: Story = {
  args: { children: "Disabled", disabled: true },
};

export const DisabledVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled>
        Primary
      </Button>
      <Button variant="secondary" disabled>
        Secondary
      </Button>
      <Button variant="outlined" disabled>
        Outlined
      </Button>
      <Button variant="warning" disabled>
        Warning
      </Button>
      <Button variant="danger" disabled>
        Danger
      </Button>
      <Button variant="ghost" disabled>
        Ghost
      </Button>
    </div>
  ),
};
