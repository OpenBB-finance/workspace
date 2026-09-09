import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Button } from "../atoms/Button";
import { ConfirmDialog } from "./ConfirmDialog";

const meta = {
  title: "Dialogs/ConfirmDialog",
  component: ConfirmDialog,
  tags: ["autodocs"],
  parameters: {
    semanticTokens: [
      { group: "Overlay", tokens: ["--surface-layer"] },
      { group: "Dialog", tokens: ["--general-bg-primary", "--general-label"] },
      { group: "Text", tokens: ["--ds-text-heading"] },
    ],
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

const InteractiveDialog = ({
  title,
  description,
  confirmText,
  cancelText,
}: {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Open dialog
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        confirmText={confirmText}
        cancelText={cancelText}
        onConfirm={() => setOpen(false)}
      />
    </>
  );
};

export const Default: Story = {
  render: () => (
    <InteractiveDialog
      title="Confirm action"
      description="Are you sure you want to proceed? This action cannot be undone."
    />
  ),
};

export const DeleteConfirmation: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Delete dashboard
        </Button>
        <ConfirmDialog
          open={open}
          onClose={() => setOpen(false)}
          title="Delete dashboard"
          description="This will permanently delete the dashboard and all its widgets. This action cannot be undone."
          confirmButton={
            <Button variant="danger" size="sm" onClick={() => setOpen(false)}>
              Delete
            </Button>
          }
          cancelText="Keep it"
        />
      </>
    );
  },
};

export const WithTrigger: Story = {
  render: () => (
    <ConfirmDialog
      trigger={
        <Button variant="outlined" size="sm">
          Reset settings
        </Button>
      }
      title="Reset all settings?"
      description="This will restore all settings to their default values."
      confirmText="Reset"
      onConfirm={() => {}}
    />
  ),
};
