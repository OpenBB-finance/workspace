import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ColorPicker } from "./ColorPicker";

const meta = {
  title: "Molecules/ColorPicker",
  component: ColorPicker,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Input", tokens: ["--ds-text-body", "--ds-text-heading"] },
      { group: "Swatch", tokens: ["--general-border-primary"] },
    ],
  },
} satisfies Meta<typeof ColorPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveColorPicker = ({
  initialColor = "#0088CC",
}: {
  initialColor?: string;
}) => {
  const [color, setColor] = useState(initialColor);
  return (
    <div className="w-48">
      <ColorPicker value={color} onChange={setColor} />
    </div>
  );
};

export const Default: Story = {
  render: () => <InteractiveColorPicker />,
};

export const CustomInitialColor: Story = {
  render: () => <InteractiveColorPicker initialColor="#E03C3C" />,
};

export const Clearable: Story = {
  render: () => {
    const [color, setColor] = useState("#2DAC5C");
    return (
      <div className="w-48">
        <ColorPicker value={color} onChange={setColor} clearable />
      </div>
    );
  },
};
