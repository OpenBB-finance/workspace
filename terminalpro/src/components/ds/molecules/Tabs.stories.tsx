import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
  title: "Molecules/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "filled", "filled_secondary"],
    },
  },
  parameters: {
    semanticTokens: [
      {
        group: "Default Variant",
        tokens: ["--ds-text-body", "--general-label-hover", "--tab-action-active"],
      },
      {
        group: "Filled Variant",
        tokens: [
          "--tab-bg-secondary",
          "--ds-text-caption",
          "--general-label",
          "--tab-filled-primary-bg-active",
          "--tab-filled-primary-text-active",
        ],
      },
      {
        group: "Filled Secondary",
        tokens: [
          "--tab-group-bg",
          "--tab-filled-secondary-text",
          "--tab-filled-secondary-bg-hover",
          "--tab-action-active",
          "--tab-bg-primary",
        ],
      },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const TabsTemplate = ({
  variant,
}: {
  variant?: "default" | "filled" | "filled_secondary";
}) => (
  <Tabs defaultValue="tab1" variant={variant} className="w-80">
    <TabsList>
      <TabsTrigger value="tab1">Overview</TabsTrigger>
      <TabsTrigger value="tab2">Settings</TabsTrigger>
      <TabsTrigger value="tab3">Activity</TabsTrigger>
    </TabsList>
    <TabsContent value="tab1" className="p-4 text-ds-text-body">
      Overview content
    </TabsContent>
    <TabsContent value="tab2" className="p-4 text-ds-text-body">
      Settings content
    </TabsContent>
    <TabsContent value="tab3" className="p-4 text-ds-text-body">
      Activity content
    </TabsContent>
  </Tabs>
);

export const Default: Story = {
  render: () => <TabsTemplate variant="default" />,
};

export const Filled: Story = {
  render: () => <TabsTemplate variant="filled" />,
};

export const FilledSecondary: Story = {
  render: () => <TabsTemplate variant="filled_secondary" />,
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-ds-text-caption body-xs-medium">Default</p>
        <TabsTemplate variant="default" />
      </div>
      <div>
        <p className="mb-2 text-ds-text-caption body-xs-medium">Filled</p>
        <TabsTemplate variant="filled" />
      </div>
      <div>
        <p className="mb-2 text-ds-text-caption body-xs-medium">Filled Secondary</p>
        <TabsTemplate variant="filled_secondary" />
      </div>
    </div>
  ),
};
