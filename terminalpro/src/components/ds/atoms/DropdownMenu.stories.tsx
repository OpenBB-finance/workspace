import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./DropdownMenu";

const meta = {
  title: "Atoms/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      {
        group: "Content",
        tokens: ["--dropdown-bg", "--dropdown-border", "--shadow-dropdown"],
      },
      { group: "Item", tokens: ["--general-label", "--general-bg-secondary"] },
      { group: "Separator", tokens: ["--surface-divider"] },
    ],
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          Open menu
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Duplicate</DropdownMenuItem>
        <DropdownMenuItem>Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-alert-error">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithDisabledItems: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outlined" size="sm">
          Options
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Copy</DropdownMenuItem>
        <DropdownMenuItem>Paste</DropdownMenuItem>
        <DropdownMenuItem disabled>Cut (disabled)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
