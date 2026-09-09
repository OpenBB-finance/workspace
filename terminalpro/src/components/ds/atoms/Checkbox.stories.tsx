import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./Checkbox";

const meta = {
  title: "Atoms/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      {
        group: "Unchecked",
        tokens: ["--general-bg-primary", "--general-border-primary"],
      },
      { group: "Checked / Indeterminate", tokens: ["--main-100", "--base-0"] },
      {
        group: "Disabled",
        tokens: ["--general-bg-primary-disabled", "--general-label-disabled"],
      },
      { group: "Error", tokens: ["--alert-error"] },
      { group: "Focus", tokens: ["--alert-informative"] },
      { group: "Label", tokens: ["--general-label", "--general-label-disabled"] },
    ],
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: "Accept terms" },
};

export const Checked: Story = {
  args: { label: "Checked", defaultChecked: true },
};

export const Indeterminate: Story = {
  args: { label: "Indeterminate", checked: "indeterminate" },
};

export const WithError: Story = {
  args: { label: "Required field", error: true },
};

export const Disabled: Story = {
  args: { label: "Disabled", disabled: true },
};

export const DisabledChecked: Story = {
  args: { label: "Disabled checked", disabled: true, defaultChecked: true },
};

export const LabelLeft: Story = {
  args: { label: "Label on left", labelPosition: "left" },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Checkbox label="Unchecked" />
      <Checkbox label="Checked" defaultChecked />
      <Checkbox label="Indeterminate" checked="indeterminate" />
      <Checkbox label="Error" error />
      <Checkbox label="Disabled" disabled />
      <Checkbox label="Disabled checked" disabled defaultChecked />
      <Checkbox label="Label on left" labelPosition="left" />
    </div>
  ),
};
