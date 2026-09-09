import type { Meta, StoryObj } from "@storybook/react";
import { HintLabel } from "./HintLabel";

const meta = {
  title: "Atoms/HintLabel",
  component: HintLabel,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Default", tokens: ["--general-label", "--general-border-primary"] },
      { group: "Disabled", tokens: ["--general-label-disabled"] },
    ],
  },
} satisfies Meta<typeof HintLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Hover me for details",
    tooltip: "This is a tooltip with extra context about the feature.",
  },
};

export const Disabled: Story = {
  args: {
    children: "Disabled hint",
    tooltip: "This tooltip won't show",
    disabled: true,
  },
};

export const RichTooltip: Story = {
  args: {
    children: "Advanced setting",
    tooltip: (
      <div className="space-y-1">
        <p className="body-xs-medium">Auto-refresh interval</p>
        <p className="body-xs-regular text-ds-text-caption">
          Controls how often dashboard data refreshes. Lower values use more bandwidth.
        </p>
      </div>
    ),
  },
};
