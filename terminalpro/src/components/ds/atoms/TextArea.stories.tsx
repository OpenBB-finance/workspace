import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./TextArea";

const meta = {
  title: "Atoms/TextArea",
  component: Textarea,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      {
        group: "Container",
        tokens: [
          "--general-border-primary",
          "--general-border-disabled",
          "--general-bg-primary-disabled",
        ],
      },
      {
        group: "Text",
        tokens: [
          "--general-label-hover",
          "--ds-text-caption",
          "--general-label-disabled",
        ],
      },
      { group: "Error", tokens: ["--alert-error"] },
    ],
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Type something...",
  },
};

export const WithLabel: Story = {
  args: {
    label: "Description",
    placeholder: "Enter a description...",
  },
};

export const WithMessage: Story = {
  args: {
    label: "Bio",
    placeholder: "Tell us about yourself...",
    message: "Max 500 characters",
  },
};

export const WithError: Story = {
  args: {
    label: "Required",
    placeholder: "This field is required...",
    message: "Please enter a value",
    error: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "Disabled",
    placeholder: "Cannot edit...",
    disabled: true,
  },
};

export const Copiable: Story = {
  args: {
    label: "API Key",
    value: "sk-1234567890abcdef",
    copiable: true,
    readOnly: true,
  },
};

export const WithDefaultValue: Story = {
  args: {
    label: "Notes",
    defaultValue:
      "This textarea auto-expands as you type more content.\nTry adding more lines to see the autoheight behavior.",
  },
};
