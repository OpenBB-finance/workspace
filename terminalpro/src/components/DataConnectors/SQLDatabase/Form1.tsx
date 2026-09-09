import { useCallback, useState } from "react";
import { toast } from "sonner";
import { getServerDatabases } from "~/api/dataConnectors";
import { Button } from "~/components/ds/atoms/Button";
import { FormInput } from "~/components/ds/atoms/Input";
import { FormSelect } from "~/components/ds/atoms/Select";
import { Form, FormField } from "~/components/ds/molecules/Form";
import type { Form1Type } from "~/utils/dataConnectorsHelpers";
import type { SQLIntroForm } from "~/utils/zodForms";

export function Form1({
  goBack,
  form,
  setItems,
  setSecondPage,
  error,
}: Form1Type<SQLIntroForm>) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const show = form.watch("database_type") !== "sqlite";

  const handleSubmit = useCallback(
    async (values: SQLIntroForm) => {
      setLoading(true);
      const response = await getServerDatabases("database", {
        database_type: values.database_type,
        username: "username" in values ? values.username : "SQLITE",
        password: "password" in values ? values.password : "SQLITE",
        host: "host" in values ? values.host : "SQLITE",
      });
      if (Array.isArray(response)) {
        setItems(response);
        setSecondPage(true);
      } else {
        setErrorMessage(response.detail ?? "Unexpected error occurred");
        toast.error("Error", {
          description: "Unable to add the sql database",
        });
      }
      setLoading(false);
    },
    [setItems, setSecondPage],
  );

  return (
    <Form {...form}>
      <form
        className="h-full flex flex-col gap-2 text-xs text-[#A2A2A2] dark:text-[#8A8A90]"
        onSubmit={form.handleSubmit(handleSubmit)}
      >
        <FormField
          name="database_type"
          control={form.control}
          render={({ field }) => (
            <FormSelect
              label="Database Type"
              options={["mysql", "sqlite"]}
              {...field}
            />
          )}
        />
        {show && (
          <>
            <FormField
              name="username"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label="Username"
                  placeholder="root"
                  autoComplete="new-username"
                  {...field}
                />
              )}
            />
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormInput
                  label="Password"
                  placeholder="password"
                  autoComplete="new-password"
                  type="password"
                  {...field}
                />
              )}
            />
            <FormField
              name="host"
              control={form.control}
              render={({ field }) => (
                <FormInput label="Host" placeholder="localhost:3306" {...field} />
              )}
            />
          </>
        )}
        {errorMessage && <p className="text-red-500">{errorMessage}</p>}
        <div className="mt-auto flex gap-2.5 justify-end">
          <Button variant="outlined" size="sm" type="button" onClick={goBack}>
            Cancel
          </Button>
          <Button
            className="[&_svg]:h-4"
            disabled={error}
            type="submit"
            variant="primary"
            size="sm"
            loading={loading}
          >
            Next
          </Button>
        </div>
      </form>
    </Form>
  );
}
