import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./Input";

const meta = {
  title: "Atoms/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
  },
  parameters: {
    semanticTokens: [
      {
        group: "Field",
        tokens: [
          "--input-field-bg",
          "--input-field-bg-hover",
          "--input-field-bg-disabled",
          "--general-border-primary",
          "--general-border-disabled",
        ],
      },
      {
        group: "Text",
        tokens: [
          "--general-label-hover",
          "--ds-text-caption",
          "--ds-text-body",
          "--general-label-disabled",
        ],
      },
      { group: "Error", tokens: ["--alert-error"] },
    ],
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter text..." },
};

export const WithLabel: Story = {
  args: { label: "Email", placeholder: "you@example.com" },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-4">
      <Input size="xs" placeholder="Extra small" label="XS" />
      <Input size="sm" placeholder="Small" label="SM" />
      <Input size="md" placeholder="Medium" label="MD" />
      <Input size="lg" placeholder="Large" label="LG" />
    </div>
  ),
};

export const WithPrefix: Story = {
  args: {
    placeholder: "Search...",
    prefix: <span className="text-ds-text-caption">$</span>,
  },
};

export const WithSuffix: Story = {
  args: {
    placeholder: "0.00",
    suffix: <span className="text-ds-text-caption">USD</span>,
  },
};

export const ErrorState: Story = {
  args: {
    label: "Email",
    placeholder: "you@example.com",
    error: true,
    message: "Invalid email address",
    defaultValue: "not-an-email",
  },
};

export const Clearable: Story = {
  args: {
    placeholder: "Type to see clear button",
    clearable: true,
    defaultValue: "Clear me",
  },
};

export const Password: Story = {
  args: {
    label: "Password",
    type: "password",
    placeholder: "Enter password",
    defaultValue: "secret123",
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled",
    placeholder: "Can't edit",
    disabled: true,
    defaultValue: "Read only value",
  },
};

export const WithMessage: Story = {
  args: {
    label: "Username",
    placeholder: "Pick a username",
    message: "Must be at least 3 characters",
  },
};
