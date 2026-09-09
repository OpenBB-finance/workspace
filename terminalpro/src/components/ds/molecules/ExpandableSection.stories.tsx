import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ExpandableSection } from "./ExpandableSection";

const meta = {
  title: "Molecules/ExpandableSection",
  component: ExpandableSection,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Container", tokens: ["--surface-divider"] },
      { group: "Text", tokens: ["--ds-text-caption"] },
    ],
  },
} satisfies Meta<typeof ExpandableSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveExample = ({
  defaultExpanded = false,
  disabled = false,
}: {
  defaultExpanded?: boolean;
  disabled?: boolean;
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="w-96">
      <ExpandableSection
        title="Chart Settings"
        description="Configure how charts are displayed in your dashboard."
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
      >
        <div className="space-y-2 text-ds-text-body body-xs-regular">
          <p>Chart type: Line</p>
          <p>Show grid: Yes</p>
          <p>Animation: Enabled</p>
        </div>
      </ExpandableSection>
    </div>
  );
};

export const Collapsed: Story = {
  render: () => <InteractiveExample />,
};

export const Expanded: Story = {
  render: () => <InteractiveExample defaultExpanded />,
};

export const Disabled: Story = {
  render: () => <InteractiveExample disabled />,
};

export const MultipleSections: Story = {
  render: () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const sections = [
      {
        title: "General",
        description: "Basic application preferences.",
        content: "Language, timezone, and date format settings.",
      },
      {
        title: "Appearance",
        description: "Customize the look and feel.",
        content: "Theme, font size, and density options.",
      },
      {
        title: "Data Sources",
        description: "Manage connected data providers.",
        content: "API keys, refresh intervals, and data retention.",
      },
    ];

    return (
      <div className="w-96">
        {sections.map((section, i) => (
          <ExpandableSection
            key={section.title}
            title={section.title}
            description={section.description}
            isExpanded={openIndex === i}
            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
          >
            <p className="text-ds-text-body body-xs-regular">{section.content}</p>
          </ExpandableSection>
        ))}
      </div>
    );
  },
};
