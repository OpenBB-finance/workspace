import type { ReactNode } from "react";
import { type SubmitHandler, type UseFormReturn, useWatch } from "react-hook-form";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { BaseDialog } from "~/components/ds/dialogs/BaseDialog";
import { DialogTitle } from "~/components/ds/dialogs/Dialog";
import { Form, FormField } from "~/components/ds/molecules/Form";
import SettingsMenu from "~/components/ds/molecules/SettingsMenu";
import AppCard from "~/components/LayoutAuth/AppCard/AppCard";
import type { AppTemplate } from "~/components/LayoutAuth/AppCard/types";
import Tooltip from "~/components/Tooltip";
import { inSnowflakeNativeApp } from "~/lib/constants";
import { noop } from "~/lib/utils";
import Icon from "../../Icon";
import { PromptsSection } from "./PromptsSection";
import { type AppMetadataForm, PREVIEW_DESCRIPTION_FALLBACK } from "./schema";

type AppDialogShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  form: UseFormReturn<AppMetadataForm>;
  onSubmit: SubmitHandler<AppMetadataForm>;
  previewWidgets: AppTemplate["widgets"];
  footer: ReactNode;
  topSlot?: ReactNode;
  className?: string;
};

export function AppDialogShell({
  open,
  onClose,
  title,
  form,
  onSubmit,
  previewWidgets,
  footer,
  topSlot,
  className = "max-w-3xl sm:max-w-3xl",
}: AppDialogShellProps) {
  const watched = useWatch({ control: form.control });

  const trimmedPromptsForPreview = (watched.prompts ?? [])
    .map((p) => (p?.value ?? "").trim())
    .filter(Boolean);

  const previewTemplate: AppTemplate = {
    id: "preview",
    name: watched.name?.trim() || "Untitled app",
    description: watched.description?.trim() || PREVIEW_DESCRIPTION_FALLBACK,
    type: "generated",
    widgets: previewWidgets,
    prompts: trimmedPromptsForPreview,
    img: watched.imageUrl?.trim() || undefined,
    onClick: noop,
  };

  return (
    <BaseDialog open={open} onClose={onClose} className={className}>
      <DialogTitle>{title}</DialogTitle>

      {topSlot}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col overflow-hidden flex-1 min-h-0"
        >
          <div className="flex flex-col gap-4 pr-1 flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-4 shrink-0">
              <SettingsMenu title="General Information">
                <FormField
                  name="name"
                  control={form.control}
                  render={({ field }) => (
                    <FormInput
                      label="Name"
                      placeholder="Enter app name..."
                      maxLength={100}
                      {...field}
                    />
                  )}
                />

                <FormField
                  name="description"
                  control={form.control}
                  render={({ field }) => (
                    <FormTextarea
                      label="Description"
                      placeholder="Describe what this app does and when to use it..."
                      maxLength={500}
                      rows={5}
                      autoheight={false}
                      {...field}
                    />
                  )}
                />

                {!inSnowflakeNativeApp && (
                  <FormField
                    name="imageUrl"
                    control={form.control}
                    render={({ field }) => (
                      <FormInput
                        label={
                          <span className="inline-flex items-center gap-1">
                            Image cover
                            <span className="text-ds-text-caption italic font-normal">
                              (optional)
                            </span>
                            <Tooltip
                              message="Recommended 5:3 ratio — e.g. 1000×600. Image will fill the card, so leave a safe area near the edges to avoid important content being cropped."
                              className="max-w-[280px]"
                            >
                              <button
                                type="button"
                                tabIndex={0}
                                aria-label="Image cover guidance"
                                className="inline-flex items-center justify-center cursor-help"
                              >
                                <Icon
                                  id="info-circled-icon"
                                  className="size-3.5 text-ds-text-caption"
                                />
                              </button>
                            </Tooltip>
                          </span>
                        }
                        placeholder="https://example.com/image.png"
                        maxLength={500}
                        {...field}
                      />
                    )}
                  />
                )}
              </SettingsMenu>

              <SettingsMenu title="App Preview">
                <div className="pointer-events-none select-none">
                  <AppCard
                    template={previewTemplate}
                    hideActions={true}
                    className="border-0 hover:border-0 rounded-none p-0 cursor-default"
                  />
                </div>
              </SettingsMenu>
            </div>

            <PromptsSection form={form} />
          </div>

          {footer}
        </form>
      </Form>
    </BaseDialog>
  );
}
