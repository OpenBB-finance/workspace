import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem, RadioGroupLabel } from "./RadioGroup";

const meta = {
  title: "Atoms/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      {
        group: "Radio",
        tokens: [
          "--general-bg-primary",
          "--general-border-primary",
          "--brand-main",
          "--link-color",
        ],
      },
      {
        group: "Label",
        tokens: [
          "--general-label",
          "--general-label-hover",
          "--general-label-disabled",
        ],
      },
      { group: "Group Label", tokens: ["--ds-text-caption"] },
    ],
  },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="option-1">
      <RadioGroupLabel>Select an option</RadioGroupLabel>
      <RadioGroupItem value="option-1" label="Option 1" />
      <RadioGroupItem value="option-2" label="Option 2" />
      <RadioGroupItem value="option-3" label="Option 3" />
    </RadioGroup>
  ),
};

export const WithDisabledItem: Story = {
  render: () => (
    <RadioGroup defaultValue="option-1">
      <RadioGroupLabel>Availability</RadioGroupLabel>
      <RadioGroupItem value="option-1" label="Available" />
      <RadioGroupItem value="option-2" label="Coming soon" disabled />
      <RadioGroupItem value="option-3" label="Also available" />
    </RadioGroup>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <RadioGroup defaultValue="light" className="flex flex-row gap-4">
      <RadioGroupItem value="light" label="Light" />
      <RadioGroupItem value="dark" label="Dark" />
      <RadioGroupItem value="system" label="System" />
    </RadioGroup>
  ),
};
