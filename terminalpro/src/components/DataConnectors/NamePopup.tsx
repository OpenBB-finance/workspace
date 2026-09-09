import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { DBType } from "~/api/dataConnectors";
import { CATEGORY_OPTIONS } from "~/components/DataConnectors/common/helpers";
import { useShallowDataConnectorStore } from "~/lib/state/dataConnector";
import { getActiveItem } from "~/utils/dataConnectorsHelpers";
import { MetadataSchema } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { FormSelect } from "../ds/atoms/Select";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";
import { Form, FormField } from "../ds/molecules/Form";
import { useWidgetContext } from "../Widget.context";

const SaveAsSchema = z
  .object({
    name: z.string().min(1, "This field is required"),
  })
  .merge(MetadataSchema);

export type TSaveAs = z.infer<typeof SaveAsSchema>;

export function NamePopup({
  open,
  setOpen,
  setOpenParent,
  onSaveAs,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  setOpenParent: (value: boolean) => void;
  onSaveAs: (values: TSaveAs) => Promise<boolean>;
}) {
  const widget = useWidgetContext()?.widget;
  const dbType = widget.connectionType as DBType;

  const getDatabases = useShallowDataConnectorStore(
    (authState) => authState.getDatabases,
  );

  const activeItem = useMemo(() => {
    const dbs = getDatabases(dbType);
    const pk = widget.widgetId.replace(/[^0-9]/g, "");

    return getActiveItem(dbs, dbType, Number.parseInt(pk, 10), true);
  }, [getDatabases(dbType)]);

  const [loading, setLoading] = useState(false);
  const form = useForm<TSaveAs>({
    resolver: zodResolver(SaveAsSchema),
    defaultValues: {
      // Don't set the name or query if were creating a new one
      name: "",
      category: activeItem?.category || undefined,
      sub_category: activeItem?.subCategory || "",
      description: activeItem?.description || "",
    },
  });

  const handleSubmit = useCallback(
    async (values: TSaveAs) => {
      setLoading(true);
      const response = await onSaveAs(values);
      // We only want to close the main page if the save was successful
      if (response) {
        setOpenParent(false);
      }
      setOpen(false);
      setLoading(false);
    },
    [onSaveAs, setOpen, setOpenParent],
  );

  return (
    <BaseDialog open={open} onClose={() => setOpen(false)}>
      <DialogTitle>Save New Widget</DialogTitle>
      <Form {...form}>
        <form
          className="my-4 flex flex-col gap-4 text-xs text-z dark:text-[#8A8A90]"
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <FormField
            name="name"
            control={form.control}
            render={({ field }) => {
              return (
                <FormInput label="Name" placeholder="Enter widget name" {...field} />
              );
            }}
          />
          <FormField
            name="category"
            control={form.control}
            render={({ field }) => (
              <FormSelect
                label={
                  <p>
                    Category<span className="text-[#5A5961]"> (optional)</span>
                  </p>
                }
                options={CATEGORY_OPTIONS}
                {...field}
              />
            )}
          />
          <FormField
            name="sub_category"
            render={({ field }) => (
              <FormInput
                label={
                  <p>
                    Sub Category<span className="text-[#5A5961]"> (optional)</span>
                  </p>
                }
                placeholder="e.g. Fundamental Analysis"
                {...field}
              />
            )}
          />
          <FormField
            name="description"
            render={({ field }) => (
              <FormInput
                label={
                  <p>
                    Description<span className="text-[#5A5961]"> (optional)</span>
                  </p>
                }
                placeholder="e.g. The top 10 CEOs by salary for 2015"
                {...field}
              />
            )}
          />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)} size="sm">
              Cancel
            </Button>
            <Button variant="primary" className="ml-2" loading={loading} size="sm">
              Create
            </Button>
          </div>
        </form>
      </Form>
    </BaseDialog>
  );
}
