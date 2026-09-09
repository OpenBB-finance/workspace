import type { Meta, StoryObj } from "@storybook/react";
import { Avatar } from "./Avatar";

const meta = {
  title: "Atoms/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { size: "md" },
};

export const WithImage: Story = {
  args: {
    src: "https://i.pravatar.cc/150?u=openbb",
    alt: "User avatar",
    size: "md",
  },
};

export const WithFallbackText: Story = {
  args: {
    size: "md",
    fallback: "JD",
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(["xs", "sm", "md", "lg"] as const).map((size) => (
        <Avatar key={size} size={size} fallback={size.toUpperCase()} />
      ))}
    </div>
  ),
};
