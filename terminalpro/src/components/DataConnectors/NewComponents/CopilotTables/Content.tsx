import { zodResolver } from "@hookform/resolvers/zod";
import { forwardRef, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { getWidgetMetadata, patchWidgetMetadata } from "~/api/auth.api";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { FormTextarea } from "~/components/ds/atoms/TextArea";
import { Form, FormField } from "~/components/ds/molecules/Form";
import { useShallowAppStore } from "~/lib/state/app";
import { useBackendConnectorStore } from "~/lib/state/backendConnector";
import { CATEGORY_OPTIONS } from "../../common/helpers";
import { useDataConnectorContext } from "../../Providers/DataConnectorContext";

const CopilotTableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  source: z.string().optional(),
});

type CopilotTableFormData = z.infer<typeof CopilotTableSchema>;

type CopilotTableFormProps = {
  initialValues: CopilotTableFormData;
  onChange: (data: CopilotTableFormData) => void;
};

const CopilotTableForm = forwardRef<HTMLFormElement, CopilotTableFormProps>(
  (props, _ref) => {
    const { initialValues, onChange } = props;
    const form = useForm<CopilotTableFormData>({
      resolver: zodResolver(CopilotTableSchema),
      defaultValues: initialValues,
      mode: "onChange",
    });

    useEffect(() => {
      const subscription = form.watch((value) => {
        onChange(value as CopilotTableFormData);
      });
      return () => subscription.unsubscribe();
    }, [form, onChange]);

    return (
      <Form {...form}>
        <form className="space-y-2.5">
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => (
              <FormInput
                label="Name"
                placeholder="e.g. Financial Analysis"
                {...field}
                onChange={(value) => {
                  form.setValue("name", value?.toString(), { shouldValidate: true });
                }}
              />
            )}
          />
          <FormField
            name="description"
            control={form.control}
            render={({ field }) => (
              <FormTextarea
                label="Description"
                placeholder="Description of your Copilot Table"
                {...field}
                rows={3}
              />
            )}
          />
          <FormField
            name="category"
            control={form.control}
            render={({ field }) => (
              <FormSelect label="Category" options={CATEGORY_OPTIONS} {...field} />
            )}
          />
          <FormField
            name="subCategory"
            control={form.control}
            render={({ field }) => (
              <FormInput label="Sub-category" placeholder="Analysis" {...field} />
            )}
          />
          <FormField
            name="source"
            control={form.control}
            render={({ field }) => (
              <FormInput label="Source" placeholder="OpenBB" {...field} />
            )}
          />
        </form>
      </Form>
    );
  },
);

export default function CopilotTableContent() {
  const { setWidgetMetadata, getWidgetMetadataById } = useBackendConnectorStore();
  const { getWidgetsByAttribute, updateWidget } = useShallowAppStore((s) => ({
    getWidgetsByAttribute: s.getWidgetsByAttribute,
    updateWidget: s.updateWidget,
  }));
  const { setOpen, mode, id } = useDataConnectorContext();

  const metadata = useMemo(() => {
    return getWidgetMetadataById(id);
  }, [id]);

  const [tableData, setTableData] = useState<CopilotTableFormData>({
    name: metadata?.name,
    description: metadata?.description,
    category: metadata?.category,
    subCategory: metadata?.subCategory,
    source: metadata?.source,
  });

  const enableSubmit = useMemo(() => {
    return CopilotTableSchema.safeParse(tableData).success;
  }, [tableData]);

  const onSubmit = useCallback(async () => {
    try {
      const widgetMetadata = {
        widgetId: id,
        widgetType: "copilot_table" as const,
        name: tableData.name,
        description: tableData.description ?? "",
        category: tableData.category ?? "",
        subCategory: tableData.subCategory ?? "",
        source: tableData.source ?? "",
      };

      const result = await patchWidgetMetadata(widgetMetadata, id);

      if (result.success) {
        const updatedMetadata = await getWidgetMetadata();
        setWidgetMetadata(updatedMetadata);

        const identifier = `copilot_table-${id}`;
        const selectedWidgets = getWidgetsByAttribute("widgetId", identifier);

        for (const [dashId, widgets] of Object.entries(selectedWidgets)) {
          for (const widget of widgets) {
            updateWidget(dashId, {
              ...widget,
              name: widgetMetadata.name,
              description: widgetMetadata.description,
              category: widgetMetadata.category,
              subCategory: widgetMetadata.subCategory,
              source: widgetMetadata.source,
            });
          }
        }

        toast.success("Widget updated successfully");
        setOpen(false);
      } else {
        toast.error("Failed to update widget");
      }
    } catch (error) {
      console.error("Error updating widget:", error);
      toast.error("An error occurred while updating the widget");
    }
  }, [id, tableData, setOpen]);

  return (
    <>
      <div className="bg-light-100 mb-2 p-4 dark:bg-dark-700 rounded-br rounded-tr rounded-bl">
        <CopilotTableForm
          initialValues={tableData}
          onChange={(data) => setTableData(data)}
        />
      </div>
      <div className="self-end mt-auto">
        <Button size="sm" onClick={onSubmit} disabled={!enableSubmit}>
          Update
        </Button>
      </div>
    </>
  );
}
