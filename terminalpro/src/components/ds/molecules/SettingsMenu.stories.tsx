import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "../atoms/Switch";
import SettingsMenu from "./SettingsMenu";

const meta = {
  title: "Molecules/SettingsMenu",
  component: SettingsMenu,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      {
        group: "Container",
        tokens: [
          "--general-bg-primary",
          "--general-border-primary",
          "--general-bg-primary-hover",
        ],
      },
      { group: "Text", tokens: ["--general-label-hover", "--ds-text-body"] },
      { group: "Icon", tokens: ["--link-color"] },
    ],
  },
} satisfies Meta<typeof SettingsMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <SettingsMenu title="Display">
        <div className="space-y-3">
          <Switch label="Show grid lines" defaultChecked />
          <Switch label="Show legend" defaultChecked />
          <Switch label="Show tooltips" />
        </div>
      </SettingsMenu>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="w-80">
      <SettingsMenu title="Notifications" icon="bell-icon">
        <div className="space-y-3">
          <Switch label="Email notifications" defaultChecked />
          <Switch label="Push notifications" />
        </div>
      </SettingsMenu>
    </div>
  ),
};

export const Collapsible: Story = {
  render: () => (
    <div className="w-80">
      <SettingsMenu title="Advanced Settings" canCollapse>
        <div className="space-y-3">
          <Switch label="Debug mode" />
          <Switch label="Verbose logging" />
          <Switch label="Beta features" />
        </div>
      </SettingsMenu>
    </div>
  ),
};

export const WithTooltip: Story = {
  render: () => (
    <div className="w-80">
      <SettingsMenu
        title="Auto-refresh"
        tooltip="Controls automatic data refresh behavior for all widgets."
      >
        <div className="space-y-3">
          <Switch label="Enable auto-refresh" defaultChecked />
        </div>
      </SettingsMenu>
    </div>
  ),
};

export const WithRightElement: Story = {
  render: () => (
    <div className="w-80">
      <SettingsMenu
        title="Theme"
        canCollapse
        rightElement={
          <span className="body-xs-regular text-ds-text-caption">Dark</span>
        }
      >
        <div className="space-y-3">
          <Switch label="Use system theme" />
          <Switch label="High contrast" />
        </div>
      </SettingsMenu>
    </div>
  ),
};
