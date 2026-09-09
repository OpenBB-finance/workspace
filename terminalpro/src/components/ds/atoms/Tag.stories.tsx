import type { Meta, StoryObj } from "@storybook/react";
import { Tag } from "./Tag";

const meta = {
  title: "Atoms/Tag",
  component: Tag,
  tags: ["autodocs"],
  argTypes: {
    color: {
      control: "select",
      options: [
        "grey",
        "success",
        "warning",
        "danger",
        "brand",
        "ruby",
        "purple",
        "yellow",
        "dark-blue",
        "burgundy",
      ],
    },
  },
  parameters: {
    semanticTokens: [
      { group: "Grey", tokens: ["--tag-grey-bg", "--tag-grey-label"] },
      { group: "Success", tokens: ["--tag-green-bg", "--tag-green-label"] },
      { group: "Warning", tokens: ["--tag-orange-bg", "--tag-orange-label"] },
      { group: "Danger", tokens: ["--tag-red-bg", "--tag-red-label"] },
      { group: "Brand", tokens: ["--tag-brand-bg", "--tag-brand-label"] },
      { group: "Ruby", tokens: ["--tag-pink-bg", "--tag-pink-label"] },
      { group: "Purple", tokens: ["--tag-purple-bg", "--tag-purple-label"] },
      { group: "Yellow", tokens: ["--tag-yellow-bg", "--tag-yellow-label"] },
      { group: "Dark Blue", tokens: ["--tag-blue-bg", "--tag-blue-label"] },
      { group: "Burgundy", tokens: ["--tag-burgundy-bg", "--tag-burgundy-label"] },
    ],
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Tag", color: "grey" },
};

export const AllColors: Story = {
  render: () => {
    const colors = [
      "grey",
      "success",
      "warning",
      "danger",
      "brand",
      "ruby",
      "purple",
      "yellow",
      "dark-blue",
      "burgundy",
    ] as const;

    return (
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <Tag key={color} color={color}>
            {color}
          </Tag>
        ))}
      </div>
    );
  },
};
