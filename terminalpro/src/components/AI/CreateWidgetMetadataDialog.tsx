import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { patchWidgetMetadata } from "~/api/auth.api";
import { CATEGORY_OPTIONS } from "~/components/DataConnectors/common/helpers";
import type { WidgetMetadataItem } from "~/lib/state/backendConnector";
import { useShallowCopilotStore } from "~/lib/state/copilot";
import { dispatchUpdateWidget, processWidgetId, useEventListener } from "~/lib/utils";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { FormSelect } from "../ds/atoms/Select";
import { FormTextarea } from "../ds/atoms/TextArea";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogDescription, DialogFooter, DialogTitle } from "../ds/dialogs/Dialog";
import { Form, FormField } from "../ds/molecules/Form";
import {
  type CreateWidgetParams,
  useCreateWidgetFromArtifact,
} from "./hooks/useCreateWidgetFromArtifact";

const metadataSchema = z.object({
  name: z.string().min(1, "This field is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
});

export type MetadataForm = z.infer<typeof metadataSchema>;

export function CreateWidgetMetadataDialog() {
  const [isLoading, setIsLoading] = useState(false);

  const { dialogState, closeDialog } = useShallowCopilotStore((state) => ({
    dialogState: state.createWidgetMetadataDialog,
    closeDialog: state.closeCreateWidgetMetadataDialog,
  }));

  const { createWidgetWithMetadata, createWidget } = useCreateWidgetFromArtifact();

  useEventListener("createWidgetPopup", (detail) => {
    if (detail) createWidget(detail);
  });

  const form = useForm<MetadataForm>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "",
      subCategory: "",
      source: "",
    },
  });

  useEffect(() => {
    if (dialogState?.initialValues) {
      form.reset({
        name: dialogState.initialValues.name ?? "",
        description: dialogState.initialValues.description ?? "",
        category: dialogState.initialValues.category ?? "",
        subCategory: dialogState.initialValues.subCategory ?? "",
        source: dialogState.initialValues.source ?? "",
      });
    }
  }, [dialogState, form]);

  const handleSubmit = useCallback(
    async (data: MetadataForm) => {
      if (!dialogState) return;

      setIsLoading(true);
      try {
        if (dialogState.mode === "create") {
          if (!dialogState.pendingParams) {
            throw new Error("Widget params not available");
          }
          await createWidgetWithMetadata(
            dialogState.pendingParams as CreateWidgetParams,
            {
              name: data.name,
              description: data.description || data.name,
            },
          );
        } else if (dialogState.mode === "update") {
          const { widgetId, widgetUuid } = dialogState;
          if (!(widgetId && widgetUuid)) {
            throw new Error("Widget information not available");
          }

          const widgetInfo = processWidgetId(widgetId);

          const widgetMetadata = {
            name: data.name,
            description: data.description,
            category: data.category,
            subCategory: data.subCategory,
            source: data.source,
          } as WidgetMetadataItem;

          const result = await patchWidgetMetadata(widgetMetadata, widgetInfo.uuid);

          if (!result.success) {
            throw new Error("Failed to update widget metadata");
          }

          dispatchUpdateWidget(widgetUuid, (prev) => ({
            ...prev,
            name: data.name,
            description: data.description,
            category: data.category,
            subCategory: data.subCategory,
            source: data.source as typeof prev.source,
          }));

          toast.success("Widget metadata updated");
        }

        closeDialog();
      } catch (error) {
        console.error("Error in metadata dialog:", error);
        toast.error(
          dialogState.mode === "create"
            ? "Failed to create widget"
            : "Failed to update metadata",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dialogState, createWidgetWithMetadata, closeDialog],
  );

  if (!dialogState) return null;

  const isCreateMode = dialogState.mode === "create";
  const title = isCreateMode ? "Create widget" : "Edit widget metadata";
  const description = isCreateMode
    ? "Enter the metadata for your new widget."
    : "By editing the metadata, you will help OpenBB Copilot better understand your widget.";

  return (
    <BaseDialog open={!!dialogState} onClose={closeDialog}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="mb-4 flex flex-col gap-2">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => <FormInput label="Name" {...field} />}
            />
            <FormField
              name="description"
              control={form.control}
              render={({ field }) => (
                <FormTextarea
                  label={
                    <p>
                      Description
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  {...field}
                />
              )}
            />
            <FormField
              name="category"
              control={form.control}
              render={({ field }) => (
                <FormSelect
                  label={
                    <p>
                      Category
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  options={CATEGORY_OPTIONS}
                  {...field}
                />
              )}
            />
            <FormField
              name="subCategory"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label={
                    <p>
                      Sub Category
                      <span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  {...field}
                />
              )}
            />
            <FormField
              name="source"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label={
                    <p>
                      Source<span className="text-[#5A5961] italic"> (optional)</span>
                    </p>
                  }
                  {...field}
                />
              )}
            />
          </div>
          <DialogFooter>
            <Button variant="outlined" size="sm" type="button" onClick={closeDialog}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={isLoading}>
              {isCreateMode ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </BaseDialog>
  );
}
