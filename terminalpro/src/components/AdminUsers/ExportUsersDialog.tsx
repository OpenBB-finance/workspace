import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import AdminDialogFooter from "~/components/AdminUsers/common/AdminDialogFooter";
import {
  buildUserExportRows,
  exportUsersToFile,
} from "~/components/AdminUsers/exportUsers";
import type { User } from "~/types/user.type";
import { FormInput } from "../ds/atoms/Input";
import { RadioGroup, RadioGroupItem } from "../ds/atoms/RadioGroup";
import { BaseDialog, type BaseDialogProps } from "../ds/dialogs/BaseDialog";
import { DialogHeader, DialogTitle } from "../ds/dialogs/Dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "../ds/molecules/Form";

const formSchema = z.object({
  fileName: z.string().min(1),
  format: z.enum(["csv", "xls"]),
});

type TForm = z.infer<typeof formSchema>;

interface Props extends BaseDialogProps {
  /** All currently-displayed (filtered) rows — exported when nothing is selected. */
  rows: User[];
  selectedRows: User[];
  entityNameMap: Map<string, string>;
  userRolesMap: Map<string, string[]>;
}

export default function ExportUsersDialog(props: Props) {
  const { open, onClose, rows, selectedRows, entityNameMap, userRolesMap } = props;

  const title = selectedRows.length
    ? `Export ${selectedRows.length} users`
    : "Export Users";

  const form = useForm<TForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { fileName: "", format: "xls" },
  });

  async function handleSubmit(values: TForm) {
    const toExport = selectedRows.length ? selectedRows : rows;
    try {
      const exportRows = buildUserExportRows(toExport, entityNameMap, userRolesMap);
      await exportUsersToFile(exportRows, values.fileName, values.format);
    } catch {
      toast.error("Failed to export users");
    }
    onClose();
  }

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      className="max-w-xs lg:max-w-md"
      modal={true}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-6"
        >
          <DialogHeader>
            <DialogTitle className="body-sm-bold!">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-[20px] pb-[10px]">
            <FormField
              name="fileName"
              control={form.control}
              render={({ field }) => (
                <FormInput placeholder="openbb_pro_users" label="Save as" {...field} />
              )}
            />

            <FormField
              name="format"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Export as</FormLabel>
                  <FormControl>
                    <RadioGroup
                      className="flex flex-col gap-[10px]"
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <RadioGroupItem value="xls" label="XLS" />
                      <RadioGroupItem value="csv" label="CSV" />
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <AdminDialogFooter
            primaryButtonName="Download"
            primaryButtonDisabled={!form.formState.isValid}
          />
        </form>
      </Form>
    </BaseDialog>
  );
}
