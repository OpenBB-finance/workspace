import type { Meta, StoryObj } from "@storybook/react";
import { ExportProgress } from "./ExportProgress";

const meta = {
  title: "Molecules/ExportProgress",
  component: ExportProgress,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Progress Bar", tokens: ["--general-bg-secondary", "--brand-main"] },
      { group: "Text", tokens: ["--ds-text-body"] },
    ],
  },
} satisfies Meta<typeof ExportProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    current: 3,
    total: 10,
    label: "Exporting dashboards",
  },
};

export const Complete: Story = {
  args: {
    current: 10,
    total: 10,
    label: "Exporting dashboards",
  },
};

export const WithSubProgress: Story = {
  args: {
    current: 2,
    total: 5,
    label: "Exporting dashboards",
    subProgress: {
      current: 3,
      total: 8,
      label: "Processing tabs",
    },
  },
};

export const EarlyStage: Story = {
  args: {
    current: 1,
    total: 50,
    label: "Exporting widgets",
  },
};
