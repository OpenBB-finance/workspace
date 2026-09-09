import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import ErrorContent from "~/components/Forms/Error";
import { type resetForm, resetSchema } from "~/utils/zodForms";
import { Button } from "../ds/atoms/Button";
import { FormInput } from "../ds/atoms/Input";
import { BaseDialog } from "../ds/dialogs/BaseDialog";
import { DialogTitle } from "../ds/dialogs/Dialog";
import { Form, FormField } from "../ds/molecules/Form";

export function PasswordUpdateDialog({
  open,
  setOpen,
  handleSubmit,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  handleSubmit: (open: string) => Promise<number>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = useCallback(
    async (values: resetForm) => {
      setLoading(true);
      const statusCode = await handleSubmit(values.password);

      switch (statusCode) {
        case 200:
          setOpen(false);
          break;
        case 401:
          setError("Invalid password submitted.");
          break;
        default:
          setError("An unknown error occurred.");
          break;
      }

      setLoading(false);
    },
    [handleSubmit, setOpen],
  );

  return (
    <BaseDialog open={open} className="[&>.DialogXButton]:hidden">
      <DialogTitle>Update Password</DialogTitle>
      <div className="text-sm text-ds-text-body">
        Please enter your new password below.
      </div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full mx-auto md:w-[408px]"
        >
          <div className="my-4">
            <FormField
              name="password"
              render={({ field }) => (
                <FormInput
                  type="password"
                  label="New Password"
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                  {...field}
                />
              )}
            />
          </div>
          <FormField
            name="confirm"
            render={({ field }) => (
              <FormInput
                type="password"
                label="Confirm Password"
                placeholder="Confirm your new password"
                autoComplete="new-password"
                {...field}
              />
            )}
          />
          <ErrorContent text={error} />
          <div className="mt-6 flex justify-end">
            <Button variant="primary" type="submit" size="sm" disabled={loading}>
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </BaseDialog>
  );
}
