import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const meta = {
  title: "Atoms/Select",
  component: Select,
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
        group: "Trigger",
        tokens: [
          "--input-field-bg",
          "--input-field-bg-disabled",
          "--general-border-primary",
          "--general-border-disabled",
          "--general-label-hover",
          "--general-label-disabled",
        ],
      },
      {
        group: "Dropdown",
        tokens: ["--dropdown-bg", "--dropdown-border", "--shadow-dropdown"],
      },
      { group: "Item", tokens: ["--general-label", "--general-bg-secondary"] },
      { group: "Text", tokens: ["--ds-text-body", "--ds-text-caption"] },
    ],
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

const simpleOptions = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

const objectOptions = [
  { label: "United States", value: "us" },
  { label: "United Kingdom", value: "uk" },
  { label: "Germany", value: "de" },
  { label: "France", value: "fr" },
  { label: "Japan", value: "jp" },
];

const groupedOptions = [
  {
    label: "Fruits",
    options: ["Apple", "Banana", "Cherry"],
  },
  {
    label: "Vegetables",
    options: ["Carrot", "Broccoli", "Spinach"],
  },
];

export const Default: Story = {
  args: {
    options: simpleOptions,
    placeholder: "Select a fruit...",
  },
};

export const WithLabel: Story = {
  args: {
    options: objectOptions,
    placeholder: "Select a country...",
    label: "Country",
  },
};

export const WithMessage: Story = {
  args: {
    options: simpleOptions,
    placeholder: "Select...",
    label: "Fruit",
    message: "Choose your favorite fruit",
  },
};

export const WithError: Story = {
  args: {
    options: simpleOptions,
    placeholder: "Select...",
    label: "Required field",
    message: "This field is required",
    error: true,
  },
};

export const Disabled: Story = {
  args: {
    options: simpleOptions,
    placeholder: "Select...",
    label: "Disabled",
    disabled: true,
  },
};

export const Grouped: Story = {
  args: {
    options: groupedOptions,
    placeholder: "Select...",
    label: "Food",
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-64">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Select
          key={size}
          options={simpleOptions}
          placeholder={`Size: ${size}`}
          label={size.toUpperCase()}
          size={size}
        />
      ))}
    </div>
  ),
};
